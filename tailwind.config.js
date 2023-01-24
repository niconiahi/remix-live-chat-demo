/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx,jsx,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gray: {
          50: "hsl(0, 0%, 95%)",
          100: "hsl(0, 0%, 91%)",
          200: "hsl(0, 0%, 78%)",
          300: "hsl(0, 0%, 64%)",
          400: "hsl(0, 0%, 37%)",
          500: "hsl(0, 0%, 10%)",
          600: "hsl(0, 0%, 9%)",
          700: "hsl(0, 0%, 8%)",
          800: "hsl(0, 0%, 6%)",
          900: "hsl(0, 0%, 0%)",
        },
      },
    },
  },
  plugins: [],
}
