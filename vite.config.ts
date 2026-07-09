import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 상대경로 base: 루트 도메인(Vercel)·서브패스(GitHub Pages) 양쪽에서 동일 빌드로 동작.
  // 해시 라우팅(#/play)이라 딥링크 경로 문제 없고, Phaser 에셋도 이미 상대경로 로딩.
  base: './',
  plugins: [react(), tailwindcss()],
})
