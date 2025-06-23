import React from 'react';
import Icon from '../components/Icon.jsx';

function SettingsView({ theme, setTheme, user, isAuthorized, handleSignIn, handleSignOut }) {
    const renderAccountSection = () => {
        if (!user) return null;

        if (user.isAnonymous) {
            return (
                <button className="w-full flex items-center justify-center px-4 py-2 rounded-md font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700" onClick={handleSignIn}>
                    <Icon name="google" type="fab" className="mr-2" /> Admin Sign-In
                </button>
            );
        }

        return (
            <div className="space-y-3 text-center">
                <p>Signed in as <span className="font-semibold">{user.email}</span></p>
                {isAuthorized && <p className="text-green-600 dark:text-green-400 font-bold">You have admin privileges.</p>}
                <button className="w-full px-4 py-2 rounded-md font-semibold text-sm bg-gray-500 text-white hover:bg-gray-600" onClick={handleSignOut}>Sign Out</button>
            </div>
        );
    };

    return (
         <div className="settings-view space-y-4">
            <h2 className="text-xl font-bold">Settings</h2>
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="p-4">
                    <h3 className="text-md font-semibold mb-2">Theme</h3>
                     <div className="flex w-full rounded-md shadow-sm">
                        <button onClick={() => setTheme('light')} className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-md border ${theme === 'light' ? 'bg-primary text-white border-primary' : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Light</button>
                        <button onClick={() => setTheme('dark')} className={`flex-1 px-4 py-2 text-sm font-medium border-t border-b ${theme === 'dark' ? 'bg-primary text-white border-primary' : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Dark</button>
                        <button onClick={() => setTheme('system')} className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-md border ${theme === 'system' ? 'bg-primary text-white border-primary' : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>System</button>
                    </div>
                </div>
            </div>
             <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="p-4">
                    <h3 className="text-md font-semibold mb-2 text-center">Account</h3>
                    {renderAccountSection()}
                </div>
            </div>
        </div>
    );
}

export default SettingsView;