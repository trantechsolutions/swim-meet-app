import React, { useState, useEffect, useMemo, useRef } from 'react';
import { firebaseConfig, ADMIN_TEAMS } from './config.js';
import { Toaster, toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

// --- Component and View Imports ---
import Icon from './components/Icon.jsx';
import Notification from './components/Notification.jsx';
import ReloadPrompt from './components/ReloadPrompt.jsx';
import ScheduleView from './views/ScheduleView.jsx';
import { SearchEventView, SearchSwimmerView } from './views/SearchView.jsx';
import AdminView from './views/AdminView.jsx';
import SettingsView from './views/SettingsView.jsx';
import PrintableHeatSheet from './components/PrintableHeatSheet.jsx';

// --- Firebase Imports ---
import { auth, db } from './firebase.js'; // Use the new central file
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously } from "firebase/auth";
import { collection, query, where, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

const provider = new GoogleAuthProvider();

// --- Helper functions for localStorage ---
const saveFavoritesToLocalStorage = (favorites) => {
    try {
        localStorage.setItem('swimMeetFavorites', JSON.stringify(Array.from(favorites)));
    } catch (error) {
        console.error("Error saving favorites:", error);
    }
};

const loadFavoritesFromLocalStorage = () => {
    try {
        const stored = localStorage.getItem('swimMeetFavorites');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
        console.error("Error loading favorites:", error);
        return new Set();
    }
};

// Main App Component
function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
    const [user, setUser] = useState(null);
    const [adminRole, setAdminRole] = useState(null);
    const [favorites, setFavorites] = useState(loadFavoritesFromLocalStorage);
    const [activeTab, setActiveTab] = useState('schedule');
    const [currentEvent, setCurrentEvent] = useState({ eventNumber: 1, heatNumber: 1, isTracking: false });
    const [eventSearch, setEventSearch] = useState('');
    const [swimmerSearch, setSwimmerSearch] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [favoritesOpen, setFavoritesOpen] = useState(false);
    const [meetData, setMeetData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allMeets, setAllMeets] = useState([]);
    const [selectedMeetId, setSelectedMeetId] = useState(null);
    const [allSwimmers, setAllSwimmers] = useState({});

    const heatSheetRef = useRef();
    const handlePrint = useReactToPrint({
        content: () => heatSheetRef.current,
        documentTitle: `${meetData?.name || 'Swim Meet'} - Heat Sheet`,
    });

    useEffect(() => {
        const applyTheme = (t) => {
            const effectiveTheme = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
            const root = document.documentElement;
            if (effectiveTheme === 'dark') {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };
        applyTheme(theme);
        localStorage.setItem('theme', theme);
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme(theme);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    useEffect(() => {
        if (!auth) {
            setError("Authentication service is not available.");
            return;
        };
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                if (currentUser.email && typeof ADMIN_TEAMS !== 'undefined') {
                    setAdminRole(ADMIN_TEAMS[currentUser.email] || null);
                } else {
                    setAdminRole(null);
                }
            } else {
                signInAnonymously(auth).catch(err => {
                    console.error("Anonymous sign-in failed:", err);
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;
        // This listener fetches all swimmers from all team rosters
        const rostersRef = collection(db, "rosters");
        const unsubscribe = onSnapshot(rostersRef, (querySnapshot) => {
            const swimmersMap = {};
            querySnapshot.forEach(doc => {
                const teamName = doc.id;
                const roster = doc.data().swimmers || [];
                roster.forEach(swimmer => {
                    swimmersMap[swimmer.id] = { ...swimmer, team: teamName };
                });
            });
            setAllSwimmers(swimmersMap);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;
        const meetsCollectionRef = collection(db, "meets");
        const unsubscribe = onSnapshot(meetsCollectionRef, (querySnapshot) => {
            const meetsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            })).sort((a,b) => a.date - b.date);

            setAllMeets(meetsList);

            if (!selectedMeetId && meetsList.length > 0) {
                const now = new Date();
                const upcomingMeet = meetsList.find(meet => meet.date >= now);
                setSelectedMeetId(upcomingMeet ? upcomingMeet.id : meetsList[meetsList.length - 1].id);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching meets:", err);
            setError("Could not load meets from the database.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db || !selectedMeetId) {
            setMeetData(null);
            return;
        };
        const meetInfo = allMeets.find(m => m.id === selectedMeetId);
        if (!meetInfo) return;
        const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(eventsQuery, (querySnapshot) => {
             const eventsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a,b) => a.eventNumber - b.eventNumber);
            setMeetData({
                ...meetInfo,
                events: eventsList
            });
        }, (err) => {
            console.error(`Error fetching events for meet ${selectedMeetId}:`, err);
            setError(`Could not load events for the selected meet.`);
        });
        return () => unsubscribe();
    }, [db, selectedMeetId, allMeets]);

    const handleSignIn = () => {
        if (!auth || !provider) return;
        signInWithPopup(auth, provider).catch(err => console.error("Sign-in failed:", err));
    };

    const handleSignOut = () => auth && auth.signOut();

    useEffect(() => {
        if (!db || !selectedMeetId) return;
        const docRef = doc(db, "meet_status", selectedMeetId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setCurrentEvent(docSnap.data());
            } else {
                 setDoc(docRef, { eventNumber: 1, heatNumber: 1, isTracking: false });
            }
        });
        return () => unsubscribe();
    }, [db, selectedMeetId]);

    const updateMeetStatus = async (statusUpdate) => {
        if (!db || !adminRole || !selectedMeetId) return;
        const docRef = doc(db, "meet_status", selectedMeetId);
        await updateDoc(docRef, statusUpdate);
    };

    useEffect(() => saveFavoritesToLocalStorage(favorites), [favorites]);

    const toggleFavorite = (swimmerId) => {
        setFavorites(prev => {
            const newFavs = new Set(prev);
            if (newFavs.has(swimmerId)) {
                newFavs.delete(swimmerId);
            } else {
                newFavs.add(swimmerId);
            }
            return newFavs;
        });
    };

    useEffect(() => {
        // Do nothing until the global swimmer list has been loaded.
        if (Object.keys(allSwimmers).length === 0) {
            return;
        }

        let favoritesWereCleaned = false;
        const cleanedFavorites = new Set(favorites);

        for (const swimmerId of cleanedFavorites) {
            // If a favorited swimmer's ID is NOT found in the global list...
            if (!allSwimmers[swimmerId]) {
                cleanedFavorites.delete(swimmerId); // ...remove it from the set.
                favoritesWereCleaned = true;
            }
        }

        // If any changes were made, update the state to trigger a re-render and save to localStorage.
        if (favoritesWereCleaned) {
            console.log("Cleaned stale swimmer IDs from favorites.");
            setFavorites(cleanedFavorites);
        }

    }, [allSwimmers, favorites]); // This runs whenever the global swimmer list or the favorites list changes.

    const favoriteResults = useMemo(() => {
        const favoritedIds = Array.from(favorites);

        return favoritedIds.map(swimmerId => {
            // 1. Get the swimmer's global details from our new allSwimmers state
            const swimmerDetails = allSwimmers[swimmerId];
            
            if (!swimmerDetails) {
                // Return a placeholder if the global roster hasn't loaded yet
                return { id: swimmerId, name: 'Loading swimmer...', team: '', events: [] };
            }

            // 2. Find events for this swimmer ONLY in the currently selected meet
            const eventsInCurrentMeet = [];
            if (meetData && meetData.events) {
                const abbreviate = name => (name || '').replace("Freestyle", "Free").replace("Backstroke", "Back").replace("Breaststroke", "Breast").replace("Butterfly", "Fly");
                meetData.events.forEach(event => {
                    if (event.heats) {
                        event.heats.forEach(heat => {
                            heat.lanes.forEach(lane => {
                                if (lane.id === swimmerId) {
                                    eventsInCurrentMeet.push(`E${event.eventNumber} H${heat.heatNumber} L${lane.lane}: ${abbreviate(event.name)}`);
                                }
                            });
                        });
                    }
                });
            }

            // 3. Return the combined data
            return {
                id: swimmerId,
                name: `${swimmerDetails.firstName} ${swimmerDetails.lastName}`,
                team: swimmerDetails.team,
                // The event list will be empty if the swimmer isn't in the current meet
                events: eventsInCurrentMeet,
                isInCurrentMeet: eventsInCurrentMeet.length > 0
            };
        }).sort((a,b) => a.name.localeCompare(b.name));

    }, [favorites, allSwimmers, meetData]);

    const swimmerSearchResults = useMemo(() => {
        // Return empty if there's no search term or if the global swimmer list isn't ready
        if (!swimmerSearch.trim() || Object.keys(allSwimmers).length === 0) {
            return [];
        }

        const query = swimmerSearch.toLowerCase();
        
        // Filter through the global list of all swimmers
        const results = Object.values(allSwimmers).filter(swimmer => {
            const fullName = `${swimmer.firstName} ${swimmer.lastName}`;
            return fullName.toLowerCase().includes(query);
        });

        // Map to a consistent result structure and sort
        return results
            .map(swimmer => ({
                id: swimmer.id,
                name: `${swimmer.firstName} ${swimmer.lastName}`,
                team: swimmer.team,
            }))
            .sort((a,b) => a.name.localeCompare(b.name));

    }, [swimmerSearch, allSwimmers]); // The hook now depends on allSwimmers, not meetData

    const eventSearchResults = useMemo(() => {
        if (!eventSearch.trim() || !meetData || !meetData.events) return [];
         const query = eventSearch.toLowerCase();
         return meetData.events.filter(event =>
            event.name.toLowerCase().includes(query) ||
            String(event.eventNumber).includes(query)
         );
    }, [eventSearch, meetData]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><h4 className="text-lg font-semibold">Loading Meet Data...</h4></div>;
    }

    if (error) {
        return <div className="container mx-auto mt-4"><div className="p-4 text-red-800 bg-red-100 border border-red-200 rounded-md">{error}</div></div>;
    }

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'schedule':
                 return meetData ? <ScheduleView events={meetData.events} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} adminRole={adminRole} updateMeetStatus={updateMeetStatus} /> : <p className="text-center">Select a meet to view the schedule.</p>;
            case 'searchEvents':
                return meetData ? <SearchEventView search={eventSearch} setSearch={setEventSearch} results={eventSearchResults} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to search events.</p>;
            case 'searchSwimmers':
                return meetData ? <SearchSwimmerView search={swimmerSearch} setSearch={setSwimmerSearch} results={swimmerSearchResults} favorites={favorites} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to search swimmers.</p>;
            case 'admin':
                return <AdminView adminRole={adminRole} allMeets={allMeets} toast={toast}/>;
            case 'settings':
                return <SettingsView theme={theme} setTheme={setTheme} user={user} isAuthorized={!!adminRole} handleSignIn={handleSignIn} handleSignOut={handleSignOut} />;
            default:
                return meetData ? <ScheduleView events={meetData.events} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} adminRole={adminRole} updateMeetStatus={updateMeetStatus}/> : <p className="text-center">Select a meet to view the schedule.</p>;
        }
    };

    return (
        <div className="bg-bg-light dark:bg-bg-dark text-text-dark dark:text-text-light transition-colors duration-300 pb-20 min-h-screen">
            <Toaster 
                position="top-center"
                reverseOrder={false}
                toastOptions={{
                    className: 'dark:bg-surface-dark dark:text-text-light',
                }}
            />
            <ReloadPrompt />
            
            <PrintableHeatSheet ref={heatSheetRef} meetData={meetData} />

            <div className="container mx-auto px-4 py-4">
                <header className="text-center mb-4">
                    {activeTab !== 'admin' && meetData ? (
                         <h1 className="font-bold text-3xl text-primary">{meetData.name}</h1>
                    ): (
                         <h1 className="font-bold text-3xl text-primary">Swim Meet Live</h1>
                    )}
                    {/* The new Print button - now only appears if there are events to print */}
                    {meetData && meetData.events && meetData.events.length > 0 && (
                        <button onClick={handlePrint} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title="Print Heat Sheet">
                            <Icon name="print" />
                        </button>
                    )}
                    {allMeets.length > 0 && activeTab !== 'admin' && (
                        <div className="mt-2 max-w-md mx-auto">
                             <select className="w-full p-2 border border-border-light dark:border-border-dark rounded-md text-sm bg-surface-light dark:bg-surface-dark text-text-dark dark:text-text-light" value={selectedMeetId || ""} onChange={e => setSelectedMeetId(e.target.value)}>
                                {allMeets.map(meet => (
                                    <option key={meet.id} value={meet.id}>
                                        {meet.name} - {meet.date.toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </header>

                {activeTab !== 'settings' && activeTab !== 'admin' && meetData && (
                     <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden mb-3">
                        <h2 className="accordion-header" id="favorites-header">
                            <button
                                className="flex justify-between items-center w-full p-4 font-semibold text-left bg-surface-light dark:bg-surface-dark text-text-dark dark:text-text-light"
                                onClick={() => setFavoritesOpen(!favoritesOpen)}
                                aria-expanded={favoritesOpen}
                                aria-controls="favorites-content"
                            >
                                <span>My Favorites ({favorites.size})</span>
                                <Icon name={favoritesOpen ? 'chevron-up' : 'chevron-down'} className={`transition-transform duration-200 ${favoritesOpen ? 'rotate-180' : ''}`}/>
                            </button>
                        </h2>
                        {favoritesOpen && (
                            <div 
                                id="favorites-content" 
                                className="p-4 bg-white dark:bg-surface-dark border-t border-border-light dark:border-border-dark"
                                role="region"
                                aria-labelledby="favorites-header"
                            >
                                {favoriteResults.length > 0 ? (
                                    <div className="divide-y divide-border-light dark:divide-border-dark -mx-4">
                                        {favoriteResults.map(swimmer => (
                                            <div key={swimmer.id} className="px-4 py-3 flex justify-between items-start">
                                                <div className="mr-auto">
                                                    <div className="font-bold flex items-center">
                                                        <span>{swimmer.name}</span>
                                                        {/* If swimmer is in the current meet, show a green dot indicator */}
                                                        {swimmer.isInCurrentMeet && (
                                                            <span 
                                                                className="ml-2 h-2.5 w-2.5 bg-green-500 rounded-full" 
                                                                title="Swimming in this meet">
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {/* If the event list is empty, show a helpful message */}
                                                        {swimmer.events.length > 0 ? (
                                                            swimmer.events.map((eventStr, index) => <div key={index}>{eventStr}</div>)
                                                        ) : (
                                                            <p className="italic text-gray-400 dark:text-gray-500 mt-1">Not in this meet</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* This button will now only render when the activeTab is 'searchSwimmers' */}
                                                {activeTab === 'searchSwimmers' && (
                                                    <button className="p-2 -m-2" onClick={() => toggleFavorite(swimmer.id)} aria-label={`Toggle favorite for ${swimmer.name}`}>
                                                        <div className="text-secondary"><Icon name="star" type="fas" /></div>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-center text-gray-500 dark:text-gray-400 mb-0">No favorites added yet. Tap the star next to a swimmer's name to add them.</p>}
                            </div>
                        )}
                    </div>
                )}

                <main>
                    {renderActiveTab()}
                </main>
            </div>
            <nav className="fixed bottom-0 left-0 w-full bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark z-30">
                <div className="flex justify-around items-center">
                    <button onClick={() => setActiveTab('schedule')} className={`flex-1 text-center py-2 px-1 rounded-lg text-sm transition-colors ${activeTab === 'schedule' ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-light' : 'text-gray-600 dark:text-gray-400'}`}><div><Icon name="list-ol" /></div><div className="text-xs">Schedule</div></button>
                    <button onClick={() => setActiveTab('searchEvents')} className={`flex-1 text-center py-2 px-1 rounded-lg text-sm transition-colors ${activeTab === 'searchEvents' ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-light' : 'text-gray-600 dark:text-gray-400'}`}><div><Icon name="magnifying-glass" /></div><div className="text-xs">Events</div></button>
                    <button onClick={() => setActiveTab('searchSwimmers')} className={`flex-1 text-center py-2 px-1 rounded-lg text-sm transition-colors ${activeTab === 'searchSwimmers' ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-light' : 'text-gray-600 dark:text-gray-400'}`}><div><Icon name="user" /></div><div className="text-xs">Swimmers</div></button>
                    {adminRole && <button onClick={() => setActiveTab('admin')} className={`flex-1 text-center py-2 px-1 rounded-lg text-sm transition-colors ${activeTab === 'admin' ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-light' : 'text-gray-600 dark:text-gray-400'}`}><div><Icon name="user-shield" /></div><div className="text-xs">Admin</div></button>}
                    <button onClick={() => setActiveTab('settings')} className={`flex-1 text-center py-2 px-1 rounded-lg text-sm transition-colors ${activeTab === 'settings' ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-light' : 'text-gray-600 dark:text-gray-400'}`}><div><Icon name="gear" /></div><div className="text-xs">Settings</div></button>
                </div>
            </nav>
        </div>
    );
}

export default App;