/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
      },
      colors: {
        brand: '#201D36',
        accent: '#9A90F5',
        sand: '#F6F2EC',
        ink: '#6E7382',
        gold: '#F2B56B',
      },
    },
  },
  plugins: [],
}
