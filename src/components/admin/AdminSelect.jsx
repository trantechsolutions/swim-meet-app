import React from 'react';

/**
 * A theme-aware, reusable select input component for the admin dashboard.
 * @param {object} props - The component props.
 * @param {string} props.label - The text for the <label> element.
 * @param {string} props.id - A unique ID for the input, used for the label's htmlFor.
 * @param {string} [props.className] - Optional additional classes to apply to the wrapper div.
 * @param {React.ReactNode} props.children - The <option> elements to render inside the select.
 * @param {any} [props.value] - The controlled value of the select input.
 * @param {Function} [props.onChange] - The function to call when the value changes.
 */
function AdminSelect({ label, id, className, children, ...props }) {
  // Base classes for consistent styling, including dark mode and focus states
  const selectClasses = `
    w-full
    p-2.5
    text-sm
    rounded-lg
    border
    bg-gray-50
    border-gray-300
    text-gray-900
    focus:ring-primary
    focus:border-primary
    dark:bg-gray-700
    dark:border-gray-600
    dark:placeholder-gray-400
    dark:text-white
    dark:focus:ring-primary-light
    dark:focus:border-primary-light
  `;

  return (
    // The className prop is applied to the wrapper for flexible layout control (e.g., margins)
    <div className={className}>
      <label
        htmlFor={id}
        className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300"
      >
        {label}
      </label>
      <select
        id={id}
        className={selectClasses}
        {...props} // Spread remaining props like value, onChange, etc.
      >
        {children}
      </select>
    </div>
  );
}

export default AdminSelect;