/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#333333',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a',
        },
        accent: {
          DEFAULT: '#00d632',
          50: '#e6fff0',
          100: '#b3ffcf',
          200: '#80ffad',
          300: '#4dff8c',
          400: '#1aff6a',
          500: '#00d632',
          600: '#00b32a',
          700: '#008f22',
          800: '#006b19',
          900: '#004711',
        },
        negative: {
          DEFAULT: '#ff3b30',
          light: '#ff6961',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
