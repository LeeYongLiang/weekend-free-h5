'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  slotLabel,
  formatNames,
  countText,
  buildResult,
  buildShareTitle,
  unfilledText,
} = require('../server/lib/view')

const allFreeStats = {
  memberCount: 3,
  filledCount: 3,
  slots: [
    { id: 'sat_am', count: 2, allFree: false },
    { id: 'sat_pm', count: 3, allFree: true },
  ],
  allFreeSlots: ['sat_pm'],
  bestSlots: ['sat_pm'],
  unfilled: [],
}

const partialStats = {
  memberCount: 3,
  filledCount: 2,
  slots: [
    { id: 'sat_am', count: 1, allFree: false },
    { id: 'sat_pm', count: 2, allFree: false },
  ],
  allFreeSlots: [],
  bestSlots: ['sat_pm'],
  unfilled: [{ nickname: 'C', isMe: false }],
}

test('slot labels', () => {
  assert.equal(slotLabel('sat_am'), '周六上午')
  assert.equal(slotLabel('sun_pm'), '周日下午')
  assert.equal(slotLabel('unknown'), 'unknown')
})

test('all-free result', () => {
  const result = buildResult(allFreeStats)
  assert.equal(result.tone, 'good')
  assert.equal(result.eyebrow, '全员有空')
  assert.equal(result.title, '周六下午')
})

test('partial result explains who is missing', () => {
  const result = buildResult(partialStats)
  assert.equal(result.tone, 'warn')
  assert.equal(result.title, '人最多：周六下午')
  assert.equal(result.detail, '2 人有空，还有 1 人没填。')
})

test('everyone filled but one slot has fewer people', () => {
  const result = buildResult({
    memberCount: 4,
    filledCount: 4,
    slots: [{ id: 'sat_pm', count: 3, allFree: false }],
    allFreeSlots: [],
    bestSlots: ['sat_pm'],
    unfilled: [],
  })
  assert.equal(result.detail, '3/4 人有空，还差 1 人。')
})

test('names the person who is not free when everyone filled', () => {
  const result = buildResult({
    memberCount: 4,
    filledCount: 4,
    slots: [{ id: 'sat_pm', count: 3, allFree: false }],
    allFreeSlots: [],
    bestSlots: ['sat_pm'],
    bestMissing: ['D'],
    unfilled: [],
  })
  assert.equal(result.detail, '3/4 人有空，D没空。')
})

test('solo member is invited to share', () => {
  const result = buildResult({
    memberCount: 1,
    filledCount: 1,
    slots: [{ id: 'sat_am', count: 1, allFree: false }],
    allFreeSlots: [],
    bestSlots: ['sat_am'],
    unfilled: [],
  })
  assert.equal(result.eyebrow, '只有你')
  assert.equal(result.title, '把卡片转发到群里')
})

test('share titles', () => {
  assert.equal(
    buildShareTitle(allFreeStats, '10.24 — 10.25'),
    '周六下午全员有空｜10.24 — 10.25'
  )
  assert.equal(
    buildShareTitle(partialStats, '10.24 — 10.25'),
    '周六下午 2 人有空｜10.24 — 10.25'
  )
  assert.equal(
    buildShareTitle(null, '10.24 — 10.25'),
    '这周末谁有空？10.24 — 10.25，点一下告诉我'
  )
})

test('count text', () => {
  assert.equal(countText({ allFree: true, count: 3 }, allFreeStats), '3 人都有空')
  assert.equal(countText({ allFree: false, count: 0 }, partialStats), '还没人选')
  assert.equal(countText({ allFree: false, count: 2 }, partialStats), '2 人有空')
  assert.equal(countText({ allFree: false, count: 2 }, { memberCount: 0 }), '还没人')
})

test('name formatting', () => {
  assert.equal(formatNames([]), '')
  assert.equal(formatNames([{ nickname: '张三', isMe: true }]), '我')
  assert.equal(
    formatNames([{ nickname: '张三' }, { nickname: '李四' }]),
    '张三、李四'
  )
  assert.equal(
    formatNames([{ nickname: '张三' }, { nickname: '李四' }, { nickname: '王五' }]),
    '张三、李四 等 3 人'
  )
})

test('unfilled text', () => {
  assert.equal(unfilledText({ unfilled: [] }), '')
  assert.equal(
    unfilledText({ unfilled: [{ nickname: 'A' }, { nickname: 'B' }] }),
    '还没填：A、B'
  )
  assert.equal(
    unfilledText({
      unfilled: [{ nickname: 'A' }, { nickname: 'B' }, { nickname: 'C' }, { nickname: 'D' }],
    }),
    '还没填：A、B、C 等 4 人'
  )
})