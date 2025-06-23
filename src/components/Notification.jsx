import React from 'react';

function Notification({ show, message, type }) {
    const baseClasses = "fixed left-1/2 -translate-x-1/2 z-50 p-4 rounded-md shadow-lg transition-all duration-300";
    const typeClasses = {
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        danger: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    const showClass = show ? 'opacity-100 top-16' : 'opacity-0 top-5 pointer-events-none';

    return (
        <div className={`${baseClasses} ${typeClasses[type] || typeClasses.info} ${showClass}`} role="alert">
            {message}
        </div>
    );
}

export default Notification;