<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, date, time, money } from '../api'
const route = useRoute(), router = useRouter()
const preview = ref(null), policy = ref(''), paymentMethod = ref(''), confirmDetails = ref(false), confirmPolicy = ref(false)
const busy = ref(false), saving = ref(false), error = ref(''), submittedId = ref(null), uncertain = ref(false)
const existing = ref(null)
let revision = 0
onUnmounted(() => { revision++ })
async function handle(e) {
  if (e.status === 401) await router.replace({ path: '/login', query: { redirect: `/courses/${route.params.id}/enroll` } })
  else error.value = e.status === 403 ? '請使用學生帳號提出正式報名；如需協助，請聯繫工作室。' : e.message
}
async function load() {
  const current = ++revision
  busy.value = true; error.value = ''; preview.value = null; submittedId.value = null; uncertain.value = false; existing.value = null; saving.value = false
  confirmDetails.value = false; confirmPolicy.value = false; paymentMethod.value = ''
  try {
    const result = await api(`/enrollments/preview/${encodeURIComponent(route.params.id)}`)
    if (current === revision) { existing.value = result.existing || null; preview.value = result.details || null; policy.value = result.policy || '' }
  } catch (e) { if (current === revision) await handle(e) }
  finally { if (current === revision) busy.value = false }
}
async function submit() {
  if (saving.value || busy.value || !preview.value || !confirmDetails.value || !confirmPolicy.value || !paymentMethod.value || uncertain.value) return
  const current = revision
  saving.value = true; error.value = ''
  try {
    const result = await api('/enrollments', { courseId: preview.value.courseId, confirmationToken: preview.value.confirmationToken,
      paymentMethod: paymentMethod.value, confirmDetails: confirmDetails.value, confirmPolicy: confirmPolicy.value })
    if (current === revision) submittedId.value = result.id
  } catch (e) {
    if (current !== revision) return
    if (e.status === 401 || e.status === 403) await handle(e)
    else {
      uncertain.value = true
      error.value = e.status === 409 || e.status === 400 ? e.message : '尚未收到送出確認，申請可能已儲存。請先查詢送出結果。'
    }
  } finally { if (current === revision) saving.value = false }
}
async function checkResult() {
  if (saving.value) return
  const current = revision
  saving.value = true; error.value = ''
  try {
    const rows = await api('/enrollments')
    if (current !== revision) return
    const existing = rows.find(x => String(x.courseId) === String(route.params.id) && ['Pending', 'Approved'].includes(x.status))
    if (existing) await router.push({ path: '/member/enrollments', query: { application: existing.id } })
    else { uncertain.value = false; preview.value = null; error.value = '目前尚未查到有效申請。請重新核對課表與金額後送出。' }
  } catch (e) { if (current === revision) await handle(e) }
  finally { if (current === revision) saving.value = false }
}
watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <main class="container section enrollment-page">
    <p class="breadcrumb"><RouterLink :to="`/courses/${route.params.id}`">課程介紹</RouterLink> / 正式報名</p>
    <p class="eyebrow">JOIN YOUR PRACTICE</p><h1>整期固定班報名</h1>
    <p v-if="!existing" class="enrollment-intro">核對完整課表與金額，選擇預計付款方式，再由工作室協助完成入班。</p>
    <section v-if="existing" class="panel enrollment-success" role="status">
      <h2>{{ existing.state === 'Enrolled' ? '您已成功報名' : existing.state === 'Paid' ? '已確認您的付款' : existing.state === 'Inactive' ? '您的上課安排已變更' : '您的報名已送出' }}</h2>
      <p>{{ existing.message }}</p>
      <RouterLink v-if="existing.state === 'Enrolled'" class="button" :to="`/member/courses?course=${route.params.id}`">查看我的課程</RouterLink>
      <RouterLink v-else class="button" to="/member/enrollments">查看報名進度</RouterLink>
    </section>
    <p v-if="busy" role="status">正在核對報名資格與課表…</p>
    <div v-if="error" class="notice error" role="alert"><p>{{ error }}</p>
      <button v-if="uncertain" class="button" :disabled="saving" @click="checkResult">{{ saving ? '查詢中…' : '查詢送出結果' }}</button>
      <button v-else class="button outline" :disabled="busy || saving" @click="load">重新核對報名資料</button>
      <RouterLink class="enrollment-link" to="/member/enrollments">查看我的報名進度</RouterLink>
    </div>
    <section v-if="submittedId" class="panel enrollment-success" role="status">
      <span class="badge">申請 #{{ submittedId }}</span><h2>報名申請已送出</h2>
      <p>請等候工作室確認名額與付款安排。申請尚未核准，尚未保留名額，也未確認收款。</p>
      <p>選擇轉帳者請先等候工作室通知，勿自行匯款。</p>
      <RouterLink class="button" :to="`/member/enrollments?application=${submittedId}`">查看報名進度 →</RouterLink>
    </section>
    <form v-else-if="preview" @submit.prevent="submit" class="enrollment-grid">
      <section class="panel"><p class="eyebrow">FULL TERM</p><h2>{{ preview.courseName }}</h2><p>{{ preview.termName }}</p>
        <p>報名學生：{{ preview.studentName }}（{{ preview.studentAccount }}）</p>
        <h3>完整課表 · {{ preview.sessions.length }} 堂</h3>
        <ol class="enrollment-sessions"><li v-for="s in preview.sessions" :key="s.id"><strong>{{ date(s.startsAt) }}</strong><span>{{ time(s.startsAt) }}–{{ time(s.endsAt) }}</span><span>{{ s.teacherName }} · {{ s.locationName }}</span></li></ol>
      </section>
      <section class="panel enrollment-summary"><h2>確認報名資料</h2>
        <p class="enrollment-total">NT$ {{ money(preview.amount) }} <small>／整期 {{ preview.sessions.length }} 堂</small></p>
        <fieldset :disabled="saving || uncertain"><legend>預計付款方式（必選）</legend>
          <label class="enrollment-choice"><input v-model="paymentMethod" type="radio" value="Cash" name="paymentMethod" required /><span><strong>現場現金</strong><small>依工作室通知，到現場繳費。</small></span></label>
          <label class="enrollment-choice"><input v-model="paymentMethod" type="radio" value="Transfer" name="paymentMethod" required /><span><strong>銀行轉帳</strong><small>等候確認名額及付款通知，請勿先行匯款。</small></span></label>
          <div class="notice">送出申請不代表付款成功或保留名額。工作室確認收款並核准後，才會加入正式上課名單。</div>
          <label class="enrollment-check"><input v-model="confirmDetails" type="checkbox" required /><span>我已核對整期課表、堂數與金額，並了解申請尚未保留名額。</span></label>
          <label class="enrollment-check"><input v-model="confirmPolicy" type="checkbox" required /><span>我已閱讀並確認：{{ policy }}</span></label>
          <button class="button enrollment-submit" :disabled="!confirmDetails || !confirmPolicy || !paymentMethod || saving || uncertain">{{ saving ? '送出中…' : '送出正式報名申請' }}</button>
        </fieldset>
        <p class="muted">本頁不會執行線上付款。報名資料以後台確認為準；中途插班請聯繫工作室。</p>
      </section>
    </form>
  </main>
</template>

<style scoped>
.enrollment-page{max-width:1120px}.enrollment-intro{color:#67796d;margin-bottom:28px}.enrollment-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:24px;align-items:start}.enrollment-sessions{padding:0;list-style:none}.enrollment-sessions li{display:grid;gap:6px;padding:18px 0;border-bottom:1px solid #e2e9e3}.enrollment-sessions li:last-child{border:0}.enrollment-sessions span{font-size:.92rem;color:#52685b}.enrollment-total{font-size:1.7rem;font-weight:700;color:#365e48}.enrollment-total small{font-size:.85rem;font-weight:400}.enrollment-summary fieldset{border:0;padding:0;min-width:0}.enrollment-summary legend{font-weight:600;margin-bottom:12px}.enrollment-choice,.enrollment-check{display:flex;align-items:flex-start;gap:12px;line-height:1.7;margin:14px 0}.enrollment-choice{border:1px solid #cbd9cf;border-radius:10px;padding:16px;cursor:pointer}.enrollment-choice:has(input:checked){background:#eef5ef;border-color:#52765f}.enrollment-choice input,.enrollment-check input{width:18px;height:18px;flex-shrink:0;margin:5px 0 0;accent-color:#52765f}.enrollment-choice small{display:block;color:#627467}.enrollment-submit{width:100%;margin:15px 0}.enrollment-link{display:inline-block;margin:12px}.enrollment-success{background:#eff7f0;max-width:720px}.enrollment-page :focus-visible{outline:3px solid #aa7c35;outline-offset:4px}@media(max-width:760px){.enrollment-grid{grid-template-columns:1fr}.enrollment-page h1{font-size:1.8rem}.enrollment-total{font-size:1.4rem}}
</style>
