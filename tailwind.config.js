/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TODO: Add custom design tokens from Figma
        primary: {
          DEFAULT: "var(--color-primary, #3b82f6)",
          foreground: "var(--color-primary-foreground, #ffffff)",
        },
        background: "var(--color-background, #ffffff)",
        surface: "var(--color-surface, #f8fafc)",
        text: "var(--color-text, #0f172a)",
      },
      fontFamily: {
        // TODO: Add custom typography from Figma
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        // TODO: Add custom spacing from Figma if needed
      }
    },
  },
  plugins: [],
}
