/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: '#080d1a',
          card: '#0f172a',
          cardBorder: '#1e293b',
          accent: '#00d2ff',
          hover: '#1e2942',
        }
      }
    },
  },
  plugins: [],
}
