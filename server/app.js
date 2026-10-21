'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { Store } = require('./lib/store')
const { weekendFor } = require('./lib/week')
const { buildState } = require('./lib/state')
const { SLOT_IDS } = require('./lib/stats')

const DEFAULT_DATA = path.join(__dirname, '..', 'data', 'store.json')
const DEFAULT_PUBLIC = path.join(__dirname, '..', 'public')
const BODY_LIMIT = 1024 * 1024

const STATIC = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(text)
}

function ok(res, data) {
  sendJson(res, 200, { ok: true, data })
}

function fail(res, status, code, error) {
  sendJson(res, status, { ok: false, code, error: error || code })
}

function sendResult(res, result) {
  if (result.status === 200) return ok(res, result.data)
  return fail(res, result.status, result.code, result.error)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false

    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > BODY_LIMIT) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (tooLarge) return reject(new Error('TOO_LARGE'))
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (e) {
        reject(e)
      }
    })

    req.on('error', reject)
  })
}

function cleanNickname(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function validNickname(value) {
  const nickname = cleanNickname(value)
  return nickname && Array.from(nickname).length <= 12 ? nickname : null
}

function validClientId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value)
}

function validRoomId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

function normalizeSlots(value) {
  if (!Array.isArray(value)) return null
  const set = new Set()
  for (const item of value) {
    if (typeof item !== 'string' || !SLOT_IDS.includes(item)) return null
    set.add(item)
  }
  return SLOT_IDS.filter((id) => set.has(id))
}

function ensureOwnerMember(store, room, weekKey) {
  if (!room.ownerNickname) return
  if (store.getMember(room.id, weekKey, room.ownerClientId)) return
  store.setMember(room.id, weekKey, room.ownerClientId, {
    nickname: room.ownerNickname,
    joinedAt: Date.now(),
    isOwner: true,
  })
}

function currentState(store, room, clientId, now) {
  const weekend = weekendFor(now)
  ensureOwnerMember(store, room, weekend.weekKey)
  const { members, selections } = store.toArrays(room.id, weekend.weekKey)
  return buildState({ room, members, selections, clientId, now })
}

function handleBootstrap(store, body) {
  const clientId = body.clientId
  if (!validClientId(clientId)) {
    return { status: 400, code: 'INVALID_CLIENT', error: '客户端标识不合法' }
  }

  const now = Date.now()
  let room = null

  if (body.roomId) {
    if (!validRoomId(body.roomId)) {
      return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
    }
    room = store.getRoom(body.roomId)
    if (!room) {
      return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
    }
  } else if (body.forceNew) {
    room = store.createRoom(clientId)
  } else {
    room = store.findRoomForClient(clientId) || store.createRoom(clientId)
  }

  const weekend = weekendFor(now)
  const member = store.getMember(room.id, weekend.weekKey, clientId)
  if (!member) {
    const last = store.findLastMember(room.id, clientId)
    if (last && last.nickname) {
      store.setMember(room.id, weekend.weekKey, clientId, {
        nickname: last.nickname,
        joinedAt: now,
        isOwner: room.ownerClientId === clientId,
      })
    }
  }

  return { status: 200, data: currentState(store, room, clientId, now) }
}

function handleJoin(store, body) {
  const clientId = body.clientId
  if (!validClientId(clientId)) {
    return { status: 400, code: 'INVALID_CLIENT', error: '客户端标识不合法' }
  }
  if (!validRoomId(body.roomId)) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  const room = store.getRoom(body.roomId)
  if (!room) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  const nickname = validNickname(body.nickname)
  if (!nickname) {
    return { status: 400, code: 'INVALID_NICKNAME', error: '昵称需要 1–12 个字' }
  }

  const now = Date.now()
  const weekend = weekendFor(now)
  const existing = store.getMember(room.id, weekend.weekKey, clientId)

  store.setMember(room.id, weekend.weekKey, clientId, {
    nickname,
    joinedAt: existing ? existing.joinedAt : now,
    isOwner: room.ownerClientId === clientId,
  })

  if (room.ownerClientId === clientId) {
    room.ownerNickname = nickname
    store.updateRoom(room)
  }

  return { status: 200, data: currentState(store, room, clientId, now) }
}

function handleSelection(store, body) {
  const clientId = body.clientId
  if (!validClientId(clientId)) {
    return { status: 400, code: 'INVALID_CLIENT', error: '客户端标识不合法' }
  }
  if (!validRoomId(body.roomId)) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  const room = store.getRoom(body.roomId)
  if (!room) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  const slots = normalizeSlots(body.slots)
  if (!slots) {
    return { status: 400, code: 'INVALID_SLOTS', error: '时间选择不合法' }
  }

  const now = Date.now()
  const weekend = weekendFor(now)
  let member = store.getMember(room.id, weekend.weekKey, clientId)

  // The page may have stayed open across Sunday -> Monday.
  if (!member) {
    const last = store.findLastMember(room.id, clientId)
    if (last && last.nickname) {
      member = {
        nickname: last.nickname,
        joinedAt: now,
        isOwner: room.ownerClientId === clientId,
      }
      store.setMember(room.id, weekend.weekKey, clientId, member)
    } else if (room.ownerClientId === clientId && room.ownerNickname) {
      member = {
        nickname: room.ownerNickname,
        joinedAt: now,
        isOwner: true,
      }
      store.setMember(room.id, weekend.weekKey, clientId, member)
    }
  }

  if (!member) {
    return { status: 400, code: 'NEED_NICKNAME', error: '请先填写昵称' }
  }

  store.setSelection(room.id, weekend.weekKey, clientId, {
    slots,
    updatedAt: now,
    late: now >= weekend.deadline,
  })

  return { status: 200, data: currentState(store, room, clientId, now) }
}

function handleGetState(store, url) {
  const clientId = url.searchParams.get('clientId') || ''
  const roomId = url.searchParams.get('roomId') || ''

  if (!validClientId(clientId)) {
    return { status: 400, code: 'INVALID_CLIENT', error: '客户端标识不合法' }
  }
  if (!validRoomId(roomId)) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  const room = store.getRoom(roomId)
  if (!room) {
    return { status: 404, code: 'ROOM_NOT_FOUND', error: '房间不存在' }
  }

  return { status: 200, data: currentState(store, room, clientId, Date.now()) }
}

function serveFile(res, filePath, contentType, cache) {
  fs.readFile(filePath, (err, buffer) => {
    if (err) {
      fail(res, 404, 'NOT_FOUND', '页面不存在')
      return
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cache || 'no-store',
    })
    res.end(buffer)
  })
}

function serveIndex(res, publicDir) {
  serveFile(res, path.join(publicDir, 'index.html'), 'text/html; charset=utf-8')
}

function createServer(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || DEFAULT_DATA
  const publicDir = options.publicDir || DEFAULT_PUBLIC
  const store = new Store(dataFile)

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const pathname = decodeURIComponent(url.pathname)

      if (req.method === 'GET' && pathname === '/api/health') {
        return ok(res, { status: 'ok' })
      }

      if (req.method === 'POST' && pathname === '/api/bootstrap') {
        let body
        try {
          body = await readBody(req)
        } catch (e) {
          return fail(res, 400, 'INVALID_JSON', '请求格式不对')
        }
        return sendResult(res, handleBootstrap(store, body))
      }

      if (req.method === 'POST' && pathname === '/api/join') {
        let body
        try {
          body = await readBody(req)
        } catch (e) {
          return fail(res, 400, 'INVALID_JSON', '请求格式不对')
        }
        return sendResult(res, handleJoin(store, body))
      }

      if (req.method === 'POST' && pathname === '/api/selection') {
        let body
        try {
          body = await readBody(req)
        } catch (e) {
          return fail(res, 400, 'INVALID_JSON', '请求格式不对')
        }
        return sendResult(res, handleSelection(store, body))
      }

      if (req.method === 'GET' && pathname === '/api/state') {
        return sendResult(res, handleGetState(store, url))
      }

      if (req.method === 'GET' && (pathname === '/' || pathname.startsWith('/r/'))) {
        return serveIndex(res, publicDir)
      }

      if (req.method === 'GET' && STATIC[pathname]) {
        const [file, type] = STATIC[pathname]
        return serveFile(res, path.join(publicDir, file), type)
      }

      if (req.method === 'GET' && pathname === '/favicon.ico') {
        res.writeHead(204)
        res.end()
        return
      }

      fail(res, 404, 'NOT_FOUND', '页面不存在')
    } catch (e) {
      console.error('request failed', e)
      fail(res, 500, 'INTERNAL', '服务开小差了')
    }
  })
}

module.exports = { createServer }