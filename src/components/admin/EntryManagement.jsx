import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, query, where, updateDoc } from 'firebase/firestore';
import Icon from '../../components/Icon';
import AdminButton from '../../components/admin/AdminButton';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminInput from '../../components/admin/AdminInput';

function EntryManagement({ adminRole, isSuperAdmin, allMeets, toast, confirm }) {
    const [allTeams, setAllTeams] = useState([]);
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [selectedSwimmerId, setSelectedSwimmerId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [entryDetails, setEntryDetails] = useState({ heat: '', lane: '' });
    const [eventsForMeet, setEventsForMeet] = useState([]);
    const [currentEntries, setCurrentEntries] = useState([]);
    const [editingEntry, setEditingEntry] = useState(null);

    const selectedMeet = useMemo(() => allMeets.find(m => m.id === selectedMeetId), [allMeets, selectedMeetId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
          setAllTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, []);

    // Dynamically determine which teams can be entered into the selected meet
    const teamsForMeet = useMemo(() => {
        if (!selectedMeet) return [];
        // If a home team is defined, limit entries to home and away teams
        if (selectedMeet.homeTeam) {
            return allTeams.filter(t => t.id === selectedMeet.homeTeam || t.id === selectedMeet.awayTeam);
        }
        // Otherwise, all teams are available for entry (for invitationals)
        return allTeams;
    }, [selectedMeet, allTeams]);

    const selectedSwimmer = roster.find(s => s.id === selectedSwimmerId);

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
        if (!selectedMeetId) { setEventsForMeet([]); return; }
        const q = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEventsForMeet(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b)=>a.eventNumber-b.eventNumber));
        });
        return unsubscribe;
    }, [selectedMeetId]);

    useEffect(() => {
        if (managingTeam) {
            const unsubscribe = onSnapshot(doc(db, 'rosters', managingTeam), (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers.sort((a,b) => a.lastName.localeCompare(b.lastName)) || [] : []);
            });
            return unsubscribe;
        } else {
            setRoster([])
        }
    }, [managingTeam]);

    useEffect(() => {
        if (!eventsForMeet || eventsForMeet.length === 0) { setCurrentEntries([]); return; }
        let allEntries = [];
        eventsForMeet.forEach(event => {
            if (event.heats) {
                event.heats.forEach(heat => {
                    heat.lanes.forEach(lane => {
                        allEntries.push({ swimmerId: lane.id, swimmerName: `${lane.firstName} ${lane.lastName}`, team: lane.team, eventId: event.id, eventName: event.name, eventNumber: event.eventNumber, heatNumber: heat.heatNumber, laneNumber: lane.lane, });
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
        if (!isSuperAdmin) setManagingTeam(entry.team);
        setSelectedSwimmerId(entry.swimmerId);
        setSelectedEventId(entry.eventId);
        setEntryDetails({ heat: entry.heatNumber, lane: entry.laneNumber });
        document.querySelector('.admin-view')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDeleteEntry = async (entry) => {
        if (await confirm('Are you sure?', `Remove ${entry.swimmerName} from E${entry.eventNumber}: ${entry.eventName}?`)) {
            const eventRef = doc(db, "meet_events", entry.eventId);
            try {
                const eventDoc = eventsForMeet.find(e => e.id === entry.eventId);
                if (!eventDoc) throw new Error("Event not found");
                const newHeats = eventDoc.heats.map(heat => ({ ...heat, lanes: heat.lanes.filter(lane => lane.id !== entry.swimmerId) })).filter(heat => heat.lanes.length > 0);
                await updateDoc(eventRef, { heats: newHeats });
                toast.success("Entry deleted successfully.");
            } catch (error) {
                toast.error("Failed to delete entry.");
                console.error("Error deleting entry:", error);
            }
        }
    };

    const handleAddOrUpdateSwimmerToEvent = async () => {
        if (!selectedSwimmer || !selectedEventId || !managingTeam || !selectedMeetId) {
            toast.error("Please select a meet, team, swimmer, and event.");
            return;
        }
        const eventRef = doc(db, "meet_events", selectedEventId);
        const eventDoc = eventsForMeet.find(e => e.id === selectedEventId);
        const swimmer = roster.find(s => s.id === selectedSwimmerId);
        
        let newHeats = JSON.parse(JSON.stringify(eventDoc.heats || []));

        if (editingEntry) {
            newHeats = newHeats.map(heat => ({ ...heat, lanes: heat.lanes.filter(lane => lane.id !== editingEntry.swimmerId) })).filter(heat => heat.lanes.length > 0);
        }
        const lanesAvailable = selectedMeet?.lanesAvailable || 8;
        const manualHeat = parseInt(entryDetails.heat, 10);
        const manualLane = parseInt(entryDetails.lane, 10);
        if (manualHeat && manualLane) {
            if (manualLane > lanesAvailable) { toast.error(`Invalid lane. Only ${lanesAvailable} lanes are available.`); return; }
            let targetHeat = newHeats.find(h => h.heatNumber === manualHeat);
            if (!targetHeat) {
                targetHeat = { heatNumber: manualHeat, lanes: [] };
                newHeats.push(targetHeat);
            }
            if (targetHeat.lanes.some(l => l.lane === manualLane)) { toast.error(`Lane ${manualLane} in Heat ${manualHeat} is already occupied.`); return; }
            targetHeat.lanes.push({ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: manualLane });
        } else {
            const isHomeTeamSwimmer = selectedSwimmer.team === selectedMeet?.homeTeam;
            const lanePriority = isHomeTeamSwimmer ? 'odd' : 'even';
            let laneAssigned = false;
            for (const heat of newHeats) {
                if (heat.lanes.length < lanesAvailable) {
                    const occupiedLanes = new Set(heat.lanes.map(l => l.lane));
                    const checkLanes = (start, step) => {
                        for (let i = start; i <= lanesAvailable; i += step) {
                            if (!occupiedLanes.has(i)) {
                                heat.lanes.push({ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: i });
                                return true;
                            }
                        }
                        return false;
                    };
                    if (lanePriority === 'odd') {
                        if (checkLanes(1, 2)) { laneAssigned = true; break; }
                        if (checkLanes(2, 2)) { laneAssigned = true; break; }
                    } else {
                        if (checkLanes(2, 2)) { laneAssigned = true; break; }
                        if (checkLanes(1, 2)) { laneAssigned = true; break; }
                    }
                }
            }
            if (!laneAssigned) {
                newHeats.push({ heatNumber: newHeats.length + 1, lanes: [{ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: 1 }] });
            }
        }
        if (selectedMeet?.homeTeam && selectedMeet?.awayTeam) {
            const isHomeTeamSwimmer = swimmer.team === selectedMeet.homeTeam;
            const lanePriority = isHomeTeamSwimmer ? 'odd' : 'even';
            let laneAssigned = false;
            // ... (the odd/even priority logic from before goes here)
        } else {
            // --- Default Sequential Laning Logic ---
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
            toast.success(`${selectedSwimmer.firstName} was ${editingEntry ? 'updated' : 'entered'} successfully.`);
            cancelEdit();
        } catch (error) {
            toast.error(`Failed to ${editingEntry ? 'update' : 'add'} entry.`);
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
                        {/* Use the new dynamic list of teams for the meet */}
                        {teamsForMeet.map(team => <option key={team.id} value={team.id}>{team.fullName}</option>)}
                    </AdminSelect>
                )}
            </div>
            {managingTeam && selectedMeetId && (
                <>
                    <div className="space-y-4">
                        <AdminSelect label="3. Select Swimmer" id="swimmerSelect" value={selectedSwimmerId} onChange={e => setSelectedSwimmerId(e.target.value)}>
                            <option value="" disabled>-- Choose from roster --</option>
                            {roster.map(swimmer => <option key={swimmer.id} value={swimmer.id}>{swimmer.lastName}, {swimmer.firstName} (Age: {swimmer.age})</option>)}
                        </AdminSelect>
                        <div>
                            <AdminSelect label="4. Select Event" id="eventSelect" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} disabled={!selectedSwimmerId}>
                                <option value="" disabled>-- Choose an event --</option>
                                {eligibleEvents.map(event => <option key={event.id} value={event.id}>E{event.eventNumber} - {event.name}</option>)}
                            </AdminSelect>
                            {!selectedSwimmerId && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a swimmer to see their eligible events.</p>}
                        </div>
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
                                    <p className="text-sm text-gray-500 dark:text-gray-400">E{entry.eventNumber}: {entry.eventName} (H:{entry.heatNumber} L:{entry.laneNumber})</p>
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

export default EntryManagement;
