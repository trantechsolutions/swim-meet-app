import React, { useState, useMemo, useRef, useEffect } from 'react';

// --- Reusable Icon ---
const ChevronUpDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
  </svg>
);

/**
 * A global, reusable, searchable combobox component for long lists of options.
 * @param {object} props The component props.
 * @param {string} props.label - The text for the <label> element.
 * @param {Array<{value: any, label: string}>} props.options - The array of options to display.
 * @param {any} props.value - The currently selected value.
 * @param {Function} props.onChange - The function to call when the value changes.
 * @param {string} props.placeholder - The placeholder text for the input field.
 * @param {string} [props.className] - Optional additional classes for the wrapper div.
 */
function AdminCombobox({ label, options, value, onChange, placeholder, className }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedOptionLabel = useMemo(() => {
    return options.find(opt => opt.value === value)?.label || '';
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery(''); // Reset query on close
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelectOption = (optionValue) => {
    onChange(optionValue);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className={className} ref={wrapperRef}>
      <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full p-2.5 pr-10 text-sm rounded-lg border bg-gray-50 border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          value={isOpen ? query : selectedOptionLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-2 rounded-r-lg focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronUpDownIcon />
        </button>
        {isOpen && (
          <ul className="absolute z-10 w-full mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm dark:bg-gray-800 dark:ring-gray-600">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <li
                  key={option.value}
                  className={`relative cursor-pointer select-none py-2 px-4 ${value === option.value ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onMouseDown={() => handleSelectOption(option.value)}
                >
                  <span className={`block truncate ${value === option.value ? 'font-semibold' : 'font-normal'}`}>
                    {option.label}
                  </span>
                </li>
              ))
            ) : (
              <li className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-400">
                Nothing found.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AdminCombobox;
