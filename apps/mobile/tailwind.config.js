/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        weered: {
          DEFAULT: "#5800E5",
          bg: "#0c0b0a",
          panel: "rgba(255,255,255,0.03)",
          border: "rgba(255,255,255,0.08)",
          text: "rgba(243,244,246,0.96)",
          muted: "rgba(203,213,225,0.72)",
        },
        gold: "#f5b700",
      },
      fontFamily: {
        sans: ["System"],
        mono: ["monospace"],
      },
    },
  },
  plugins: [],
};
