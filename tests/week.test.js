'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  weekendFor,
  weekLabel,
  deadlineLabel,
  weekStatus,
  formatDateTime,
} = require('../server/lib/week')

// Beijing time -> UTC timestamp.
function bj(year, month, day, hour = 12, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0)
}

test('Wednesday maps to the coming weekend', () => {
  const week = weekendFor(bj(2026, 10, 21, 12))
  assert.equal(week.weekKey, '2026-10-24')
  assert.equal(week.satDate, '2026-10-24')
  assert.equal(week.sunDate, '2026-10-25')
  assert.equal(week.deadline, Date.UTC(2026, 9, 23, 12, 0, 0))
})

test('Friday 19:59 is open, Friday 20:00 is closed', () => {
  const before = weekendFor(bj(2026, 10, 23, 19, 59))
  assert.equal(before.weekKey, '2026-10-24')
  assert.equal(weekStatus(before.deadline, bj(2026, 10, 23, 19, 59)), 'open')

  const at = weekendFor(bj(2026, 10, 23, 20, 0))
  assert.equal(at.weekKey, '2026-10-24')
  assert.equal(weekStatus(at.deadline, bj(2026, 10, 23, 20, 0)), 'closed')
})

test('Saturday and Sunday stay on the current weekend', () => {
  const saturday = weekendFor(bj(2026, 10, 24, 10))
  assert.equal(saturday.weekKey, '2026-10-24')
  assert.equal(weekStatus(saturday.deadline, bj(2026, 10, 24, 10)), 'closed')

  const sunday = weekendFor(bj(2026, 10, 25, 23))
  assert.equal(sunday.weekKey, '2026-10-24')
  assert.equal(weekStatus(sunday.deadline, bj(2026, 10, 25, 23)), 'closed')
})

test('Monday 00:00 rolls over to the next weekend', () => {
  const monday = weekendFor(bj(2026, 10, 26, 0))
  assert.equal(monday.weekKey, '2026-10-31')
  assert.equal(monday.sunDate, '2026-11-01')
  assert.equal(monday.deadline, Date.UTC(2026, 9, 30, 12, 0, 0))
})

test('month boundary', () => {
  const week = weekendFor(bj(2026, 10, 28, 12))
  assert.equal(week.weekKey, '2026-10-31')
  assert.equal(week.sunDate, '2026-11-01')
  assert.equal(weekLabel(week.satDate, week.sunDate), '10.31 — 11.01')
})

test('year boundary', () => {
  const week = weekendFor(bj(2026, 12, 30, 12))
  assert.equal(week.weekKey, '2027-01-02')
  assert.equal(week.sunDate, '2027-01-03')
  assert.equal(week.deadline, Date.UTC(2027, 0, 1, 12, 0, 0))

  const friday = weekendFor(bj(2027, 1, 1, 20, 0))
  assert.equal(friday.weekKey, '2027-01-02')
  assert.equal(weekStatus(friday.deadline, bj(2027, 1, 1, 20, 0)), 'closed')
})

test('labels are rendered in Beijing time', () => {
  const week = weekendFor(bj(2026, 10, 21, 12))
  assert.equal(deadlineLabel(week.deadline), '周五 20:00')
  assert.equal(formatDateTime(week.deadline), '2026-10-23 20:00:00')
})

test('Friday 00:00 still points at the coming weekend', () => {
  const week = weekendFor(bj(2026, 10, 23, 0))
  assert.equal(week.weekKey, '2026-10-24')
  assert.equal(weekStatus(week.deadline, bj(2026, 10, 23, 0)), 'open')
})

test('leap day', () => {
  const week = weekendFor(bj(2028, 2, 29, 10))
  assert.equal(week.weekKey, '2028-03-04')
  assert.equal(week.sunDate, '2028-03-05')
  assert.equal(week.deadline, Date.UTC(2028, 2, 3, 12, 0, 0))
})