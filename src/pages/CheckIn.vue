<script setup>
import { reactive, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, date, time } from '../api';
import { createCheckInFlow } from '../checkInFlow';
const route = useRoute(), router = useRouter(), state = reactive({}), dialog = ref(null), report = ref('');
const key = 'enjoyspace-check-in';
function saveCheckIn(value) { try { value ? sessionStorage.setItem(key, JSON.stringify(value)) : sessionStorage.removeItem(key); } catch { /* Storage is optional; scanning still works. */ } }
const flow = createCheckInFlow({ state, request: api, save: saveCheckIn, login: () => router.replace('/login?redirect=/check-in') });
async function load() {
  const token = new URLSearchParams(route.hash.slice(1)).get('code');
  let saved; try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* No saved scan. */ }
  if(token) { saveCheckIn({ token }); await router.replace('/check-in'); await flow.preview(token); }
  else if(saved?.token) await flow.preview(saved.token, saved.sessionId);
}
watch(() => state.error, async error => { if(error) { await nextTick(); if(!dialog.value?.open) dialog.value?.showModal(); } });
watch(() => route.hash, value => { if(value) load(); });
onMounted(load); onBeforeUnmount(() => { dialog.value?.close(); });
async function retry() { dialog.value?.close(); await flow.retry(); }
async function notifyStaff() {
  if(!state.details?.sessionId) return;
  try { report.value = (await api(`/check-in/sessions/${state.details.sessionId}/report`, {})).message; }
  catch(e) { report.value = e.message; }
}
function rescan() { dialog.value?.close(); flow.clear(); }
</script>
<template>
  <section class="container section check-in-page">
    <p class="eyebrow">WELCOME TO YOUR PRACTICE</p><h1>課堂打卡</h1>
    <p v-if="['scan','login'].includes(state.phase)" class="notice">請使用手機相機掃描教室顯示的課堂 QR Code，登入學生會員後確認到課。</p>
    <p v-if="state.busy" role="status">{{ state.phase === 'submitting' ? '正在確認到課，請稍候…' : '正在確認課堂資料…' }}</p>
    <article v-if="state.details" class="panel">
      <h2>{{ state.details.courseName }}</h2><p>{{ state.details.teacher }} · {{ state.details.location }}</p>
      <p>{{ date(state.details.startsAt) }} · {{ time(state.details.startsAt) }}–{{ time(state.details.endsAt) }}</p>
      <div v-if="['present','late'].includes(state.phase)" class="notice success" role="status">
        <h2>{{ state.phase === 'late' ? '已完成打卡・遲到' : '已完成打卡・出席' }}</h2>
        <p v-if="state.details.checkedInAt">到課時間：{{ new Date(state.details.checkedInAt).toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false}) }}</p>
        <p>出勤已記錄，無須重複打卡。</p>
      </div>
      <p v-if="state.phase === 'locked'" class="notice">此堂出勤已由工作室登記，或目前不開放打卡。若需更正，請洽老師或管理員。</p>
      <template v-if="state.phase === 'ready'"><p>確認你已到達教室後，請按下方按鈕。開課超過 10 分鐘會記為遲到。</p><button class="button wide" :disabled="state.busy" @click="flow.submit">打卡上課</button></template>
    </article>
    <p v-if="state.notice" class="notice" role="status">{{ state.notice }}</p>
    <div v-if="state.phase === 'error'" class="notice error"><p>{{ state.error?.message }}</p><button class="button" @click="dialog.showModal()">查看處理方式</button></div>
    <p v-if="report" role="status">{{ report }}</p><button v-if="state.phase === 'error' && state.details" class="button outline" @click="notifyStaff">通知工作室協助核對</button>
    <p><RouterLink to="/member">回會員首頁</RouterLink></p>
    <dialog ref="dialog" class="check-in-dialog" aria-labelledby="check-in-error-title"><h2 id="check-in-error-title">打卡需要確認</h2><p>{{ state.error?.message }}</p>
      <p v-if="state.error?.action === 'verify'">結果尚未確認，請先查詢出勤紀錄；系統不會自動再次送出打卡。</p>
      <p v-else>此次操作沒有新增打卡紀錄。若重新掃描仍無法完成，請洽系統管理員。</p>
      <button v-if="['verify','retry'].includes(state.error?.action)" class="button" :disabled="state.busy" @click="retry">{{ state.error?.action === 'verify' ? '查詢打卡結果' : '重新確認課堂' }}</button>
      <button class="button outline" @click="rescan">重新掃描</button><button class="button outline" @click="dialog.close()">關閉</button>
    </dialog>
  </section>
</template>
<style scoped>
.check-in-page{max-width:760px}.check-in-dialog{max-width:min(92vw,540px);border:1px solid #90aa9e;border-radius:16px;padding:28px;color:#223d49}.check-in-dialog::backdrop{background:#173c4266}.check-in-dialog button{margin:6px 8px 0 0}
</style>
