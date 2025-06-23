const { useState, useEffect, useMemo, useRef } = React;

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

// Reusable Icon Component
const Icon = ({ name, type = 'fas', ...props }) => <i className={`${type} fa-${name}`} {...props}></i>;

// A simple map to determine which team an admin belongs to.
const ADMIN_TEAMS = {
    'jonny5v@gmail.com': 'SUPERADMIN', 
    'admin@kenneraquatics.com': 'AQN',
    'coach@riverridgesharks.com': 'SCS',
    'admin@barracudaswim.org': 'BARR',
    'user@example.com': 'KLR' 
};

// --- Firebase Services ---
const {
    initializeApp,
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    getFirestore,
    collection,
    query,
    where,
    doc,
    onSnapshot,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    writeBatch,
    Timestamp
} = window.firebase;

let app, auth, db, provider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
} catch (e) {
    console.error("Firebase initialization failed. Make sure a valid config.js file is loaded before this script.", e);
}


// Main App Component
function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
    const [user, setUser] = useState(null);
    const [adminRole, setAdminRole] = useState(null); 
    const [favorites, setFavorites] = useState(new Set());
    const [activeTab, setActiveTab] = useState('schedule');
    const [currentEvent, setCurrentEvent] = useState({ eventNumber: 1, heatNumber: 1, isTracking: false });
    const [eventSearch, setEventSearch] = useState('');
    const [swimmerSearch, setSwimmerSearch] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    
    const [meetData, setMeetData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allMeets, setAllMeets] = useState([]);
    const [selectedMeetId, setSelectedMeetId] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ show: true, message, type });
        setTimeout(() => {
            setNotification({ show: false, message: '', type: '' });
        }, 3000);
    };

    useEffect(() => {
        const applyTheme = (t) => {
            document.documentElement.setAttribute('data-bs-theme', t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t);
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
                if (currentUser.email) {
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
    }, [db]);

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

    const toggleTracking = async () => {
        if (!db || !adminRole || !selectedMeetId) return;
        const docRef = doc(db, "meet_status", selectedMeetId);
        await setDoc(docRef, { isTracking: !currentEvent.isTracking }, { merge: true });
    };

    useEffect(() => setFavorites(loadFavoritesFromLocalStorage()), []);
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

    const favoriteResults = useMemo(() => {
        if (!meetData || !meetData.events) return [];
        const results = {};
        const abbreviate = name => (name || '').replace("Freestyle", "Free").replace("Backstroke", "Back").replace("Breaststroke", "Breast").replace("Butterfly", "Fly");
        meetData.events.forEach(event => {
            if(event.heats) {
                event.heats.forEach(heat => {
                    heat.lanes.forEach(lane => {
                        const fullName = `${lane.firstName} ${lane.lastName}`;
                        if (favorites.has(lane.id)) {
                            if (!results[fullName]) {
                                results[fullName] = { team: lane.team, events: [] };
                            }
                            results[fullName].events.push(`E${event.eventNumber} H${heat.heatNumber} L${lane.lane}: ${abbreviate(event.name)}`);
                        }
                    });
                });
            }
        });
        return Object.entries(results).map(([name, data]) => ({ name, ...data })).sort((a,b) => a.name.localeCompare(b.name));
    }, [favorites, meetData]);

    const swimmerSearchResults = useMemo(() => {
        if (!swimmerSearch.trim() || !meetData || !meetData.events) return [];
        const query = swimmerSearch.toLowerCase();
        const results = {};
         const abbreviate = name => (name || '').replace("Freestyle", "Free").replace("Backstroke", "Back").replace("Breaststroke", "Breast").replace("Butterfly", "Fly");
        meetData.events.forEach(event => {
             if(event.heats) {
                event.heats.forEach(heat => {
                    heat.lanes.forEach(lane => {
                        const fullName = `${lane.firstName} ${lane.lastName}`;
                        if (fullName.toLowerCase().includes(query)) {
                            if (!results[fullName]) {
                                results[fullName] = { team: lane.team, events: [] };
                            }
                            results[fullName].events.push(`E${event.eventNumber} H${heat.heatNumber} L${lane.lane}: ${abbreviate(event.name)}`);
                        }
                    });
                });
            }
        });
        return Object.entries(results).map(([name, data]) => ({ name, ...data }));
    }, [swimmerSearch, meetData]);
    
    const eventSearchResults = useMemo(() => {
        if (!eventSearch.trim() || !meetData || !meetData.events) return [];
         const query = eventSearch.toLowerCase();
         return meetData.events.filter(event => 
            event.name.toLowerCase().includes(query) ||
            String(event.eventNumber).includes(query)
         );
    }, [eventSearch, meetData]);

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center vh-100"><h4>Loading Meet Data...</h4></div>;
    }

    if (error) {
        return <div className="container mt-4"><div className="alert alert-danger">{error}</div></div>;
    }
    
    const renderActiveTab = () => {
        switch (activeTab) {
            case 'schedule':
                 return meetData ? <ScheduleView events={meetData.events} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to view the schedule.</p>;
            case 'searchEvents':
                return meetData ? <SearchEventView search={eventSearch} setSearch={setEventSearch} results={eventSearchResults} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to search events.</p>;
            case 'searchSwimmers':
                return meetData ? <SearchSwimmerView search={swimmerSearch} setSearch={setSwimmerSearch} results={swimmerSearchResults} favorites={favorites} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to search swimmers.</p>;
            case 'admin':
                return <AdminView adminRole={adminRole} allMeets={allMeets} showNotification={showNotification}/>;
            case 'settings':
                return <SettingsView theme={theme} setTheme={setTheme} user={user} isAuthorized={!!adminRole} handleSignIn={handleSignIn} handleSignOut={handleSignOut} />;
            default:
                return meetData ? <ScheduleView events={meetData.events} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} /> : <p className="text-center">Select a meet to view the schedule.</p>;
        }
    };
    
    return (
        <>
            <Notification show={notification.show} message={notification.message} type={notification.type} />
            <div className="container py-4">
                <header className="text-center mb-4">
                    {activeTab !== 'admin' && meetData ? (
                         <h1 className="fw-bold">{meetData.name}</h1>
                    ): (
                         <h1 className="fw-bold">Swim Meet Live</h1>
                    )}
                   
                    {allMeets.length > 0 && activeTab !== 'admin' && (
                        <div className="mt-2">
                             <select className="form-select form-select-sm" value={selectedMeetId || ""} onChange={e => setSelectedMeetId(e.target.value)}>
                                {allMeets.map(meet => (
                                    <option key={meet.id} value={meet.id}>
                                        {meet.name} - {meet.date.toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </header>
                
                 {adminRole && activeTab === 'schedule' && (
                    <div className="card bg-light-subtle mb-3">
                       <div className="card-body text-center">
                           <h5 className="card-title">Admin Controls</h5>
                            <p>Now: Event #{currentEvent.eventNumber}, Heat #{currentEvent.heatNumber}</p>
                           <div className="btn-group" role="group">
                             <button onClick={toggleTracking} className={`btn ${currentEvent.isTracking ? 'btn-warning' : 'btn-primary'}`}>
                                {currentEvent.isTracking ? 'Stop Tracking' : 'Start Tracking'}
                             </button>
                           </div>
                       </div>
                    </div>
                )}
                
                {activeTab !== 'settings' && activeTab !== 'admin' && meetData && (
                    <div className="accordion mb-3" id="favoritesAccordion">
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFavorites">
                                    My Favorites ({favorites.size})
                                </button>
                            </h2>
                            <div id="collapseFavorites" className="accordion-collapse collapse">
                                <div className="accordion-body">
                                    {favoriteResults.length > 0 ? (
                                        <ul className="list-group list-group-flush">
                                            {favoriteResults.map(swimmer => (
                                                <li key={swimmer.name} className="list-group-item d-flex justify-content-between align-items-start">
                                                    <div className="me-auto">
                                                        <div className="fw-bold">{swimmer.name}</div>
                                                        <div className="small text-muted">
                                                            {swimmer.events.map((eventStr, index) => <div key={index}>{eventStr}</div>)}
                                                        </div>
                                                    </div>
                                                    <button className="btn btn-sm" onClick={() => toggleFavorite(swimmer.name)}>
                                                        <div className="favorite-icon"><Icon name="star" type="fas" /></div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className="text-center text-muted mb-0">No favorites added yet. Tap the star next to a swimmer's name to add them.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <main>
                    {renderActiveTab()}
                </main>
            </div>
            <nav className="bottom-nav navbar fixed-bottom">
                <div className="container-fluid d-flex justify-content-around">
                    <button onClick={() => setActiveTab('schedule')} className={`btn flex-grow-1 ${activeTab === 'schedule' ? 'active' : ''}`}><div><Icon name="list-ol" /></div><div className="small">Schedule</div></button>
                    <button onClick={() => setActiveTab('searchEvents')} className={`btn flex-grow-1 ${activeTab === 'searchEvents' ? 'active' : ''}`}><div><Icon name="magnifying-glass" /></div><div className="small">Events</div></button>
                    <button onClick={() => setActiveTab('searchSwimmers')} className={`btn flex-grow-1 ${activeTab === 'searchSwimmers' ? 'active' : ''}`}><div><Icon name="user" /></div><div className="small">Swimmers</div></button>
                    {adminRole && <button onClick={() => setActiveTab('admin')} className={`btn flex-grow-1 ${activeTab === 'admin' ? 'active' : ''}`}><div><Icon name="user-shield" /></div><div className="small">Admin</div></button>}
                    <button onClick={() => setActiveTab('settings')} className={`btn flex-grow-1 ${activeTab === 'settings' ? 'active' : ''}`}><div><Icon name="gear" /></div><div className="small">Settings</div></button>
                </div>
            </nav>
        </>
    );
}

// --- View Components ---

function Notification({ show, message, type }) {
    return (
        <div className={`notification alert alert-${type} ${show ? 'show' : ''}`} role="alert">
            {message}
        </div>
    );
}

function ScheduleView({ events, favorites, currentEvent, toggleFavorite }) {
    if (!events || events.length === 0) {
        return <p className="text-center text-muted">No events found for this meet.</p>
    }
    return (
        <div>
            {currentEvent.isTracking && (
                <div className="now-swimming p-3 rounded mb-4 shadow text-center">
                    <h2 className="h6 text-uppercase">Now Swimming</h2>
                    <div className="h5 mt-1">Event #{currentEvent.eventNumber} - Heat #{currentEvent.heatNumber}</div>
                </div>
            )}
            {events.map(event => (
                <EventCard key={event.id} event={event} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} />
            ))}
        </div>
    );
}

function SearchEventView({ search, setSearch, results, favorites, currentEvent, toggleFavorite }) {
    return (
        <div>
            <input type="text" className="form-control mb-3" placeholder="Search by event name or number..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && results.length === 0 && <p className="text-center text-muted">No events found.</p>}
            {results.map(event => (
                <EventCard key={event.id} event={event} favorites={favorites} currentEvent={currentEvent} toggleFavorite={toggleFavorite} />
            ))}
        </div>
    );
}

function SearchSwimmerView({ search, setSearch, results, favorites, toggleFavorite }) {
    return (
        <div>
            <input type="text" className="form-control mb-3" placeholder="Search for a swimmer..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && results.length === 0 && <p className="text-center text-muted">No swimmers found.</p>}
            <ul className="list-group">
                {results.map(swimmer => (
                    <li key={swimmer.name} className="list-group-item d-flex justify-content-between align-items-start">
                        <div className="me-auto">
                            <div className="fw-bold">{swimmer.name} ({swimmer.team})</div>
                             <div className="small text-muted">
                                {swimmer.events.map((eventStr, index) => <div key={index}>{eventStr}</div>)}
                            </div>
                        </div>
                        <button className="btn btn-sm" onClick={() => toggleFavorite(swimmer.name)}>
                             <div className={`favorite-icon ${!favorites.has(swimmer.name) ? 'inactive' : ''}`}>
                                <Icon name="star" type={favorites.has(swimmer.name) ? 'fas' : 'far'} />
                             </div>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function AdminView({ adminRole, allMeets, showNotification }) {
    const [adminSubView, setAdminSubView] = useState('meets');

    if (!adminRole) {
        return <div className="alert alert-warning">You are not authorized to view this page.</div>;
    }

    const renderSubView = () => {
        switch(adminSubView) {
            case 'meets':
                return <MeetManagement showNotification={showNotification} allMeets={allMeets} />;
            case 'library':
                return <EventLibraryManagement adminRole={adminRole} showNotification={showNotification} />;
            case 'schedule':
                return <ScheduleManagement allMeets={allMeets} showNotification={showNotification} />;
            case 'rosters':
                 return <RosterManagement adminRole={adminRole} showNotification={showNotification} />;
            case 'entries':
                 return <EntryManagement adminRole={adminRole} allMeets={allMeets} showNotification={showNotification} />;
            default:
                return null;
        }
    };

    return (
        <div className="admin-view">
            <h2 className="h4 mb-3">Admin Panel</h2>
            <ul className="nav nav-pills nav-fill flex-column flex-sm-row mb-3">
                <li className="nav-item"><button className={`nav-link ${adminSubView === 'meets' ? 'active' : ''}`} onClick={() => setAdminSubView('meets')}>Meets</button></li>
                <li className="nav-item"><button className={`nav-link ${adminSubView === 'library' ? 'active' : ''}`} onClick={() => setAdminSubView('library')}>Library</button></li>
                <li className="nav-item"><button className={`nav-link ${adminSubView === 'schedule' ? 'active' : ''}`} onClick={() => setAdminSubView('schedule')}>Schedule</button></li>
                <li className="nav-item"><button className={`nav-link ${adminSubView === 'rosters' ? 'active' : ''}`} onClick={() => setAdminSubView('rosters')}>Rosters</button></li>
                <li className="nav-item"><button className={`nav-link ${adminSubView === 'entries' ? 'active' : ''}`} onClick={() => setAdminSubView('entries')}>Entries</button></li>
            </ul>
            <div className="card">
                <div className="card-body">
                    {renderSubView()}
                </div>
            </div>
        </div>
    );
}

function MeetManagement({ showNotification, allMeets }) {
    const [meetName, setMeetName] = useState("");
    const [meetDate, setMeetDate] = useState("");
    const [editingMeet, setEditingMeet] = useState(null);
    
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    }

    const handleEditClick = (meet) => {
        setEditingMeet(meet);
        setMeetName(meet.name);
        setMeetDate(formatDateForInput(meet.date));
    };

    const resetForm = () => {
        setMeetName("");
        setMeetDate("");
        setEditingMeet(null);
    };

    const handleDeleteClick = async (meetId, meetName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete "${meetName}" and all of its scheduled events. This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                // Delete all events associated with the meet
                const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", meetId));
                const eventDocs = await getDocs(eventsQuery);
                const batch = writeBatch(db);
                eventDocs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                // Delete the meet itself
                batch.delete(doc(db, "meets", meetId));
                await batch.commit();
                showNotification(`"${meetName}" and all its events were deleted.`, 'success');
            } catch (error) {
                showNotification("Failed to delete meet and its events.", 'danger');
                console.error("Error deleting meet:", error);
            }
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!meetName.trim() || !meetDate) {
            showNotification("Please provide a name and a date for the meet.", "warning");
            return;
        }

        const date = new Date(meetDate);

        try {
            if (editingMeet) {
                const meetRef = doc(db, "meets", editingMeet.id);
                await updateDoc(meetRef, {
                    name: meetName,
                    date: Timestamp.fromDate(date)
                });
                 showNotification("Meet updated successfully!", "success");
            } else {
                const meetsCollectionRef = collection(db, "meets");
                await addDoc(meetsCollectionRef, {
                    name: meetName,
                    date: Timestamp.fromDate(date)
                });
                showNotification("Meet successfully added!", "success");
            }
            resetForm();
        } catch (error) {
            console.error("Error saving meet:", error);
            showNotification("Failed to save meet.", "danger");
        }
    };

    return (
         <>
            <h5 className="card-title">{editingMeet ? 'Edit Meet' : 'Create New Meet'}</h5>
            <form onSubmit={handleFormSubmit}>
                <div className="mb-3">
                    <label htmlFor="meetName" className="form-label">Meet Name</label>
                    <input type="text" id="meetName" className="form-control" value={meetName} onChange={e => setMeetName(e.target.value)} />
                </div>
                <div className="mb-3">
                    <label htmlFor="meetDate" className="form-label">Meet Date</label>
                    <input type="date" id="meetDate" className="form-control" value={meetDate} onChange={e => setMeetDate(e.target.value)} />
                </div>
                <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary">{editingMeet ? 'Update Meet' : 'Add Meet'}</button>
                    {editingMeet && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
                </div>
            </form>
            <hr/>
            <h5 className="mt-3">Existing Meets</h5>
             <ul className="list-group">
                {allMeets.map(meet => (
                    <li key={meet.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{meet.name} ({meet.date.toLocaleDateString()})</span>
                        <div>
                            <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEditClick(meet)}><Icon name="pencil-alt"/></button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteClick(meet.id, meet.name)}><Icon name="trash"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

function EventLibraryManagement({ adminRole, showNotification }) {
    const [eventName, setEventName] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
        const libraryRef = collection(db, "event_library");
        const unsubscribe = onSnapshot(libraryRef, (snapshot) => {
            const templates = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b) => a.name.localeCompare(b.name));
            setEventLibrary(templates);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setEventName("");
        setEditingEvent(null);
    }
    
    const handleEditClick = (event) => {
        setEditingEvent(event);
        setEventName(event.name);
    }
    
    const handleRemoveClick = async (eventId, eventName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete "${eventName}" from the Event Library.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        if(result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "event_library", eventId));
                showNotification("Library event deleted successfully.", "success");
            } catch (error) {
                 showNotification("Error deleting library event.", "danger");
                 console.error("Error removing library event: ", error);
            }
        }
    }

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!eventName.trim()) {
            showNotification("Event name cannot be empty.", "warning");
            return;
        }

        try {
            if(editingEvent) {
                const eventRef = doc(db, "event_library", editingEvent.id);
                await updateDoc(eventRef, { name: eventName });
                showNotification("Library event updated successfully.", "success");
            } else {
                await addDoc(collection(db, "event_library"), { name: eventName });
                showNotification("Library event created successfully.", "success");
            }
            resetForm();
        } catch (error) {
            showNotification("Error saving library event.", "danger");
            console.error("Error saving library event:", error);
        }
    };
    
    const handleBulkLoad = async () => {
        const result = await Swal.fire({
            title: 'Bulk Load Events?',
            text: "This will add any missing standard events to the library. It will not create duplicates.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, load them!'
        });
        
        if (!result.isConfirmed) return;

        const standardEvents = [
            "Girls 6 & Under 25m Freestyle", "Boys 6 & Under 25m Freestyle", "Girls 7-8 25m Freestyle", "Boys 7-8 25m Freestyle",
            "Girls 9-10 50m Freestyle", "Boys 9-10 50m Freestyle", "Girls 11-12 50m Freestyle", "Boys 11-12 50m Freestyle",
            "Girls 13-14 50m Freestyle", "Boys 13-14 50m Freestyle", "Girls 15-17 50m Freestyle", "Boys 15-17 50m Freestyle",
            "Girls 9-10 100m Freestyle", "Boys 9-10 100m Freestyle", "Girls 11-12 100m Freestyle", "Boys 11-12 100m Freestyle",
            "Girls 13-14 100m Freestyle", "Boys 13-14 100m Freestyle", "Girls 15-17 100m Freestyle", "Boys 15-17 100m Freestyle",
            "Girls 11-12 200m Freestyle", "Boys 11-12 200m Freestyle", "Girls 13-14 200m Freestyle", "Boys 13-14 200m Freestyle",
            "Girls 15-17 200m Freestyle", "Boys 15-17 200m Freestyle", "Girls 6 & Under 25m Backstroke", "Boys 6 & Under 25m Backstroke",
            "Girls 7-8 25m Backstroke", "Boys 7-8 25m Backstroke", "Girls 9-10 50m Backstroke", "Boys 9-10 50m Backstroke",
            "Girls 11-12 50m Backstroke", "Boys 11-12 50m Backstroke", "Girls 13-14 100m Backstroke", "Boys 13-14 100m Backstroke",
            "Girls 15-17 100m Backstroke", "Boys 15-17 100m Backstroke", "Girls 7-8 25m Breaststroke", "Boys 7-8 25m Breaststroke",
            "Girls 9-10 50m Breaststroke", "Boys 9-10 50m Breaststroke", "Girls 11-12 50m Breaststroke", "Boys 11-12 50m Breaststroke",
            "Girls 13-14 100m Breaststroke", "Boys 13-14 100m Breaststroke", "Girls 15-17 100m Breaststroke", "Boys 15-17 100m Breaststroke",
            "Girls 7-8 25m Butterfly", "Boys 7-8 25m Butterfly", "Girls 9-10 50m Butterfly", "Boys 9-10 50m Butterfly",
            "Girls 11-12 50m Butterfly", "Boys 11-12 50m Butterfly", "Girls 13-14 100m Butterfly", "Boys 13-14 100m Butterfly",
            "Girls 15-17 100m Butterfly", "Boys 15-17 100m Butterfly", "Girls 9-10 100m IM", "Boys 9-10 100m IM",
            "Girls 11-12 100m IM", "Boys 11-12 100m IM", "Girls 13-14 200m IM", "Boys 13-14 200m IM",
            "Girls 15-17 200m IM", "Boys 15-17 200m IM"
        ];
        
        const existingEventNames = new Set(eventLibrary.map(t => t.name));
        const eventsToAdd = standardEvents.filter(name => !existingEventNames.has(name));
        
        if (eventsToAdd.length === 0) {
            showNotification("All standard library events already exist.", "info");
            return;
        }

        showNotification(`Adding ${eventsToAdd.length} new library events...`, "info");
        const batch = writeBatch(db);
        eventsToAdd.forEach(name => {
            const newDocRef = doc(collection(db, "event_library"));
            batch.set(newDocRef, { name });
        });
        
        try {
            await batch.commit();
            showNotification("Bulk load complete!", "success");
        } catch (error) {
            showNotification("An error occurred during bulk load.", "danger");
            console.error("Bulk load error:", error);
        }
    };

    return (
        <>
            <h5 className="card-title">Event Library</h5>
            <p className="card-text text-muted">Create a master list of reusable event types.</p>
            {adminRole === 'SUPERADMIN' && (
                <>
                    <form onSubmit={handleFormSubmit} className="mb-3">
                        <div className="mb-3">
                            <label htmlFor="libraryEventName" className="form-label">{editingEvent ? 'Edit Event Name' : 'New Event Name'}</label>
                            <input type="text" id="libraryEventName" className="form-control" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g., Girls 9-10 50m Freestyle" />
                        </div>
                        <div className="d-grid gap-2">
                             <button type="submit" className="btn btn-primary">{editingEvent ? 'Update Event' : 'Create Event'}</button>
                             {editingEvent && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
                        </div>
                    </form>
                    <div className="d-grid">
                         <button className="btn btn-outline-secondary" onClick={handleBulkLoad}>Bulk Load Standard Events</button>
                    </div>
                </>
            )}
            <hr />
            <h5 className="card-title mt-3">Existing Library Events</h5>
            <ul className="list-group">
                {eventLibrary.map(event => (
                    <li key={event.id} className="list-group-item d-flex justify-content-between align-items-center">
                        {event.name}
                        {adminRole === 'SUPERADMIN' && (
                            <div>
                                <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEditClick(event)}><Icon name="pencil-alt"/></button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveClick(event.id, event.name)}><Icon name="trash"/></button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}

function ScheduleManagement({ allMeets, showNotification }) {
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [eventLibrary, setEventLibrary] = useState([]);
    const [selectedLibraryEventId, setSelectedLibraryEventId] = useState("");
    const [eventNumber, setEventNumber] = useState("");
    const [scheduledEvents, setScheduledEvents] = useState([]);
    const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
        const libraryRef = collection(db, "event_library");
        const unsubscribe = onSnapshot(libraryRef, (snapshot) => {
            const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
            setEventLibrary(templates);
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (!selectedMeetId) {
            setScheduledEvents([]);
            return;
        }
        const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b)=> a.eventNumber - b.eventNumber);
            setScheduledEvents(events);
        });
        return () => unsubscribe();
    }, [selectedMeetId]);

    const resetForm = () => {
        setSelectedLibraryEventId("");
        setEventNumber("");
        setEditingEvent(null);
    };

    const handleEditClick = (event) => {
        setEditingEvent(event);
        setSelectedLibraryEventId(event.libraryEventId);
        setEventNumber(event.eventNumber);
    };

    const handleRemoveClick = async (eventId, eventName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Remove "${eventName}" from this meet's schedule?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "meet_events", eventId));
                showNotification("Event removed from schedule.", "success");
            } catch (error) {
                showNotification("Failed to remove event.", "danger");
                console.error("Error removing event from schedule:", error);
            }
        }
    };
    
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (editingEvent) {
            if (!eventNumber) {
                showNotification("Event number cannot be empty.", "warning");
                return;
            }
            const eventRef = doc(db, "meet_events", editingEvent.id);
            try {
                await updateDoc(eventRef, {
                    eventNumber: parseInt(eventNumber, 10)
                });
                showNotification("Event updated successfully!", "success");
                resetForm();
            } catch (error) {
                showNotification("Failed to update event.", "danger");
                console.error("Error updating event:", error);
            }
        } else {
            if (!selectedMeetId || !selectedLibraryEventId || !eventNumber) {
                showNotification("Please fill out all fields.", "warning");
                return;
            }
            const libraryEvent = eventLibrary.find(t => t.id === selectedLibraryEventId);
            if (!libraryEvent) {
                showNotification("Selected library event not found.", "danger");
                return;
            }
            const eventData = {
                meetId: selectedMeetId,
                libraryEventId: selectedLibraryEventId,
                name: libraryEvent.name,
                eventNumber: parseInt(eventNumber, 10),
                heats: []
            };
            try {
                await addDoc(collection(db, "meet_events"), eventData);
                showNotification(`Event "${libraryEvent.name}" added to the meet.`, "success");
                resetForm();
            } catch (error) {
                showNotification("Error adding event to meet.", "danger");
                console.error(error);
            }
        }
    };

    const handleBulkSchedule = async () => {
         const result = await Swal.fire({
            title: 'Bulk Add Schedule?',
            text: `This will add ALL events from the library to this meet, sorted by stroke, age, gender, and distance. It will not create duplicates.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, create schedule!'
        });
        if(!result.isConfirmed || !selectedMeetId) return;

        const scheduledEventNames = new Set(scheduledEvents.map(e => e.name));
        const eventsToAdd = eventLibrary.filter(libEvent => !scheduledEventNames.has(libEvent.name));
        
        if (eventsToAdd.length === 0) {
            showNotification("All library events are already scheduled for this meet.", "info");
            return;
        }
        
        const sortOrder = { "Freestyle": 1, "Backstroke": 2, "Breaststroke": 3, "Butterfly": 4, "IM": 5 };
        const parseEventNameForSort = (name) => {
            const parts = name.split(' ');
            const gender = parts[0]; 
            const ageGroup = parts[1];
            const distance = parseInt(parts[2].replace('m', ''));
            const stroke = parts[3];
            
            let ageMin;
            if (ageGroup.includes('&')) {
                ageMin = parseInt(ageGroup.split('&')[0]);
            } else if (ageGroup.includes('-')) {
                ageMin = parseInt(ageGroup.split('-')[0]);
            } else {
                ageMin = parseInt(ageGroup);
            }

            return { gender, ageMin, distance, stroke: sortOrder[stroke] || 99 };
        };

        eventsToAdd.sort((a, b) => {
            const parsedA = parseEventNameForSort(a.name);
            const parsedB = parseEventNameForSort(b.name);
            
            if (parsedA.stroke !== parsedB.stroke) return parsedA.stroke - parsedB.stroke;
            if (parsedA.ageMin !== parsedB.ageMin) return parsedA.ageMin - parsedB.ageMin;
            if (parsedA.gender !== parsedB.gender) return parsedA.gender === 'Girls' ? -1 : 1;
            return parsedA.distance - parsedB.distance;
        });

        const batch = writeBatch(db);
        let currentEventNumber = scheduledEvents.length + 1;
        eventsToAdd.forEach(libEvent => {
            const newEventRef = doc(collection(db, "meet_events"));
            batch.set(newEventRef, {
                meetId: selectedMeetId,
                libraryEventId: libEvent.id,
                name: libEvent.name,
                eventNumber: currentEventNumber++,
                heats: []
            });
        });
        
        try {
            await batch.commit();
            showNotification(`${eventsToAdd.length} events have been added to the schedule.`, 'success');
        } catch(e) {
            showNotification('Error bulk-adding schedule.', 'danger');
            console.error(e);
        }
    };
    
    return (
        <>
            <h5 className="card-title">Manage a Meet's Schedule</h5>
            <p className="card-text text-muted">Assign library events to a meet and give them an event number.</p>
            <div className="mb-3">
                <label htmlFor="meetSelectForSchedule" className="form-label">1. Select Meet</label>
                <select id="meetSelectForSchedule" className="form-select" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                    <option value="" disabled>-- Choose a meet --</option>
                    {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
                </select>
            </div>
            {selectedMeetId && (
                <>
                <form onSubmit={handleFormSubmit}>
                    <h6 className="mt-4">{editingEvent ? "Editing Event" : "Add New Event"}</h6>
                    <div className="mb-3">
                        <label htmlFor="libraryEventSelect" className="form-label">Library Event</label>
                        <select id="libraryEventSelect" className="form-select" value={selectedLibraryEventId} onChange={e => setSelectedLibraryEventId(e.target.value)} disabled={!!editingEvent}>
                            <option value="" disabled>-- Choose an event --</option>
                            {eventLibrary.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="eventNumberSchedule" className="form-label">Event Number</label>
                        <input type="number" id="eventNumberSchedule" className="form-control" value={eventNumber} onChange={e => setEventNumber(e.target.value)} />
                    </div>
                    <div className="d-grid gap-2">
                        <button type="submit" className="btn btn-primary">{editingEvent ? 'Update Event' : 'Add Event to Schedule'}</button>
                        {editingEvent && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel Edit</button>}
                    </div>
                </form>
                <div className="d-grid gap-2 mt-3">
                    <button className="btn btn-outline-success" onClick={handleBulkSchedule}>Bulk Add Full Schedule</button>
                </div>
                 <>
                    <hr/>
                    <h5 className="mt-3">Current Schedule</h5>
                    <ul className="list-group">
                        {scheduledEvents.map(event => (
                            <li key={event.id} className="list-group-item d-flex justify-content-between align-items-center">
                                <span><strong>E{event.eventNumber}:</strong> {event.name}</span>
                                <div>
                                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEditClick(event)}>Edit</button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveClick(event.id, event.name)}>Remove</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                 </>
                </>
            )}
        </>
    );
}

function RosterManagement({ adminRole, showNotification }) {
    const isSuperAdmin = adminRole === 'SUPERADMIN';
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [swimmerForm, setSwimmerForm] = useState({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });
    const allTeams = useMemo(() => Object.values(ADMIN_TEAMS).filter(r => r !== 'SUPERADMIN').sort(), []);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (managingTeam) {
            const rosterDocRef = doc(db, 'rosters', managingTeam);
            const unsubscribe = onSnapshot(rosterDocRef, (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers || [] : []);
            });
            return () => unsubscribe();
        } else {
            setRoster([]);
        }
    }, [managingTeam]);
    
    const resetForm = () => setSwimmerForm({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const { id, firstName, lastName, age, gender } = swimmerForm;
        if (!firstName.trim() || !lastName.trim() || !age || !managingTeam) {
            showNotification("Please select a team and fill out all swimmer fields.", "warning");
            return;
        }
        
        let newRoster;
        if (id) { // Editing existing swimmer
            newRoster = roster.map(swimmer => swimmer.id === id ? { ...swimmer, firstName, lastName, age: parseInt(age), gender } : swimmer);
        } else { // Adding new swimmer
            newRoster = [...roster, { id: crypto.randomUUID(), firstName, lastName, age: parseInt(age), gender }];
        }
        
        const rosterDocRef = doc(db, 'rosters', managingTeam);
        await setDoc(rosterDocRef, { swimmers: newRoster }, { merge: true });
        showNotification(`Swimmer ${id ? 'updated' : 'added'} successfully!`, "success");
        resetForm();
    };

    const handleEditClick = (swimmer) => {
        setSwimmerForm(swimmer);
    };

    const handleRemoveClick = async (swimmerToRemove) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This will remove ${swimmerToRemove.firstName} ${swimmerToRemove.lastName} from the roster and all events they are entered in.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete them!'
        });
        if(!result.isConfirmed) return;
        
        // Remove from roster
        const newRoster = roster.filter(s => s.id !== swimmerToRemove.id);
        const rosterDocRef = doc(db, 'rosters', managingTeam);
        await setDoc(rosterDocRef, { swimmers: newRoster });
        
        // Remove from all event entries
        const allEventsQuery = query(collection(db, "meet_events"));
        const allEventsSnap = await getDocs(allEventsQuery);
        const batch = writeBatch(db);
        allEventsSnap.forEach(eventDoc => {
            const eventData = eventDoc.data();
            if(eventData.heats) {
                let heatsModified = false;
                const newHeats = eventData.heats.map(heat => {
                    const originalLaneCount = heat.lanes.length;
                    const filteredLanes = heat.lanes.filter(lane => lane.id !== swimmerToRemove.id);
                    if(originalLaneCount > filteredLanes.length) {
                        heatsModified = true;
                    }
                    return {...heat, lanes: filteredLanes};
                }).filter(heat => heat.lanes.length > 0);
                
                if(heatsModified) {
                    batch.update(eventDoc.ref, { heats: newHeats });
                }
            }
        });
        await batch.commit();

        showNotification("Swimmer removed from roster and all entries.", "success");
    };

     const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = lines.shift().toLowerCase().split(',').map(h => h.trim());
            
            if (headers[0] !== 'firstname' || headers[1] !== 'lastname' || headers[2] !== 'age' || headers[3] !== 'gender') {
                showNotification("Invalid CSV headers. Must be: firstName,lastName,age,gender", "danger");
                return;
            }

            const newSwimmers = lines.map(line => {
                const [firstName, lastName, age, gender] = line.split(',');
                return { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), age: parseInt(age), gender: gender.trim() };
            });

            const newRoster = [...roster, ...newSwimmers];
            const rosterDocRef = doc(db, 'rosters', managingTeam);
            await setDoc(rosterDocRef, { swimmers: newRoster }, { merge: true });
            showNotification(`Bulk upload successful! Added ${newSwimmers.length} swimmers.`, "success");
            fileInputRef.current.value = ""; // Reset file input
        };
        reader.readAsText(file);
    };

    return (
        <>
            <h5 className="card-title">Manage Team Rosters</h5>
            <p className="card-text text-muted">Add or view swimmers for a specific team.</p>
            {isSuperAdmin && (
                 <div className="mb-3">
                    <label htmlFor="teamSelectRoster" className="form-label">1. Select Team</label>
                    <select id="teamSelectRoster" className="form-select" value={managingTeam || ""} onChange={e => setManagingTeam(e.target.value)}>
                        <option value="" disabled>-- Choose a Team --</option>
                        {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
                    </select>
                </div>
            )}
            {managingTeam && (
                <>
                    <h6 className="card-title mt-4">{swimmerForm.id ? 'Edit Swimmer' : 'Add Swimmer'} to {managingTeam}</h6>
                    <form onSubmit={handleFormSubmit} className="row g-2 mb-3 align-items-end">
                        <div className="col-sm">
                            <label htmlFor="swimmerFirstName" className="form-label">First Name</label>
                            <input type="text" className="form-control" id="swimmerFirstName" value={swimmerForm.firstName} onChange={e => setSwimmerForm({...swimmerForm, firstName: e.target.value})} />
                        </div>
                        <div className="col-sm">
                            <label htmlFor="swimmerLastName" className="form-label">Last Name</label>
                            <input type="text" className="form-control" id="swimmerLastName" value={swimmerForm.lastName} onChange={e => setSwimmerForm({...swimmerForm, lastName: e.target.value})} />
                        </div>
                        <div className="col-sm-2">
                            <label htmlFor="swimmerAge" className="form-label">Age</label>
                            <input type="number" className="form-control" id="swimmerAge" value={swimmerForm.age} onChange={e => setSwimmerForm({...swimmerForm, age: e.target.value})} />
                        </div>
                         <div className="col-sm-3">
                            <label htmlFor="swimmerGender" className="form-label">Gender</label>
                             <select id="swimmerGender" className="form-select" value={swimmerForm.gender} onChange={e => setSwimmerForm({...swimmerForm, gender: e.target.value})}>
                                 <option value="Boy">Boy</option>
                                 <option value="Girl">Girl</option>
                             </select>
                        </div>
                        <div className="col-sm-auto d-grid">
                             <label className="form-label d-block">&nbsp;</label>
                            <button type="submit" className="btn btn-primary">{swimmerForm.id ? 'Update' : 'Add'}</button>
                        </div>
                         {swimmerForm.id && <div className="col-sm-auto d-grid"> <label className="form-label d-block">&nbsp;</label><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>}
                    </form>
                     <div className="mb-3">
                         <label htmlFor="csvUpload" className="form-label">Bulk Upload Roster (CSV)</label>
                         <input type="file" className="form-control" id="csvUpload" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} />
                         <div className="form-text">CSV format: firstName,lastName,age,gender (with header row)</div>
                     </div>
                     <hr/>
                     <h6 className="card-title mt-3">Team Roster for {managingTeam}</h6>
                     <ul className="list-group">
                        {roster.length > 0 ? roster.map(swimmer => (
                            <li key={swimmer.id} className="list-group-item d-flex justify-content-between align-items-center">
                                <span>{swimmer.firstName} {swimmer.lastName} (Age: {swimmer.age}, {swimmer.gender})</span>
                                <div>
                                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEditClick(swimmer)}><Icon name="pencil-alt"/></button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveClick(swimmer)}><Icon name="trash"/></button>
                                </div>
                            </li>
                        )) : <li className="list-group-item text-muted">No swimmers on this roster yet.</li>}
                    </ul>
                </>
            )}
        </>
    );
}

function EntryManagement({ adminRole, allMeets, showNotification }) {
    const isSuperAdmin = adminRole === 'SUPERADMIN';
    const [selectedMeetId, setSelectedMeetId] = useState("");
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [selectedSwimmerId, setSelectedSwimmerId] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [eventsForMeet, setEventsForMeet] = useState([]);
    
    const selectedSwimmer = roster.find(s => s.id === selectedSwimmerId);

    const eligibleEvents = useMemo(() => {
        if(!selectedSwimmer || !eventsForMeet) return [];
        
        const getEventAgeAndGender = (eventName) => {
            const nameLower = eventName.toLowerCase();
            const gender = nameLower.startsWith('girls') ? 'Girl' : nameLower.startsWith('boys') ? 'Boy' : 'Mixed';
            
            const ageMatch = eventName.match(/(\d+)(-(\d+))?(\s*&\s*Under)?/);
            if (!ageMatch) return { minAge: 0, maxAge: 100, gender };
            
            if (ageMatch[4]) { // Handles "8 & Under"
                return { minAge: 0, maxAge: parseInt(ageMatch[1]), gender };
            }
            if (ageMatch[3]) { // Handles "9-10"
                return { minAge: parseInt(ageMatch[1]), maxAge: parseInt(ageMatch[3]), gender };
            }
            return { minAge: parseInt(ageMatch[1]), maxAge: parseInt(ageMatch[1]), gender }; // Handles single age
        };

        return eventsForMeet.filter(event => {
            const { minAge, maxAge, gender } = getEventAgeAndGender(event.name);
            const isAgeEligible = selectedSwimmer.age >= minAge && selectedSwimmer.age <= maxAge;
            const isGenderEligible = gender === 'Mixed' || gender === selectedSwimmer.gender;
            return isAgeEligible && isGenderEligible;
        });

    }, [selectedSwimmer, eventsForMeet]);


    const allTeams = useMemo(() => Object.values(ADMIN_TEAMS).filter(r => r !== 'SUPERADMIN').sort(), []);
    
    useEffect(() => {
        if (!db || !selectedMeetId) {
            setEventsForMeet([]);
            return;
        }
        const eventsQuery = query(collection(db, "meet_events"), where("meetId", "==", selectedMeetId));
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b)=>a.eventNumber-b.eventNumber);
            setEventsForMeet(events);
        });
        return () => unsubscribe();
    }, [db, selectedMeetId]);

    useEffect(() => {
        if (managingTeam) {
            const rosterDocRef = doc(db, 'rosters', managingTeam);
            const unsubscribe = onSnapshot(rosterDocRef, (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers || [] : []);
            });
            return () => unsubscribe();
        }
    }, [managingTeam]);

    const handleAddSwimmerToEvent = async () => {
        if (!selectedSwimmer || !selectedEventId || !managingTeam || !selectedMeetId) {
            showNotification("Please select a meet, team, swimmer, and event.", "warning");
            return;
        }

        const eventRef = doc(db, "meet_events", selectedEventId);
        const eventDoc = eventsForMeet.find(e => e.id === selectedEventId);
        if (!eventDoc) return;

        const alreadyEntered = (eventDoc.heats || []).some(h => h.lanes.some(l => l.id === selectedSwimmer.id));
        if (alreadyEntered) {
            showNotification(`${selectedSwimmer.firstName} ${selectedSwimmer.lastName} is already entered in this event.`, "danger");
            return;
        }

        let newHeats = JSON.parse(JSON.stringify(eventDoc.heats || []));
        if(newHeats.length === 0) newHeats.push({heatNumber: 1, lanes: []});

        let laneAssigned = false;
        for (const heat of newHeats) {
            if(heat.lanes.length < 8) {
                 const occupiedLanes = new Set(heat.lanes.map(l => l.lane));
                for (let i = 1; i <= 8; i++) {
                    if (!occupiedLanes.has(i)) {
                        heat.lanes.push({ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: i });
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
                lanes: [{ ...selectedSwimmer, team: managingTeam, seedTime: "NT", lane: 1 }]
            });
        }
        
        newHeats.forEach(heat => heat.lanes.sort((a, b) => a.lane - b.lane));
        
        await updateDoc(eventRef, { heats: newHeats });
        
        showNotification(`${selectedSwimmer.firstName} ${selectedSwimmer.lastName} was added to Event ${eventDoc.eventNumber}.`, "success");
        setSelectedSwimmerId("");
    };

    return (
        <>
             <h5 className="card-title">Enter Swimmers into Events</h5>
             <p className="card-text text-muted">Assign swimmers from a team's roster to scheduled events.</p>
            <div className="mb-3">
                <label htmlFor="meetSelectEntries" className="form-label">1. Select Meet</label>
                <select id="meetSelectEntries" className="form-select" value={selectedMeetId} onChange={e => setSelectedMeetId(e.target.value)}>
                    <option value="" disabled>-- Choose a meet --</option>
                    {allMeets.map(meet => <option key={meet.id} value={meet.id}>{meet.name}</option>)}
                </select>
            </div>

            {isSuperAdmin && selectedMeetId && (
                 <div className="mb-3">
                    <label htmlFor="teamSelectManage" className="form-label">2. Select Team</label>
                    <select id="teamSelectManage" className="form-select" value={managingTeam || ""} onChange={e => setManagingTeam(e.target.value)}>
                        <option value="" disabled>-- Choose a Team --</option>
                        {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
                    </select>
                </div>
            )}
            
            {managingTeam && selectedMeetId && (
                <>
                <div className="mb-3">
                    <label htmlFor="swimmerSelect" className="form-label">3. Select Swimmer</label>
                    <select id="swimmerSelect" className="form-select" value={selectedSwimmerId} onChange={e => setSelectedSwimmerId(e.target.value)}>
                        <option value="" disabled>-- Choose from roster --</option>
                        {roster.map(swimmer => <option key={swimmer.id} value={swimmer.id}>{swimmer.firstName} {swimmer.lastName} (Age: {swimmer.age})</option>)}
                    </select>
                </div>
                 <div className="mb-3">
                    <label htmlFor="eventSelect" className="form-label">4. Select Event</label>
                    <select id="eventSelect" className="form-select" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} disabled={!selectedSwimmerId}>
                         <option value="" disabled>-- Choose an event --</option>
                        {eligibleEvents.map(event => <option key={event.id} value={event.id}>E{event.eventNumber} - {event.name}</option>)}
                    </select>
                     {!selectedSwimmerId && <div className="form-text">Select a swimmer to see their eligible events.</div>}
                </div>
                <button className="btn btn-success w-100" onClick={handleAddSwimmerToEvent} disabled={!selectedSwimmerId || !selectedEventId}>
                    Add Swimmer to Event
                </button>
                </>
            )}
        </>
    )
}

function EventCard({ event, favorites, currentEvent, toggleFavorite }) {
    const hasFavorite = (event.heats || []).some(h => h.lanes.some(l => favorites.has(l.id)));
    const isCurrent = currentEvent.isTracking && event.eventNumber === currentEvent.eventNumber;
    
    return (
        <div className={`card mb-3 event-card ${hasFavorite ? 'favorite' : ''} ${isCurrent ? 'current-event' : ''}`}>
            <div className="card-header fw-bold">
                Event {event.eventNumber}: {event.name}
            </div>
            <div className="card-body">
                {event.heats && event.heats.map(heat => (
                    <div key={heat.heatNumber} className={`mb-2 p-2 rounded ${isCurrent && heat.heatNumber === currentEvent.heatNumber ? 'bg-primary-subtle' : ''}`}>
                        <h6 className="card-subtitle mb-2 text-muted">Heat {heat.heatNumber}</h6>
                        <ul className="list-group list-group-flush">
                            {heat.lanes.map(lane => (
                                <li key={lane.id} className="list-group-item d-flex justify-content-between align-items-center">
                                    <span><strong>Lane {lane.lane}:</strong> {`${lane.firstName} ${lane.lastName}`} ({lane.team})</span>
                                    <div className="d-flex align-items-center">
                                        <span className="font-monospace me-3">{lane.seedTime}</span>
                                        <button className="btn btn-sm" onClick={() => toggleFavorite(lane.id)}>
                                            <div className={`favorite-icon ${!favorites.has(lane.id) ? 'inactive' : ''}`}>
                                                <Icon name="star" type={favorites.has(lane.id) ? 'fas' : 'far'} />
                                            </div>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SettingsView({ theme, setTheme, user, isAuthorized, handleSignIn, handleSignOut }) {
    const renderAccountSection = () => {
        if (!user) {
            return null; 
        }

        if (user.isAnonymous) {
            return (
                <button className="btn btn-primary w-100" onClick={handleSignIn}>
                    <Icon name="google" type="fab" className="me-2" /> Admin Sign-In
                </button>
            );
        }
        
        return (
            <div>
                <p>Signed in as {user.email}</p>
                {isAuthorized && <p className="text-success fw-bold">You have admin privileges.</p>}
                <button className="btn btn-secondary w-100" onClick={handleSignOut}>Sign Out</button>
            </div>
        );
    };

    return (
         <div className="settings-view">
            <h2 className="h4 mb-3">Settings</h2>
            <div className="card mb-3">
                <div className="card-body">
                    <h3 className="card-title h6">Theme</h3>
                     <div className="btn-group w-100">
                        <button onClick={() => setTheme('light')} className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline-primary'}`}>Light</button>
                        <button onClick={() => setTheme('dark')} className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline-primary'}`}>Dark</button>
                        <button onClick={() => setTheme('system')} className={`btn ${theme === 'system' ? 'btn-primary' : 'btn-outline-primary'}`}>System</button>
                    </div>
                </div>
            </div>
             <div className="card mb-3">
                <div className="card-body">
                    <h3 className="card-title h6">Account</h3>
                    {renderAccountSection()}
                </div>
            </div>
        </div>
    );
}


const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
