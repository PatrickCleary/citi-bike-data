import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/icons/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/map/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
      },
      keyframes: {
        slideDown: {
          "0%": {
            opacity: "0",
            transform: "translateY(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      dropShadow: {
        "cb-mini": "0px 0px 5px rgba(0, 0, 0, .05)",
        "cb-hex": "0px 0px 1px rgba(0, 0, 0, .35)",
      },

      colors: {
        cb: {
          white: "#F2F3F0",
          lightGray: "#C3C9CC",
          darkPurple: "#440154",
          purple: "#482878",
          bluePurple: "#3e4989",
          blue: "#31688e",
          teal: "#26828e",
          green: "#35b779",
          lightGreen: "#6ece58",
          yellow: "#fde725",
          // Comparison/trend colors
          increase: "#01665e", // Dark blue-green for increases
          "increase-pastel": "#BEE8E5",
          decrease: "#8c510a", // Brown for decreases
          "decrease-pastel": "#EBDAC5",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
