import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, onSnapshot, writeBatch, setDoc } from 'firebase/firestore';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminButton from '../../components/admin/AdminButton';
import Icon from '../../components/Icon';

function ImportManagement({ allMeets, toast }) {
  const [importType, setImportType] = useState('entries');
  const [selectedMeetId, setSelectedMeetId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [csvData, setCsvData] = useState("");
  const [allRosters, setAllRosters] = useState({});
  const [allTeams, setAllTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
        setAllTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rosters'), (snapshot) => {
      const rosters = {};
      snapshot.forEach(doc => {
        rosters[doc.id] = doc.data().swimmers || [];
      });
      setAllRosters(rosters);
    });
    return () => unsub();
  }, []);

  const selectedMeet = useMemo(() => {
    return allMeets.find(m => m.id === selectedMeetId);
  }, [allMeets, selectedMeetId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setCsvData(event.target.result);
      reader.readAsText(file);
    }
    e.target.value = null;
  };

  const handleImport = () => {
    if (importType === 'entries') handleEntryImport();
    else if (importType === 'events') handleEventImport();
    else if (importType === 'roster') handleRosterImport();
  };

  const handleRosterImport = async () => {
      if (!selectedTeamId) { toast.error("Please select a team to import the roster for."); return; }
      if (!csvData.trim()) { toast.error("Please provide CSV data to import."); return; }
      setIsLoading(true);
      toast.loading('Importing roster...');
      const lines = csvData.trim().split('\n');
      const errors = [];
      const newSwimmers = [];
      lines.forEach((line, index) => {
          if (index === 0 && line.toLowerCase().includes('firstname')) return;
          const [firstName, lastName, ageStr, gender] = line.split(',').map(s => s.trim());
          if (!firstName || !lastName) { errors.push(`Line ${index + 1}: FirstName and LastName are required.`); return; }
          const age = parseInt(ageStr, 10);
          newSwimmers.push({ id: crypto.randomUUID(), firstName, lastName, age: isNaN(age) ? 0 : age, gender: gender || ''});
      });
      if (errors.length > 0) {
          toast.dismiss();
          toast.error(`Import failed with ${errors.length} errors.`);
          setIsLoading(false);
          return;
      }
      const existingRoster = allRosters[selectedTeamId] || [];
      const finalRoster = [...existingRoster, ...newSwimmers];
      try {
          await setDoc(doc(db, 'rosters', selectedTeamId), { swimmers: finalRoster }, { merge: true });
          toast.dismiss();
          toast.success(`${newSwimmers.length} swimmers imported to team ${selectedTeamId}.`);
          setCsvData("");
      } catch (error) {
          toast.dismiss();
          toast.error("An error occurred while saving the roster.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleEventImport = async () => {
      if (!selectedMeet) { toast.error("Please select a meet first."); return; }
      if (!csvData.trim()) { toast.error("Please provide CSV data to import."); return; }
      setIsLoading(true);
      toast.loading('Importing events...');
      const lines = csvData.trim().split('\n');
      const errors = [];
      const newEvents = [];
      lines.forEach((line, index) => {
          if (index === 0 && line.toLowerCase().includes('eventnumber,eventname')) return;
          const [eventNumberStr, eventName] = line.split(',').map(s => s.trim());
          const eventNumber = parseInt(eventNumberStr, 10);
          if (!eventName || isNaN(eventNumber)) { errors.push(`Line ${index + 1}: Invalid format. Expected EventNumber,EventName`); return; }
          newEvents.push({ meetId: selectedMeetId, eventNumber, name: eventName, heats: [] });
      });
      if (errors.length > 0) {
          toast.dismiss();
          toast.error(`Import failed with ${errors.length} errors.`);
          setIsLoading(false);
          return;
      }
      try {
          const batch = writeBatch(db);
          newEvents.forEach(eventData => batch.set(doc(collection(db, "meet_events")), eventData));
          await batch.commit();
          toast.dismiss();
          toast.success(`${newEvents.length} events imported successfully!`);
          setCsvData("");
      } catch (error) {
          toast.dismiss();
          toast.error("An error occurred while saving events.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleEntryImport = async () => {
    if (!selectedMeet) { toast.error("Please select a meet first."); return; }
    if (!csvData.trim()) { toast.error("Please provide CSV data to import."); return; }

    setIsLoading(true);
    toast.loading('Processing entries...');

    const eventsInMeet = selectedMeet.events || [];
    const eventMap = new Map(eventsInMeet.map(e => [e.eventNumber.toString(), e]));
    const entriesByEvent = {};
    const errors = [];
    const lines = csvData.trim().split('\n');

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('team,firstname,lastname,eventnumber')) return;
      const columns = line.split(',').map(s => s.trim());
      const [team, firstName, lastName, eventNumberStr, heatStr, laneStr] = columns;
      const eventNumber = eventNumberStr;
      if (!team || !firstName || !lastName || !eventNumber) {
        errors.push(`Line ${index + 1}: Invalid format. Required: Team,FirstName,LastName,EventNumber`);
        return;
      }
      const roster = allRosters[team];
      const swimmer = roster?.find(s => s.firstName.toLowerCase() === firstName.toLowerCase() && s.lastName.toLowerCase() === lastName.toLowerCase());
      if (!swimmer) { errors.push(`Line ${index + 1}: Swimmer "${firstName} ${lastName}" on team "${team}" not found.`); return; }
      if (!eventMap.has(eventNumber)) { errors.push(`Line ${index + 1}: Event #${eventNumber} not found in this meet.`); return; }
      if (!entriesByEvent[eventNumber]) entriesByEvent[eventNumber] = [];
      const heat = heatStr ? parseInt(heatStr, 10) : null;
      const lane = laneStr ? parseInt(laneStr, 10) : null;
      entriesByEvent[eventNumber].push({ swimmer: { ...swimmer, team }, heat: isNaN(heat) ? null : heat, lane: isNaN(lane) ? null : lane });
    });

    if (errors.length > 0) {
        toast.dismiss();
        toast.error(`Import failed with ${errors.length} errors. See console for details.`);
        console.error("Import Errors:", errors);
        setIsLoading(false);
        return;
    }
    
    const batch = writeBatch(db);
    for (const eventNumber in entriesByEvent) {
        const event = eventMap.get(eventNumber);
        const newEntries = entriesByEvent[eventNumber];
        let newHeats = JSON.parse(JSON.stringify(event.heats || []));
        const lanesAvailable = selectedMeet.lanesAvailable || 8;
        const isRelayEvent = event.name.toLowerCase().includes('relay');

        const manualEntries = newEntries.filter(e => e.heat && e.lane);
        const autoEntries = newEntries.filter(e => !e.heat || !e.lane);

        // --- PASS 1: Process manual entries first to reserve their spots ---
        manualEntries.forEach(entry => {
            const { swimmer, heat: manualHeat, lane: manualLane } = entry;
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
                errors.push(`Conflict: Lane ${manualLane} in Event #${eventNumber}, Heat ${targetHeat.heatNumber} is occupied.`);
            } else {
                targetLane.swimmers.push({ ...swimmer, seedTime: "NT" });
            }
        });

        // --- PASS 2: Process automatic entries, filling in the gaps ---
        if (autoEntries.length > 0) {
            let nextHeatNumber = newHeats.length > 0 ? Math.max(...newHeats.map(h => h.heatNumber)) + 1 : 1;
            let currentAutoHeat = { heatNumber: nextHeatNumber, lanes: [] };
            newHeats.push(currentAutoHeat);

            autoEntries.forEach(entry => {
                const { swimmer } = entry;
                const hasHomeAway = selectedMeet?.homeTeam && selectedMeet?.awayTeam;
                const isHomeTeamSwimmer = hasHomeAway && swimmer.team === selectedMeet.homeTeam;
                const lanePriority = hasHomeAway ? (isHomeTeamSwimmer ? 'odd' : 'even') : 'any';

                let placed = false;
                
                // Find and place in the current auto-generated heat
                const findAndPlaceInLane = (start, step) => {
                    for (let i = start; i <= lanesAvailable; i += step) {
                        let targetLane = currentAutoHeat.lanes.find(l => l.lane === i);
                        if (!targetLane) {
                            currentAutoHeat.lanes.push({ lane: i, swimmers: [{ ...swimmer, seedTime: "NT" }] });
                            return true;
                        }
                    }
                    return false;
                };

                if (currentAutoHeat.lanes.reduce((acc, l) => acc + l.swimmers.length, 0) < lanesAvailable) {
                    if (lanePriority === 'odd') { if(findAndPlaceInLane(1, 2) || findAndPlaceInLane(2, 2)) placed = true; }
                    else if (lanePriority === 'even') { if(findAndPlaceInLane(2, 2) || findAndPlaceInLane(1, 2)) placed = true; }
                    else { if(findAndPlaceInLane(1, 1)) placed = true; }
                }

                // If the current auto-heat is full, create a new one
                if (!placed) {
                    nextHeatNumber++;
                    currentAutoHeat = { heatNumber: nextHeatNumber, lanes: [] };
                    newHeats.push(currentAutoHeat);
                    const newLaneNumber = (lanePriority === 'even' && lanesAvailable >= 2) ? 2 : 1;
                    currentAutoHeat.lanes.push({ lane: newLaneNumber, swimmers: [{ ...swimmer, seedTime: "NT" }] });
                }
            });
        }
        
        newHeats.sort((a, b) => a.heatNumber - b.heatNumber);
        newHeats.forEach(heat => heat.lanes.sort((a,b) => a.lane - b.lane));
        console.debug(`Processed Event #${eventNumber}: ${newHeats.length} heats created.`);
        console.debug(newHeats);
        batch.update(doc(db, "meet_events", event.id), { heats: newHeats });
    }

    if (errors.length > 0) {
        toast.dismiss();
        toast.error(`${errors.length} conflicts found during import. See console for details.`);
        console.error("Import Conflicts:", errors);
        setIsLoading(false);
        return;
    }

    try {
        await batch.commit();
        toast.dismiss();
        toast.success("Bulk import completed successfully!");
        setCsvData("");
    } catch (error) {
        toast.dismiss();
        toast.error("An error occurred while saving the entries.");
        console.error(error);
    } finally {
        setIsLoading(false);
    }
  };

  const getPlaceholderText = () => {
      if (importType === 'entries') return "Team,FirstName,LastName,EventNumber,Heat,Lane...";
      if (importType === 'events') return "EventNumber,EventName...";
      if (importType === 'roster') return "FirstName,LastName,Age,Gender...";
  };

  const getFormatText = () => {
      if (importType === 'entries') return "Format: Team,FirstName,LastName,EventNumber,[Heat],[Lane] (Heat & Lane are optional)";
      if (importType === 'events') return "Format: EventNumber,EventName (e.g., 1,Boys 6 & Under 25m Freestyle)";
      if (importType === 'roster') return "Format: FirstName,LastName,[Age],[Gender] (Age and Gender are optional)";
  };

  return (
    <>
      <h5 className="font-semibold text-lg">Import Data</h5>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Select an import type, choose a meet or team, then upload or paste CSV data.
      </p>
      <div className="flex border-b border-border-light dark:border-border-dark mb-4">
          <button onClick={() => setImportType('entries')} className={`px-4 py-2 font-semibold ${importType === 'entries' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Entries</button>
          <button onClick={() => setImportType('events')} className={`px-4 py-2 font-semibold ${importType === 'events' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Events</button>
          <button onClick={() => setImportType('roster')} className={`px-4 py-2 font-semibold ${importType === 'roster' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Roster</button>
      </div>
      <div className="space-y-4">
        {importType === 'roster' ? (
            <AdminSelect label="1. Select Team to Import Roster For" id="teamSelectForRosterImport" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                <option value="" disabled>-- Choose a team --</option>
                {allTeams.map(team => <option key={team.id} value={team.id}>{team.fullName}</option>)}
            </AdminSelect>
        ) : (
            <AdminSelect label="1. Select Meet" id="meetSelectForImport" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                <option value="" disabled>-- Choose a meet --</option>
                {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
            </AdminSelect>
        )}
        <div>
            <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">2. Upload CSV File</label>
            <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
        </div>
        <div>
            <label htmlFor="csv-paste" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Or Paste CSV Data Below</label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{getFormatText()}</p>
            <textarea
                id="csv-paste"
                className="w-full h-48 mt-2 p-2 font-mono text-xs border border-border-light dark:border-border-dark rounded-md bg-gray-50 dark:bg-gray-900"
                placeholder={getPlaceholderText()}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
            />
        </div>
        <AdminButton onClick={handleImport} disabled={isLoading || (importType === 'roster' ? !selectedTeamId : !selectedMeetId)}>
            {isLoading ? 'Importing...' : <><Icon name="upload" className="mr-2" /> Import {importType.charAt(0).toUpperCase() + importType.slice(1)}</>}
        </AdminButton>
      </div>
    </>
  );
}

export default ImportManagement;
