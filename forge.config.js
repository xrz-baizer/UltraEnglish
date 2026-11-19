module.exports = {
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
