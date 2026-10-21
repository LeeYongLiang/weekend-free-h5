'use strict'

const { weekendFor, weekLabel, deadlineLabel, weekStatus } = require('./week')
const { computeStats } = require('./stats')
const {
  SLOT_DEFS,
  formatNames,
  countText,
  buildResult,
  buildShareTitle,
  unfilledText,
} = require('./view')

/**
 * Build the exact payload the H5 page renders.
 *
 * room:       { id, ownerClientId, ownerNickname }
 * members:    [{ id, nickname, joinedAt }]
 * selections: [{ id, slots, updatedAt, late }]
 * clientId:   the browser-local identity
 * now:        epoch ms (Beijing time is derived by lib/week)
 */
function buildState({ room, members, selections, clientId, now }) {
  const weekend = weekendFor(now)
  const sortedMembers = members
    .slice()
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
  const stats = computeStats(sortedMembers, selections)

  const selById = new Map(selections.map((selection) => [selection.id, selection]))
  const memberById = new Map(sortedMembers.map((member) => [member.id, member]))

  const me = memberById.get(clientId) || null
  const mySelection = selById.get(clientId) || null

  const viewStats = {
    memberCount: stats.memberCount,
    filledCount: stats.filledCount,
    slots: stats.slots.map((slot) => ({
      id: slot.id,
      count: slot.count,
      allFree: slot.allFree,
    })),
    allFreeSlots: stats.allFreeSlots,
    bestSlots: stats.bestSlots,
    bestMissing: stats.bestMissingIds
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((member) => member.nickname),
    unfilled: stats.unfilledIds
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((member) => ({
        nickname: member.nickname,
        isMe: member.id === clientId,
      })),
  }

  const publicSlots = stats.slots.map((slot) => ({
    id: slot.id,
    count: slot.count,
    allFree: slot.allFree,
    members: slot.freeIds
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((member) => ({
        nickname: member.nickname,
        isMe: member.id === clientId,
      })),
  }))

  const slots = SLOT_DEFS.map((def) => {
    const slot = publicSlots.find((item) => item.id === def.id) || {
      id: def.id,
      count: 0,
      allFree: false,
      members: [],
    }
    return {
      id: def.id,
      label: def.label,
      selected: !!(mySelection && mySelection.slots.includes(def.id)),
      count: slot.count,
      allFree: slot.allFree,
      countText: countText(slot, viewStats),
      namesText: formatNames(slot.members),
    }
  })

  const status = weekStatus(weekend.deadline, now)
  const result = buildResult(viewStats)

  return {
    roomId: room.id,
    isOwner: room.ownerClientId === clientId,
    needsNickname: !me,
    week: {
      key: weekend.weekKey,
      satDate: weekend.satDate,
      sunDate: weekend.sunDate,
      weekLabel: weekLabel(weekend.satDate, weekend.sunDate),
      deadline: weekend.deadline,
      deadlineLabel: deadlineLabel(weekend.deadline),
      status,
      statusLabel: status === 'open' ? '收集中' : '已截止',
      serverNow: now,
    },
    me: me
      ? {
          nickname: me.nickname,
          slots: mySelection && Array.isArray(mySelection.slots) ? mySelection.slots : [],
          late: !!(mySelection && mySelection.late),
          filled: !!mySelection,
        }
      : null,
    members: sortedMembers.map((member, index) => {
      const selection = selById.get(member.id)
      return {
        key: String(index),
        nickname: member.nickname,
        isMe: member.id === clientId,
        filled: !!selection,
        late: !!(selection && selection.late),
      }
    }),
    stats: viewStats,
    slots,
    result,
    membersProgress: `${stats.filledCount}/${stats.memberCount}`,
    unfilledText: unfilledText(viewStats),
    shareTitle: buildShareTitle(viewStats, weekLabel(weekend.satDate, weekend.sunDate)),
    heroSub: status === 'open'
      ? '点一下，告诉我你哪些半天有空。'
      : '结果已出，把链接再发一次群。',
    footerHint: status === 'open'
      ? '周五 20:00 出结果；之后仍可补填。'
      : '结果实时更新；截止后的修改会标记“补”。',
  }
}

module.exports = { buildState }