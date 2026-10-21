(function () {
  'use strict'

  const SLOT_ORDER = ['sat_am', 'sat_pm', 'sun_am', 'sun_pm']
  const QUICK = {
    all: ['sat_am', 'sat_pm', 'sun_am', 'sun_pm'],
    sat: ['sat_am', 'sat_pm'],
    sun: ['sun_am', 'sun_pm'],
    none: [],
  }
  const STORAGE_CLIENT = 'weekend_free_client_id'
  const STORAGE_ROOM = 'weekend_free_last_room'

  const $ = (id) => document.getElementById(id)
  const els = {
    loading: $('loading'),
    error: $('error'),
    errorText: $('errorText'),
    retryBtn: $('retryBtn'),
    newRoomBtn: $('newRoomBtn'),
    content: $('content'),
    weekLabel: $('weekLabel'),
    status: $('status'),
    heroSub: $('heroSub'),
    slots: $('slots'),
    allFreeBanner: $('allFreeBanner'),
    allFreeText: $('allFreeText'),
    allFreeSlots: $('allFreeSlots'),
    celebration: $('celebration'),
    saveIndicator: $('saveIndicator'),
    result: $('result'),
    resultBars: $('resultBars'),
    resultEyebrow: $('resultEyebrow'),
    resultTitle: $('resultTitle'),
    resultDetail: $('resultDetail'),
    members: $('members'),
    membersProgress: $('membersProgress'),
    memberCount: $('memberCount'),
    memberProgressBar: $('memberProgressBar'),
    memberProgressFill: $('memberProgressFill'),
    unfilledText: $('unfilledText'),
    copyBtn: $('copyBtn'),
    refreshBtn: $('refreshBtn'),
    footerHint: $('footerHint'),
    nicknameModal: $('nicknameModal'),
    nicknameInput: $('nicknameInput'),
    joinBtn: $('joinBtn'),
    toast: $('toast'),
  }

  let state = null
  let lastServerState = null
  let roomId = parseRoomId()
  let saving = false
  let dirty = false
  let pendingSlots = []
  let mutationSeq = 0
  let toastTimer = null
  let pollTimer = null
  let cachedClientId = ''
  let celebrationTimer = null
  let lastMatchKey = ''
  let refreshing = false
  let modalReturnFocus = null
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function parseRoomId() {
    const match = location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)/)
    return match ? match[1] : ''
  }

  function getClientId() {
    if (cachedClientId) return cachedClientId

    let id = ''
    try {
      id = localStorage.getItem(STORAGE_CLIENT) || ''
    } catch (e) {
      id = ''
    }

    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
      try {
        localStorage.setItem(STORAGE_CLIENT, id)
      } catch (e) {
        // Private mode: keep the in-memory id for this visit.
      }
    }

    cachedClientId = id
    return id
  }

  async function request(path, options) {
    let res
    try {
      res = await fetch(path, options)
    } catch (e) {
      const error = new Error('网络错误')
      error.code = 'NETWORK'
      throw error
    }

    let payload = null
    try {
      payload = await res.json()
    } catch (e) {
      payload = null
    }

    if (!payload || payload.ok !== true) {
      const error = new Error((payload && payload.error) || '请求失败')
      error.code = (payload && payload.code) || (res.status === 404 ? 'NOT_FOUND' : 'INTERNAL')
      throw error
    }

    return payload.data
  }

  function post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  function showToast(text) {
    els.toast.textContent = text
    els.toast.classList.remove('hidden')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2400)
  }

  function showError(message, code) {
    els.loading.classList.add('hidden')
    els.content.classList.add('hidden')
    setNicknameModal(false)
    els.error.classList.remove('hidden')
    els.errorText.textContent = message
    els.newRoomBtn.classList.toggle('hidden', code !== 'ROOM_NOT_FOUND')
  }

  function showContent() {
    els.loading.classList.add('hidden')
    els.error.classList.add('hidden')
    els.content.classList.remove('hidden')
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function quickMode(slots) {
    const key = slots.slice().sort().join(',')
    const same = (list) => list.slice().sort().join(',') === key
    if (same(QUICK.all)) return 'all'
    if (same(QUICK.sat)) return 'sat'
    if (same(QUICK.sun)) return 'sun'
    if (key === '') return 'none'
    return ''
  }

  function icon(name, className) {
    return '<svg class="icon ' + (className || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'
  }

  function setSaveStatus(status) {
    const labels = { saving: '正在保存…', saved: '已自动保存', failed: '保存失败，请重试' }
    els.saveIndicator.className = 'save-indicator ' + (status || '')
    els.saveIndicator.textContent = labels[status] || '点选即保存'
  }

  function setNicknameModal(open) {
    const wasOpen = !els.nicknameModal.classList.contains('hidden')
    if (open && !wasOpen) modalReturnFocus = document.activeElement
    els.nicknameModal.classList.toggle('hidden', !open)
    document.body.classList.toggle('modal-open', open)
    els.content.inert = open
    document.querySelector('.topbar').inert = open
    if (open && !wasOpen) setTimeout(() => {
      if (!els.nicknameModal.classList.contains('hidden')) els.nicknameInput.focus()
    }, 50)
    if (!open && wasOpen) {
      if (modalReturnFocus && modalReturnFocus.isConnected && modalReturnFocus !== document.body) modalReturnFocus.focus()
      else els.slots.querySelector('.slot')?.focus({ preventScroll: true })
    }
  }

  function celebrate() {
    clearTimeout(celebrationTimer)
    els.celebration.replaceChildren()
    if (reducedMotion.matches) return
    const fragment = document.createDocumentFragment()
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('span')
      piece.className = 'confetti'
      const angle = (i / 24) * Math.PI * 2
      piece.style.setProperty('--dx', Math.round(Math.cos(angle) * (110 + Math.random() * 220)) + 'px')
      piece.style.setProperty('--dy', Math.round(Math.sin(angle) * 110 + 50) + 'px')
      piece.style.setProperty('--spin', Math.round(Math.random() * 540) + 'deg')
      piece.style.animationDelay = (i % 4) * 35 + 'ms'
      fragment.appendChild(piece)
    }
    els.celebration.appendChild(fragment)
    celebrationTimer = setTimeout(() => els.celebration.replaceChildren(), 1400)
  }

  function renderSlots(next) {
    const focusedId = document.activeElement?.closest('.slot')?.dataset.id
    if (!els.slots.children.length) {
      els.slots.innerHTML = next.slots.map((slot) => {
        const date = slot.id.startsWith('sat') ? next.week.satDate : next.week.sunDate
        return '<button class="slot" type="button" data-id="' + slot.id + '" aria-pressed="false">'
          + '<span class="slot-head">' + icon(slot.id.endsWith('am') ? 'sun' : 'sunset', 'slot-time-icon')
          + '<span class="slot-check">' + icon('check') + '</span></span>'
          + '<span class="slot-label">' + escapeHtml(slot.label)
          + '<span class="slot-date">' + escapeHtml(date.slice(5).replace('-', '.')) + '</span></span>'
          + '<span class="slot-foot"><span class="slot-count"></span><span class="badge hidden">' + icon('check') + '全员有空</span></span>'
          + '<span class="slot-names"></span></button>'
      }).join('')
    }
    next.slots.forEach((slot) => {
      const el = els.slots.querySelector('[data-id="' + slot.id + '"]')
      const date = slot.id.startsWith('sat') ? next.week.satDate : next.week.sunDate
      el.classList.toggle('on', slot.selected)
      el.classList.toggle('all-free', slot.allFree)
      el.setAttribute('aria-pressed', String(slot.selected))
      el.setAttribute('aria-label', slot.label + '，' + slot.countText + (slot.allFree ? '，全员有空' : ''))
      el.querySelector('.slot-date').textContent = date.slice(5).replace('-', '.')
      el.querySelector('.slot-count').textContent = slot.countText
      el.querySelector('.badge').classList.toggle('hidden', !slot.allFree)
      const names = el.querySelector('.slot-names')
      names.textContent = slot.namesText || (slot.selected ? '我有空，等你一起' : '点击选为有空')
      names.classList.toggle('slot-selection-label', !slot.namesText && slot.selected)
    })
    if (focusedId && document.activeElement === document.body) {
      els.slots.querySelector('[data-id="' + focusedId + '"]')?.focus({ preventScroll: true })
    }
  }

  function renderBars(next) {
    if (!els.resultBars.children.length) {
      els.resultBars.innerHTML = next.slots.map((slot) =>
        '<div class="result-bar-row" data-slot="' + slot.id + '"><span>' + escapeHtml(slot.label) + '</span>'
        + '<span class="result-bar-track"><span class="result-bar-fill" style="width:0"></span></span>'
        + '<span class="result-bar-count"></span></div>'
      ).join('')
    }
    next.slots.forEach((slot) => {
      const row = els.resultBars.querySelector('[data-slot="' + slot.id + '"]')
      const percent = next.stats.memberCount ? slot.count / next.stats.memberCount * 100 : 0
      row.classList.toggle('match', slot.allFree)
      row.querySelector('.result-bar-count').textContent = slot.count + '/' + next.stats.memberCount
      row.querySelector('.result-bar-fill').style.width = percent + '%'
    })
  }

  function render(next) {
    state = next
    lastServerState = next
    roomId = next.roomId
    try {
      localStorage.setItem(STORAGE_ROOM, roomId)
    } catch (e) {
      // Ignore storage failures.
    }

    if (location.pathname !== '/r/' + roomId) {
      history.replaceState(null, '', '/r/' + roomId)
    }

    document.title = '周末有空｜' + next.week.weekLabel

    els.weekLabel.textContent = next.week.weekLabel
    els.status.textContent = next.week.statusLabel
    els.status.className = 'status ' + next.week.status
    els.heroSub.textContent = next.heroSub
    els.footerHint.textContent = next.footerHint
    els.membersProgress.textContent = '已填 ' + next.membersProgress
    els.unfilledText.textContent = next.unfilledText

    els.result.className = 'result panel ' + next.result.tone
    els.resultEyebrow.textContent = next.result.eyebrow
    els.resultTitle.textContent = next.stats.allFreeSlots.length === SLOT_ORDER.length
      ? '整个周末，大家都有空' : next.result.title
    els.resultDetail.textContent = next.result.detail || ''

    const allFree = next.stats.allFreeSlots.length > 0
    els.allFreeBanner.classList.toggle('hidden', !allFree)
    els.allFreeText.textContent = allFree ? next.stats.memberCount + ' 位伙伴都有空，一起出发。' : ''
    const matchKey = allFree ? next.roomId + ':' + next.week.key + ':' + next.stats.allFreeSlots.join(',') : ''
    const matchesChanged = matchKey !== lastMatchKey
    if (matchesChanged) {
      els.allFreeSlots.innerHTML = next.slots.filter((slot) => slot.allFree).map((slot) =>
        '<span class="match-slot">' + icon('check') + escapeHtml(slot.label) + '</span>'
      ).join('')
    }
    if (!allFree) {
      clearTimeout(celebrationTimer)
      els.celebration.replaceChildren()
    }
    lastMatchKey = matchKey

    renderSlots(next)
    renderBars(next)
    els.memberCount.textContent = next.stats.memberCount + ' 人'
    const progress = next.stats.memberCount ? Math.round(next.stats.filledCount / next.stats.memberCount * 100) : 0
    els.memberProgressFill.style.width = progress + '%'
    els.memberProgressBar.setAttribute('aria-valuenow', String(progress))
    els.memberProgressBar.setAttribute('aria-valuetext', next.stats.filledCount + ' 人已填，共 ' + next.stats.memberCount + ' 人')

    els.members.innerHTML = next.members.map((member) => {
      const initial = Array.from(member.nickname || '?')[0] || '?'
      return '<span class="member ' + (member.filled ? '' : 'empty') + '">'
        + '<span class="member-avatar">' + escapeHtml(initial) + '</span>'
        + '<span class="member-name">' + escapeHtml(member.nickname)
        + (member.isMe ? '<span class="member-me">我</span>' : '') + '</span>'
        + (member.filled ? icon('check', 'member-filled') : '')
        + (member.late ? '<span class="member-late">补</span>' : '')
        + '</span>'
    }).join('') || '<p class="members-empty">等你和朋友加入，周末就有着落了。</p>'

    const active = next.me && next.me.filled ? quickMode(next.me.slots) : ''
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.toggle('on', chip.dataset.mode === active)
      chip.setAttribute('aria-pressed', String(chip.dataset.mode === active))
    })

    const needsNickname = !!next.needsNickname
    setNicknameModal(needsNickname)
    if (!saving) setSaveStatus(next.me && next.me.filled ? 'saved' : '')

    showContent()
    if (allFree && matchesChanged && !needsNickname) celebrate()
  }

  function applyOptimistic(slots) {
    const selected = new Set(slots)
    document.querySelectorAll('.slot').forEach((el) => {
      const on = selected.has(el.dataset.id)
      el.classList.toggle('on', on)
      el.setAttribute('aria-pressed', on ? 'true' : 'false')
      // A group match is server-confirmed; retract it immediately when I deselect.
      if (!on) el.classList.remove('all-free')
      el.querySelector('.badge').classList.toggle('hidden', !el.classList.contains('all-free'))
    })

    const active = quickMode(slots)
    document.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.toggle('on', chip.dataset.mode === active)
      chip.setAttribute('aria-pressed', String(chip.dataset.mode === active))
    })
    if (state && state.stats.allFreeSlots.some((id) => !selected.has(id))) {
      els.allFreeBanner.classList.add('hidden')
    }
    setSaveStatus('saving')
  }

  function queueSave(slots) {
    pendingSlots = slots.slice()
    if (saving) {
      dirty = true
      return
    }
    flushSave()
  }

  async function flushSave() {
    saving = true
    dirty = false
    const slots = pendingSlots.slice()
    const seq = ++mutationSeq
    setSaveStatus('saving')

    try {
      const data = await post('/api/selection', {
        roomId: roomId || (state && state.roomId),
        clientId: getClientId(),
        slots,
      })
      lastServerState = data
      if (seq === mutationSeq && !dirty) {
        render(data)
        setSaveStatus('saved')
      }
    } catch (e) {
      if (dirty) return

      if (e.code === 'NEED_NICKNAME') {
        setNicknameModal(true)
        setSaveStatus('')
        return
      }

      if (lastServerState) render(lastServerState)
      setSaveStatus('failed')
      showToast('保存失败，请重试')
    } finally {
      saving = false
      if (dirty) flushSave()
    }
  }

  function toggleSlot(id) {
    if (!state) return
    if (state.needsNickname) {
      setNicknameModal(true)
      return
    }

    const current = state.me && Array.isArray(state.me.slots) ? state.me.slots.slice() : []
    const index = current.indexOf(id)
    if (index >= 0) current.splice(index, 1)
    else current.push(id)

    const ordered = SLOT_ORDER.filter((slotId) => current.includes(slotId))
    state = { ...state, me: { ...(state.me || {}), slots: ordered, filled: true },
      slots: state.slots.map((slot) => ({ ...slot, selected: ordered.includes(slot.id) })) }

    applyOptimistic(ordered)
    queueSave(ordered)
  }

  function quickSelect(mode) {
    if (!state) return
    if (state.needsNickname) {
      setNicknameModal(true)
      return
    }

    const slots = (QUICK[mode] || []).slice()
    state = { ...state, me: { ...(state.me || {}), slots, filled: true },
      slots: state.slots.map((slot) => ({ ...slot, selected: slots.includes(slot.id) })) }

    applyOptimistic(slots)
    queueSave(slots)
  }

  async function join() {
    if (els.joinBtn.disabled) return

    const nickname = (els.nicknameInput.value || '').trim()
    if (!nickname) {
      showToast('先填个昵称')
      return
    }
    if (Array.from(nickname).length > 12) {
      showToast('昵称最多 12 个字')
      return
    }

    els.joinBtn.disabled = true
    const seq = ++mutationSeq

    try {
      const data = await post('/api/join', {
        roomId: roomId || (state && state.roomId),
        clientId: getClientId(),
        nickname,
      })
      if (seq === mutationSeq) {
        render(data)
        showToast('加入成功')
      }
    } catch (e) {
      if (e.code === 'ROOM_NOT_FOUND') {
        showError('这个房间不存在，可能已被删除。', 'ROOM_NOT_FOUND')
        return
      }
      showToast(e.code === 'INVALID_NICKNAME' ? '昵称需要 1–12 个字' : '加入失败，请重试')
    } finally {
      els.joinBtn.disabled = false
    }
  }

  async function refresh(manual) {
    if (!state || saving || refreshing) return
    refreshing = true
    if (manual) {
      els.refreshBtn.classList.add('refreshing')
      els.refreshBtn.disabled = true
    }
    const seq = mutationSeq

    try {
      const query = '/api/state?roomId=' + encodeURIComponent(state.roomId)
        + '&clientId=' + encodeURIComponent(getClientId())
      const data = await request(query)
      if (seq === mutationSeq && !saving && !dirty) render(data)
      if (manual) showToast('结果已更新')
    } catch (e) {
      if (manual) showToast('刷新失败，请检查网络后重试')
    } finally {
      refreshing = false
      els.refreshBtn.classList.remove('refreshing')
      els.refreshBtn.disabled = false
    }
  }

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 15000)
  }

  async function copyLink() {
    const id = state && state.roomId
    if (!id) return
    const link = location.origin + '/r/' + id

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link)
      } else {
        const input = document.createElement('textarea')
        input.value = link
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(input)
        if (!copied) throw new Error('COPY_FAILED')
      }
      showToast('链接已复制，发到群里吧')
    } catch (e) {
      showToast('复制失败，长按地址栏手动复制')
    }
  }

  async function bootstrap(forceNew) {
    const seq = ++mutationSeq
    els.loading.classList.remove('hidden')
    els.error.classList.add('hidden')
    els.content.classList.add('hidden')
    setNicknameModal(false)

    try {
      const data = await post('/api/bootstrap', {
        roomId: forceNew ? '' : (roomId || localStorage.getItem(STORAGE_ROOM) || ''),
        clientId: getClientId(),
        forceNew: !!forceNew,
      })
      if (seq !== mutationSeq) return
      render(data)
      startPolling()
    } catch (e) {
      if (seq !== mutationSeq) return
      const code = e.code || 'NETWORK'
      const message = code === 'ROOM_NOT_FOUND'
        ? '这个房间不存在，可能已被删除。'
        : code === 'INVALID_CLIENT'
          ? '浏览器身份异常，刷新页面再试。'
          : '连不上服务器，确认服务还在运行。'
      showError(message, code)
    }
  }

  els.slots.addEventListener('click', (event) => {
    const button = event.target.closest('.slot')
    if (!button) return
    if (!reducedMotion.matches) {
      const bounds = button.getBoundingClientRect()
      const ripple = document.createElement('span')
      ripple.className = 'ripple'
      ripple.style.left = (event.detail ? event.clientX - bounds.left : bounds.width / 2) + 'px'
      ripple.style.top = (event.detail ? event.clientY - bounds.top : bounds.height / 2) + 'px'
      button.appendChild(ripple)
      setTimeout(() => ripple.remove(), 550)
      button.classList.remove('slot-pop')
      void button.offsetWidth
      button.classList.add('slot-pop')
      setTimeout(() => button.classList.remove('slot-pop'), 400)
    }
    toggleSlot(button.dataset.id)
  })

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => quickSelect(chip.dataset.mode))
  })

  els.joinBtn.addEventListener('click', join)
  els.nicknameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') join()
  })
  els.copyBtn.addEventListener('click', copyLink)
  els.refreshBtn.addEventListener('click', () => refresh(true))
  els.nicknameModal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    if (event.shiftKey && document.activeElement === els.nicknameInput) {
      event.preventDefault()
      els.joinBtn.focus()
    } else if (!event.shiftKey && document.activeElement === els.joinBtn) {
      event.preventDefault()
      els.nicknameInput.focus()
    }
  })
  els.retryBtn.addEventListener('click', () => bootstrap(false))
  els.newRoomBtn.addEventListener('click', () => bootstrap(true))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })

  bootstrap(false)
})()
