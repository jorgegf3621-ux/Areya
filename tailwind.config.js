/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
      },
      colors: {
        brand: '#1A1A2E',
        accent: '#4F46E5',
      },
    },
  },
  plugins: [],
}
