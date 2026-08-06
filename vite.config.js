import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        impressum: fileURLToPath(new URL('./impressum.html', import.meta.url)),
        gutscheine: fileURLToPath(new URL('./gutscheine.html', import.meta.url)),
        danke: fileURLToPath(new URL('./danke.html', import.meta.url)),
      },
    },
  },
})
