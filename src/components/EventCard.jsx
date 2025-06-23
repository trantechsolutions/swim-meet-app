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
                                <li key={lane.id} className="p-3 flex justify-between items-center">
                                    <div>
                                      <strong className="font-semibold">Lane {lane.lane}:</strong> {`${lane.firstName} ${lane.lastName}`} <span className="text-gray-500">({lane.team})</span>
                                    </div>
                                    <button className="p-2 -m-2" onClick={() => toggleFavorite(lane.id)} aria-label={`Toggle favorite for ${lane.firstName} ${lane.lastName}`}>
                                        <div className={`${favorites.has(lane.id) ? 'text-secondary' : 'text-gray-400 dark:text-gray-500'}`}>
                                            <Icon name="star" type={favorites.has(lane.id) ? 'fas' : 'far'} />
                                        </div>
                                    </button>
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