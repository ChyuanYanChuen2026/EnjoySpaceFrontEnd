<script setup>
import { chineseValidation as vChineseValidation } from '../chineseValidation';
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, date, time, money, calendarDate } from '../api';
import MemberPage from '../components/MemberPage.vue';
import MemberToolbar from '../components/MemberToolbar.vue';
import TrialBookingPicker from '../components/TrialBookingPicker.vue';
import { newRequestKey } from '../requestKey';
import { trialBookingIssue } from '../trialApplication.js';
const router = useRouter(), items = ref([]), busy = ref(false), error = ref(''), notice = ref(''), selected = ref(null), options = ref(null), choices = ref([0]), batch = ref(''), modal = ref(null), modalText = ref('');
const labels = { Pending:'待審核', Contacted:'已聯繫，等待審核', Approved:'已核准', Rejected:'已退回', Cancelled:'已取消' };
const attendance = { Scheduled:'尚未打卡', Present:'出席', Late:'遲到', Absent:'缺席' };
async function showError(message) { modalText.value = message; await nextTick(); modal.value?.showModal(); }
async function load() {
  busy.value = true; error.value = '';
  try { items.value = await api('/my-trials'); }
  catch(e) { if(e.status === 401) router.replace('/login?redirect=/member/trials'); else error.value = e.message; }
  finally { busy.value = false; }
}
async function choose(item) {
  if (busy.value) return;
  busy.value = true; options.value = null; selected.value = null;
  try { options.value = await api(`/my-trials/${item.id}/options`); selected.value = item; choices.value = [0]; batch.value = newRequestKey(); }
  catch(e) { await showError(e.message); } finally { busy.value = false; }
}
watch(choices, () => { batch.value = newRequestKey(); }, {deep:true});
async function book() {
  if(busy.value) return;
  if (!selected.value) return showError('請先選擇體驗方案。');
  const issue = trialBookingIssue({ choices: choices.value, options: options.value });
  if (issue) return showError(issue);
  busy.value = true;
  try { notice.value = (await api(`/my-trials/${selected.value.id}/bookings`, { rowVersion: options.value.rowVersion, batchKey: batch.value, sessionIds: choices.value })).message; selected.value = null; await load(); }
  catch(e) { await showError(e.message + (e.status === 0 || e.status >= 500 ? ' 請先更新紀錄確認是否送出成功；保留原選擇再次送出不會建立重複預約。' : '')); }
  finally { busy.value = false; }
}
const cancelTarget = ref(null), cancelReason = ref('');
async function cancel() {
  if (busy.value || !cancelTarget.value) return;
  if (!cancelReason.value.trim() || cancelReason.value.length > 500) return showError('請填寫取消原因，最多 500 字。');
  busy.value = true;
  try { notice.value = (await api(`/my-trials/bookings/${cancelTarget.value.id}/cancel`, { rowVersion: cancelTarget.value.rowVersion, reason: cancelReason.value })).message; cancelTarget.value = null; await load(); }
  catch(e) { await showError(e.message); } finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <MemberPage title="我的體驗課" eyebrow="YOUR FIRST PRACTICE" description="查看審核與付款進度，安排接下來的練習。">
    <MemberToolbar title="體驗方案與預約" :busy="busy" @refresh="load" />
    <p v-if="error" class="notice error" role="alert">{{ error }}</p><p v-if="notice" class="notice success" role="status">{{ notice }}</p>
    <p v-if="!busy && !items.length" class="empty">尚無體驗申請。<RouterLink to="/trial">申請體驗課 →</RouterLink></p>
    <article v-for="item in items" :key="item.id" class="panel">
      <h2>{{ item.planName }} <span class="badge">{{ labels[item.status] || item.status }}</span></h2>
      <p>方案申請 #{{ item.id }} · {{ item.quota }} 堂 · NT$ {{ money(item.quotedPrice) }}</p>
      <p v-if="item.reviewNote">工作室回覆：{{ item.reviewNote }}</p>
      <p class="notice">{{ item.schedulingMessage }}</p>
      <template v-if="item.validFromDate"><p>使用期間：{{ calendarDate(item.validFromDate) }} ～ {{ item.validUntilDate ? calendarDate(item.validUntilDate) : '不限期' }}</p><p>尚可預約 <strong>{{ item.remaining }}</strong> 堂 · 待審與已核准預約會占用堂數。</p></template>
      <button v-if="item.canBook && item.remaining > 0" class="button" :disabled="busy" @click="choose(item)">選擇體驗場次</button>
      <section v-if="selected?.id === item.id && options" class="trial-reservation">
        <h3>選擇希望上的場次</h3><p>每堂各別審核，核准後才保留名額。僅顯示方案效期內可選的課堂。</p>
        <form v-chinese-validation @submit.prevent="book">
          <TrialBookingPicker v-model="choices" :options="options" :busy="busy" @invalid="showError" />
          <div class="actions">
            <button class="button" :disabled="busy || !options.sessions.length || options.remaining < 1">{{ busy ? '送出中…' : '送出預約，等待審核' }}</button>
            <button type="button" class="button outline" :disabled="busy" @click="selected = null">取消預約</button>
          </div>
        </form>
      </section>
      <h3 v-if="item.bookings.length">我的場次</h3>
      <article v-for="b in item.bookings" :key="b.id" class="trial-booking-row"><div><h4>{{ b.name }} <span class="badge">{{ labels[b.status] }}</span></h4><p>預約單 #{{ b.id }} · {{ date(b.startsAt) }} {{ time(b.startsAt) }}–{{ time(b.endsAt) }}</p><p>{{ b.teacher }} · {{ b.location }} <span v-if="b.attendance && b.status === 'Approved'">· {{ attendance[b.attendance] }}</span></p><p v-if="b.reviewNote">工作室回覆：{{ b.reviewNote }}</p></div><button v-if="b.canCancel" class="button outline" :disabled="busy" @click="cancelTarget = b; cancelReason = ''">取消這堂預約</button></article>
    </article>
    <section v-if="cancelTarget" class="panel"><h2>取消預約 #{{ cancelTarget.id }}</h2><p>取消後會釋放此堂使用的額度。已開課或已點名的場次無法取消。</p><form v-chinese-validation @submit.prevent="cancel"><label>取消原因<textarea v-model="cancelReason" data-validation-label="取消原因" required maxlength="500"></textarea></label><button class="button" :disabled="busy">確認取消預約</button><button class="button outline" type="button" :disabled="busy" @click="cancelTarget = null">保留預約</button></form></section>
    <dialog ref="modal" class="trial-error-dialog" aria-labelledby="trial-error-title"><h2 id="trial-error-title">請確認預約資料</h2><p>{{ modalText }}</p><button class="button" @click="modal.close()">我知道了</button></dialog>
  </MemberPage>
</template>
<style scoped>
.trial-reservation { margin: 24px 0; padding: clamp(10px, 2vw, 24px); background: #f1f5f1; border-radius: 12px; }
.trial-booking-row{border-top:1px solid #dce4de;margin-top:20px;padding-top:16px}.trial-error-dialog{max-width:min(92vw,520px);padding:28px;border:1px solid #90aa9e;border-radius:16px;color:#223d49}.trial-error-dialog::backdrop{background:#173c4266}
</style>
