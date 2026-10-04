// Renders build/icon.svg to build/icon.png (512x512) using Electron's own Chromium.
// Usage: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = readFileSync(join(__dirname, '../build/icon.svg'), 'utf8')
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true
  })
  await win.loadURL(
    'data:text/html,' +
      encodeURIComponent(`<body style="margin:0;background:transparent">${svg}</body>`)
  )
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  writeFileSync(join(__dirname, '../build/icon.png'), image.toPNG())
  app.quit()
})
