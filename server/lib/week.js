'use strict'

const BJ_OFFSET = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function ymd(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function beijingDate(ts) {
  return new Date(ts + BJ_OFFSET)
}

/**
 * The weekend (Saturday/Sunday) the app should currently show, in Beijing time.
 *
 * Saturday  -> today
 * Sunday    -> yesterday
 * Mon-Fri   -> the coming Saturday
 *
 * The deadline is Friday 20:00 Beijing time, which is Friday 12:00 UTC.
 */
function weekendFor(ts) {
  const now = typeof ts === 'number' ? ts : Date.now()
  const bj = beijingDate(now)
  const day = bj.getUTCDay() // 0 = Sunday ... 6 = Saturday

  let diff
  if (day === 6) diff = 0
  else if (day === 0) diff = -1
  else diff = 6 - day

  const sat = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + diff))
  const sun = new Date(Date.UTC(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate() + 1))
  const deadline = Date.UTC(
    sat.getUTCFullYear(),
    sat.getUTCMonth(),
    sat.getUTCDate() - 1,
    12, 0, 0, 0
  )

  return {
    weekKey: ymd(sat),
    satDate: ymd(sat),
    sunDate: ymd(sun),
    deadline,
  }
}

function weekLabel(satDate, sunDate) {
  const md = (value) => {
    const parts = value.split('-')
    return `${Number(parts[1])}.${parts[2]}`
  }
  return `${md(satDate)} — ${md(sunDate)}`
}

function deadlineLabel(deadline) {
  const bj = beijingDate(deadline)
  return `周五 ${pad2(bj.getUTCHours())}:${pad2(bj.getUTCMinutes())}`
}

function weekStatus(deadline, now) {
  return now >= deadline ? 'closed' : 'open'
}

function formatDateTime(ts) {
  const bj = beijingDate(ts)
  return `${ymd(bj)} ${pad2(bj.getUTCHours())}:${pad2(bj.getUTCMinutes())}:${pad2(bj.getUTCSeconds())}`
}

module.exports = {
  BJ_OFFSET,
  DAY_MS,
  beijingDate,
  weekendFor,
  weekLabel,
  deadlineLabel,
  weekStatus,
  formatDateTime,
  ymd,
}