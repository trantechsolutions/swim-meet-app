# Swim Meet Live - Changelog

All notable changes to this project will be documented in this file.

---

### **v2.1.0 - Admin Experience Overhaul** - 2025-06-23

This version focuses on significant improvements to the admin panel, introducing a dynamic team management system and replacing the old alert library with a modern, integrated solution.

#### ✨ New Features

-   **Team & Admin Management**: A new "Teams" panel allows super admins to create, edit, and delete teams and assign admin users to them. This removes the need for hardcoded values in the configuration.
-   **Flexible Meet Creation**: Creating a meet no longer requires selecting home and away teams, making the system flexible for invitationals and multi-team events.
-   **Advanced Laning Logic**: The entry management system now uses intelligent laning. If a meet has home/away teams, it prioritizes odd/even lanes accordingly. If not, it fills lanes sequentially.
-   **Modern Confirmation Modals**: Replaced all `sweetalert2` popups with a custom, non-blocking modal system powered by a `useConfirm` hook and `react-hot-toast` for a cleaner UI.

#### 🛠️ Fixes & Improvements

-   **Code Organization**: The monolithic `AdminView.jsx` has been broken down into separate, dedicated components for each administrative function, significantly improving maintainability.
-   **Super Admin Role**: Restored and properly integrated the "SUPERADMIN" role, ensuring full access across all team-related panels.
-   **Date Handling**: Fixed a critical bug where dates could be misinterpreted due to timezone issues.
-   **Copy Meet Functionality**: Re-implemented the "Copy Meet" feature using the new non-blocking toast system.

<br>

---

### **v2.0.0 - The Modernization Update** - 2025-06-23

This release marks a complete overhaul of the project's foundation, moving from a static, CDN-based setup to a modern, compiled Vite project. It also introduces major feature enhancements for admins and users.

#### ✨ New Features

-   **PWA Functionality**: The application is now an installable Progressive Web App, enabling offline access and a native app-like experience.
-   **Global Favorites**: A swimmer can be favorited, and they will appear in the "My Favorites" list regardless of which meet is being viewed. An indicator now shows if a favorite is participating in the current meet.
-   **Global Swimmer Search**: The swimmer search now looks across all team rosters, not just the swimmers entered in the current meet.
-   **Advanced Schedule Management**: The admin schedule view has been completely redesigned with a dual-panel layout, allowing for:
    -   Selective bulk adding of events from the library.
    -   Selective bulk removal of events from a schedule.
    -   Bulk "Add All" and "Remove All" actions.
    -   Inline editing of a scheduled event's number.
-   **Meet Lane Configuration**: Admins can now specify the number of available lanes for each meet, which is respected by the entry management system.
-   **Manual Heat/Lane Assignment**: Admins can now manually assign a swimmer to a specific heat and lane, in addition to the automatic assignment.

#### 🛠️ Fixes & Improvements

-   **Project Migration**: Migrated the entire application from a script-tag-based system to a Vite-powered build process for improved performance and maintainability.
-   **Dark Mode & Accessibility**: Fixed numerous bugs with dark mode theming and improved overall accessibility with better color contrast and ARIA attributes.
-   **Timezone Correction**: Fixed a bug where meet dates could appear as one day earlier than selected due to UTC timezone conversions.
-   **Data Integrity**: Favorites are now automatically removed from a user's list if the corresponding swimmer is deleted from the master roster.
-   **Admin Panel Stability**: Resolved several bugs in the Admin panel related to component state and database interactions, making all panels fully functional.
-   **Code Refactoring**: The entire application was broken down from a single file into a clean, feature-based structure with separate files for views and reusable components.