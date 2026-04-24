/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
  // Safelist dynamic score-badge classes that are built at runtime and stored
  // in localStorage — Tailwind's static scan won't always catch runtime strings.
  safelist: [
    'bg-green-900/50', 'text-green-400', 'ring-green-600',
    'bg-yellow-900/50', 'text-yellow-400', 'ring-yellow-600',
    'bg-red-900/50', 'text-red-400', 'ring-red-600',
    'ring-1',
  ],
}
