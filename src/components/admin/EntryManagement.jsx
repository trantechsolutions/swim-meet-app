import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, query, where, updateDoc, writeBatch } from 'firebase/firestore';
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
    const [selectedEntries, setSelectedEntries] = useState(new Set());

    const selectedMeet = useMemo(() => allMeets.find(m => m.id === selectedMeetId), [allMeets, selectedMeetId]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
          setAllTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsub;
    }, []);

    const teamsForMeet = useMemo(() => {
        if (!selectedMeet) return [];
        if (selectedMeet.homeTeam) {
            return allTeams.filter(t => t.id === selectedMeet.homeTeam || t.id === selectedMeet.awayTeam);
        }
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
                        // For each swimmer in a lane, create a separate entry item for the list
                        lane.swimmers.forEach(swimmer => {
                            const entryId = `${event.id}-${heat.heatNumber}-${lane.lane}-${swimmer.id}`;
                            allEntries.push({ id: entryId, swimmerId: swimmer.id, swimmerName: `${swimmer.firstName} ${swimmer.lastName}`, team: swimmer.team, eventId: event.id, eventName: event.name, eventNumber: event.eventNumber, heatNumber: heat.heatNumber, laneNumber: lane.lane, });
                        });
                    });
                });
            }
        });
        if (!isSuperAdmin) {
            allEntries = allEntries.filter(entry => entry.team === adminRole);
        }
        allEntries.sort((a,b) => a.eventNumber - b.eventNumber || a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber || a.swimmerName.localeCompare(b.swimmerName));
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
        if (await confirm('Are you sure?', `Remove ${entry.swimmerName} from this entry?`)) {
            const eventRef = doc(db, "meet_events", entry.eventId);
            try {
                const eventDoc = eventsForMeet.find(e => e.id === entry.eventId);
                if (!eventDoc) throw new Error("Event not found");

                // Go through heats and lanes to find the specific swimmer to remove
                const newHeats = eventDoc.heats.map(heat => {
                    if (heat.heatNumber !== entry.heatNumber) return heat;
                    
                    const newLanes = heat.lanes.map(lane => {
                        if (lane.lane !== entry.laneNumber) return lane;
                        // Filter out the deleted swimmer
                        const updatedSwimmers = lane.swimmers.filter(s => s.id !== entry.swimmerId);
                        // If the lane is now empty, remove the whole lane object
                        if (updatedSwimmers.length === 0) return null;
                        return { ...lane, swimmers: updatedSwimmers };
                    }).filter(Boolean); // filter(Boolean) removes nulls

                    if (newLanes.length === 0) return null;
                    return { ...heat, lanes: newLanes };
                }).filter(Boolean);

                await updateDoc(eventRef, { heats: newHeats });
                toast.success("Entry deleted successfully.");
            } catch (error) {
                toast.error("Failed to delete entry.");
            }
        }
    };

    const handleAddOrUpdateSwimmerToEvent = async () => {
        const swimmer = roster.find(s => s.id === selectedSwimmerId);
        if (!swimmer || !selectedEventId || !managingTeam || !selectedMeetId) {
            toast.error("Please select a meet, team, swimmer, and event.");
            return;
        }
    
        const eventRef = doc(db, "meet_events", selectedEventId);
        const eventDoc = eventsForMeet.find(e => e.id === selectedEventId);
        if (!eventDoc) return;
    
        let newHeats = JSON.parse(JSON.stringify(eventDoc.heats || []));
    
        if (editingEntry) {
            newHeats = newHeats.map(heat => ({
                ...heat,
                lanes: heat.lanes.map(lane => ({
                    ...lane,
                    swimmers: lane.swimmers.filter(s => s.id !== editingEntry.swimmerId)
                })).filter(lane => lane.swimmers.length > 0)
            })).filter(heat => heat.lanes.length > 0);
        }
    
        const lanesAvailable = selectedMeet?.lanesAvailable || 8;
        const manualHeat = parseInt(entryDetails.heat, 10);
        const manualLane = parseInt(entryDetails.lane, 10);
        const isRelayEvent = eventDoc.name.toLowerCase().includes('relay');
    
        if (manualHeat && manualLane) {
            let targetHeat = newHeats.find(h => h.heatNumber === manualHeat);
            if (!targetHeat) {
                targetHeat = { heatNumber: manualHeat, lanes: [] };
                newHeats.push(targetHeat);
            }
    
            let targetLane = targetHeat.lanes.find(l => l.lane === manualLane);
            if (!targetLane) {
                targetLane = { lane: manualLane, swimmers: [] };
                targetHeat.lanes.push(targetLane);
            }
    
            if (!isRelayEvent && targetLane.swimmers.length > 0) {
                toast.error(`Lane ${manualLane} in Heat ${manualHeat} is already occupied.`);
                return;
            }
    
            targetLane.swimmers.push({ ...swimmer, team: managingTeam, seedTime: "NT" });
        } else {
            // --- UPDATED Automatic Assignment Logic ---
            const hasHomeAway = selectedMeet?.homeTeam && selectedMeet?.awayTeam;
            const isHomeTeamSwimmer = hasHomeAway && swimmer.team === selectedMeet.homeTeam;
            const lanePriority = hasHomeAway ? (isHomeTeamSwimmer ? 'odd' : 'even') : 'any';
            
            let laneAssigned = false;
            for (const heat of newHeats) {
                if (heat.lanes.length < lanesAvailable || (isRelayEvent && heat.lanes.some(l => l.swimmers.length < 4))) {
                    const occupiedLanes = new Set(heat.lanes.map(l => l.lane));
                    
                    const checkLanes = (start, step) => {
                        for (let i = start; i <= lanesAvailable; i += step) {
                            if (!occupiedLanes.has(i)) {
                                heat.lanes.push({ lane: i, swimmers: [{ ...swimmer, team: managingTeam, seedTime: "NT" }] });
                                return true;
                            }
                        }
                        return false;
                    };

                    if (lanePriority === 'odd') {
                        if (checkLanes(1, 2) || checkLanes(2, 2)) laneAssigned = true;
                    } else if (lanePriority === 'even') {
                        if (checkLanes(2, 2) || checkLanes(1, 2)) laneAssigned = true;
                    } else { // 'any' priority for meets without assigned teams
                        if (checkLanes(1, 1)) laneAssigned = true;
                    }

                    if (laneAssigned) break;
                }
            }
    
            if (!laneAssigned) {
                newHeats.push({ heatNumber: newHeats.length + 1, lanes: [{ lane: 1, swimmers: [{ ...swimmer, team: managingTeam, seedTime: "NT" }] }] });
            }
        }
    
        newHeats.sort((a, b) => a.heatNumber - b.heatNumber);
        newHeats.forEach(heat => heat.lanes.sort((a, b) => a.lane - b.lane));
    
        try {
            await updateDoc(eventRef, { heats: newHeats });
            toast.success(`${swimmer.firstName} was ${editingEntry ? 'updated' : 'entered'} successfully.`);
            cancelEdit();
        } catch (error) {
            toast.error(`Failed to ${editingEntry ? 'update' : 'add'} entry.`);
            console.error("Error in entry transaction:", error);
        }
    };

    const handleToggleSelection = (entryId) => {
        setSelectedEntries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entryId)) {
                newSet.delete(entryId);
            } else {
                newSet.add(entryId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allEntryIds = new Set(currentEntries.map(entry => entry.id));
            setSelectedEntries(allEntryIds);
        } else {
            setSelectedEntries(new Set());
        }
    };

    const handleBulkDelete = async () => {
        if (selectedEntries.size === 0) return;
        if (await confirm('Are you sure?', `This will remove ${selectedEntries.size} selected entries.`)) {
            const entriesToDelete = Array.from(selectedEntries).map(id => currentEntries.find(e => e.id === id));
            
            // Group deletions by event to minimize writes
            const updatesByEvent = {};
            entriesToDelete.forEach(entry => {
                if (!updatesByEvent[entry.eventId]) {
                    const eventDoc = eventsForMeet.find(e => e.id === entry.eventId);
                    updatesByEvent[entry.eventId] = JSON.parse(JSON.stringify(eventDoc.heats));
                }
                updatesByEvent[entry.eventId] = updatesByEvent[entry.eventId]
                    .map(heat => ({
                        ...heat,
                        lanes: heat.lanes.filter(lane => lane.id !== entry.swimmerId)
                    }))
                    .filter(heat => heat.lanes.length > 0);
            });
            
            try {
                const batch = writeBatch(db);
                for (const eventId in updatesByEvent) {
                    batch.update(doc(db, 'meet_events', eventId), { heats: updatesByEvent[eventId] });
                }
                await batch.commit();
                toast.success(`${selectedEntries.size} entries deleted.`);
                setSelectedEntries(new Set());
            } catch (error) {
                toast.error("Failed to delete entries.");
                console.error("Bulk delete error:", error);
            }
        }
    };

    const areAllSelected = currentEntries.length > 0 && selectedEntries.size === currentEntries.length;

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
                                {eventsForMeet.map(event => <option key={event.id} value={event.id}>E{event.eventNumber} - {event.name}</option>)}
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
            
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h6 className="font-semibold text-lg">Current Entries for {isSuperAdmin && !managingTeam ? 'All Teams' : managingTeam}</h6>
                            {currentEntries.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="select-all-entries"
                                        checked={areAllSelected}
                                        onChange={handleSelectAll}
                                    />
                                    <label htmlFor="select-all-entries" className="text-sm font-medium">Select All</label>
                                </div>
                            )}
                        </div>
                        {selectedEntries.size > 0 && (
                            <AdminButton onClick={handleBulkDelete} variant="secondary" className="w-auto">
                                <Icon name="trash" className="mr-2" /> Delete Selected ({selectedEntries.size})
                            </AdminButton>
                        )}
                    </div>

                    <ul className="mt-2 space-y-2">
                        {currentEntries.length > 0 ? currentEntries.map(entry => (
                            <li key={entry.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedEntries.has(entry.id)}
                                        onChange={() => handleToggleSelection(entry.id)}
                                        aria-label={`Select entry for ${entry.swimmerName}`}
                                    />
                                    <div>
                                        <span className="font-semibold">{entry.swimmerName}</span> ({entry.team})
                                        <p className="text-sm text-gray-500 dark:text-gray-400">E{entry.eventNumber}: {entry.eventName} (H:{entry.heatNumber} L:{entry.laneNumber})</p>
                                    </div>
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
