<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, date, time } from '../api'
import { catalogRevision, loadCatalog } from '../state'
import MemberPage from '../components/MemberPage.vue'
import MemberToolbar from '../components/MemberToolbar.vue'

const route = useRoute(), router = useRouter()
const courses = ref([]), busy = ref(false), saving = ref(false), error = ref(''), success = ref('')
const selection = ref(null), reason = ref(''), needsRefresh = ref(false), showPast = ref(false)
const now = ref(Date.now())
let serverOffset = 0, revision = 0
const timer = setInterval(() => { now.value = Date.now() + serverOffset }, 15000)
onUnmounted(() => { clearInterval(timer); revision++ })
const visibleCourses = computed(() => courses.value.filter(c => !route.query.course || String(c.courseId) === String(route.query.course)))
const sessionsFor = c => c.sessions.filter(s => showPast.value || new Date(s.endsAt).getTime() > now.value)
const hasStarted = s => new Date(s.startsAt).getTime() <= now.value
const canLeave = s => s.canLeave && !hasStarted(s)
const canCancel = s => s.canCancelLeave && !hasStarted(s)
const attendance = { Scheduled: '待上課', Present: '已出席', Late: '遲到', Absent: '缺席', Excused: '已請假' }
const entitlements = { Available: '可申請一堂補課，請至「我的補課」選擇時間。', Reserved: '補課申請待審核，可至「我的補課」查看。', Consumed: '已安排補課。', Revoked: '本次補課資格已撤銷。' }
function status(s) {
  if (s.isCancelled) return '教室停課'
  if (s.status === 'OnLeave') return '已請假'
  if (s.status !== 'Active') return '上課安排已取消'
  if (s.attendanceStatus === 'Scheduled' && new Date(s.endsAt).getTime() <= now.value) return '課堂已結束'
  return attendance[s.attendanceStatus] || '出席資料待確認'
}
function unavailable(s) {
  if (s.isCancelled) return s.leaveUnavailableReason
  if (hasStarted(s)) return '這堂課已開始，如需調整請聯繫工作室。'
  return s.status === 'OnLeave' ? s.cancelLeaveUnavailableReason : s.leaveUnavailableReason
}
async function handle(e) {
  if (e.status === 401) await router.replace({ path: '/login', query: { redirect: route.fullPath } })
  else error.value = e.status === 403 ? '我的課程提供學生帳號使用，請確認您的登入帳號。' : e.message
}
async function load(afterWrite = false) {
  if (busy.value || (saving.value && !afterWrite)) return
  const current = ++revision
  busy.value = true; error.value = ''
  try {
    const result = await api('/learning')
    if (current !== revision) return
    courses.value = result.courses
    serverOffset = new Date(result.serverNow).getTime() - Date.now(); now.value = Date.now() + serverOffset
    needsRefresh.value = false; selection.value = null; reason.value = ''
  } catch (e) { if (current === revision) { needsRefresh.value = true; await handle(e) } }
  finally { if (current === revision) busy.value = false }
}
function open(s, action) {
  if (busy.value || saving.value || needsRefresh.value) return
  selection.value = { session: s, action }; reason.value = ''; error.value = ''; success.value = ''
}
async function submit() {
  if (!selection.value || saving.value || busy.value || needsRefresh.value) return
  const { session: s, action } = selection.value
  if (action === 'leave' ? !canLeave(s) || !reason.value.trim() : !canCancel(s)) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const result = action === 'leave'
      ? await api('/learning/leaves', { participantId: s.id, rowVersion: s.rowVersion, reason: reason.value.trim() })
      : await api(`/learning/leaves/${s.leave.id}/cancel`, { rowVersion: s.leave.rowVersion })
    success.value = result.message
    await load(true)
    void loadCatalog()
  } catch (e) {
    needsRefresh.value = true
    if (!e.status || e.status >= 500) error.value = '尚未收到操作結果，資料可能已儲存。請先重新整理確認請假狀態，勿重複送出。'
    else await handle(e)
  } finally { saving.value = false }
}
onMounted(() => load())
// Background catalogue refresh must not discard a leave reason being typed.
watch(catalogRevision, () => { if (!selection.value) load() })
watch(() => route.query.course, () => { if (!saving.value) { selection.value = null; reason.value = '' } })
</script>

<template>
  <MemberPage class="my-courses" title="我的課程" eyebrow="MY PRACTICE" description="查看已報名的固定班與核准補課，安排每一次練習。">
    <MemberToolbar :title="showPast ? '上課紀錄' : '近期上課'" :busy="busy" :disabled="saving" @refresh="load()">
      <RouterLink v-if="route.query.course" to="/member/courses">查看全部已報名課程</RouterLink>
    </MemberToolbar>
    <p class="notice">開課前且尚未點名的固定班課堂可辦理請假，送出後立即生效並取得一堂補課資格。取消請假須在開課前、原堂仍有名額，且補課資格尚未申請或使用。</p>
    <p v-if="success" class="notice" role="status">{{ success }}</p>
    <div v-if="error" class="notice error" role="alert"><p>{{ error }}</p><p v-if="needsRefresh">請按「重新整理」確認最新狀態後再操作。</p></div>
    <p v-if="busy" role="status">正在讀取您的課表…</p>
    <label class="history-toggle"><input type="checkbox" v-model="showPast" :disabled="saving" /> 包含已結束課堂</label>
    <section v-for="c in visibleCourses" :key="c.courseId" class="panel course-panel">
      <p class="eyebrow">{{ c.termName }}</p><h2>{{ c.name }}</h2><span class="badge">已正式入班</span>
      <article v-for="s in sessionsFor(c)" :key="s.id" class="class-row">
        <div class="class-heading"><h3>{{ date(s.startsAt) }}</h3><span class="badge" :class="{ 'on-leave': s.status === 'OnLeave' }">{{ status(s) }}</span></div>
        <p v-if="s.participationType === 'Makeup'"><strong>補課 · {{ s.courseName }}</strong></p>
        <p>{{ time(s.startsAt) }}–{{ time(s.endsAt) }} · {{ s.teacher }} · {{ s.location }}</p>
        <p v-if="s.leave?.status === 'Active'" class="leave-detail">請假原因：{{ s.leave.reason }}<br>{{ entitlements[s.leave.entitlementStatus] || '補課安排請聯繫工作室。' }}</p>
        <RouterLink v-if="s.leave?.status === 'Active'" :to="`/member/makeup?entitlement=${s.leave.entitlementId}`">{{ s.leave.entitlementStatus === 'Available' ? '選擇補課時間 →' : '查看補課申請 →' }}</RouterLink>
        <p v-else-if="s.leave?.status === 'Cancelled'" class="muted">上次請假已取消，本次補課資格已撤銷。</p>
        <div class="actions" v-if="selection?.session.id !== s.id">
          <RouterLink v-if="s.participationType === 'Makeup'" class="button outline" :to="`/member/makeup?request=${s.makeupRequestId}`">查看補課安排／取消</RouterLink>
          <button v-else-if="canLeave(s)" class="button" :disabled="busy || saving || needsRefresh" @click="open(s, 'leave')">辦理請假</button>
          <button v-else-if="canCancel(s)" class="button outline" :disabled="busy || saving || needsRefresh" @click="open(s, 'cancel')">取消請假</button>
          <p v-else class="muted">{{ unavailable(s) }}</p>
        </div>
        <form v-else class="leave-form" @submit.prevent="submit">
          <template v-if="selection.action === 'leave'">
            <label :for="`reason-${s.id}`">請假原因（必填）</label>
            <textarea :id="`reason-${s.id}`" v-model="reason" maxlength="500" rows="3" required :disabled="saving || needsRefresh" placeholder="請簡述這堂課需要請假的原因"></textarea>
            <small>{{ reason.length }} / 500</small><p>送出後即完成這堂課的請假，可至「我的補課」選擇補課時間。</p>
          </template>
          <p v-else>確定取消 {{ date(s.startsAt) }} {{ time(s.startsAt) }} 的請假嗎？您將恢復原堂上課安排，這次請假產生的補課資格也會撤銷。</p>
          <p v-if="hasStarted(s)" role="status">這堂課已開始，請重新整理課程。</p>
          <div class="actions">
            <button class="button" :disabled="saving || busy || needsRefresh || (selection.action === 'leave' ? !canLeave(s) || !reason.trim() : !canCancel(s))">{{ saving ? '處理中…' : selection.action === 'leave' ? '確認請假' : '確認取消請假' }}</button>
            <button type="button" class="button outline" :disabled="saving" @click="selection = null">返回課表</button>
          </div>
        </form>
      </article>
      <p v-if="!sessionsFor(c).length" class="empty">{{ c.sessions.length ? '目前沒有接下來的課堂，可勾選「包含已結束課堂」查看紀錄。' : '工作室正在安排您的課表，請稍後再查看。' }}</p>
    </section>
    <section v-if="!busy && !error && !visibleCourses.length" class="panel"><h2>目前沒有{{ route.query.course ? '這門課程的' : '' }}正式上課安排</h2><p>如果您已送出報名，請先查看報名紀錄；工作室確認入班後，課表就會出現在這裡。</p><RouterLink class="button" to="/member/enrollments">查看報名紀錄</RouterLink></section>
  </MemberPage>
</template>

<style scoped>
.my-courses{max-width:1000px}.course-nav{margin:24px 0;flex-wrap:wrap}.course-panel{margin:24px 0}.class-row{padding:24px 0;border-top:1px solid #dfe7e1;margin-top:24px}.class-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.class-heading h3{margin:0}.on-leave{background:#f6ecd9;color:#775923}.leave-detail{white-space:pre-wrap;overflow-wrap:anywhere}.leave-form{background:#f4f7f3;border-radius:12px;padding:20px;margin-top:18px}.leave-form textarea{display:block;width:100%;margin-top:8px;resize:vertical;box-sizing:border-box}.leave-form small{display:block;text-align:right}.leave-form .actions,.class-row .actions{flex-wrap:wrap}.history-toggle{display:flex;align-items:center;gap:10px}.history-toggle input{width:18px;height:18px;accent-color:#577d69}.my-courses :focus-visible{outline:3px solid #aa7c35;outline-offset:3px}@media(max-width:600px){.my-courses h1{font-size:2rem}.leave-form{padding:14px}.class-heading{align-items:flex-start}.class-heading h3{font-size:1.05rem}}
</style>
