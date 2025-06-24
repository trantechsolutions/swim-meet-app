import { useState, useMemo } from 'react';

import useConfirm from '../hooks/useConfirm.jsx';

// Component Imports
import TeamManagement from '../components/admin/TeamManagement.jsx';
import MeetManagement from '../components/admin/MeetManagement.jsx';
import EventLibraryManagement from '../components/admin/EventLibraryManagement.jsx';
import ScheduleManagement from '../components/admin/ScheduleManagement.jsx';
import RosterManagement from '../components/admin/RosterManagement.jsx';
import EntryManagement from '../components/admin/EntryManagement.jsx';
import PrintManagement from '../components/admin/PrintManagement.jsx';
import ImportManagement from '../components/admin/ImportManagement.jsx';


function AdminView({ toast, isSuperAdmin, adminRole, allMeets }) {
    const { confirm, ConfirmationModal } = useConfirm();
    const [adminSubView, setAdminSubView] = useState('meets');

    const [activeMeetId, setActiveMeetId] = useState(allMeets[0]?.id || "");
    const selectedMeetForEntries = useMemo(() => allMeets.find(meet => meet.id === activeMeetId), [allMeets, activeMeetId]);

    const enhancedAllMeets = allMeets.map(meet => ({
        ...meet,
        events: meet.events || [], // Ensure events array exists
    }));

    if (!adminRole) {
        return <div className="p-4 text-yellow-800 bg-yellow-100 border border-yellow-200 rounded-md">You are not authorized to view this page.</div>;
    }

    const renderSubView = () => {
        const props = { toast, confirm, adminRole, isSuperAdmin, allMeets: enhancedAllMeets, activeMeetId, setActiveMeetId, selectedMeet: selectedMeetForEntries, };
        switch (adminSubView) {
            case 'meets':
                return <MeetManagement {...props} />;
            case 'library':
                return <EventLibraryManagement {...props} />;
            case 'schedule':
                return <ScheduleManagement {...props} />;
            case 'rosters':
                return <RosterManagement {...props} />;
            case 'entries':
                return <EntryManagement {...props} />;
            case 'teams':
                return <TeamManagement {...props} />;
            case 'print':
                return <PrintManagement {...props} />;
            case 'import':
                return <ImportManagement {...props} />;
            default:
                return null;
        }
    };

    const navLinkClasses = "block w-full text-center px-4 py-2 rounded-md font-semibold text-sm";
    const activeNavLinkClasses = "bg-primary text-white";
    const inactiveNavLinkClasses = "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600";
    const navItems = [
        { key: 'meets', label: 'Meets' },
        { key: 'teams', label: 'Teams' },
        { key: 'library', label: 'Library' },
        { key: 'schedule', label: 'Schedule' },
        { key: 'rosters', label: 'Rosters' },
        { key: 'entries', label: 'Entries' },
        { key: 'print', label: 'Print' },
        { key: 'import', label: 'Import' },
    ];

    return (
        <div className="admin-view">
            <h2 className="text-xl font-bold mb-3">Admin Panel</h2>
            <ConfirmationModal />
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                {navItems.map(item => (
                    <li key={item.key}>
                        <button 
                            className={`${navLinkClasses} ${adminSubView === item.key ? activeNavLinkClasses : inactiveNavLinkClasses}`} 
                            onClick={() => setAdminSubView(item.key)}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="p-4">
                    {renderSubView()}
                </div>
            </div>
        </div>
    );
}

export default AdminView;