export function trialApplicationIssue({ member, plans, planId, session, loading, referrerName, now = Date.now() }) {
  if (loading) return '正在讀取體驗方案與場次…'
  if (member && !member.roles.includes('Student')) return '體驗申請須先成為學生會員，請使用學生帳號；若已有體驗帳號，請聯繫工作室確認會員資格。'
  if (!plans.length) return '目前尚無開放的體驗方案，方案公布後即可申請。'
  const plan = plans.find(plan => plan.id === planId)
  if (!plan) return '請選擇目前開放的體驗方案。'
  if (plan.requiresReferrer && !referrerName?.trim()) return '舊生介紹方案須填寫介紹人姓名。'
  if (!session) return '請選擇體驗場次。'
  const startsAt = Date.parse(session.startsAt)
  if (!Number.isFinite(startsAt)) return '場次時間資料不正確，請重新整理後再選擇。'
  if (startsAt <= now) return '此場次已開始，請選擇其他場次。'
  if (session.enrolled >= session.capacity) return '此場次已額滿，請選擇其他場次。'
  return ''
}

export function trialBookingIssue({ choices, options, now = Date.now() }) {
  if (!options || !Array.isArray(options.sessions)) return '請重新選擇體驗方案與場次。'
  if (!Array.isArray(choices) || !choices.length) return '請至少選擇一堂預約場次。'
  const missing = choices.findIndex(id => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647)
  if (missing >= 0) return `請選擇第 ${missing + 1} 堂的日期與上課場次。`
  if (new Set(choices).size !== choices.length) return '重複選擇同一堂課，請調整後再送出。'
  if (choices.length > 20) return '單次最多預約 20 堂。'
  if (!Number.isInteger(options.remaining) || choices.length > options.remaining) return '可預約堂數不足；待審預約也會占用堂數，請重新整理。'
  const sessions = new Map(options.sessions.map(session => [session.id, session]))
  for (const id of choices) {
    const session = sessions.get(id)
    if (!session || !Number.isFinite(Date.parse(session.startsAt))) return '有場次不在目前可選範圍，請重新整理後選擇。'
    if (Date.parse(session.startsAt) <= now) return '有場次已開始，請重新選擇上課場次。'
  }
  return ''
}
