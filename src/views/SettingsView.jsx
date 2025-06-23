import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
// Import the new libraries
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function SettingsView({ theme, setTheme, user, isAuthorized, handleSignIn, handleSignOut }) {
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogContent, setChangelogContent] = useState('Loading...');

    useEffect(() => {
        if (showChangelog && changelogContent === 'Loading...') {
            fetch('CHANGELOG.md') // Note: Path is relative to the public folder
                .then(response => {
                    if (response.ok) {
                        return response.text();
                    }
                    throw new Error('Could not load changelog.');
                })
                .then(text => setChangelogContent(text))
                .catch(error => setChangelogContent(error.message));
        }
    }, [showChangelog]);

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
            
            {/* Theme Settings Panel */}
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

            {/* Changelog Panel */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-md border border-border-light dark:border-border-dark">
                <div className="p-4">
                    <button
                        className="flex justify-between items-center w-full font-semibold"
                        onClick={() => setShowChangelog(!showChangelog)}
                        aria-expanded={showChangelog}
                    >
                        <span>Version History & Changelog</span>
                        <Icon name={showChangelog ? 'chevron-up' : 'chevron-down'} />
                    </button>

                    {showChangelog && (
                        // Replace the <pre> tag with this styled div and the ReactMarkdown component
                        <div className="prose prose-sm dark:prose-invert max-w-none mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {changelogContent}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>

             {/* Account Panel */}
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