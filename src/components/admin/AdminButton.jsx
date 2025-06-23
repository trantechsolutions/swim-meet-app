import React from 'react';

const AdminButton = ({ children, onClick, type = 'button', variant = 'primary', className = '', ...props }) => {
    const baseClasses = "w-full text-center px-4 py-2 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-primary text-white hover:bg-green-700",
        secondary: "bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-500",
        outline: "border border-current text-primary hover:bg-primary/10 dark:hover:bg-primary/20",
        'outline-success': "border border-green-500 text-green-600 hover:bg-green-500/10",
    };
    return (
        <button type={type} onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

export default AdminButton;