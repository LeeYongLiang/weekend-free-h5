'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function emptyData() {
  return { rooms: {}, members: {}, selections: {} }
}

class Store {
  constructor(file) {
    this.file = file
    this.data = this.load()
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      return {
        rooms: parsed.rooms && typeof parsed.rooms === 'object' ? parsed.rooms : {},
        members: parsed.members && typeof parsed.members === 'object' ? parsed.members : {},
        selections: parsed.selections && typeof parsed.selections === 'object' ? parsed.selections : {},
      }
    } catch (e) {
      return emptyData()
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    fs.renameSync(tmp, this.file)
  }

  createRoom(ownerClientId) {
    let id
    do {
      id = crypto.randomBytes(6).toString('hex')
    } while (this.data.rooms[id])

    const room = {
      id,
      ownerClientId,
      ownerNickname: '',
      createdAt: Date.now(),
    }
    this.data.rooms[id] = room
    this.data.members[id] = {}
    this.data.selections[id] = {}
    this.save()
    return room
  }

  getRoom(id) {
    return this.data.rooms[id] || null
  }

  updateRoom(room) {
    this.data.rooms[room.id] = room
    this.save()
  }

  ensureWeek(roomId, weekKey) {
    if (!this.data.members[roomId]) this.data.members[roomId] = {}
    if (!this.data.selections[roomId]) this.data.selections[roomId] = {}
    if (!this.data.members[roomId][weekKey]) this.data.members[roomId][weekKey] = {}
    if (!this.data.selections[roomId][weekKey]) this.data.selections[roomId][weekKey] = {}
    return {
      members: this.data.members[roomId][weekKey],
      selections: this.data.selections[roomId][weekKey],
    }
  }

  getMembers(roomId, weekKey) {
    return (this.data.members[roomId] && this.data.members[roomId][weekKey]) || {}
  }

  getSelections(roomId, weekKey) {
    return (this.data.selections[roomId] && this.data.selections[roomId][weekKey]) || {}
  }

  getMember(roomId, weekKey, clientId) {
    return this.getMembers(roomId, weekKey)[clientId] || null
  }

  setMember(roomId, weekKey, clientId, member) {
    this.ensureWeek(roomId, weekKey)
    this.data.members[roomId][weekKey][clientId] = member
    this.save()
  }

  setSelection(roomId, weekKey, clientId, selection) {
    this.ensureWeek(roomId, weekKey)
    this.data.selections[roomId][weekKey][clientId] = selection
    this.save()
  }

  findLastMember(roomId, clientId) {
    const weeks = this.data.members[roomId] || {}
    let best = null
    for (const weekKey of Object.keys(weeks)) {
      const member = weeks[weekKey][clientId]
      if (member && (!best || (member.joinedAt || 0) > (best.joinedAt || 0))) {
        best = { ...member, weekKey }
      }
    }
    return best
  }

  findRoomForClient(clientId) {
    let best = null

    for (const room of Object.values(this.data.rooms)) {
      if (room.ownerClientId === clientId) {
        if (!best || (room.createdAt || 0) > best.time) {
          best = { room, time: room.createdAt || 0 }
        }
      }
    }

    for (const roomId of Object.keys(this.data.members)) {
      const room = this.data.rooms[roomId]
      if (!room) continue
      for (const weekKey of Object.keys(this.data.members[roomId])) {
        const member = this.data.members[roomId][weekKey][clientId]
        if (member && (!best || (member.joinedAt || 0) > best.time)) {
          best = { room, time: member.joinedAt || 0 }
        }
      }
    }

    return best ? best.room : null
  }

  toArrays(roomId, weekKey) {
    const membersMap = this.getMembers(roomId, weekKey)
    const selectionsMap = this.getSelections(roomId, weekKey)
    return {
      members: Object.keys(membersMap).map((id) => ({ id, ...membersMap[id] })),
      selections: Object.keys(selectionsMap).map((id) => ({ id, ...selectionsMap[id] })),
    }
  }
}

module.exports = { Store }