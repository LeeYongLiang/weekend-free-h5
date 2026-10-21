'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildState } = require('../server/lib/state')

const NOW_CLOSED = Date.UTC(2026, 9, 23, 13, 0, 0) // 2026-10-23 21:00 Beijing
const NOW_OPEN = Date.UTC(2026, 9, 22, 4, 0, 0) // 2026-10-22 12:00 Beijing

const ROOM = { id: 'room1', ownerClientId: 'client-a', ownerNickname: 'A' }

const A = { id: 'client-a', nickname: 'A', joinedAt: 1 }
const B = { id: 'client-b', nickname: 'B', joinedAt: 2 }
const C = { id: 'client-c', nickname: 'C', joinedAt: 3 }
const D = { id: 'client-d', nickname: 'D', joinedAt: 4 }

function selection(id, slots, late) {
  return { id, slots, updatedAt: 1000, late: !!late }
}

test('closed week with everyone free produces the H5 payload', () => {
  const state = buildState({
    room: ROOM,
    members: [A, B],
    selections: [
      selection('client-a', ['sat_pm'], true),
      selection('client-b', ['sat_pm'], false),
    ],
    clientId: 'client-a',
    now: NOW_CLOSED,
  })

  assert.equal(state.roomId, 'room1')
  assert.equal(state.isOwner, true)
  assert.equal(state.needsNickname, false)
  assert.equal(state.week.weekLabel, '10.24 — 10.25')
  assert.equal(state.week.status, 'closed')
  assert.equal(state.week.statusLabel, '已截止')
  assert.equal(state.week.deadlineLabel, '周五 20:00')
  assert.equal(state.week.serverNow, NOW_CLOSED)

  assert.equal(state.me.nickname, 'A')
  assert.deepEqual(state.me.slots, ['sat_pm'])
  assert.equal(state.me.late, true)
  assert.equal(state.me.filled, true)

  assert.equal(state.members.length, 2)
  const me = state.members.find((member) => member.nickname === 'A')
  const other = state.members.find((member) => member.nickname === 'B')
  assert.equal(me.isMe, true)
  assert.equal(me.filled, true)
  assert.equal(me.late, true)
  assert.equal(other.isMe, false)
  assert.equal(other.late, false)

  assert.equal(state.stats.memberCount, 2)
  assert.equal(state.stats.filledCount, 2)
  assert.deepEqual(state.stats.allFreeSlots, ['sat_pm'])
  assert.deepEqual(state.stats.bestSlots, ['sat_pm'])

  const satPm = state.slots.find((slot) => slot.id === 'sat_pm')
  assert.equal(satPm.selected, true)
  assert.equal(satPm.count, 2)
  assert.equal(satPm.allFree, true)
  assert.equal(satPm.countText, '2 人都有空')
  assert.equal(satPm.namesText, '我、B')

  assert.equal(state.result.tone, 'good')
  assert.equal(state.result.eyebrow, '全员有空')
  assert.equal(state.result.title, '周六下午')
  assert.equal(state.shareTitle, '周六下午全员有空｜10.24 — 10.25')
  assert.equal(state.membersProgress, '2/2')
  assert.equal(state.unfilledText, '')
  assert.equal(state.heroSub, '结果已出，把链接再发一次群。')
  assert.equal(state.footerHint, '结果实时更新；截止后的修改会标记“补”。')
})

test('a visitor without a nickname gets needsNickname and no me', () => {
  const state = buildState({
    room: ROOM,
    members: [A, B],
    selections: [selection('client-a', ['sat_am'])],
    clientId: 'client-c',
    now: NOW_OPEN,
  })

  assert.equal(state.needsNickname, true)
  assert.equal(state.me, null)
  assert.equal(state.isOwner, false)
  assert.equal(state.week.status, 'open')
  assert.equal(state.week.statusLabel, '收集中')
  assert.equal(state.members.length, 2)
  assert.equal(state.heroSub, '点一下，告诉我你哪些半天有空。')
  assert.equal(state.footerHint, '周五 20:00 出结果；之后仍可补填。')
})

test('partial fill exposes counts, unfilled names and best-missing names', () => {
  const state = buildState({
    room: ROOM,
    members: [A, B, C, D],
    selections: [
      selection('client-a', ['sat_pm']),
      selection('client-b', ['sat_pm']),
      selection('client-d', []),
    ],
    clientId: 'client-a',
    now: NOW_CLOSED,
  })

  assert.equal(state.stats.memberCount, 4)
  assert.equal(state.stats.filledCount, 3)
  assert.deepEqual(state.stats.allFreeSlots, [])
  assert.deepEqual(state.stats.bestSlots, ['sat_pm'])
  assert.deepEqual(state.stats.bestMissing, ['D'])
  assert.deepEqual(state.stats.unfilled, [{ nickname: 'C', isMe: false }])

  assert.equal(state.result.tone, 'warn')
  assert.equal(state.result.title, '人最多：周六下午')
  assert.equal(state.result.detail, '2 人有空，还有 1 人没填。')
  assert.equal(state.membersProgress, '3/4')
  assert.equal(state.unfilledText, '还没填：C')
})

test('a member who has not chosen yet is not marked as filled', () => {
  const state = buildState({
    room: ROOM,
    members: [A, B],
    selections: [selection('client-a', ['sat_pm'])],
    clientId: 'client-b',
    now: NOW_OPEN,
  })

  assert.equal(state.needsNickname, false)
  assert.equal(state.me.filled, false)
  assert.deepEqual(state.me.slots, [])
})

test('members are ordered by join time and the key is stable within a response', () => {
  const state = buildState({
    room: ROOM,
    members: [C, A, B],
    selections: [],
    clientId: 'client-b',
    now: NOW_OPEN,
  })

  assert.deepEqual(state.members.map((member) => member.nickname), ['A', 'B', 'C'])
  assert.deepEqual(state.members.map((member) => member.key), ['0', '1', '2'])
})