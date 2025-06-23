import React from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';

function ScheduleView({ events, favorites, currentEvent, toggleFavorite, adminRole, updateMeetStatus }) {
    if (!events || events.length === 0) {
        return <p className="text-center text-gray-500">No events found for this meet.</p>
    }

    const handleNextEvent = () => {
        const nextEventNumber = Math.min(events.length, currentEvent.eventNumber + 1);
        updateMeetStatus({ eventNumber: nextEventNumber, heatNumber: 1 });
    };
    const handlePrevEvent = () => {
        const prevEventNumber = Math.max(1, currentEvent.eventNumber - 1);
        updateMeetStatus({ eventNumber: prevEventNumber, heatNumber: 1 });
    };
    const toggleTracking = () => {
        updateMeetStatus({ isTracking: !currentEvent.isTracking });
    };

    return (
        <div>
            {adminRole && (
                 <div className="sticky top-0 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-sm z-10 p-2 rounded-lg border border-border-light dark:border-border-dark mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevEvent} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" aria-label="Previous Event"><Icon name="backward-step"/></button>
                        <div className="text-center">
                            <div className="font-semibold text-sm">Event {currentEvent.eventNumber}</div>
                        </div>
                        <button onClick={handleNextEvent} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" aria-label="Next Event"><Icon name="forward-step"/></button>
                    </div>
                    <button onClick={toggleTracking} className={`py-2 px-3 rounded-md font-semibold text-xs flex-shrink-0 ${currentEvent.isTracking ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'}`}>
                        {currentEvent.isTracking ? 'Stop Tracking' : 'Start Tracking'}
                    </button>
                 </div>
            )}
            {currentEvent.isTracking && !adminRole && (
                <div className="bg-primary text-white p-3 rounded-lg mb-4 shadow-md text-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider">Now Swimming</h2>
                    <div className="text-lg mt-1 font-semibold">Event #{currentEvent.eventNumber}</div>
                </div>
            )}
            {events.map(event => (
                <EventCard key={event.id} event={event} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} />
            ))}
        </div>
    );
}

export default ScheduleView;