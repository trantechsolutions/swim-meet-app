import React from 'react';
import Icon from '../components/Icon.jsx';
import EventCard from '../components/EventCard.jsx';

export function SearchEventView({ search, setSearch, results, favorites, currentEvent, toggleFavorite }) {
    return (
        <div>
            <label htmlFor="event-search-input" className="sr-only">Search by event name or number</label>
            <input 
                id="event-search-input"
                type="text" 
                className="w-full p-3 mb-3 border border-border-light dark:border-border-dark rounded-md bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary focus:border-primary outline-none" 
                placeholder="Search by event name or number..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
            />
            {search && results.length === 0 && <p className="text-center text-gray-500">No events found.</p>}
            {results.map(event => (
                <EventCard key={event.id} event={event} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} />
            ))}
        </div>
    );
}

export function SearchSwimmerView({ search, setSearch, results, favorites, toggleFavorite }) {
    return (
        <div>
            <label htmlFor="swimmer-search-input" className="sr-only">Search for a swimmer</label>
            <input 
                id="swimmer-search-input"
                type="text" 
                className="w-full p-3 mb-3 border border-border-light dark:border-border-dark rounded-md bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary focus:border-primary outline-none" 
                placeholder="Search for a swimmer..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
            />
            {search && results.length === 0 && <p className="text-center text-gray-500">No swimmers found.</p>}
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md overflow-hidden border border-border-light dark:border-border-dark">
                <ul className="divide-y divide-border-light dark:divide-border-dark">
                    {results.map(swimmer => (
                        <li key={swimmer.id} className="p-4 flex justify-between items-center">
                            {/* The div now just displays the name and team */}
                            <div className="mr-auto font-bold">
                                {swimmer.name} ({swimmer.team})
                            </div>
                            <button className="p-2 -m-2" onClick={() => toggleFavorite(swimmer.id)} aria-label={`Toggle favorite for ${swimmer.name}`}>
                                <div className={`${favorites.has(swimmer.id) ? 'text-secondary' : 'text-gray-400 dark:text-gray-500'}`}>
                                    <Icon name="star" type={favorites.has(swimmer.id) ? 'fas' : 'far'} />
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}