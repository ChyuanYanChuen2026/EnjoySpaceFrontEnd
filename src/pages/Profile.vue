<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { CircleCheck, CircleAlert, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { member, refreshMember } from '../state'
import { chineseValidation as vChineseValidation } from '../chineseValidation.js'
import { TAIWAN_MOBILE_PATTERN, TAIWAN_MOBILE_MESSAGE } from '../validationErrors.js'
import { createProfileState, createProfileEditor, profileIsDirty } from '../memberProfile.js'
import MemberPage from '../components/MemberPage.vue'

const router = useRouter()
const state = reactive(createProfileState())
const dirty = computed(() => profileIsDirty(state))
const resultDialog = ref(null)
const feedback = reactive({ kind: 'success', title: '', message: '' })
const loginRequired = ref(false)
let active = true
async function showFeedback(kind, title, message) {
  Object.assign(feedback, { kind, title, message })
  await nextTick()
  if (active && !resultDialog.value?.open) resultDialog.value?.showModal()
}
function closeFeedback() {
  resultDialog.value?.close()
  if (loginRequired.value) router.replace('/login?redirect=/member/profile')
}
async function checkLatest() {
  closeFeedback()
  await editor.load()
  if (active && state.error && !loginRequired.value)
    await showFeedback('error', '暫時無法取得資料', state.error)
}
const editor = createProfileEditor(state, {
  request: api,
  onSaved: async () => {
    await showFeedback('success', '會員資料已修改完成', '你的聯絡資料已更新，工作室將使用最新資料與你聯繫。')
    return refreshMember()
  },
  onUnauthorized: () => {
    member.value = null
    loginRequired.value = true
    return showFeedback('error', '請重新登入', '登入已逾時，請重新登入後確認會員資料。')
  },
})
async function saveProfile() {
  if (state.loading || state.saving || state.blocked || !dirty.value) return
  await editor.save()
  if (active && state.error && !loginRequired.value)
    await showFeedback('error', state.blocked ? '請先確認會員資料' : '尚未完成修改', state.error)
}
onMounted(editor.load)
onBeforeUnmount(() => { active = false; resultDialog.value?.close(); editor.dispose() })
</script>

<template>
  <MemberPage title="會員資料" eyebrow="我的會員資料" description="更新你的聯絡方式，方便工作室與你聯繫。">
    <p v-if="state.loading" role="status">讀取會員資料中…</p>
    <p v-if="state.error" class="notice error" role="alert">{{ state.error }}</p>
    <p v-if="state.notice" class="notice" role="status">{{ state.notice }}</p>
    <div v-if="!state.profile && !state.loading" class="profile-actions">
      <RouterLink v-if="state.forbidden" class="button outline" to="/member">返回會員首頁</RouterLink>
      <button v-else type="button" class="button outline" @click="editor.load">重新讀取會員資料</button>
    </div>

    <section v-if="state.profile" class="panel profile-panel">
      <div class="profile-heading">
        <h2>基本資料</h2>
        <button type="button" class="button outline small" :disabled="state.loading || state.saving" @click="editor.load">查詢最新資料</button>
      </div>
      <dl class="profile-identity">
        <div><dt>帳號</dt><dd>{{ state.profile.account }}</dd></div>
        <div><dt>學號</dt><dd>{{ state.profile.studentNo || '尚未編配' }}</dd></div>
        <div><dt>姓名</dt><dd>{{ state.profile.displayName }}</dd></div>
      </dl>
      <p class="profile-hint">帳號與學號無法自行修改；姓名如需更正，請聯繫工作室。</p>

      <aside v-if="state.latest" class="profile-latest" aria-label="目前儲存的聯絡資料">
        <h3>目前儲存的聯絡資料</h3>
        <dl>
          <div><dt>手機</dt><dd>{{ state.latest.phone || '尚未填寫' }}</dd></div>
          <div><dt>電子郵件</dt><dd>{{ state.latest.email || '尚未填寫' }}</dd></div>
          <div><dt>LINE ID</dt><dd>{{ state.latest.lineId || '尚未填寫' }}</dd></div>
        </dl>
        <p class="profile-hint">載入後會捨棄下方尚未儲存的修改，再以最新資料編輯。</p>
        <button type="button" class="button outline small" :disabled="state.loading || state.saving" @click="editor.useLatest">載入最新資料</button>
      </aside>

      <form v-chinese-validation class="profile-form" @submit.prevent="saveProfile">
        <h2>聯絡資料</h2>
        <p class="profile-hint">標示 * 為必填欄位。</p>
        <fieldset :disabled="state.loading || state.saving">
          <div class="profile-fields">
            <label for="profile-phone">手機 *
              <input id="profile-phone" v-model="state.form.phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" required minlength="10" maxlength="10" :pattern="TAIWAN_MOBILE_PATTERN" :title="TAIWAN_MOBILE_MESSAGE" data-validation-label="手機" :data-pattern-message="TAIWAN_MOBILE_MESSAGE" aria-describedby="profile-phone-hint" />
              <span id="profile-phone-hint" class="profile-hint">09 開頭，共 10 碼數字，不含空格或符號。</span>
            </label>
            <label for="profile-email">電子郵件 *
              <input id="profile-email" v-model="state.form.email" name="email" type="email" autocomplete="email" required maxlength="200" data-validation-label="電子郵件" />
            </label>
            <label for="profile-line">LINE ID（選填）
              <input id="profile-line" v-model="state.form.lineId" name="lineId" type="text" maxlength="100" autocomplete="off" data-validation-label="LINE ID" />
            </label>
          </div>
          <p v-if="state.blocked" class="profile-hint">請先查詢並載入最新資料，再重新編輯儲存。</p>
          <div class="profile-actions">
            <button type="submit" class="button" :disabled="state.blocked || !dirty">{{ state.saving ? '儲存中…' : '儲存變更' }}</button>
            <button type="button" class="button outline" :disabled="!dirty" @click="editor.cancel">取消編輯</button>
          </div>
        </fieldset>
      </form>
    </section>
    <dialog ref="resultDialog" class="profile-result" :class="{ 'profile-result-error': feedback.kind === 'error' }"
      aria-labelledby="profile-result-title" aria-describedby="profile-result-message" @cancel.prevent="closeFeedback">
      <button type="button" class="profile-result-close" aria-label="關閉提示" @click="closeFeedback"><X :size="20" aria-hidden="true" /></button>
      <div class="profile-result-icon" aria-hidden="true"><CircleCheck v-if="feedback.kind === 'success'" :size="34" /><CircleAlert v-else :size="34" /></div>
      <p class="profile-result-caption">{{ feedback.kind === 'success' ? '資料更新完成' : '會員資料提醒' }}</p>
      <h2 id="profile-result-title">{{ feedback.title }}</h2>
      <p id="profile-result-message">{{ feedback.message }}</p>
      <div class="profile-result-actions">
        <button v-if="state.blocked && state.profile && feedback.kind === 'error'" type="button" class="button" :disabled="state.loading || state.saving" @click="checkLatest">查詢最新資料</button>
        <button type="button" class="button" :class="{ outline: state.blocked && state.profile && feedback.kind === 'error' }" autofocus @click="closeFeedback">{{ loginRequired ? '重新登入' : feedback.kind === 'success' ? '確定' : '關閉提示' }}</button>
      </div>
    </dialog>
  </MemberPage>
</template>

<style scoped>
.profile-panel{padding:28px}
.profile-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.profile-heading h2,.profile-form h2{margin:0}
.profile-identity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:0}
dt{font-size:13px;color:var(--muted);margin-bottom:6px}
dd{margin:0;overflow-wrap:anywhere}
.profile-hint{font-size:13px;color:var(--muted);line-height:1.7}
.profile-form{border-top:1px solid var(--line);padding-top:24px;margin-top:24px}
.profile-form fieldset{margin:0;padding:0;border:0;min-width:0}
.profile-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.profile-fields label{display:flex;flex-direction:column;gap:8px;min-width:0}
.profile-fields input{width:100%;min-width:0}
.profile-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
.profile-latest{background:#eef3ef;border:1px solid var(--line);border-radius:8px;padding:20px;margin-top:24px}
.profile-latest h3{margin-top:0}
.profile-latest dl{display:grid;gap:12px}
.profile-result{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:36px 30px 28px;border:1px solid #dce5dc;border-radius:20px;background:#fcfcf8;color:var(--ink,#223d49);box-shadow:0 20px 70px #193d3433;text-align:center}
.profile-result::backdrop{background:#183c3d80;backdrop-filter:blur(3px)}
.profile-result-close{position:absolute;right:14px;top:14px;display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:transparent;color:#587367;cursor:pointer}
.profile-result-close:hover{background:#eaf0ea}
.profile-result-icon{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 18px;background:#e5eee6;border:1px solid #d4e3d6;border-radius:50%;color:#507760}
.profile-result-caption{margin:0 0 10px;font-size:12px;letter-spacing:.16em;color:#587367}
.profile-result h2{margin:0;font-size:25px;line-height:1.4}
#profile-result-message{margin:16px 0 0;color:#657984;font-size:15px;line-height:1.9;overflow-wrap:anywhere}
.profile-result-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:26px}
.profile-result-actions .button{min-width:130px;min-height:44px}
.profile-result button:focus-visible{outline:3px solid #aa7c35;outline-offset:3px}
.profile-result-error .profile-result-icon{color:#a95b49;background:#f7eae4;border-color:#eed5c9}
.profile-result-error .profile-result-caption{color:#a15e4c}
@media(max-width:600px){
  .profile-result{padding:32px 22px 24px}
  .profile-result h2{font-size:23px}
  .profile-panel{padding:20px 16px}
  .profile-identity,.profile-fields{grid-template-columns:1fr;gap:16px}
  .profile-actions .button{flex:1;min-width:120px}
  .profile-latest{padding:16px}
}
</style>
