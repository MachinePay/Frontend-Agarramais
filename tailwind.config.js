/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F2A20C",
          light: "#F2B705",
          dark: "#0D0D0D",
        },
        secondary: {
          DEFAULT: "#F2DC99",
          light: "#F2F2F2",
        },
        background: {
          dark: "#0D0D0D",
          light: "#F2F2F2",
        },
        accent: {
          orange: "#F2A20C",
          yellow: "#F2B705",
          cream: "#F2DC99",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
