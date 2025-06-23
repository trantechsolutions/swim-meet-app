import React from 'react';

// Reusable Icon Component - with aria-hidden for accessibility
const Icon = ({ name, type = 'fas', ...props }) => <i className={`${type} fa-${name}`} aria-hidden="true" {...props}></i>;

export default Icon;