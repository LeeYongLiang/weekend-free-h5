'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createServer } = require('../server/app')

test('two clients can fill the same slot and get an all-free result', async () => {
  const dataFile = path.join(os.tmpdir(), `wxfree-api-${process.pid}-${Date.now()}.json`)
  const server = createServer({ dataFile })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const post = async (pathname, body) => {
    const res = await fetch(base + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json() }
  }

  const A = 'client-aaaa-1111'
  const B = 'client-bbbb-2222'

  try {
    const bootA = await post('/api/bootstrap', { clientId: A })
    assert.equal(bootA.status, 200)
    assert.equal(bootA.json.ok, true)
    assert.equal(bootA.json.data.needsNickname, true)
    const roomId = bootA.json.data.roomId
    assert.match(roomId, /^[a-f0-9]{12}$/)

    const joinA = await post('/api/join', { roomId, clientId: A, nickname: '小明' })
    assert.equal(joinA.json.ok, true)
    assert.equal(joinA.json.data.needsNickname, false)
    assert.equal(joinA.json.data.me.nickname, '小明')
    assert.equal(joinA.json.data.members.length, 1)

    const selectA = await post('/api/selection', { roomId, clientId: A, slots: ['sat_pm'] })
    assert.equal(selectA.json.ok, true)
    assert.deepEqual(selectA.json.data.me.slots, ['sat_pm'])
    assert.equal(selectA.json.data.slots.find((slot) => slot.id === 'sat_pm').selected, true)

    const bootB = await post('/api/bootstrap', { roomId, clientId: B })
    assert.equal(bootB.json.ok, true)
    assert.equal(bootB.json.data.needsNickname, true)
    assert.equal(bootB.json.data.stats.memberCount, 1)

    const joinB = await post('/api/join', { roomId, clientId: B, nickname: '小红' })
    assert.equal(joinB.json.ok, true)
    assert.equal(joinB.json.data.stats.memberCount, 2)
    assert.equal(joinB.json.data.stats.filledCount, 1)

    const selectB = await post('/api/selection', { roomId, clientId: B, slots: ['sat_pm'] })
    assert.equal(selectB.json.ok, true)
    assert.deepEqual(selectB.json.data.stats.allFreeSlots, ['sat_pm'])
    assert.equal(selectB.json.data.result.tone, 'good')
    assert.equal(selectB.json.data.result.title, '周六下午')
    assert.match(selectB.json.data.shareTitle, /周六下午全员有空/)
    assert.equal(selectB.json.data.membersProgress, '2/2')

    const stateRes = await fetch(base + `/api/state?roomId=${roomId}&clientId=${A}`)
    const stateJson = await stateRes.json()
    assert.equal(stateJson.ok, true)
    assert.deepEqual(stateJson.data.stats.allFreeSlots, ['sat_pm'])

    const badSlot = await post('/api/selection', { roomId, clientId: A, slots: ['bad'] })
    assert.equal(badSlot.status, 400)
    assert.equal(badSlot.json.code, 'INVALID_SLOTS')

    const badRoom = await post('/api/bootstrap', { roomId: 'nope', clientId: A })
    assert.equal(badRoom.status, 404)
    assert.equal(badRoom.json.code, 'ROOM_NOT_FOUND')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(dataFile, { force: true })
  }
})