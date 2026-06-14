/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50:'#eff6ff', 100:'#dbeafe', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 900:'#1e3a8a' },
        success: { 50:'#f0fdf4', 100:'#dcfce7', 500:'#22c55e', 700:'#15803d' },
        danger: { 50:'#fef2f2', 100:'#fee2e2', 500:'#ef4444', 700:'#b91c1c' },
        warning: { 50:'#fffbeb', 100:'#fef3c7', 500:'#f59e0b', 700:'#b45309' },
      }
    }
  },
  plugins: []
}
