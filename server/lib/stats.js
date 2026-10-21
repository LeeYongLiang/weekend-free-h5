'use strict'

const SLOT_IDS = ['sat_am', 'sat_pm', 'sun_am', 'sun_pm']

const SLOT_LABELS = {
  sat_am: '周六上午',
  sat_pm: '周六下午',
  sun_am: '周日上午',
  sun_pm: '周日下午',
}

/**
 * Pure availability aggregation for the H5 store.
 *
 * members:   [{ id, nickname }]
 * selections:[{ id, slots: [] }]  -- an empty slots array means "filled, free in none"
 *
 * "All free" is strict: at least two members, everyone has a selection document,
 * and every member selected that slot.
 */
function computeStats(members, selections) {
  const selById = new Map()
  for (const selection of selections || []) {
    if (selection && selection.id) selById.set(selection.id, selection)
  }

  const filledMembers = members.filter((member) => selById.has(member.id))
  const filledCount = filledMembers.length
  const memberCount = members.length
  const everyoneFilled = memberCount >= 2 && filledCount === memberCount

  const slots = SLOT_IDS.map((id) => {
    const free = members.filter((member) => {
      const selection = selById.get(member.id)
      return !!(selection && Array.isArray(selection.slots) && selection.slots.includes(id))
    })
    return {
      id,
      count: free.length,
      freeIds: free.map((member) => member.id),
      allFree: everyoneFilled && free.length === memberCount,
    }
  })

  const allFreeSlots = slots.filter((slot) => slot.allFree).map((slot) => slot.id)
  const maxCount = slots.reduce((max, slot) => Math.max(max, slot.count), 0)
  const bestSlots = maxCount > 0
    ? slots.filter((slot) => slot.count === maxCount).map((slot) => slot.id)
    : []

  let bestMissingIds = []
  if (bestSlots.length > 0) {
    const best = slots.find((slot) => slot.id === bestSlots[0])
    const freeSet = new Set(best.freeIds)
    bestMissingIds = filledMembers
      .filter((member) => !freeSet.has(member.id))
      .map((member) => member.id)
  }

  const unfilledIds = members
    .filter((member) => !selById.has(member.id))
    .map((member) => member.id)

  return {
    memberCount,
    filledCount,
    slots,
    allFreeSlots,
    bestSlots,
    bestMissingIds,
    unfilledIds,
  }
}

module.exports = {
  SLOT_IDS,
  SLOT_LABELS,
  computeStats,
}