'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { computeStats, SLOT_IDS } = require('../server/lib/stats')

const members = [
  { id: 'a', nickname: 'A' },
  { id: 'b', nickname: 'B' },
  { id: 'c', nickname: 'C' },
]

test('slot ids stay stable', () => {
  assert.deepEqual(SLOT_IDS, ['sat_am', 'sat_pm', 'sun_am', 'sun_pm'])
})

test('partial fill is never all-free', () => {
  const stats = computeStats(members, [
    { id: 'a', slots: ['sat_am', 'sat_pm'] },
    { id: 'b', slots: ['sat_pm'] },
  ])

  assert.equal(stats.memberCount, 3)
  assert.equal(stats.filledCount, 2)
  assert.deepEqual(stats.unfilledIds, ['c'])
  assert.deepEqual(stats.allFreeSlots, [])
  assert.deepEqual(stats.bestSlots, ['sat_pm'])
  assert.equal(stats.slots.find((slot) => slot.id === 'sat_pm').count, 2)
})

test('everyone free in one slot is all-free', () => {
  const stats = computeStats(members, [
    { id: 'a', slots: ['sat_pm'] },
    { id: 'b', slots: ['sat_pm'] },
    { id: 'c', slots: ['sat_pm'] },
  ])

  assert.equal(stats.filledCount, 3)
  assert.deepEqual(stats.allFreeSlots, ['sat_pm'])
  assert.deepEqual(stats.bestSlots, ['sat_pm'])
  assert.deepEqual(stats.bestMissingIds, [])
})

test('an empty selection counts as filled', () => {
  const stats = computeStats(members, [
    { id: 'a', slots: ['sat_pm'] },
    { id: 'b', slots: ['sat_pm'] },
    { id: 'c', slots: [] },
  ])

  assert.equal(stats.filledCount, 3)
  assert.deepEqual(stats.unfilledIds, [])
  assert.deepEqual(stats.allFreeSlots, [])
  assert.deepEqual(stats.bestSlots, ['sat_pm'])
  assert.deepEqual(stats.bestMissingIds, ['c'])
})

test('a single member is never "all free"', () => {
  const stats = computeStats([{ id: 'a', nickname: 'A' }], [
    { id: 'a', slots: ['sat_am'] },
  ])

  assert.equal(stats.memberCount, 1)
  assert.equal(stats.filledCount, 1)
  assert.deepEqual(stats.allFreeSlots, [])
  assert.deepEqual(stats.bestSlots, ['sat_am'])
})

test('ties keep every best slot, and missing names are for the first one', () => {
  const four = members.concat([{ id: 'd', nickname: 'D' }])
  const stats = computeStats(four, [
    { id: 'a', slots: ['sat_am'] },
    { id: 'b', slots: ['sat_pm'] },
    { id: 'c', slots: ['sat_am'] },
    { id: 'd', slots: ['sat_pm'] },
  ])

  assert.deepEqual(stats.bestSlots, ['sat_am', 'sat_pm'])
  assert.deepEqual(stats.bestMissingIds, ['b', 'd'])
})

test('nobody has filled', () => {
  const stats = computeStats(members, [])

  assert.equal(stats.filledCount, 0)
  assert.deepEqual(stats.unfilledIds, ['a', 'b', 'c'])
  assert.deepEqual(stats.allFreeSlots, [])
  assert.deepEqual(stats.bestSlots, [])
})

test('no members at all', () => {
  const stats = computeStats([], [])

  assert.equal(stats.memberCount, 0)
  assert.equal(stats.filledCount, 0)
  assert.deepEqual(stats.allFreeSlots, [])
  assert.deepEqual(stats.bestSlots, [])
})