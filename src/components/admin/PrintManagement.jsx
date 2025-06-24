import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminButton from '../../components/admin/AdminButton';
import PrintableHeatSheet from '../../components/PrintableHeatSheet';

function PrintManagement({ allMeets, toast }) {
  const [selectedMeetId, setSelectedMeetId] = useState("");
  const [filterType, setFilterType] = useState('full');
  const [subFilter, setSubFilter] = useState('');
  const [printTrigger, setPrintTrigger] = useState(false);

  const heatSheetRef = useRef(null);

  const selectedMeet = useMemo(() => {
    return allMeets.find(m => m.id === selectedMeetId);
  }, [allMeets, selectedMeetId]);

  const getAgeGroups = useMemo(() => {
    if (!selectedMeet?.events) return [];
    const groups = new Set();
    selectedMeet.events.forEach(event => {
      const match = event.name.match(/\d+( & Under|-\d+)/);
      if (match) groups.add(match[0].trim());
    });
    return Array.from(groups).sort((a, b) => parseInt(a) - parseInt(b));
  }, [selectedMeet]);

  const eventsToPrint = useMemo(() => {
    if (!selectedMeet?.events) return [];
    if (filterType === 'full') return selectedMeet.events;
    if (filterType === 'gender') {
      const currentSubFilter = subFilter || 'Girls';
      return selectedMeet.events.filter(event => event.name.toLowerCase().startsWith(currentSubFilter.toLowerCase()));
    }
    if (filterType === 'age') {
      const currentSubFilter = subFilter || (getAgeGroups.length > 0 ? getAgeGroups[0] : '');
      return selectedMeet.events.filter(event => event.name.includes(currentSubFilter));
    }
    return [];
  }, [selectedMeet, filterType, subFilter, getAgeGroups]);

  // Use useCallback to create a stable callback function.
  const onPrintCompleted = useCallback(() => {
    setPrintTrigger(false);
  }, []);

  // Memoize the configuration for useReactToPrint to stabilize `handlePrint`.
  const printConfig = useMemo(() => ({
    // FIX: Use the 'content' prop as per current library documentation.
    contentRef: () => heatSheetRef.current,
    documentTitle: `${selectedMeet?.name || 'Swim Meet'} - Heat Sheet`,
    onAfterPrint: onPrintCompleted,
    onPrintError: onPrintCompleted, // Also reset trigger on error.
  }), [selectedMeet, onPrintCompleted]);

  // `handlePrint` is now stable and will not cause unnecessary effect runs.
  const handlePrint = useReactToPrint(printConfig);

  useEffect(() => {
    if (printTrigger) {
      // The check for eventsToPrint.length should now work reliably.
      if (eventsToPrint.length > 0) {
        handlePrint();
      } else {
        toast.error("There are no events to print for this selection.");
        setPrintTrigger(false); // Reset if there's nothing to print.
      }
    }
    // The dependency array is now stable. `handlePrint` only changes when `printConfig` does.
  }, [printTrigger, eventsToPrint, handlePrint, toast]);

  const triggerPrint = () => {
    setPrintTrigger(true);
  };
  
  const getFormattedDate = () => {
    if (!selectedMeet?.date) return '';
    const date = selectedMeet.date instanceof Date ? selectedMeet.date : selectedMeet.date.toDate();
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <h5 className="font-semibold text-lg">Print Heat Sheets</h5>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Select a meet and filter options, then click the main print button.
      </p>

      <AdminSelect label="1. Select Meet" id="meetSelectForPrint" value={selectedMeetId} onChange={e => { setSelectedMeetId(e.target.value); setFilterType('full'); setSubFilter(''); }}>
        <option value="" disabled>-- Choose a meet --</option>
        {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
      </AdminSelect>

      {selectedMeetId && (
        <>
            <div className="my-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
                <h6 className="font-semibold text-primary dark:text-primary-light">Step 2: Choose Filters</h6>
                <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <button onClick={() => setFilterType('full')} className={`px-3 py-2 text-sm rounded-md border-2 ${filterType === 'full' ? 'border-primary bg-primary/10' : 'border-transparent'}`}>All Events</button>
                    <button onClick={() => setFilterType('gender')} className={`px-3 py-2 text-sm rounded-md border-2 ${filterType === 'gender' ? 'border-primary bg-primary/10' : 'border-transparent'}`}>By Gender</button>
                    <button onClick={() => setFilterType('age')} className={`px-3 py-2 text-sm rounded-md border-2 ${filterType === 'age' ? 'border-primary bg-primary/10' : 'border-transparent'}`}>By Age Group</button>
                </div>
                {filterType === 'gender' && (
                    <AdminSelect label="Select Gender" value={subFilter || 'Girls'} onChange={e => setSubFilter(e.target.value)} className="mt-4">
                        <option value="Girls">Girls</option>
                        <option value="Boys">Boys</option>
                    </AdminSelect>
                )}
                {filterType === 'age' && (
                    <AdminSelect label="Select Age Group" value={subFilter} onChange={e => setSubFilter(e.target.value)} className="mt-4">
                        <option value="" disabled>-- Select Age --</option>
                        {getAgeGroups.map(age => <option key={age} value={age}>{age}</option>)}
                    </AdminSelect>
                )}
            </div>
            
            <div className="mt-6">
                <AdminButton
                // The print button now calls window.print() directly
                onClick={() => window.print()}
                disabled={!eventsToPrint || eventsToPrint.length === 0}
              >
                    Print Heat Sheet ({eventsToPrint.length} events)
                </AdminButton>
            </div>
        </>
      )}
      
      {/* Hidden component that will be printed */}
      <PrintableHeatSheet 
        meetName={selectedMeet?.name}
        meetDate={getFormattedDate()}
        eventsToPrint={eventsToPrint} 
      />
    </>
  );
}

export default PrintManagement;