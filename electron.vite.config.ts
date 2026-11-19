import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

// Plugin to copy resources to build output
function copyResourcesPlugin() {
  return {
    name: 'copy-resources',
    closeBundle() {
      const srcDir = resolve(__dirname, 'assets/dictionaries')
      const destDir = resolve(__dirname, 'app-build/main/resources/dictionaries')

      if (existsSync(srcDir)) {
        mkdirSync(destDir, { recursive: true })
        const files = readdirSync(srcDir)
        for (const file of files) {
          copyFileSync(resolve(srcDir, file), resolve(destDir, file))
        }
        console.log(`Copied ${files.length} dictionary files to build output`)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyResourcesPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@types': resolve('src/types'),
        '@constants': resolve('src/constants')
      }
    },
    build: {
      outDir: 'app-build/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'app-build/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@': resolve('src/renderer'),
        '@types': resolve('src/types'),
        '@constants': resolve('src/constants')
      }
    },
    plugins: [react()],
    build: {
      outDir: 'app-build/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    }
  }
})
