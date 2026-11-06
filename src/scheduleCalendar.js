const taiwanDate = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function taiwanDateKey(value = Date.now()) {
  const parts = taiwanDate.formatToParts(new Date(value))
  const { year, month, day } = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${year.padStart(4, '0')}-${month}-${day}`
}

// Once a session has a Taipei date, do calendar arithmetic on the date alone.
function utcDay(key) {
  return new Date(`${key}T00:00:00Z`)
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

export function monthRange(month) {
  const from = `${month}-01`
  const last = utcDay(from)
  last.setUTCMonth(last.getUTCMonth() + 1, 0)
  return { from, until: dayKey(last) }
}

export function shiftMonth(month, offset) {
  const first = utcDay(`${month}-01`)
  first.setUTCMonth(first.getUTCMonth() + offset)
  return dayKey(first).slice(0, 7)
}

export function monthCells(month, firstWeekday = 0) {
  const { from, until } = monthRange(month)
  const leading = (utcDay(from).getUTCDay() - firstWeekday + 7) % 7
  const days = Number(until.slice(-2))
  const cells = Array(leading).fill(null)
  for (let day = 1; day <= days; day++) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function weekRange(date, weekOffset = 0) {
  const start = utcDay(date)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() + weekOffset * 7)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return { from: dayKey(start), until: dayKey(end) }
}

export function groupSessionsByDay(sessions) {
  const days = new Map()
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id)
  for (const session of sorted) {
    const day = taiwanDateKey(session.startsAt)
    if (!days.has(day)) days.set(day, [])
    days.get(day).push(session)
  }
  return days
}

export function initialSelectedDay(sessions, range, today = taiwanDateKey()) {
  const days = sessions.map(session => taiwanDateKey(session.startsAt))
    .filter(day => day >= range.from && day <= range.until).sort()
  const emptyDay = today >= range.from && today <= range.until ? today : range.from
  return days.find(day => day >= today) ?? days[0] ?? emptyDay
}

export function summarizeSessionDays(grouped) {
  const days = new Map()
  for (const [day, sessions] of grouped) {
    let remaining = 0
    let enrolled = 0
    for (const session of sessions) {
      enrolled += session.enrolled
      // Show unfilled seats even after a class starts; booking eligibility is separate.
      remaining += Math.max(0, session.capacity - session.enrolled)
    }
    days.set(day, { count: sessions.length, remaining, enrolled })
  }
  return days
}
