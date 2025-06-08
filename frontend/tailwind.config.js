// Filename: tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundImage: {
        'pattern': "url('/images/bg-pattern.png')",
      },
    },
  },
  plugins: [],
};
