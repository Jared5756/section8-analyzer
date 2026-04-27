/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [],
  // Safelist dynamic score-badge classes that are built at runtime and stored
  // in localStorage — Tailwind's static scan won't always catch runtime strings.
  safelist: [
    // legacy dark-only classes (stored in existing localStorage deals)
    'bg-green-900/50', 'text-green-400', 'ring-green-600',
    'bg-yellow-900/50', 'text-yellow-400', 'ring-yellow-600',
    'bg-red-900/50', 'text-red-400', 'ring-red-600',
    // new dual-mode light classes
    'bg-green-100', 'text-green-800', 'ring-green-400',
    'bg-yellow-100', 'text-yellow-800', 'ring-yellow-400',
    'bg-red-100', 'text-red-800', 'ring-red-400',
    // new dual-mode dark: variants
    'dark:bg-green-900/50', 'dark:text-green-400', 'dark:ring-green-600',
    'dark:bg-yellow-900/50', 'dark:text-yellow-400', 'dark:ring-yellow-600',
    'dark:bg-red-900/50', 'dark:text-red-400', 'dark:ring-red-600',
    'ring-1',
  ],
}
