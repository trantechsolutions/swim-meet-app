import React, { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import Sortable from 'sortablejs';

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

function MeetManagement({ showNotification, allMeets }) {
    // ... MeetManagement component logic remains the same
    const [meetName, setMeetName] = useState("");
    const [meetDate, setMeetDate] = useState("");
    const [editingMeet, setEditingMeet] = useState(null);

    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    const handleEditClick = (meet) => {
        setEditingMeet(meet);
        setMeetName(meet.name);
        setMeetDate(formatDateForInput(meet.date));
    };

    const resetForm = () => {
        setMeetName("");
        setMeetDate("");
        setEditingMeet(null);
    };

    const handleDeleteClick = async (meetId, meetName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete "${meetName}" and all of its scheduled events. This action cannot be undone.`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetId));
                const eventDocs = await getDocs(eventsQuery);
                const batch = writeBatch(db);
                eventDocs.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(db, "meets", meetId));
                await batch.commit();
                showNotification(`"${meetName}" and all its events were deleted.`, 'success');
            } catch (error) {
                showNotification("Failed to delete meet and its events.", 'danger');
                console.error("Error deleting meet:", error);
            }
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!meetName.trim() || !meetDate) {
            showNotification("Please provide a name and a date for the meet.", "warning");
            return;
        }
        const date = new Date(meetDate);
        try {
            if (editingMeet) {
                await updateDoc(doc(db, "meets", editingMeet.id), { name: meetName, date: Timestamp.fromDate(date) });
                showNotification("Meet updated successfully!", "success");
            } else {
                await addDoc(collection(db, "meets"), { name: meetName, date: Timestamp.fromDate(date) });
                showNotification("Meet successfully added!", "success");
            }
            resetForm();
        } catch (error) {
            showNotification("Failed to save meet.", "danger");
        }
    };

    const handleCopyClick = async (meetToCopy) => {
        const { value: formValues } = await Swal.fire({
            title: `Copy Meet: ${meetToCopy.name}`,
            html: `<input id="swal-input1" class="swal2-input" value="Copy of ${meetToCopy.name}">` +
                  `<input id="swal-input2" type="date" class="swal2-input" value="${formatDateForInput(new Date())}">`,
            focusConfirm: false,
            preConfirm: () => [document.getElementById('swal-input1').value, document.getElementById('swal-input2').value]
        });
        if (formValues) {
            const [newName, newDate] = formValues;
            if(!newName || !newDate) {
                showNotification("New meet name and date are required.", "warning"); return;
            }
            try {
                const newMeetRef = await addDoc(collection(db, "meets"), { name: newName, date: Timestamp.fromDate(new Date(newDate)) });
                const originalEventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetToCopy.id));
                const originalEventsSnap = await getDocs(originalEventsQuery);
                const originalEvents = originalEventsSnap.docs.map(d => ({...d.data(), id: d.id}));
                const batch = writeBatch(db);
                originalEvents.forEach(event => {
                    const newEventRef = doc(collection(db, "meet_events"));
                    const newEventData = { ...event, meetId: newMeetRef.id, heats: [] };
                    delete newEventData.id;
                    batch.set(newEventRef, newEventData);
                });
                await batch.commit();
                showNotification(`Successfully copied meet and its schedule.`, 'success');
            } catch (error) {
                showNotification("Failed to copy meet.", "danger");
            }
        }
    };

    return (
         <>
            <h5 className="font-semibold text-lg">{editingMeet ? 'Edit Meet' : 'Create New Meet'}</h5>
            <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
                <AdminInput label="Meet Name" id="meetName" type="text" value={meetName} onChange={e => setMeetName(e.target.value)} />
                <AdminInput label="Meet Date" id="meetDate" type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)} />
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

function EventLibraryManagement({ adminRole, showNotification }) {
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
        const result = await Swal.fire({
            title: 'Are you sure?', text: `This will permanently delete "${eventName}" from the Event Library.`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
        });
        if(result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "event_library", eventId));
                showNotification("Library event deleted successfully.", "success");
            } catch (error) {
                 showNotification("Error deleting library event.", "danger");
            }
        }
    }
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!eventName.trim()) {
            showNotification("Event name cannot be empty.", "warning"); return;
        }
        try {
            if(editingEvent) {
                await updateDoc(doc(db, "event_library", editingEvent.id), { name: eventName });
                showNotification("Library event updated successfully.", "success");
            } else {
                await addDoc(collection(db, "event_library"), { name: eventName });
                showNotification("Library event created successfully.", "success");
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

function ScheduleManagement({ allMeets, showNotification }) {
    // ... ScheduleManagement component logic remains the same
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [selectedLibraryEventId, setSelectedLibraryEventId] = useState("");
    const [scheduledEvents, setScheduledEvents] = useState([]);
    const [editingEventId, setEditingEventId] = useState(null);
    const [editingEventNumber, setEditingEventNumber] = useState("");
    const scheduleListRef = useRef(null);
    const sortableInstance = useRef(null);
    
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "event_library"), (snapshot) => {
            setEventLibrary(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    const handleUpdateEventNumber = async (eventId, newNumberStr) => {
        const newNumber = parseInt(newNumberStr, 10);
        if (isNaN(newNumber) || newNumber < 1 || newNumber > scheduledEvents.length) {
            showNotification(`Please enter a valid event number between 1 and ${scheduledEvents.length}.`, "warning");
            return;
        }

        const list = [...scheduledEvents];
        const eventToMove = list.find(e => e.id === eventId);
        if (!eventToMove) return;

        const oldIndex = list.findIndex(e => e.id === eventId);
        list.splice(oldIndex, 1);
        list.splice(newNumber - 1, 0, eventToMove);

        const batch = writeBatch(db);
        list.forEach((event, index) => {
            const eventRef = doc(db, "meet_events", event.id);
            batch.update(eventRef, { eventNumber: index + 1 });
        });

        try {
            await batch.commit();
            showNotification("Event order updated successfully.", "success");
            setEditingEventId(null);
        } catch (error) {
            showNotification("Failed to update event order.", "danger");
            console.error("Error updating event order:", error);
        }
    };

    useEffect(() => {
        if (scheduleListRef.current) {
            if (sortableInstance.current) {
                sortableInstance.current.destroy();
            }
            sortableInstance.current = new Sortable(scheduleListRef.current, {
                animation: 150,
                onEnd: async (evt) => {
                    const { oldIndex, newIndex } = evt;
                    const reordered = [...scheduledEvents];
                    const [movedItem] = reordered.splice(oldIndex, 1);
                    reordered.splice(newIndex, 0, movedItem);
                    
                    const batch = writeBatch(db);
                    reordered.forEach((event, index) => {
                        const eventRef = doc(db, "meet_events", event.id);
                        batch.update(eventRef, { eventNumber: index + 1 });
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
    }, [scheduledEvents]);

    const handleAddEventToMeet = async (e) => {
        e.preventDefault();
        if (!selectedMeetId || !selectedLibraryEventId) {
            showNotification("Please select a meet and a library event.", "warning"); return;
        }
        const libraryEvent = eventLibrary.find(t => t.id === selectedLibraryEventId);
        if (!libraryEvent) return;

        const eventData = {
            meetId: selectedMeetId,
            libraryEventId: selectedLibraryEventId,
            name: libraryEvent.name,
            eventNumber: scheduledEvents.length + 1,
            heats: []
        };
        try {
            await addDoc(collection(db, "meet_events"), eventData);
            showNotification(`Event "${libraryEvent.name}" added.`, "success");
            setSelectedLibraryEventId("");
        } catch (error) {
            showNotification("Error adding event.", "danger");
        }
    };
    
    const handleRemoveClick = async (eventId, eventName) => {
        const result = await Swal.fire({
            title: 'Are you sure?', text: `Remove "${eventName}" from this schedule?`,
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, remove it!'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "meet_events", eventId));
                showNotification("Event removed.", "success");
            } catch (error) {
                showNotification("Failed to remove event.", "danger");
            }
        }
    };
    
    const handleBulkSchedule = async () => {
         const result = await Swal.fire({
            title: 'Bulk Add Schedule?', text: `This will add ALL events from the library to this meet. It will not create duplicates.`,
            icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, create schedule!'
        });
        if(!result.isConfirmed || !selectedMeetId) return;

        const scheduledEventNames = new Set(scheduledEvents.map(e => e.name));
        let eventsToAdd = eventLibrary.filter(libEvent => !scheduledEventNames.has(libEvent.name));
        if (eventsToAdd.length === 0) {
            showNotification("All library events are already scheduled.", "info"); return;
        }
        
        const sortOrder = { "Freestyle": 1, "Backstroke": 2, "Breaststroke": 3, "Butterfly": 4, "IM": 5 };
        const parseEventNameForSort = (name) => {
            const parts = name.split(' ');
            const gender = parts[0]; 
            const ageGroup = parts[1];
            const distance = parseInt(parts[2].replace('m', ''));
            const stroke = parts[3];
            let ageMin = ageGroup.includes('-') ? parseInt(ageGroup.split('-')[0]) : parseInt(ageGroup);
            return { gender, ageMin, distance, stroke: sortOrder[stroke] || 99 };
        };
        eventsToAdd.sort((a, b) => {
            const pa = parseEventNameForSort(a.name); const pb = parseEventNameForSort(b.name);
            if (pa.ageMin !== pb.ageMin) return pa.ageMin - pb.ageMin;
            if (pa.gender !== pb.gender) return pa.gender === 'Girls' ? -1 : 1;
            if (pa.stroke !== pb.stroke) return pa.stroke - pb.stroke;
            return pa.distance - pb.distance;
        });

        const batch = writeBatch(db);
        let currentEventNumber = scheduledEvents.length + 1;
        eventsToAdd.forEach(libEvent => {
            const newEventRef = doc(collection(db, "meet_events"));
            batch.set(newEventRef, { meetId: selectedMeetId, libraryEventId: libEvent.id, name: libEvent.name, eventNumber: currentEventNumber++, heats: [] });
        });
        try {
            await batch.commit();
            showNotification(`${eventsToAdd.length} events added to schedule.`, 'success');
        } catch(e) {
            showNotification('Error bulk-adding schedule.', 'danger');
        }
    };
    
    return (
        <>
            <h5 className="font-semibold text-lg">Manage a Meet's Schedule</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Assign library events, then reorder by dragging or editing the event number.</p>
            <div className="my-4 space-y-4">
                <AdminSelect label="1. Select Meet" id="meetSelectForSchedule" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                    <option value="" disabled>-- Choose a meet --</option>
                    {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
                </AdminSelect>
            </div>
            {selectedMeetId && (
                <>
                <form onSubmit={handleAddEventToMeet} className="space-y-4">
                    <h6 className="font-semibold">Add Single Event</h6>
                    <AdminSelect label="Library Event" id="libraryEventSelect" value={selectedLibraryEventId} onChange={e => setSelectedLibraryEventId(e.target.value)}>
                        <option value="" disabled>-- Choose an event --</option>
                        {eventLibrary.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                    </AdminSelect>
                    <AdminButton type="submit">Add Event to Schedule</AdminButton>
                </form>
                <div className="mt-3">
                    <AdminButton variant="outline-success" onClick={handleBulkSchedule}>Bulk Add Full Schedule</AdminButton>
                </div>
                 <>
                    <hr className="my-6 border-border-light dark:border-border-dark"/>
                    <h5 className="font-semibold text-lg">Current Schedule</h5>
                    <ul className="mt-2 space-y-2" ref={scheduleListRef}>
                        {scheduledEvents.map((event) => (
                            <li key={event.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center cursor-grab">
                                <div className="flex items-center">
                                    <Icon name="bars" className="mr-3 text-gray-400 dark:text-gray-500"/>
                                    {editingEventId === event.id ? (
                                        <input 
                                            type="number" 
                                            value={editingEventNumber}
                                            onChange={(e) => setEditingEventNumber(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateEventNumber(event.id, editingEventNumber)
                                                if (e.key === 'Escape') setEditingEventId(null);
                                            }}
                                            className="w-14 p-1 rounded-md border border-primary bg-surface-light dark:bg-surface-dark"
                                            autoFocus
                                        />
                                    ) : (
                                        <strong className="w-14 text-center">E{event.eventNumber}:</strong>
                                    )}
                                    <span className="ml-2">{event.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                     {editingEventId === event.id ? (
                                        <>
                                            <button className="text-green-500 hover:text-green-700" onClick={() => handleUpdateEventNumber(event.id, editingEventNumber)} title="Save"><Icon name="check"/></button>
                                            <button className="text-red-500 hover:text-red-700" onClick={() => setEditingEventId(null)} title="Cancel"><Icon name="times"/></button>
                                        </>
                                     ) : (
                                        <>
                                            <button className="text-gray-500 hover:text-gray-700" onClick={() => { setEditingEventId(event.id); setEditingEventNumber(event.eventNumber); }} title="Edit Number"><Icon name="pencil-alt"/></button>
                                            <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveClick(event.id, event.name)} title="Remove Event"><Icon name="trash"/></button>
                                        </>
                                     )}
                                </div>
                            </li>
                        ))}
                    </ul>
                 </>
                </>
            )}
        </>
    );
}

function RosterManagement({ adminRole, showNotification }) {
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

function EntryManagement({ adminRole, allMeets, showNotification }) {
    // ... EntryManagement component logic remains the same
    const isSuperAdmin = adminRole === 'SUPERADMIN';
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [selectedSwimmerId, setSelectedSwimmerId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
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
    };

    const handleEditEntry = (entry) => {
        setEditingEntry(entry);
        if (!isSuperAdmin) {
            setManagingTeam(entry.team);
        }
        setSelectedSwimmerId(entry.swimmerId);
        setSelectedEventId(entry.eventId);
        
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
        if (!selectedSwimmer || !selectedEventId || !managingTeam || !selectedMeetId) {
            showNotification("Please select a meet, team, swimmer, and event.", "warning");
            return;
        }

        const batch = writeBatch(db);

        if (editingEntry) {
            const oldEventRef = doc(db, "meet_events", editingEntry.eventId);
            const oldEventDoc = eventsForMeet.find(e => e.id === editingEntry.eventId);
            if (oldEventDoc) {
                 const newHeats = oldEventDoc.heats
                    .map(heat => ({
                        ...heat,
                        lanes: heat.lanes.filter(lane => lane.id !== editingEntry.swimmerId)
                    }))
                    .filter(heat => heat.lanes.length > 0);
                 batch.update(oldEventRef, { heats: newHeats });
            }
        }
        
        const newEventRef = doc(db, "meet_events", selectedEventId);
        const newEventDoc = eventsForMeet.find(e => e.id === selectedEventId);
        if (!newEventDoc) return;
        
        const alreadyEntered = (newEventDoc.heats || []).some(h => h.lanes.some(l => l.id === selectedSwimmer.id));
        if (alreadyEntered && !(editingEntry && editingEntry.eventId === selectedEventId)) {
            showNotification(`${selectedSwimmer.firstName} is already in this event.`, "danger");
            return; 
        }

        let newHeats = JSON.parse(JSON.stringify(newEventDoc.heats || []));
        if (newHeats.length === 0) newHeats.push({ heatNumber: 1, lanes: [] });
        
        let laneAssigned = false;
        for (const heat of newHeats) {
            if (heat.lanes.length < 8) {
                const occupiedLanes = new Set(heat.lanes.map(l => l.lane));
                for (let i = 1; i <= 8; i++) {
                    if (!occupiedLanes.has(i)) {
                        heat.lanes.push({ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: i });
                        laneAssigned = true; break;
                    }
                }
                if (laneAssigned) break;
            }
        }

        if (!laneAssigned) {
            newHeats.push({
                heatNumber: newHeats.length + 1,
                lanes: [{ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: 1 }]
            });
        }
        
        newHeats.forEach(heat => heat.lanes.sort((a, b) => a.lane - b.lane));
        batch.update(newEventRef, { heats: newHeats });
        
        try {
            await batch.commit();
            showNotification(`${selectedSwimmer.firstName} was ${editingEntry ? 'updated' : 'entered'} successfully.`, "success");
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
                        <div>
                            <AdminSelect label="4. Select Event" id="eventSelect" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} disabled={!selectedSwimmerId}>
                                <option value="" disabled>-- Choose an event --</option>
                                {eligibleEvents.map(event => <option key={event.id} value={event.id}>E{event.eventNumber} - {event.name}</option>)}
                            </AdminSelect>
                            {!selectedSwimmerId && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a swimmer to see their eligible events.</p>}
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

function AdminView({ adminRole, allMeets, showNotification }) {
    const [adminSubView, setAdminSubView] = useState('meets');

    if (!adminRole) {
        return <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-md">You are not authorized to view this page.</div>;
    }

    const renderSubView = () => {
        switch(adminSubView) {
            case 'meets':
                return <MeetManagement showNotification={showNotification} allMeets={allMeets} />;
            case 'library':
                return <EventLibraryManagement adminRole={adminRole} showNotification={showNotification} />;
            case 'schedule':
                return <ScheduleManagement allMeets={allMeets} showNotification={showNotification} />;
            case 'rosters':
                 return <RosterManagement adminRole={adminRole} showNotification={showNotification} />;
            case 'entries':
                 return <EntryManagement adminRole={adminRole} allMeets={allMeets} showNotification={showNotification} />;
            default:
                return null;
        }
    };

    const navLinkClasses = "block w-full text-center px-4 py-2 rounded-md font-semibold text-sm";
    const activeNavLinkClasses = "bg-primary text-white";
    const inactiveNavLinkClasses = "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600";

    return (
        <div className="admin-view">
            <h2 className="text-xl font-bold mb-3">Admin Panel</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                <li><button className={`${navLinkClasses} ${adminSubView === 'meets' ? activeNavLinkClasses : inactiveNavLinkClasses}`} onClick={() => setAdminSubView('meets')}>Meets</button></li>
                <li><button className={`${navLinkClasses} ${adminSubView === 'library' ? activeNavLinkClasses : inactiveNavLinkClasses}`} onClick={() => setAdminSubView('library')}>Library</button></li>
                <li><button className={`${navLinkClasses} ${adminSubView === 'schedule' ? activeNavLinkClasses : inactiveNavLinkClasses}`} onClick={() => setAdminSubView('schedule')}>Schedule</button></li>
                <li><button className={`${navLinkClasses} ${adminSubView === 'rosters' ? activeNavLinkClasses : inactiveNavLinkClasses}`} onClick={() => setAdminSubView('rosters')}>Rosters</button></li>
                <li><button className={`${navLinkClasses} ${adminSubView === 'entries' ? activeNavLinkClasses : inactiveNavLinkClasses}`} onClick={() => setAdminSubView('entries')}>Entries</button></li>
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