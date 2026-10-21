'use strict'

const os = require('os')
const { createServer } = require('./server/app')

const port = Number(process.env.PORT) || 4173
const host = process.env.HOST || '0.0.0.0'
const server = createServer()

server.listen(port, host, () => {
  console.log('')
  console.log('周末有空 H5 已启动')
  console.log(`  本机:   http://localhost:${port}`)

  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  局域网: http://${net.address}:${port}`)
      }
    }
  }
  console.log('')
  console.log('手机和电脑连同一个 Wi-Fi 时，用「局域网」地址打开；')
  console.log('发到微信群测试时，用公网地址或隧道地址。')
})