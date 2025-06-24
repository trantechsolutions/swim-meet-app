import React from 'react';
import Icon from './Icon.jsx';

function EventCard({ event, favorites, currentEvent, toggleFavorite }) {
    const hasFavorite = (event.heats || []).some(h => h.lanes.some(l => favorites.has(l.id)));
    const isCurrent = currentEvent.isTracking && event.eventNumber === currentEvent.eventNumber;

    const cardClasses = [
        "bg-surface-light dark:bg-surface-dark rounded-lg mb-3 border border-border-light dark:border-border-dark overflow-hidden transition-all",
        hasFavorite ? "border-l-4 border-l-secondary" : "",
        isCurrent ? "border-2 border-primary dark:border-primary-light scale-[1.02]" : ""
    ].join(" ");

    return (
        <div className={cardClasses}>
            <div className="p-4 border-b border-border-light dark:border-border-dark font-bold">
                Event {event.eventNumber}: {event.name}
            </div>
            <div className="p-4 space-y-4">
                {event.heats && event.heats.length > 0 ? event.heats.map(heat => (
                    <div key={heat.heatNumber} className={`p-3 rounded-lg ${isCurrent && heat.heatNumber === currentEvent.heatNumber ? 'bg-primary/10 dark:bg-primary/20' : ''}`}>
                        <h6 className="mb-2 font-semibold text-gray-600 dark:text-gray-400">Heat {heat.heatNumber}</h6>
                        <ul className="divide-y divide-border-light dark:divide-border-dark -m-3">
                            {heat.lanes.map(lane => (
                                <li key={lane.lane} className="p-3 flex justify-between items-start">
                                    <div className="flex-grow">
                                        <strong className="font-semibold">Lane {lane.lane}:</strong>
                                        {/* Map over the swimmers in the lane */}
                                        {lane.swimmers.map(swimmer => (
                                            <div key={swimmer.id} className="ml-4 flex justify-between items-center">
                                                <span>{`${swimmer.firstName} ${swimmer.lastName}`} <span className="text-gray-500">({swimmer.team})</span></span>
                                                <button className="p-2 -m-2" onClick={() => toggleFavorite(swimmer.id)}>
                                                    <div className={`${favorites.has(swimmer.id) ? 'text-secondary' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        <Icon name="star" type={favorites.has(swimmer.id) ? 'fas' : 'far'} />
                                                    </div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )) : <p className="text-center text-gray-500">No heats or swimmers for this event yet.</p>}
            </div>
        </div>
    );
}

export default EventCard;