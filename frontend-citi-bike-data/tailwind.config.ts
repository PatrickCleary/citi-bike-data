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
      dropShadow: {
        "cb-mini": "0px 0px 5px rgba(0, 0, 0, .05)",
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
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;
