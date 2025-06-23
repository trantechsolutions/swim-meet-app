/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Use class-based dark mode
  theme: {
    extend: {
      colors: {
        'primary': '#3a8538',
        'primary-light': '#a3d4a2',
        'secondary': '#D9A000', // Changed from #FFC107 for better contrast
        'text-light': '#f9fafb',
        'text-dark': '#1f2937',
        'bg-light': '#f8f9fa',
        'bg-dark': '#111827',
        'surface-light': '#ffffff',
        'surface-dark': '#212529',
        'border-light': '#dee2e6',
        'border-dark': '#495057',
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}