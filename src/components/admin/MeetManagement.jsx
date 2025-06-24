import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import Icon from '../../components/Icon';
import AdminInput from '../../components/admin/AdminInput';
import AdminButton from '../../components/admin/AdminButton';
import AdminSelect from '../../components/admin/AdminSelect';
import { toast } from 'react-hot-toast';

// This is a custom component rendered inside a toast for user input
const CopyMeetForm = ({ t, meetToCopy, onCopy }) => {
    const [newName, setNewName] = useState(`Copy of ${meetToCopy.name}`);
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = () => {
        if (!newName || !newDate) {
            toast.error("Name and date are required.");
            return;
        }
        onCopy(newName, newDate);
        toast.dismiss(t.id);
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg shadow-lg flex flex-col gap-2 border border-border-light dark:border-border-dark">
            <h4 className="font-bold text-text-dark dark:text-text-light">Copy Meet</h4>
            <AdminInput label="New Meet Name" id="copy-meet-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <AdminInput label="New Meet Date" id="copy-meet-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <div className="flex justify-end gap-2 mt-2">
                <AdminButton variant="secondary" onClick={() => toast.dismiss(t.id)}>Cancel</AdminButton>
                <AdminButton onClick={handleSubmit}>Copy</AdminButton>
            </div>
        </div>
    );
};


function MeetManagement({ allMeets, confirm }) {
    const [teams, setTeams] = useState([]);
    const [meetName, setMeetName] = useState("");
    const [meetDate, setMeetDate] = useState("");
    const [lanesAvailable, setLanesAvailable] = useState(8);
    const [location, setLocation] = useState("");
    const [homeTeam, setHomeTeam] = useState("");
    const [awayTeam, setAwayTeam] = useState("");
    const [editingMeet, setEditingMeet] = useState(null);

    useEffect(() => {
        const onTeamsUpdate = onSnapshot(collection(db, 'teams'), (snapshot) => {
            const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTeams(teamsData);
        });
        return () => onTeamsUpdate();
    }, []);

    const formatDateForInput = (dateObject) => {
        if (dateObject && typeof dateObject.toDate === 'function') {
            return new Date(dateObject.toDate()).toISOString().split('T')[0];
        }
        if (dateObject instanceof Date) {
            return dateObject.toISOString().split('T')[0];
        }
        return '';
    };

    const handleEditClick = (meet) => {
        setEditingMeet(meet);
        setMeetName(meet.name);
        setMeetDate(formatDateForInput(meet.date));
        setLanesAvailable(meet.lanesAvailable || 8);
        setLocation(meet.location || "");
        setHomeTeam(meet.homeTeam || "");
        setAwayTeam(meet.awayTeam || "");
    };

    const resetForm = () => {
        setMeetName("");
        setMeetDate("");
        setLanesAvailable(8);
        setLocation("");
        setHomeTeam("");
        setAwayTeam("");
        setEditingMeet(null);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Updated validation: Teams are now optional
        if (!meetName || !meetDate) {
            toast.error("Meet Name and Date are required.");
            return;
        }
        const meetPayload = {
            name: meetName,
            date: Timestamp.fromDate(new Date(meetDate + 'T00:00:00')),
            lanesAvailable: parseInt(lanesAvailable, 10) || 8,
            location: location || "",
            homeTeam: homeTeam || "",
            awayTeam: awayTeam || "",
        };
        
        try {
            if (editingMeet) {
                await updateDoc(doc(db, "meets", editingMeet.id), meetPayload);
                toast.success("Meet updated successfully!");
            } else {
                await addDoc(collection(db, "meets"), meetPayload);
                toast.success("Meet created successfully!");
            }
            resetForm();
        } catch (error) {
            toast.error("Failed to save meet.");
            console.error("Meet save error:", error);
        }
    };
    
    const handleDeleteClick = async (meetId, meetName) => {
        if (await confirm('Are you sure?', `This will permanently delete "${meetName}" and all associated events.`)) {
            try {
                const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetId));
                const eventDocs = await getDocs(eventsQuery);
                const batch = writeBatch(db);
                eventDocs.forEach(d => batch.delete(d.ref));
                batch.delete(doc(db, "meets", meetId));
                await batch.commit();
                toast.success(`"${meetName}" was deleted.`);
            } catch (error) {
                toast.error("Failed to delete meet.");
                console.error("Meet delete error:", error);
            }
        }
    };

    // Re-added copy functionality
    const handleCopyClick = (meetToCopy) => {
        const onCopy = async (newName, newDateStr) => {
            try {
                toast.loading('Copying meet...');
                const newDate = new Date(newDateStr + 'T00:00:00');
                
                // Create a clean payload for the new meet, copying all relevant fields
                const newMeetPayload = {
                    name: newName,
                    date: Timestamp.fromDate(newDate),
                    location: meetToCopy.location || "",
                    homeTeam: meetToCopy.homeTeam || "",
                    awayTeam: meetToCopy.awayTeam || "",
                    lanesAvailable: meetToCopy.lanesAvailable || 8,
                };
    
                const newMeetRef = await addDoc(collection(db, "meets"), newMeetPayload);
    
                const originalEventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetToCopy.id));
                const originalEventsSnap = await getDocs(originalEventsQuery);
    
                if (originalEventsSnap.empty) {
                    toast.dismiss();
                    toast.success(`Successfully copied meet "${newName}". No events were scheduled in the original.`);
                    return;
                }
    
                const batch = writeBatch(db);
                originalEventsSnap.docs.forEach(eventDoc => {
                    const eventData = eventDoc.data();
                    const newEventData = { ...eventData, meetId: newMeetRef.id, heats: [] };
                    batch.set(doc(collection(db, "meet_events")), newEventData);
                });
    
                await batch.commit();
                toast.dismiss();
                toast.success(`Successfully copied meet and its schedule.`);
            } catch (error) {
                toast.dismiss();
                toast.error("Failed to copy meet.");
                console.error("Copy meet error:", error);
            }
        };
    
        toast.custom((t) => (
            <CopyMeetForm t={t} meetToCopy={meetToCopy} onCopy={onCopy} />
        ), { duration: Infinity }); // Keep the toast open until dismissed
    };
    
    return (
        <>
            <h5 className="font-semibold text-lg">{editingMeet ? 'Edit Meet' : 'Create New Meet'}</h5>
            <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
                <AdminInput label="Meet Name" id="meetName" type="text" value={meetName} onChange={e => setMeetName(e.target.value)} />
                <AdminInput label="Location" id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AdminSelect label="Home Team (Optional)" id="homeTeam" value={homeTeam} onChange={e => setHomeTeam(e.target.value)}>
                        <option value="">-- No Home Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </AdminSelect>
                    <AdminSelect label="Away Team (Optional)" id="awayTeam" value={awayTeam} onChange={e => setAwayTeam(e.target.value)}>
                        <option value="">-- No Away Team --</option>
                        {teams.filter(t => t.id !== homeTeam).map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </AdminSelect>
                </div>
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
                        <div>
                            <span className="font-medium">{meet.name}</span>
                            <p className="text-sm text-gray-500">{new Date(formatDateForInput(meet.date) + 'T00:00:00').toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Copy button is re-added here */}
                            <button className="text-blue-500 hover:text-blue-700" onClick={() => handleCopyClick(meet)} title="Copy Meet"><Icon name="copy"/></button>
                            <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEditClick(meet)} title="Edit"><Icon name="pencil-alt"/></button>
                            <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(meet.id, meet.name)} title="Delete"><Icon name="trash"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

export default MeetManagement;
