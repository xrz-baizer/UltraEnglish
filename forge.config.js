const { readdir, rm } = require('node:fs/promises')
const { join } = require('node:path')

module.exports = {
  hooks: {
    packageAfterPrune: async (_config, buildPath, _electronVersion, platform) => {
      const target = platform === 'mas' ? 'darwin' : platform
      const binaries = join(buildPath, 'node_modules/onnxruntime-node/bin/napi-v6')
      const platforms = ['darwin', 'linux', 'win32']
      if (!platforms.includes(target)) return
      for (const entry of await readdir(binaries)) {
        if (platforms.includes(entry) && entry !== target) {
          await rm(join(binaries, entry), { recursive: true })
        }
      }
    }
  },
  packagerConfig: {
    name: 'UltraEnglish',
    executableName: 'ultra-english',
    icon: './assets/icons/icon',
    asar: true,
    extraResource: [
      './assets/audios',
      './assets/dictionaries',
      './assets/models',
      './assets/bin'
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'UltraEnglish',
        iconUrl: 'https://example.com/icon.ico',
        setupIcon: './assets/icons/icon.ico'
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'UltraEnglish',
        icon: './assets/icons/icon.icns',
        format: 'ULFO'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/icons/icon.png'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}
