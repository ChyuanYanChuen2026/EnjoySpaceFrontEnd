export function trialApplicationIssue({ member, plans, planId, session, loading, referrerName, now = Date.now() }) {
  if (loading) return '正在讀取體驗方案與場次…'
  if (member && !member.roles.some(role => ['Student', 'TrialGuest'].includes(role))) return '此帳號無法申請體驗課，請使用學生帳號。'
  if (!plans.length) return '目前尚無開放的體驗方案，方案公布後即可申請。'
  const plan = plans.find(plan => plan.id === planId)
  if (!plan) return '請選擇目前開放的體驗方案。'
  if (plan.requiresReferrer && !referrerName?.trim()) return '舊生介紹方案須填寫介紹人姓名。'
  if (!session) return '請選擇體驗場次。'
  if (new Date(session.startsAt).getTime() <= now) return '此場次已開始，請選擇其他場次。'
  if (session.enrolled >= session.capacity) return '此場次已額滿，請選擇其他場次。'
  return ''
}
