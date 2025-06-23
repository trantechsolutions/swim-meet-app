# Swim Meet Live - Changelog

All notable changes to this project will be documented in this file.

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