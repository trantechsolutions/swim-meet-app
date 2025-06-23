import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sortable from 'sortablejs';

import useConfirm from '../hooks/useConfirm.jsx';

// Firebase Imports
import { db } from '../firebase.js'; // Use the new central file
import { collection, query, where, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, Timestamp } from "firebase/firestore";
import { ADMIN_TEAMS, STANDARD_EVENT_LIBRARY } from '../config.js';


// Component Imports
import Icon from '../components/Icon.jsx';
import AdminButton from '../components/admin/AdminButton.jsx';
import AdminInput from '../components/admin/AdminInput.jsx';
import AdminSelect from '../components/admin/AdminSelect.jsx';

// NOTE: No longer initializing firebase here

function MeetManagement({ toast, confirm, allMeets }) {
    // ... MeetManagement component logic remains the same
    const [meetName, setMeetName] = useState("");
    const [meetDate, setMeetDate] = useState("");
    const [editingMeet, setEditingMeet] = useState(null);
    const [lanesAvailable, setLanesAvailable] = useState(8); 

    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    const handleEditClick = (meet) => {
        setEditingMeet(meet);
        setMeetName(meet.name);
        setMeetDate(formatDateForInput(meet.date));
        setLanesAvailable(meet.lanesAvailable || 8);
    };

    const resetForm = () => {
        setMeetName("");
        setMeetDate("");
        setEditingMeet(null);
        setLanesAvailable(8);
    };

    const handleDeleteClick = async (meetId, meetName) => {
        const result = await confirm({
            title: 'Are you sure?',
            message: `This will permanently delete "${meetName}" and all of its scheduled events. This action cannot be undone.`,
            confirmText: 'Delete'
        });
        if (result) {
            try {
                const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetId));
                const eventDocs = await getDocs(eventsQuery);
                const batch = writeBatch(db);
                eventDocs.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(db, "meets", meetId));
                await batch.commit();
                toast.success(`"${meetName}" and all its events were deleted.`);
            } catch (error) {
                toast.error("Failed to delete meet and its events.");
                console.error("Error deleting meet:", error);
            }
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const meetPayload = {
            name: meetName,
            date: Timestamp.fromDate(new Date(meetDate + 'T00:00:00')),
            lanesAvailable: parseInt(lanesAvailable, 10) || 8
        };
        try {
            if (editingMeet) {
                await updateDoc(doc(db, "meets", editingMeet.id), meetPayload);
                toast.success("Meet updated successfully!");
            } else {
                await addDoc(collection(db, "meets"), meetPayload);
                toast.success("Meet successfully added!");
            }
            resetForm();
        } catch (error) {
            toast.error("Failed to save meet.");
        }
    };

    const handleCopyClick = async (meetToCopy) => {
        const formValues = await confirm({
            mode: 'form',
            title: `Copy Meet: ${meetToCopy.name}`,
            confirmText: 'Copy Meet',
            inputs: [
                { name: 'newName', label: 'New Meet Name', defaultValue: `Copy of ${meetToCopy.name}` },
                { name: 'newDate', label: 'New Meet Date', type: 'date', defaultValue: formatDateForInput(new Date()) },
                { name: 'lanesAvailable', label: 'Lanes Available', type: 'number', defaultValue: meetToCopy.lanesAvailable || 8 }
            ]
        });

        if (formValues) {
            const { newName, newDate, lanesAvailable } = formValues;
            if (!newName || !newDate) {
                toast.error("New meet name and date are required."); return;
            }
            try {
                const newMeetRef = await addDoc(collection(db, "meets"), { 
                    name: newName, 
                    date: Timestamp.fromDate(new Date(newDate + 'T00:00:00')),
                    lanesAvailable: parseInt(lanesAvailable, 10) || 8
                });
                const originalEventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetToCopy.id));
                const originalEventsSnap = await getDocs(originalEventsQuery);
                const originalEvents = originalEventsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
                const batch = writeBatch(db);
                originalEvents.forEach(event => {
                    const newEventRef = doc(collection(db, "meet_events"));
                    const newEventData = { ...event, meetId: newMeetRef.id, heats: [] };
                    delete newEventData.id;
                    batch.set(newEventRef, newEventData);
                });
                await batch.commit();
                toast.success(`Successfully copied meet and its schedule.`);
            } catch (error) {
                toast.error("Failed to copy meet.");
            }
        }
    };

    return (
         <>
            <h5 className="font-semibold text-lg">{editingMeet ? 'Edit Meet' : 'Create New Meet'}</h5>
            <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
                <AdminInput label="Meet Name" id="meetName" type="text" value={meetName} onChange={e => setMeetName(e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AdminInput label="Meet Date" id="meetDate" type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} />
                    <AdminInput label="Lanes Available" id="lanesAvailable" type="number" min="1" max="12" value={lanesAvailable} onChange={e => setLanesAvailable(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <AdminButton type="submit">{editingMeet ? 'Update Meet' : 'Add Meet'}</AdminButton>
                    {editingMeet && <AdminButton type="button" variant="secondary" onClick={resetForm}>Cancel</AdminButton>}
                </div>
            </form>
            <hr className="my-6 border-border-light dark:border-border-dark"/>
            <h5 className="mt-3 font-semibold text-lg">Existing Meets</h5>
             <ul className="mt-2 space-y-2">
                {allMeets.map(meet => (
                    <li key={meet.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                        <span className="font-medium">{meet.name} <span className="text-gray-500 dark:text-gray-400">({meet.date.toLocaleDateString()})</span></span>
                        <div className="flex items-center space-x-2">
                            <button className="text-blue-500 hover:text-blue-700" onClick={() => handleCopyClick(meet)} title="Copy"><Icon name="copy"/></button>
                            <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEditClick(meet)} title="Edit"><Icon name="pencil-alt"/></button>
                            <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(meet.id, meet.name)} title="Delete"><Icon name="trash"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

function EventLibraryManagement({ toast, confirm, adminRole }) {
    // ... EventLibraryManagement component logic remains the same
    const [eventName, setEventName] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
        const libraryRef = collection(db, "event_library");
        const unsubscribe = onSnapshot(libraryRef, (snapshot) => {
            const templates = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b) => a.name.localeCompare(b.name));
            setEventLibrary(templates);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setEventName("");
        setEditingEvent(null);
    }
    const handleEditClick = (event) => {
        setEditingEvent(event);
        setEventName(event.name);
    }
    const handleRemoveClick = async (eventId, eventName) => {
        if (await confirm('Are you sure?', `This will permanently delete "${eventName}" from the Event Library.`)) {
             try {
                await deleteDoc(doc(db, "event_library", eventId));
                toast.success("Library event deleted successfully.");
            } catch (error) {
                 toast.error("Error deleting library event.");
            }
        }
    }
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!eventName.trim()) {
            toast.warning("Event name cannot be empty."); return;
        }
        try {
            if(editingEvent) {
                await updateDoc(doc(db, "event_library", editingEvent.id), { name: eventName });
                toast.success("Library event updated successfully.");
            } else {
                await addDoc(collection(db, "event_library"), { name: eventName });
                toast.error("Library event created successfully.");
            }
            resetForm();
        } catch (error) {
            showNotification("Error saving library event.", "danger");
        }
    };
    const handleBulkLoad = async () => {
        const result = await Swal.fire({
            title: 'Bulk Load Events?',
            text: "This will add any missing standard events to the library. It will not create duplicates.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, load them!'
        });
        if (!result.isConfirmed) return;

        if (typeof STANDARD_EVENT_LIBRARY === 'undefined' || !Array.isArray(STANDARD_EVENT_LIBRARY)) {
            showNotification("Standard event library is not defined in config.js.", "danger");
            return;
        }

        const existingEventNames = new Set(eventLibrary.map(t => t.name));
        const eventsToAdd = STANDARD_EVENT_LIBRARY.filter(name => !existingEventNames.has(name));
        
        if (eventsToAdd.length === 0) {
            showNotification("All standard library events already exist.", "info");
            return;
        }

        showNotification(`Adding ${eventsToAdd.length} new library events...`, "info");
        const batch = writeBatch(db);
        eventsToAdd.forEach(name => {
            const newDocRef = doc(collection(db, "event_library"));
            batch.set(newDocRef, { name });
        });
        
        try {
            await batch.commit();
            showNotification("Bulk load complete!", "success");
        } catch (error) {
            showNotification("An error occurred during bulk load.", "danger");
            console.error("Bulk load error:", error);
        }
    };

    return (
        <>
            <h5 className="font-semibold text-lg">Event Library</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create a master list of reusable event types.</p>
            {adminRole === 'SUPERADMIN' && (
                <div className="my-4 space-y-4">
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <AdminInput
                            label={editingEvent ? 'Edit Event Name' : 'New Event Name'}
                            id="libraryEventName"
                            type="text"
                            value={eventName}
                            onChange={e => setEventName(e.target.value)}
                            placeholder="e.g., Girls 9-10 50m Freestyle"
                        />
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             <AdminButton type="submit">{editingEvent ? 'Update Event' : 'Create Event'}</AdminButton>
                             {editingEvent && <AdminButton type="button" variant="secondary" onClick={resetForm}>Cancel</AdminButton>}
                        </div>
                    </form>
                    <AdminButton variant="outline" onClick={handleBulkLoad}>Bulk Load Standard Events</AdminButton>
                </div>
            )}
            <hr className="my-6 border-border-light dark:border-border-dark"/>
            <h5 className="mt-3 font-semibold text-lg">Existing Library Events</h5>
            <ul className="mt-2 space-y-2">
                {eventLibrary.map(event => (
                    <li key={event.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                        <span className="font-medium">{event.name}</span>
                        {adminRole === 'SUPERADMIN' && (
                            <div className="flex items-center space-x-2">
                                <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEditClick(event)} title="Edit"><Icon name="pencil-alt"/></button>
                                <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveClick(event.id, event.name)} title="Delete"><Icon name="trash"/></button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}

function ScheduleManagement({ toast, confirm, allMeets }) {
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [scheduledEvents, setScheduledEvents] = useState([]);
    
    const [selectedLibraryEvents, setSelectedLibraryEvents] = useState(new Set());
    const [selectedScheduledEvents, setSelectedScheduledEvents] = useState(new Set());

    // NEW: State to manage which event is being edited
    const [editingEventId, setEditingEventId] = useState(null);
    const [editingEventNumber, setEditingEventNumber] = useState('');

    const scheduleListRef = useRef(null);
    const sortableInstance = useRef(null);

    // --- Data Fetching and Drag-and-Drop useEffects (unchanged) ---
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "event_library"), (snapshot) => {
            const library = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
            setEventLibrary(library);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedMeetId) {
            setScheduledEvents([]);
            return;
        }
        const q = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b)=> a.eventNumber - b.eventNumber);
            setScheduledEvents(events);
        }, (error) => {
            showNotification("Could not load schedule.", "danger");
        });
        return () => unsubscribe();
    }, [selectedMeetId]);

    useEffect(() => {
        if (scheduleListRef.current) {
            if (sortableInstance.current) sortableInstance.current.destroy();
            sortableInstance.current = new Sortable(scheduleListRef.current, {
                animation: 150,
                // Disable drag-and-drop while an item is being edited
                disabled: !!editingEventId, 
                onEnd: async (evt) => {
                    const { oldIndex, newIndex } = evt;
                    if (oldIndex === newIndex) return;
                    const reordered = [...scheduledEvents];
                    const [movedItem] = reordered.splice(oldIndex, 1);
                    reordered.splice(newIndex, 0, movedItem);
                    
                    const batch = writeBatch(db);
                    reordered.forEach((event, index) => {
                        batch.update(doc(db, "meet_events", event.id), { eventNumber: index + 1 });
                    });
                    try {
                        await batch.commit();
                        showNotification("Event order updated.", "success");
                    } catch (error) {
                        showNotification("Failed to update event order.", "danger");
                    }
                },
            });
        }
    }, [scheduledEvents, editingEventId]); // Re-initialize when editing state changes

    // --- Selection and Event Handling Logic ---
    const handleToggleSelection = (id, type) => {
        const updater = type === 'library' ? setSelectedLibraryEvents : setSelectedScheduledEvents;
        updater(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const availableLibraryEvents = useMemo(() => {
        const scheduledNames = new Set(scheduledEvents.map(e => e.name));
        return eventLibrary.filter(e => !scheduledNames.has(e.name));
    }, [eventLibrary, scheduledEvents]);

    const handleAddEvents = async (idsToAdd) => {
        // ... (this function is unchanged)
        if (!selectedMeetId || idsToAdd.length === 0) return;
        const eventsData = idsToAdd.map((id, index) => {
            const libraryEvent = eventLibrary.find(e => e.id === id);
            return { meetId: selectedMeetId, libraryEventId: libraryEvent.id, name: libraryEvent.name, eventNumber: scheduledEvents.length + 1 + index, heats: [] };
        });
        const batch = writeBatch(db);
        eventsData.forEach(eventData => batch.set(doc(collection(db, "meet_events")), eventData));
        try {
            await batch.commit();
            showNotification(`${eventsData.length} event(s) added successfully.`, "success");
            setSelectedLibraryEvents(new Set());
        } catch (error) {
            showNotification("Error adding events.", "danger");
        }
    };
    
    const handleRemoveEvents = async (idsToRemove) => {
        // ... (this function is unchanged)
        if (!selectedMeetId || idsToRemove.length === 0) return;
        const result = await Swal.fire({ title: 'Are you sure?', text: `This will remove ${idsToRemove.length} event(s) from this meet's schedule.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, remove them' });
        if (result.isConfirmed) {
            const batch = writeBatch(db);
            idsToRemove.forEach(id => batch.delete(doc(db, "meet_events", id)));
            const remainingEvents = scheduledEvents.filter(e => !idsToRemove.includes(e.id)).sort((a,b) => a.eventNumber - b.eventNumber);
            remainingEvents.forEach((event, index) => batch.update(doc(db, "meet_events", event.id), { eventNumber: index + 1 }));
            try {
                await batch.commit();
                showNotification("Selected events removed.", "success");
                setSelectedScheduledEvents(new Set());
            } catch (error) {
                showNotification("Failed to remove events.", "danger");
            }
        }
    };

    const handleAddAll = () => {
        // ... (this function is unchanged)
        const scheduledNames = new Set(scheduledEvents.map(e => e.name));
        const libraryEventsToAdd = STANDARD_EVENT_LIBRARY.map(name => eventLibrary.find(e => e.name === name)).filter(event => event && !scheduledNames.has(event.name));
        const idsToAdd = libraryEventsToAdd.map(e => e.id);
        handleAddEvents(idsToAdd);
    };

    const handleRemoveAll = async () => {
        // ... (this function is unchanged)
        if (scheduledEvents.length === 0) return;
        const result = await Swal.fire({ title: 'Are you sure?', text: "This will remove ALL events from this meet's schedule. This action cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, clear the schedule!' });
        if (result.isConfirmed) {
            const batch = writeBatch(db);
            scheduledEvents.forEach(event => batch.delete(doc(db, "meet_events", event.id)));
            try {
                await batch.commit();
                showNotification("Complete schedule has been cleared.", "success");
                setSelectedScheduledEvents(new Set());
            } catch (error) {
                showNotification("Failed to clear schedule.", "danger");
            }
        }
    };

    // --- NEW: Functions to handle inline editing of event numbers ---
    const handleStartEdit = (event) => {
        setEditingEventId(event.id);
        setEditingEventNumber(event.eventNumber);
    };

    const handleCancelEdit = () => {
        setEditingEventId(null);
        setEditingEventNumber('');
    };
    
    const handleConfirmEdit = async () => {
        const eventIdToUpdate = editingEventId;
        const newNumber = parseInt(editingEventNumber, 10);

        if (isNaN(newNumber) || newNumber < 1 || newNumber > scheduledEvents.length) {
            showNotification(`Please enter a valid event number between 1 and ${scheduledEvents.length}.`, 'warning');
            return;
        }

        const list = [...scheduledEvents];
        const eventToMove = list.find(e => e.id === eventIdToUpdate);
        if (!eventToMove) return;

        const oldIndex = list.findIndex(e => e.id === eventIdToUpdate);
        list.splice(oldIndex, 1); // Remove item from its old position
        list.splice(newNumber - 1, 0, eventToMove); // Insert item at its new position

        const batch = writeBatch(db);
        list.forEach((event, index) => {
            batch.update(doc(db, "meet_events", event.id), { eventNumber: index + 1 });
        });

        try {
            await batch.commit();
            showNotification("Event number updated successfully.", "success");
            handleCancelEdit(); // Exit editing mode
        } catch (error) {
            showNotification("Failed to update event number.", "danger");
        }
    };

    return (
        <>
            <h5 className="font-semibold text-lg">Manage a Meet's Schedule</h5>
            <div className="my-4">
                <AdminSelect label="1. Select Meet to Manage" id="meetSelectForSchedule" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                    <option value="" disabled>-- Choose a meet --</option>
                    {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
                </AdminSelect>
            </div>
            
            {selectedMeetId && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center mt-4">
                    {/* Panel 1: Available Events Library */}
                    <div className="border border-border-light dark:border-border-dark rounded-lg p-3">
                        <h6 className="font-semibold mb-2">Event Library ({availableLibraryEvents.length})</h6>
                        <ul className="h-64 overflow-y-auto space-y-1">
                            {availableLibraryEvents.map(event => (
                                <li key={event.id} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                                    <input type="checkbox" id={`lib-${event.id}`} checked={selectedLibraryEvents.has(event.id)} onChange={() => handleToggleSelection(event.id, 'library')} />
                                    <label htmlFor={`lib-${event.id}`} className="flex-grow cursor-pointer">{event.name}</label>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Panel 2: Action Buttons */}
                    <div className="flex flex-row md:flex-col gap-2 justify-center">
                        <AdminButton onClick={handleAddAll} title="Add All"><Icon name="angle-double-right" /></AdminButton>
                        <AdminButton onClick={() => handleAddEvents(Array.from(selectedLibraryEvents))} title="Add Selected"><Icon name="angle-right" /></AdminButton>
                        <AdminButton onClick={() => handleRemoveEvents(Array.from(selectedScheduledEvents))} title="Remove Selected"><Icon name="angle-left" /></AdminButton>
                        <AdminButton onClick={handleRemoveAll} title="Remove All"><Icon name="angle-double-left" /></AdminButton>
                    </div>

                    {/* Panel 3: Scheduled Events (with new edit UI) */}
                    <div className="border border-border-light dark:border-border-dark rounded-lg p-3">
                         <h6 className="font-semibold mb-2">Scheduled Events ({scheduledEvents.length})</h6>
                         <ul className="h-64 overflow-y-auto space-y-1" ref={scheduleListRef}>
                            {scheduledEvents.map(event => (
                                <li key={event.id} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" data-id={event.id}>
                                    <input type="checkbox" id={`sch-${event.id}`} checked={selectedScheduledEvents.has(event.id)} onChange={() => handleToggleSelection(event.id, 'schedule')} disabled={!!editingEventId} />
                                    
                                    {editingEventId === event.id ? (
                                        <> {/* -- Edit State UI -- */}
                                            <input
                                                type="number"
                                                className="w-16 p-1 text-center rounded-md border border-primary bg-surface-light dark:bg-surface-dark"
                                                value={editingEventNumber}
                                                onChange={(e) => setEditingEventNumber(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleConfirmEdit();
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                autoFocus
                                            />
                                            <span className="flex-grow">{event.name}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={handleConfirmEdit} title="Save" className="text-green-500 hover:text-green-700"><Icon name="check"/></button>
                                                <button onClick={handleCancelEdit} title="Cancel" className="text-red-500 hover:text-red-700"><Icon name="times"/></button>
                                            </div>
                                        </>
                                    ) : (
                                        <> {/* -- Display State UI -- */}
                                            <label htmlFor={`sch-${event.id}`} className="flex-grow cursor-grab"><strong className="mr-2 w-8 inline-block text-center">E{event.eventNumber}:</strong>{event.name}</label>
                                            <div className="ml-auto">
                                                <button onClick={() => handleStartEdit(event)} title="Edit Number" className="text-gray-500 hover:text-gray-700"><Icon name="pencil-alt" /></button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
}

function RosterManagement({ toast, confirm, adminRole }) {
    // ... RosterManagement component logic, with handleRemoveClick corrected
    const isSuperAdmin = adminRole === 'SUPERADMIN';
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [swimmerForm, setSwimmerForm] = useState({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });
    const allTeams = useMemo(() => Object.values(ADMIN_TEAMS).filter(r => r !== 'SUPERADMIN').sort(), []);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (managingTeam) {
            const unsubscribe = onSnapshot(doc(db, 'rosters', managingTeam), (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers || [] : []);
            });
            return () => unsubscribe();
        } else {
            setRoster([]);
        }
    }, [managingTeam]);
    
    const resetForm = () => setSwimmerForm({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const { id, firstName, lastName, age, gender } = swimmerForm;
        if (!firstName.trim() || !lastName.trim() || !age || !managingTeam) {
            showNotification("Please select a team and fill out all swimmer fields.", "warning"); return;
        }
        let newRoster = id ? roster.map(s => s.id === id ? { ...s, firstName, lastName, age: parseInt(age), gender } : s)
                          : [...roster, { id: crypto.randomUUID(), firstName, lastName, age: parseInt(age), gender }];
        
        await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster }, { merge: true });
        showNotification(`Swimmer ${id ? 'updated' : 'added'} successfully!`, "success");
        resetForm();
    };
    const handleEditClick = (swimmer) => setSwimmerForm(swimmer);

    // FIXED: This function now only removes the swimmer from the roster
    // and correctly warns the user about the scope of the action.
    const handleRemoveClick = async (swimmerToRemove) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This removes ${swimmerToRemove.firstName} from the team roster. It does NOT remove them from any events they are already entered in.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove from roster'
        });
        if(!result.isConfirmed) return;
        
        try {
            const newRoster = roster.filter(s => s.id !== swimmerToRemove.id);
            await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster });
            showNotification("Swimmer removed from roster.", "success");
        } catch (error) {
            showNotification("Failed to remove swimmer from roster.", "danger");
            console.error("Error removing swimmer:", error);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = lines.shift().toLowerCase().split(',').map(h => h.trim());
            if (headers[0] !== 'firstname' || headers[1] !== 'lastname' || headers[2] !== 'age' || headers[3] !== 'gender') {
                showNotification("Invalid CSV headers. Must be: firstName,lastName,age,gender", "danger"); return;
            }
            const newSwimmers = lines.map(line => {
                const [firstName, lastName, age, gender] = line.split(',');
                return { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), age: parseInt(age), gender: gender.trim() };
            });
            const newRoster = [...roster, ...newSwimmers];
            await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster }, { merge: true });
            showNotification(`Bulk upload successful! Added ${newSwimmers.length} swimmers.`, "success");
            fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <>
            <h5 className="font-semibold text-lg">Manage Team Rosters</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add or view swimmers for a specific team.</p>
            <div className="my-4 space-y-4">
                {isSuperAdmin && (
                    <AdminSelect label="1. Select Team" id="teamSelectRoster" value={managingTeam || ""} onChange={e => setManagingTeam(e.target.value)}>
                        <option value="" disabled>-- Choose a Team --</option>
                        {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
                    </AdminSelect>
                )}
            </div>

            {managingTeam && (
                <>
                    <h6 className="font-semibold mt-6">{swimmerForm.id ? 'Edit Swimmer' : 'Add Swimmer'} to {managingTeam}</h6>
                    <form onSubmit={handleFormSubmit} className="my-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:items-end gap-3">
                        <div className="lg:flex-grow"><AdminInput label="First Name" id="swimmerFirstName" type="text" value={swimmerForm.firstName} onChange={e => setSwimmerForm({...swimmerForm, firstName: e.target.value})} /></div>
                        <div className="lg:flex-grow"><AdminInput label="Last Name" id="swimmerLastName" type="text" value={swimmerForm.lastName} onChange={e => setSwimmerForm({...swimmerForm, lastName: e.target.value})} /></div>
                        <div className="lg:w-20"><AdminInput label="Age" id="swimmerAge" type="number" value={swimmerForm.age} onChange={e => setSwimmerForm({...swimmerForm, age: e.target.value})} /></div>
                        <div className="lg:w-28"><AdminSelect label="Gender" id="swimmerGender" value={swimmerForm.gender} onChange={e => setSwimmerForm({...swimmerForm, gender: e.target.value})}>
                            <option value="Boy">Boy</option><option value="Girl">Girl</option>
                         </AdminSelect></div>
                        <div className="flex space-x-2 pt-5 lg:pt-0">
                           <AdminButton type="submit" className="flex-1">{swimmerForm.id ? 'Update' : 'Add'}</AdminButton>
                           {swimmerForm.id && <AdminButton type="button" variant="secondary" onClick={resetForm} className="flex-1">Cancel</AdminButton>}
                        </div>
                    </form>

                     <div className="mt-6">
                         <label htmlFor="csvUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bulk Upload Roster (CSV)</label>
                         <input type="file" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" id="csvUpload" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} />
                         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Format: firstName,lastName,age,gender (with header row)</p>
                     </div>

                     <hr className="my-6 border-border-light dark:border-border-dark"/>
                     <h6 className="font-semibold text-lg mt-3">Team Roster for {managingTeam}</h6>
                     <ul className="mt-2 space-y-2">
                        {roster.length > 0 ? roster.map(swimmer => (
                            <li key={swimmer.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                                <span className="font-medium">{swimmer.firstName} {swimmer.lastName} (Age: {swimmer.age}, {swimmer.gender})</span>
                                <div className="flex items-center space-x-2">
                                    <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEditClick(swimmer)} title="Edit"><Icon name="pencil-alt"/></button>
                                    <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveClick(swimmer)} title="Delete"><Icon name="trash"/></button>
                                </div>
                            </li>
                        )) : <li className="p-3 text-center text-gray-500 dark:text-gray-400">No swimmers on this roster yet.</li>}
                    </ul>
                </>
            )}
        </>
    );
}

function EntryManagement({ adminRole, allMeets, showNotification, selectedMeet }) {
    const isSuperAdmin = adminRole === 'SUPERADMIN';
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [selectedSwimmerId, setSelectedSwimmerId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [entryDetails, setEntryDetails] = useState({ heat: '', lane: '' });
    const [eventsForMeet, setEventsForMeet] = useState([]);
    const [currentEntries, setCurrentEntries] = useState([]);
    const [editingEntry, setEditingEntry] = useState(null);
    
    const selectedSwimmer = roster.find(s => s.id === selectedSwimmerId);
    const allTeams = useMemo(() => Object.values(ADMIN_TEAMS).filter(r => r !== 'SUPERADMIN').sort(), []);

    const eligibleEvents = useMemo(() => {
        if (!selectedSwimmer || !eventsForMeet) return [];
        const getEventAgeAndGender = (eventName) => {
            const nameLower = eventName.toLowerCase();
            const gender = nameLower.startsWith('girls') ? 'Girl' : nameLower.startsWith('boys') ? 'Boy' : 'Mixed';
            const ageMatch = eventName.match(/(\d+)(-(\d+))?(\s*&\s*Under)?/);
            if (!ageMatch) return { minAge: 0, maxAge: 100, gender };
            if (ageMatch[4]) return { minAge: 0, maxAge: parseInt(ageMatch[1]), gender };
            if (ageMatch[3]) return { minAge: parseInt(ageMatch[1]), maxAge: parseInt(ageMatch[3]), gender };
            return { minAge: parseInt(ageMatch[1]), maxAge: parseInt(ageMatch[1]), gender };
        };
        return eventsForMeet.filter(event => {
            const { minAge, maxAge, gender } = getEventAgeAndGender(event.name);
            const isAgeEligible = selectedSwimmer.age >= minAge && selectedSwimmer.age <= maxAge;
            const isGenderEligible = gender === 'Mixed' || gender === selectedSwimmer.gender;
            return isAgeEligible && isGenderEligible;
        });
    }, [selectedSwimmer, eventsForMeet]);

    useEffect(() => {
        if (!db || !selectedMeetId) {
            setEventsForMeet([]);
            return;
        }
        const q = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEventsForMeet(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b)=>a.eventNumber-b.eventNumber));
        });
        return () => unsubscribe();
    }, [selectedMeetId]);

    useEffect(() => {
        if (managingTeam) {
            const unsubscribe = onSnapshot(doc(db, 'rosters', managingTeam), (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers || [] : []);
            });
            return () => unsubscribe();
        } else {
            setRoster([])
        }
    }, [managingTeam]);

    useEffect(() => {
        if (!eventsForMeet || eventsForMeet.length === 0) {
            setCurrentEntries([]);
            return;
        }

        let allEntries = [];
        eventsForMeet.forEach(event => {
            if (event.heats) {
                event.heats.forEach(heat => {
                    heat.lanes.forEach(lane => {
                        allEntries.push({
                            swimmerId: lane.id,
                            swimmerName: `${lane.firstName} ${lane.lastName}`,
                            team: lane.team,
                            eventId: event.id,
                            eventName: event.name,
                            eventNumber: event.eventNumber,
                            heatNumber: heat.heatNumber,
                            laneNumber: lane.lane,
                        });
                    });
                });
            }
        });

        if (!isSuperAdmin) {
            allEntries = allEntries.filter(entry => entry.team === adminRole);
        }
        
        allEntries.sort((a,b) => {
            if (a.eventNumber !== b.eventNumber) return a.eventNumber - b.eventNumber;
            return a.swimmerName.localeCompare(b.swimmerName);
        });

        setCurrentEntries(allEntries);

    }, [eventsForMeet, adminRole, isSuperAdmin]);
    
    const cancelEdit = () => {
        setEditingEntry(null);
        setSelectedSwimmerId("");
        setSelectedEventId("");
        setEntryDetails({ heat: '', lane: '' });
    };

    const handleEditEntry = (entry) => {
        setEditingEntry(entry);
        if (!isSuperAdmin) {
            setManagingTeam(entry.team);
        }
        setSelectedSwimmerId(entry.swimmerId);
        setSelectedEventId(entry.eventId);
        setEntryDetails({ heat: entry.heatNumber, lane: entry.laneNumber });
        
        const adminView = document.querySelector('.admin-view');
        if (adminView) {
            adminView.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleDeleteEntry = async (entry) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Remove ${entry.swimmerName} from E${entry.eventNumber}: ${entry.eventName}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove them!'
        });
        if (!result.isConfirmed) return;

        const eventRef = doc(db, "meet_events", entry.eventId);
        try {
            const eventDoc = eventsForMeet.find(e => e.id === entry.eventId);
            if (!eventDoc) throw new Error("Event not found");

            const newHeats = eventDoc.heats
                .map(heat => ({
                    ...heat,
                    lanes: heat.lanes.filter(lane => lane.id !== entry.swimmerId)
                }))
                .filter(heat => heat.lanes.length > 0);

            await updateDoc(eventRef, { heats: newHeats });
            showNotification("Entry deleted successfully.", "success");
        } catch (error) {
            showNotification("Failed to delete entry.", "danger");
            console.error("Error deleting entry:", error);
        }
    };

    const handleAddOrUpdateSwimmerToEvent = async () => {
        const swimmer = roster.find(s => s.id === selectedSwimmerId);
        if (!swimmer || !selectedEventId || !managingTeam || !selectedMeetId) {
            showNotification("Please select a meet, team, swimmer, and event.", "warning");
            return;
        }

        const eventRef = doc(db, "meet_events", selectedEventId);
        const eventDoc = eventsForMeet.find(e => e.id === selectedEventId);
        if (!eventDoc) return;

        let newHeats = JSON.parse(JSON.stringify(eventDoc.heats || []));

        // --- This block removes the old entry if we are in "edit mode" ---
        if (editingEntry) {
            newHeats = newHeats.map(heat => ({
                ...heat,
                lanes: heat.lanes.filter(lane => lane.id !== editingEntry.swimmerId)
            })).filter(heat => heat.lanes.length > 0);
        }
        
        const lanesAvailable = selectedMeet?.lanesAvailable || 8;

        // --- Manual Assignment Logic ---
        const manualHeat = parseInt(entryDetails.heat, 10);
        const manualLane = parseInt(entryDetails.lane, 10);

        if (manualHeat && manualLane) {
            if (manualLane > lanesAvailable) {
                showNotification(`Invalid lane. Only ${lanesAvailable} lanes are available for this meet.`, "danger");
                return;
            }

            let targetHeat = newHeats.find(h => h.heatNumber === manualHeat);
            if (!targetHeat) {
                targetHeat = { heatNumber: manualHeat, lanes: [] };
                newHeats.push(targetHeat);
            }

            const isOccupied = targetHeat.lanes.some(l => l.lane === manualLane);
            if (isOccupied) {
                showNotification(`Lane ${manualLane} in Heat ${manualHeat} is already occupied.`, "danger");
                return;
            }
            
            targetHeat.lanes.push({ ...swimmer, team: managingTeam, seedTime: "NT", lane: manualLane });

        } else {
            // --- Automatic Assignment Logic ---
            let laneAssigned = false;
            for (const heat of newHeats) {
                if (heat.lanes.length < lanesAvailable) {
                    const occupiedLanes = new Set(heat.lanes.map(l => l.lane));
                    for (let i = 1; i <= lanesAvailable; i++) {
                        if (!occupiedLanes.has(i)) {
                            heat.lanes.push({ ...swimmer, team: managingTeam, seedTime: "NT", lane: i });
                            laneAssigned = true;
                            break;
                        }
                    }
                    if (laneAssigned) break;
                }
            }

            if (!laneAssigned) {
                newHeats.push({
                    heatNumber: newHeats.length + 1,
                    lanes: [{ ...swimmer, team: managingTeam, seedTime: "NT", lane: 1 }]
                });
            }
        }
        
        newHeats.sort((a,b) => a.heatNumber - b.heatNumber);
        newHeats.forEach(heat => heat.lanes.sort((a, b) => a.lane - b.lane));

        try {
            await updateDoc(eventRef, { heats: newHeats });
            showNotification(`${swimmer.firstName} was ${editingEntry ? 'updated' : 'entered'} successfully.`, "success");
            cancelEdit();
        } catch (error) {
            showNotification(`Failed to ${editingEntry ? 'update' : 'add'} entry.`, "danger");
            console.error("Error in entry transaction:", error);
        }
    };


    return (
        <>
            <h5 className="font-semibold text-lg">{editingEntry ? 'Edit Entry' : 'Enter Swimmers into Events'}</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Assign swimmers to events for the selected meet.</p>
            <div className="my-4 space-y-4">
                <AdminSelect label="1. Select Meet" id="meetSelectEntries" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                    <option value="" disabled>-- Choose a meet --</option>
                    {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
                </AdminSelect>
                {isSuperAdmin && selectedMeetId && (
                     <AdminSelect label="2. Select Team" id="teamSelectManage" value={managingTeam || ""} onChange={e => setManagingTeam(e.target.value)}>
                        <option value="" disabled>-- Choose a Team --</option>
                        {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
                    </AdminSelect>
                )}
            </div>
            
            {managingTeam && selectedMeetId && (
                <>
                    <div className="space-y-4">
                        <AdminSelect 
                            label="3. Select Swimmer" 
                            id="swimmerSelect" 
                            value={selectedSwimmerId} 
                            onChange={e => setSelectedSwimmerId(e.target.value)}
                        >
                            <option value="" disabled>-- Choose from roster --</option>
                            {roster.map(swimmer => <option key={swimmer.id} value={swimmer.id}>{swimmer.firstName} {swimmer.lastName} (Age: {swimmer.age})</option>)}
                        </AdminSelect>
                        <AdminSelect label="4. Select Event" id="eventSelect" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} disabled={!selectedSwimmerId}>
                            <option value="" disabled>-- Choose an event --</option>
                            {eligibleEvents.map(event => <option key={event.id} value={event.id}>E{event.eventNumber} - {event.name}</option>)}
                        </AdminSelect>
                        
                        {/* Add the new optional input fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <AdminInput label="Heat (Optional)" id="heatNumber" type="number" min="1" placeholder="Auto" value={entryDetails.heat} onChange={e => setEntryDetails({...entryDetails, heat: e.target.value})} />
                            <AdminInput label="Lane (Optional)" id="laneNumber" type="number" min="1" placeholder="Auto" value={entryDetails.lane} onChange={e => setEntryDetails({...entryDetails, lane: e.target.value})} />
                        </div>
                        
                        <div className="flex space-x-2">
                           <AdminButton onClick={handleAddOrUpdateSwimmerToEvent} disabled={!selectedSwimmerId || !selectedEventId} variant="primary">
                                {editingEntry ? 'Update Entry' : 'Add Entry'}
                           </AdminButton>
                           {editingEntry && <AdminButton onClick={cancelEdit} variant="secondary">Cancel Edit</AdminButton>}
                        </div>
                    </div>
                    <hr className="my-6 border-border-light dark:border-border-dark"/>
                    <h6 className="font-semibold text-lg mt-3">Current Entries for {isSuperAdmin ? 'All Teams' : managingTeam}</h6>
                    <ul className="mt-2 space-y-2">
                        {currentEntries.length > 0 ? currentEntries.map(entry => (
                            <li key={`${entry.swimmerId}-${entry.eventId}`} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                                <div>
                                    <span className="font-semibold">{entry.swimmerName}</span> ({entry.team})
                                    <p className="text-sm text-gray-500 dark:text-gray-400">E{entry.eventNumber}: {entry.eventName}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white" onClick={() => handleEditEntry(entry)} title="Edit"><Icon name="pencil-alt"/></button>
                                    <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteEntry(entry)} title="Delete"><Icon name="trash"/></button>
                                </div>
                            </li>
                        )) : <li className="p-3 text-center text-gray-500 dark:text-gray-400">No entries found for the selected team.</li>}
                    </ul>
                </>
            )}
        </>
    );
}

function AdminView({ toast, adminRole, allMeets }) {
    const { confirm, ConfirmationModal } = useConfirm();
    const [adminSubView, setAdminSubView] = useState('meets');

    const [activeMeetId, setActiveMeetId] = useState(allMeets[0]?.id || "");
    const selectedMeetForEntries = useMemo(() => allMeets.find(meet => meet.id === activeMeetId), [allMeets, activeMeetId]);

    if (!adminRole) {
        return <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-md">You are not authorized to view this page.</div>;
    }

    const renderSubView = () => {
        const props = { toast, confirm, adminRole, allMeets, activeMeetId, setActiveMeetId, selectedMeet: selectedMeetForEntries };
        switch(adminSubView) {
            case 'meets':
                return <MeetManagement {...props} />;
            case 'library':
                return <EventLibraryManagement {...props}  />;
            case 'schedule':
                return <ScheduleManagement {...props}  />;
            case 'rosters':
                 return <RosterManagement {...props}  />;
            case 'entries':
                 return <EntryManagement {...props}  />;
            default:
                return null;
        }
    };

    return (
        <div className="admin-view">
            <h2 className="text-xl font-bold mb-3">Admin Panel</h2>
            <ConfirmationModal />
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                <li><button className={`block w-full text-center px-4 py-2 rounded-md font-semibold text-sm ${adminSubView === 'meets' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`} onClick={() => setAdminSubView('meets')}>Meets</button></li>
                <li><button className={`block w-full text-center px-4 py-2 rounded-md font-semibold text-sm ${adminSubView === 'library' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`} onClick={() => setAdminSubView('library')}>Library</button></li>
                <li><button className={`block w-full text-center px-4 py-2 rounded-md font-semibold text-sm ${adminSubView === 'schedule' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`} onClick={() => setAdminSubView('schedule')}>Schedule</button></li>
                <li><button className={`block w-full text-center px-4 py-2 rounded-md font-semibold text-sm ${adminSubView === 'rosters' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`} onClick={() => setAdminSubView('rosters')}>Rosters</button></li>
                <li><button className={`block w-full text-center px-4 py-2 rounded-md font-semibold text-sm ${adminSubView === 'entries' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`} onClick={() => setAdminSubView('entries')}>Entries</button></li>
            </ul>
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="p-4">
                    {renderSubView()}
                </div>
            </div>
        </div>
    );
}

export default AdminView;