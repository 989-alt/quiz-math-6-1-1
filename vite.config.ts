import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/quiz-math-6-1-1/',
  plugins: [react(), tailwindcss()],
})
