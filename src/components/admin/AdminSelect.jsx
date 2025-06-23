import React from 'react';

const AdminSelect = ({ label, id, children, ...props }) => (
     <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <select id={id} className="w-full p-2 border border-border-light dark:border-border-dark rounded-md bg-surface-light dark:bg-surface-dark text-text-dark dark:text-text-light focus:ring-2 focus:ring-primary focus:border-primary outline-none" {...props}>
            {children}
        </select>
    </div>
);

export default AdminSelect;