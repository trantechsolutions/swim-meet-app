import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { STANDARD_EVENT_LIBRARY } from '../../config';
import Icon from '../../components/Icon';
import AdminInput from '../../components/admin/AdminInput';
import AdminButton from '../../components/admin/AdminButton';

function EventLibraryManagement({ adminRole, isSuperAdmin, toast, confirm }) {
    const [eventName, setEventName] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "event_library"), (snapshot) => {
            const templates = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b) => a.name.localeCompare(b.name));
            setEventLibrary(templates);
        });
        return unsubscribe;
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
            toast.error("Event name cannot be empty."); return;
        }
        try {
            if(editingEvent) {
                await updateDoc(doc(db, "event_library", editingEvent.id), { name: eventName });
                toast.success("Library event updated successfully.");
            } else {
                await addDoc(collection(db, "event_library"), { name: eventName });
                toast.success("Library event created successfully.");
            }
            resetForm();
        } catch (error) {
            toast.error("Error saving library event.");
        }
    };

    const handleBulkLoad = async () => {
        if (!await confirm('Bulk Load Events?', 'This will add any missing standard events to the library. It will not create duplicates.')) return;
        
        const existingEventNames = new Set(eventLibrary.map(t => t.name));
        const eventsToAdd = STANDARD_EVENT_LIBRARY.filter(name => !existingEventNames.has(name));
        
        if (eventsToAdd.length === 0) {
            toast.success("All standard library events already exist.");
            return;
        }

        toast.loading(`Adding ${eventsToAdd.length} new library events...`);
        const batch = writeBatch(db);
        eventsToAdd.forEach(name => {
            const newDocRef = doc(collection(db, "event_library"));
            batch.set(newDocRef, { name });
        });
        
        try {
            await batch.commit();
            toast.dismiss();
            toast.success("Bulk load complete!");
        } catch (error) {
            toast.dismiss();
            toast.error("An error occurred during bulk load.");
            console.error("Bulk load error:", error);
        }
    };

    return (
        <>
            <h5 className="font-semibold text-lg">Event Library</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create a master list of reusable event types.</p>
            {isSuperAdmin && (
                <div className="my-4 space-y-4">
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <AdminInput label={editingEvent ? 'Edit Event Name' : 'New Event Name'} id="libraryEventName" type="text" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g., Girls 9-10 50m Freestyle" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             <AdminButton type="submit">{editingEvent ? 'Update Event' : 'Create Event'}</AdminButton>
                             {editingEvent && <AdminButton type="button" variant="secondary" onClick={resetForm}>Cancel</AdminButton>}
                        </div>
                    </form>
                    <AdminButton variant="outline-success" onClick={handleBulkLoad}>Bulk Load Standard Events</AdminButton>
                </div>
            )}
            <hr className="my-6 border-border-light dark:border-border-dark"/>
            <h5 className="mt-3 font-semibold text-lg">Existing Library Events</h5>
            <ul className="mt-2 space-y-2">
                {eventLibrary.map(event => (
                    <li key={event.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                        <span className="font-medium">{event.name}</span>
                        {isSuperAdmin && (
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

export default EventLibraryManagement;
