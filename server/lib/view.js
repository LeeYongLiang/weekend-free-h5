'use strict'

const SLOT_DEFS = [
  { id: 'sat_am', label: '周六上午' },
  { id: 'sat_pm', label: '周六下午' },
  { id: 'sun_am', label: '周日上午' },
  { id: 'sun_pm', label: '周日下午' },
]

function slotLabel(id) {
  const def = SLOT_DEFS.find((slot) => slot.id === id)
  return def ? def.label : id
}

function formatNames(members) {
  if (!members || members.length === 0) return ''
  const names = members.map((member) => (member.isMe ? '我' : member.nickname))
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
}

function countText(slot, stats) {
  if (!stats || stats.memberCount === 0) return '还没人'
  if (slot.allFree) return `${slot.count} 人都有空`
  if (slot.count === 0) return '还没人选'
  return `${slot.count} 人有空`
}

function buildResult(stats) {
  if (!stats || stats.memberCount === 0) {
    return {
      tone: 'neutral',
      eyebrow: '等待加入',
      title: '把卡片转发到群里',
      detail: '大家点开就能填，不用注册。',
    }
  }

  if (stats.memberCount === 1) {
    return {
      tone: 'neutral',
      eyebrow: '只有你',
      title: '把卡片转发到群里',
      detail: '等大家进来填，结果会自动汇总。',
    }
  }

  if (stats.filledCount === 0) {
    return {
      tone: 'neutral',
      eyebrow: '还没开始',
      title: '你先选一下这周末的空闲',
      detail: '点上面的半天卡片，选完自动保存。',
    }
  }

  if (stats.allFreeSlots && stats.allFreeSlots.length > 0) {
    const labels = stats.allFreeSlots.map(slotLabel).join('、')
    return {
      tone: 'good',
      eyebrow: '全员有空',
      title: labels,
      detail: stats.allFreeSlots.length > 1
        ? '这几个半天大家都可以。'
        : '这个半天大家都可以。',
    }
  }

  if (stats.bestSlots && stats.bestSlots.length > 0) {
    const first = (stats.slots || []).find((slot) => slot.id === stats.bestSlots[0])
    const labels = stats.bestSlots.map(slotLabel).join('、')
    const count = first ? first.count : 0
    const unfilledCount = stats.memberCount - stats.filledCount

    let detail
    if (unfilledCount > 0) {
      detail = `${count} 人有空，还有 ${unfilledCount} 人没填。`
    } else {
      const missing = stats.memberCount - count
      if (missing > 0) {
        const names = Array.isArray(stats.bestMissing) ? stats.bestMissing : []
        const canNameThem = stats.bestSlots.length === 1 && names.length > 0
        if (canNameThem) {
          const nameText = names.length > 2
            ? `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
            : names.join('、')
          detail = `${count}/${stats.memberCount} 人有空，${nameText}没空。`
        } else {
          detail = `${count}/${stats.memberCount} 人有空，还差 ${missing} 人。`
        }
      } else {
        detail = `${count} 人有空。`
      }
    }

    return {
      tone: 'warn',
      eyebrow: '还没有全员空闲',
      title: `人最多：${labels}`,
      detail,
    }
  }

  return {
    tone: 'warn',
    eyebrow: '暂时没有交集',
    title: '还没有人选出共同的半天',
    detail: '等大家填完再看看。',
  }
}

function buildShareTitle(stats, weekLabel) {
  if (stats && stats.allFreeSlots && stats.allFreeSlots.length > 0) {
    const labels = stats.allFreeSlots.map(slotLabel).join('、')
    return `${labels}全员有空｜${weekLabel}`
  }

  if (stats && stats.bestSlots && stats.bestSlots.length > 0) {
    const first = (stats.slots || []).find((slot) => slot.id === stats.bestSlots[0])
    return `${slotLabel(stats.bestSlots[0])} ${first ? first.count : 0} 人有空｜${weekLabel}`
  }

  return `这周末谁有空？${weekLabel}，点一下告诉我`
}

function unfilledText(stats) {
  if (!stats || !stats.unfilled || stats.unfilled.length === 0) return ''
  const names = stats.unfilled.map((member) => (member.isMe ? '我' : member.nickname))
  if (names.length <= 3) return `还没填：${names.join('、')}`
  return `还没填：${names.slice(0, 3).join('、')} 等 ${names.length} 人`
}

module.exports = {
  SLOT_DEFS,
  slotLabel,
  formatNames,
  countText,
  buildResult,
  buildShareTitle,
  unfilledText,
}