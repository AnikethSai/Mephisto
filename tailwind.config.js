/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hell: {
          950: "#090506",
          900: "#130a0d",
          850: "#1c0f14",
          800: "#27141b",
          700: "#3d1c26",
          600: "#5c2433",
        },
        soul: {
          gold: "#e6af2e",
          amber: "#f59e0b",
          glow: "#ffb703",
          flame: "#e63946",
          darkred: "#9e2a2b",
        },
      },
    },
  },
  plugins: [],
};
