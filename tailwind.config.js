/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        primary: '#00D84A',
        secondary: '#34D399',
        
        // Background Colors
        background: '#0A0A0A',
        dark: '#111111',
        
        // Chat Bubble Colors
        'bubble-me': '#00D84A',
        'bubble-other': '#1A1A1A',
        
        // Text Colors
        'text-secondary': '#9CA3AF',
        
        // Border Colors
        'border-light': 'rgba(255,255,255,0.08)',
        
        // Shadow Colors
        'shadow-green': 'rgba(0, 216, 74, 0.2)',
      },
      borderRadius: {
        'xl': '1.25rem',
        '2xl': '2rem',
        '3xl': '1.875rem',
        '4xl': '2.5rem',
      },
      fontFamily: {
        'system': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      },
    },
  },
  plugins: [],
  presets: [require("nativewind/preset")],
}

