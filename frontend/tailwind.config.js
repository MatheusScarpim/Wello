/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d7',
          300: '#f4a9b6',
          400: '#ed758c',
          500: 'var(--color-primary-light, #e14565)',
          600: 'var(--color-primary, #cd2649)',
          700: 'var(--color-primary-dark, #ac1c3c)',
          800: '#901a37',
          900: '#7b1a34',
          950: '#440a18',
        },
        accent: {
          500: 'var(--color-accent, #2563eb)',
          600: 'var(--color-accent, #2563eb)',
        },
        sidebar: {
          bg: 'var(--color-sidebar-bg, #1f2937)',
          text: 'var(--color-sidebar-text, #f9fafb)',
        },
        header: {
          bg: 'var(--color-header-bg, #ffffff)',
          text: 'var(--color-header-text, #111827)',
        },
      },
      fontFamily: {
        sans: ['var(--font-family, Inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--border-radius, 0.75rem)',
      },
    },
  },
  plugins: [],
}
