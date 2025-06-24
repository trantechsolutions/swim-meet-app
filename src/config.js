// --- App Version ---
// Change this version number to force a refresh of cached CSS and JS files.
export const APP_VERSION = "2.1.0";

// --- Firebase Config ---
// This object contains your Firebase project's credentials.
export const firebaseConfig = {
  apiKey: "AIzaSyDMge0ZVBwCHb6tzmdIv5dD_BMrtfu_P_I",
  authDomain: "swim-meet-app.firebaseapp.com",
  projectId: "swim-meet-app",
  storageBucket: "swim-meet-app.firebasestorage.app",
  messagingSenderId: "869827349699",
  appId: "1:869827349699:web:26b08aeece866760cbe676"
};

// --- Authorized Admin Users ---
// A simple map to determine which team an admin belongs to.
export const ADMIN_TEAMS = {
    'jonny5v@gmail.com': 'SUPERADMIN', 
    'admin@westgatecc.com': 'WCC',
    'admin@ponchatrainrc.com': 'PRC',
    'admin@barracudaswim.org': 'BARR',
    'admin@example.com': 'KLR' 
};

// --- Standard Event Library for Bulk Loading ---
export const STANDARD_EVENT_LIBRARY = [
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