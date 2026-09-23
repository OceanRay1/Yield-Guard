/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '2px',
        md: '4px',
        lg: '4px', // Cap max rounding at 4px
        xl: '4px',
        '2xl': '4px',
      },
      colors: {
        terminal: {
          bg: '#121417',
          panel: '#1A1D23',
          border: '#2C313C',
          accent: '#3B82F6',
          muted: '#8C95A5',
          text: '#E2E8F0',
          success: '#10B981',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
      },
    },
  },
  plugins: [],
};
