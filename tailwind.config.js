/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        revelio: {
          blue: '#007AFF',
          violet: '#5856D6',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          text: '#1D1D1F',
          subtle: '#86868B',
          border: '#E5E5EA',
          bg: '#F9F9FB',
          // Dark variants
          'dark-bg': '#1C1C1E',
          'dark-card': '#2C2C2E',
          'dark-border': '#3A3A3C',
          'dark-text': '#F5F5F7',
          'dark-subtle': '#98989D',
        },
      },
      fontFamily: {
        logo: ['Comfortaa', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        badge: '7px',
      },
    },
  },
  plugins: [],
}
