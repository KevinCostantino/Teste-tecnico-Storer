import { resolve } from 'node:path'
import { existsSync, mkdirSync, renameSync, rmdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const moveHtmlPlugin = {
  name: 'move-html-to-root',
  closeBundle() {
    const moves: Array<[string, string]> = [
      [join('dist', 'src', 'popup', 'index.html'), join('dist', 'popup', 'index.html')],
      [join('dist', 'src', 'options', 'index.html'), join('dist', 'options', 'index.html')],
    ]

    for (const [src, dest] of moves) {
      if (existsSync(src)) {
        const destDir = dirname(dest)
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true })
        }
        renameSync(src, dest)
      }
    }

    // Remove empty src/ directories if left behind
    try {
      rmdirSync(join('dist', 'src', 'popup'))
      rmdirSync(join('dist', 'src', 'options'))
      rmdirSync(join('dist', 'src'))
    } catch {
      // ignore if not empty or not found
    }
  },
}

export default defineConfig({
  plugins: [react(), moveHtmlPlugin],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        'popup/index': resolve(__dirname, 'src/popup/index.html'),
        'options/index': resolve(__dirname, 'src/options/index.html'),
        'background/index': resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/index') {
            return 'background/index.js'
          }

          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
})
