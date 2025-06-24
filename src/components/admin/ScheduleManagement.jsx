import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sortable from 'sortablejs';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, query, where, writeBatch } from 'firebase/firestore';
import { STANDARD_EVENT_LIBRARY } from '../../config';
import Icon from '../../components/Icon';
import AdminButton from '../../components/admin/AdminButton';
import AdminSelect from '../../components/admin/AdminSelect';

function ScheduleManagement({ allMeets, toast, confirm }) {
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [scheduledEvents, setScheduledEvents] = useState([]);
    
    const [selectedLibraryEvents, setSelectedLibraryEvents] = useState(new Set());
    const [selectedScheduledEvents, setSelectedScheduledEvents] = useState(new Set());

    const [editingEventId, setEditingEventId] = useState(null);
    const [editingEventNumber, setEditingEventNumber] = useState('');

    const scheduleListRef = useRef(null);
    const sortableInstance = useRef(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "event_library"), (snapshot) => {
            const library = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
            setEventLibrary(library);
        });
        return unsubscribe;
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
            toast.error("Could not load schedule.");
        });
        return unsubscribe;
    }, [selectedMeetId]);

    useEffect(() => {
        if (scheduleListRef.current) {
            if (sortableInstance.current) sortableInstance.current.destroy();
            sortableInstance.current = new Sortable(scheduleListRef.current, {
                animation: 150,
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
                        toast.success("Event order updated.");
                    } catch (error) {
                        toast.error("Failed to update event order.");
                    }
                },
            });
        }
    }, [scheduledEvents, editingEventId]);

    const handleToggleSelection = (id, type) => {
        const updater = type === 'library' ? setSelectedLibraryEvents : setSelectedScheduledEvents;
        updater(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const availableLibraryEvents = useMemo(() => {
        const scheduledNames = new Set(scheduledEvents.map(e => e.name));
        return eventLibrary.filter(e => !scheduledNames.has(e.name));
    }, [eventLibrary, scheduledEvents]);

    const handleAddEvents = async (idsToAdd) => {
        if (!selectedMeetId || idsToAdd.length === 0) return;
        const eventsData = idsToAdd.map((id, index) => {
            const libraryEvent = eventLibrary.find(e => e.id === id);
            return { meetId: selectedMeetId, libraryEventId: libraryEvent.id, name: libraryEvent.name, eventNumber: scheduledEvents.length + 1 + index, heats: [] };
        });
        const batch = writeBatch(db);
        eventsData.forEach(eventData => batch.set(doc(collection(db, "meet_events")), eventData));
        try {
            await batch.commit();
            toast.success(`${eventsData.length} event(s) added successfully.`);
            setSelectedLibraryEvents(new Set());
        } catch (error) {
            toast.error("Error adding events.");
        }
    };
    
    const handleRemoveEvents = async (idsToRemove) => {
        if (!selectedMeetId || idsToRemove.length === 0) return;
        if (await confirm('Are you sure?', `This will remove ${idsToRemove.length} event(s) from this meet's schedule.`)) {
            const batch = writeBatch(db);
            idsToRemove.forEach(id => batch.delete(doc(db, "meet_events", id)));
            const remainingEvents = scheduledEvents.filter(e => !idsToRemove.includes(e.id)).sort((a,b) => a.eventNumber - b.eventNumber);
            remainingEvents.forEach((event, index) => batch.update(doc(db, "meet_events", event.id), { eventNumber: index + 1 }));
            try {
                await batch.commit();
                toast.success("Selected events removed.");
                setSelectedScheduledEvents(new Set());
            } catch (error) {
                toast.error("Failed to remove events.");
            }
        }
    };

    const handleAddAll = () => {
        const scheduledNames = new Set(scheduledEvents.map(e => e.name));
        const libraryEventsToAdd = STANDARD_EVENT_LIBRARY.map(name => eventLibrary.find(e => e.name === name)).filter(event => event && !scheduledNames.has(event.name));
        const idsToAdd = libraryEventsToAdd.map(e => e.id);
        handleAddEvents(idsToAdd);
    };

    const handleRemoveAll = async () => {
        if (scheduledEvents.length === 0) return;
        if (await confirm('Are you sure?', "This will remove ALL events from this meet's schedule. This action cannot be undone.")) {
            const batch = writeBatch(db);
            scheduledEvents.forEach(event => batch.delete(doc(db, "meet_events", event.id)));
            try {
                await batch.commit();
                toast.success("Complete schedule has been cleared.");
                setSelectedScheduledEvents(new Set());
            } catch (error) {
                toast.error("Failed to clear schedule.");
            }
        }
    };

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
            toast.error(`Please enter a valid event number between 1 and ${scheduledEvents.length}.`);
            return;
        }
        const list = [...scheduledEvents];
        const eventToMove = list.find(e => e.id === eventIdToUpdate);
        if (!eventToMove) return;
        const oldIndex = list.findIndex(e => e.id === eventIdToUpdate);
        list.splice(oldIndex, 1);
        list.splice(newNumber - 1, 0, eventToMove);
        const batch = writeBatch(db);
        list.forEach((event, index) => batch.update(doc(db, "meet_events", event.id), { eventNumber: index + 1 }));
        try {
            await batch.commit();
            toast.success("Event number updated successfully.");
            handleCancelEdit();
        } catch (error) {
            toast.error("Failed to update event number.");
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
                    <div className="flex flex-row md:flex-col gap-2 justify-center">
                        <AdminButton onClick={handleAddAll} title="Add All"><Icon name="angle-double-right" /></AdminButton>
                        <AdminButton onClick={() => handleAddEvents(Array.from(selectedLibraryEvents))} title="Add Selected"><Icon name="angle-right" /></AdminButton>
                        <AdminButton onClick={() => handleRemoveEvents(Array.from(selectedScheduledEvents))} title="Remove Selected"><Icon name="angle-left" /></AdminButton>
                        <AdminButton onClick={handleRemoveAll} title="Remove All"><Icon name="angle-double-left" /></AdminButton>
                    </div>
                    <div className="border border-border-light dark:border-border-dark rounded-lg p-3">
                         <h6 className="font-semibold mb-2">Scheduled Events ({scheduledEvents.length})</h6>
                         <ul className="h-64 overflow-y-auto space-y-1" ref={scheduleListRef}>
                            {scheduledEvents.map(event => (
                                <li key={event.id} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" data-id={event.id}>
                                    <input type="checkbox" id={`sch-${event.id}`} checked={selectedScheduledEvents.has(event.id)} onChange={() => handleToggleSelection(event.id, 'schedule')} disabled={!!editingEventId} />
                                    {editingEventId === event.id ? (
                                        <>
                                            <input type="number" className="w-16 p-1 text-center rounded-md border border-primary bg-surface-light dark:bg-surface-dark" value={editingEventNumber} onChange={(e) => setEditingEventNumber(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmEdit(); if (e.key === 'Escape') handleCancelEdit(); }} autoFocus />
                                            <span className="flex-grow">{event.name}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={handleConfirmEdit} title="Save" className="text-green-500 hover:text-green-700"><Icon name="check"/></button>
                                                <button onClick={handleCancelEdit} title="Cancel" className="text-red-500 hover:text-red-700"><Icon name="times"/></button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
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

export default ScheduleManagement;
