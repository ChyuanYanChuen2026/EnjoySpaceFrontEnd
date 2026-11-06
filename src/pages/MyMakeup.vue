<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, date, time, calendarDate } from '../api'
import { catalogRevision, loadCatalog } from '../state'
import MemberPage from '../components/MemberPage.vue'
import MemberToolbar from '../components/MemberToolbar.vue'

const route = useRoute(), router = useRouter()
const data = ref({ entitlements: [], requests: [] }), busy = ref(false), saving = ref(false), loadingOptions = ref(false)
const error = ref(''), success = ref(''), needsRefresh = ref(false), action = ref(null), options = ref(null)
const targetId = ref(''), reason = ref(''), dayFilter = ref(''), courseFilter = ref(''), showRevoked = ref(false)
const now = ref(Date.now())
let offset = 0, revision = 0, optionRevision = 0, alive = true
const timer = setInterval(() => { now.value = Date.now() + offset }, 15000)
onUnmounted(() => { alive = false; revision++; optionRevision++; clearInterval(timer) })
const eligibilityLabels = { Available: '可使用', Reserved: '申請待審中', Consumed: '已安排補課', Revoked: '已撤銷' }
const requestLabels = { Pending: '待審核', Approved: '已核准', Rejected: '未通過', Cancelled: '已取消' }
const qualifications = computed(() => data.value.entitlements.filter(e => showRevoked.value || e.status !== 'Revoked'))
const days = computed(() => [...new Set((options.value?.targets || []).map(s => date(s.startsAt)))])
const targetCourses = computed(() => [...new Map((options.value?.targets || []).map(s => [s.courseId, s.courseName]))])
const targets = computed(() => (options.value?.targets || []).filter(s => new Date(s.startsAt).getTime() > now.value
  && (!dayFilter.value || date(s.startsAt) === dayFilter.value) && (!courseFilter.value || String(s.courseId) === String(courseFilter.value))))
const selectedTarget = computed(() => targets.value.find(s => s.id === Number(targetId.value)))
const disabled = computed(() => busy.value || saving.value || loadingOptions.value || needsRefresh.value)
const canApply = e => e.canApply && now.value <= new Date(`${e.periodEnd}T23:59:59.999+08:00`).getTime()
const canCancel = r => r.canCancel && (r.status === 'Pending' || new Date(r.startsAt).getTime() > now.value)
const sourceFor = id => data.value.entitlements.find(e => e.id === id)
function close() { optionRevision++; action.value = null; options.value = null; targetId.value = ''; reason.value = ''; loadingOptions.value = false }
async function handle(e) {
  if (!alive) return
  if (e.status === 401) await router.replace({ path: '/login', query: { redirect: route.fullPath } })
  else error.value = e.status === 403 ? '我的補課提供學生帳號使用，請確認您的登入帳號。' : e.message
}
async function load(afterWrite = false) {
  if (busy.value || (saving.value && !afterWrite)) return
  const current = ++revision
  busy.value = true; error.value = ''
  try {
    const result = await api('/makeup')
    if (current !== revision) return
    data.value = result; offset = new Date(result.serverNow).getTime() - Date.now(); now.value = Date.now() + offset
    needsRefresh.value = false; close()
  } catch (e) { if (current === revision) { needsRefresh.value = true; await handle(e) } }
  finally { if (current === revision) busy.value = false }
}
async function choose(e) {
  if (disabled.value || !canApply(e)) return
  close(); const current = ++optionRevision
  action.value = { type: 'apply', id: e.id }; loadingOptions.value = true; error.value = ''; success.value = ''
  dayFilter.value = ''; courseFilter.value = ''
  try {
    const result = await api(`/makeup/entitlements/${e.id}/options`)
    if (current === optionRevision) options.value = result
  } catch (err) { if (current === optionRevision) { needsRefresh.value = true; await handle(err) } }
  finally { if (current === optionRevision) loadingOptions.value = false }
}
function cancel(r) {
  if (disabled.value || !canCancel(r)) return
  close(); action.value = { type: 'cancel', id: r.id }; error.value = ''; success.value = ''
}
async function submit() {
  if (disabled.value || !action.value) return
  const current = revision, selectedAction = action.value
  const request = data.value.requests.find(r => r.id === selectedAction.id)
  if (selectedAction.type === 'apply' ? !selectedTarget.value || !options.value : !request || !canCancel(request) || !reason.value.trim()) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const result = selectedAction.type === 'apply'
      ? await api('/makeup/requests', { entitlementId: options.value.id, rowVersion: options.value.rowVersion, targetSessionId: selectedTarget.value.id, targetRowVersion: selectedTarget.value.rowVersion })
      : await api(`/makeup/requests/${request.id}/cancel`, { rowVersion: request.rowVersion, reason: reason.value.trim() })
    if (current !== revision) return
    success.value = result.message
    await load(true)
    void loadCatalog()
  } catch (e) {
    if (current !== revision) return
    needsRefresh.value = true
    if (!e.status || e.status >= 500) error.value = '尚未收到操作結果，申請可能已儲存。請先重新整理確認補課紀錄，勿重複送出。'
    else await handle(e)
  } finally { if (alive) saving.value = false }
}
onMounted(() => load())
watch(catalogRevision, () => { if (!action.value) load() })
watch([dayFilter, courseFilter], () => { targetId.value = '' })
</script>

<template>
  <MemberPage class="my-makeup" title="我的補課" eyebrow="MAKE TIME FOR YOUR PRACTICE" description="選擇適合的時間，讓練習接續下去。">
    <MemberToolbar title="補課資格與申請" :busy="busy" :disabled="saving || loadingOptions" @refresh="load()" />
    <p class="notice">申請補課須經工作室審核。待審期間會保留這筆補課資格，但不保留課堂名額；核准後才會加入您的課表。</p>
    <p v-if="success" class="notice" role="status">{{ success }}</p>
    <div v-if="error" class="notice error" role="alert"><p>{{ error }}</p><p v-if="needsRefresh">請按「重新整理」確認最新狀態後再操作。</p></div>
    <p v-if="busy" role="status">正在讀取您的補課資格與申請…</p>
    <section aria-labelledby="qualifications-heading">
      <div class="section-heading"><h2 id="qualifications-heading">補課資格</h2><label class="makeup-toggle"><input v-model="showRevoked" type="checkbox" :disabled="saving" /> 顯示已撤銷資格</label></div>
      <article v-for="e in qualifications" :key="e.id" class="panel makeup-card" :class="{ highlighted: String(e.id) === route.query.entitlement }">
        <div class="makeup-heading"><h3>{{ e.sourceCourse || '原課堂' }}</h3><span class="badge">{{ e.status === 'Available' && !canApply(e) ? '暫不可使用' : eligibilityLabels[e.status] || '請洽工作室' }}</span></div>
        <p v-if="e.sourceStartsAt">{{ e.sourceType === 'Leave' ? '請假課堂' : '停課課堂' }}：{{ date(e.sourceStartsAt) }} {{ time(e.sourceStartsAt) }}</p>
        <p>可補課期間：{{ calendarDate(e.periodStart) }}～{{ calendarDate(e.periodEnd) }}</p>
        <p class="muted">資格 #{{ e.id }} · {{ e.sourceTerm }} · 一堂補課</p>
        <template v-if="action?.type !== 'apply' || action.id !== e.id">
          <button v-if="canApply(e)" class="button" :disabled="disabled" @click="choose(e)">選擇補課時間</button>
          <p v-else class="muted">{{ e.unavailableReason || '這筆補課資格的可用期間已結束，請聯繫工作室。' }}</p>
        </template>
        <form v-else class="makeup-form" @submit.prevent="submit">
          <p v-if="loadingOptions" role="status">正在查詢可選場次…</p>
          <template v-if="options">
            <p>可選擇上述期間內其他開放補課的課程，不限同一學期。</p>
            <div class="makeup-filters"><label>日期<select v-model="dayFilter" :disabled="saving"><option value="">全部日期</option><option v-for="day in days" :key="day">{{ day }}</option></select></label><label>課程<select v-model="courseFilter" :disabled="saving"><option value="">全部課程</option><option v-for="[id, name] in targetCourses" :key="id" :value="id">{{ name }}</option></select></label></div>
            <fieldset :disabled="disabled"><legend>選擇一個補課場次</legend>
              <label v-for="s in targets" :key="s.id" class="makeup-option"><input type="radio" name="makeup-session" :value="s.id" v-model="targetId" required /><span><strong>{{ s.courseName }}</strong><span>{{ date(s.startsAt) }} {{ time(s.startsAt) }}–{{ time(s.endsAt) }}</span><span>{{ s.teacher }} · {{ s.location }}</span><small>目前剩餘 {{ s.remaining }} 位，名額依審核時為準</small></span></label>
            </fieldset>
            <p v-if="!targets.length" class="notice">{{ options.targets.length ? '目前篩選條件下沒有可選場次，請調整日期或課程。' : '目前沒有符合資格的補課場次。請稍後重新查詢，或聯繫工作室協助安排。' }}</p>
            <p v-if="selectedTarget" class="notice">您選擇了「{{ selectedTarget.courseName }}」{{ date(selectedTarget.startsAt) }} {{ time(selectedTarget.startsAt) }}。送出後請等候工作室審核。</p>
          </template>
          <div class="actions"><button class="button" :disabled="disabled || !selectedTarget">{{ saving ? '送出中…' : '送出補課申請' }}</button><button type="button" class="button outline" :disabled="saving" @click="close">返回資格列表</button></div>
        </form>
      </article>
      <p v-if="!busy && !error && !qualifications.length" class="empty">目前沒有可顯示的補課資格。完成固定班請假後，可在這裡選擇補課時間。</p>
    </section>
    <section aria-labelledby="requests-heading" class="makeup-history">
      <h2 id="requests-heading">補課申請紀錄</h2>
      <article v-for="r in data.requests" :key="r.id" class="panel makeup-card" :class="{ highlighted: String(r.id) === route.query.request }">
        <div class="makeup-heading"><h3>{{ r.courseName }}</h3><span class="badge" :class="{ approved: r.status === 'Approved' }">{{ requestLabels[r.status] || '請洽工作室' }}</span></div>
        <p>{{ date(r.startsAt) }} {{ time(r.startsAt) }}–{{ time(r.endsAt) }} · {{ r.teacher }} · {{ r.location }}</p>
        <p class="muted">申請 #{{ r.id }} · 使用資格 #{{ r.entitlementId }}（{{ sourceFor(r.entitlementId)?.sourceCourse || '原課堂' }}）</p>
        <p v-if="r.isCancelled" class="notice">這堂課已停課，請聯繫工作室確認後續安排。</p>
        <p v-else-if="r.status === 'Pending'">工作室正在審核您的申請，目前尚未保留名額。</p>
        <p v-else-if="r.status === 'Approved'">補課已核准，請至「我的課程」查看上課安排。</p>
        <p v-else-if="r.status === 'Rejected'">這次申請未通過，請查看上方補課資格的最新狀態；資格可使用時，可重新選擇場次。</p>
        <p v-if="r.reviewNote" class="notice makeup-note">{{ r.status === 'Cancelled' ? '先前審核回覆' : '工作室回覆' }}：{{ r.reviewNote }}</p>
        <p v-if="r.cancellationReason" class="makeup-note">取消原因：{{ r.cancellationReason }}</p>
        <div v-if="action?.type !== 'cancel' || action.id !== r.id" class="actions">
          <RouterLink v-if="r.status === 'Approved'" class="button outline" to="/member/courses">查看我的課程</RouterLink>
          <button v-if="canCancel(r)" class="button outline" :disabled="disabled" @click="cancel(r)">{{ r.status === 'Pending' ? '取消申請' : '取消補課' }}</button>
          <p v-else-if="r.status === 'Approved'" class="muted">{{ r.cancelUnavailableReason || '這堂補課已開始，請聯繫工作室。' }}</p>
        </div>
        <form v-else class="makeup-form" @submit.prevent="submit">
          <p>確定取消這筆{{ r.status === 'Pending' ? '補課申請' : '已核准補課' }}嗎？取消後可在資格有效期間內重新選擇場次；已核准的上課安排也會一併取消。</p>
          <label :for="`cancel-makeup-${r.id}`">取消原因（必填）</label><textarea :id="`cancel-makeup-${r.id}`" v-model="reason" maxlength="500" rows="3" required :disabled="disabled"></textarea><small>{{ reason.length }} / 500</small>
          <p v-if="!canCancel(r)" class="notice">目前已無法自行取消，請重新整理或聯繫工作室。</p>
          <div class="actions"><button class="button" :disabled="disabled || !reason.trim() || !canCancel(r)">{{ saving ? '處理中…' : '確認取消補課' }}</button><button type="button" class="button outline" :disabled="saving" @click="close">保留補課安排</button></div>
        </form>
      </article>
      <p v-if="!busy && !error && !data.requests.length" class="empty">目前沒有補課申請紀錄。</p>
    </section>
  </MemberPage>
</template>

<style scoped>
.my-makeup{max-width:1000px}.makeup-nav{margin:24px 0}.my-makeup .actions{flex-wrap:wrap}.makeup-card{margin:18px 0}.makeup-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.makeup-heading h3{margin:0}.makeup-toggle{display:flex;align-items:center;gap:8px;font-size:.9rem}.makeup-toggle input{width:18px;height:18px}.highlighted{border:2px solid #6b8b75}.makeup-form{background:#f1f5f0;padding:20px;border-radius:12px;margin-top:20px}.makeup-filters{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.makeup-filters select{display:block;width:100%;margin-top:6px;min-width:0}.makeup-form fieldset{border:0;padding:0;min-width:0}.makeup-form legend{font-weight:600;margin-bottom:12px}.makeup-option{display:flex;gap:12px;background:white;border:1px solid #d4dfd6;border-radius:10px;padding:16px;margin-bottom:12px;cursor:pointer}.makeup-option:has(input:checked){border-color:#52765f;background:#eaf2eb}.makeup-option input{width:18px;height:18px;flex-shrink:0;margin-top:5px;accent-color:#52765f}.makeup-option span span,.makeup-option small{display:block;margin-top:5px}.makeup-option small,.makeup-note{overflow-wrap:anywhere}.makeup-form textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;margin-top:8px}.makeup-form>.actions{margin-top:16px}.makeup-history{margin-top:42px}.makeup-note{white-space:pre-wrap}.approved{background:#e2f0e5;color:#315d3e}.my-makeup :focus-visible{outline:3px solid #aa7c35;outline-offset:3px}@media(max-width:600px){.my-makeup h1{font-size:2rem}.makeup-filters{grid-template-columns:1fr}.makeup-form{padding:14px}.my-makeup .section-heading{flex-wrap:wrap}.makeup-option{padding:12px}}
</style>
