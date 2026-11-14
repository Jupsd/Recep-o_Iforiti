/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terreiro: {
          50: '#eef7f2',
          100: '#d5ecdf',
          200: '#aedac2',
          300: '#7ac09c',
          400: '#45a074',
          500: '#238257',
          600: '#166643',
          700: '#0f5132',
          800: '#0e412a',
          900: '#0c3624',
        },
      },
    },
  },
  plugins: [],
};

