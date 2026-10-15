<script setup lang="js">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import Hero from "../components/Hero.vue";
import { api, date, time, money, validity, ApiError } from "../api";
import { catalog, member, refreshMember, trialDraft, catalogRevision } from "../state";
import { CalendarDays, Clock3, UserRound, MapPin, CheckCircle2, LockKeyhole } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const draft = trialDraft.value;
const sessions = ref([]);
const sessionId = ref(Number(route.query.session) || draft?.sessionId || 0);
const planId = ref(Number(route.query.plan) || draft?.planId || 0);
const busy = ref(false);
const loadingSessions = ref(true);
const error = ref("");
const success = ref("");
const submissionKey = ref(draft?.submissionKey || crypto.randomUUID());
const form = ref(draft?.form || { name: "", phone: "", email: "", lineId: "", note: "" });
const selected = computed(() => sessions.value.find((s) => s.id === sessionId.value));
const plans = computed(() => catalog.value.plans.filter((p) => p.planType === "Trial" && p.audienceType === "TrialGuest"));
const canApply = computed(() => !member.value || member.value.roles.some((r) => ["Student", "TrialGuest"].includes(r)));

function saveDraft() {
  trialDraft.value = { form: { ...form.value }, sessionId: sessionId.value, planId: planId.value, submissionKey: submissionKey.value };
}

function login() {
  saveDraft();
  router.push({ path: "/login", query: { redirect: route.fullPath } });
}

onBeforeRouteLeave((to) => {
  if (to.path === "/login") saveDraft();
  else trialDraft.value = null;
});

onMounted(async () => {
  await refreshMember();
  if (member.value && !draft) {
    form.value = {
      ...form.value,
      name: member.value.displayName,
      email: member.value.email || "",
      phone: member.value.phone || "",
    };
  }
  await loadSessions();
});

let sessionRequest = 0;
async function loadSessions() {
  const request = ++sessionRequest;
  loadingSessions.value = true;
  try {
    const result = await api("/sessions");
    if (request !== sessionRequest) return;
    sessions.value = result;
    if (sessionId.value && !sessions.value.some((s) => s.id === sessionId.value)) {
      const requested = await api("/sessions?sessionId=" + sessionId.value);
      if (request !== sessionRequest) return;
      sessions.value.push(...requested);
      if (!requested.length) {
        error.value = "您選擇的場次已結束或停止公開，請重新選擇。";
      }
    }
    if (!sessionId.value) {
      sessionId.value = sessions.value.find((s) => s.enrolled < s.capacity)?.id || 0;
    }
  } catch (e) {
    if (request === sessionRequest) error.value = e.message;
  } finally {
    if (request === sessionRequest) loadingSessions.value = false;
  }
}

watch(catalogRevision, () => {
  if (!busy.value && !success.value) loadSessions();
});

async function submit() {
  if (!member.value) {
    login();
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const r = await api("/trial-requests", { ...form.value, sessionId: sessionId.value, planId: planId.value, submissionKey: submissionKey.value });
    success.value = r.message || "體驗申請已送出，請至會員專區查看。";
    trialDraft.value = null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      member.value = null;
      login();
    } else error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Hero title="體驗課申請" subtitle="從一堂體驗課開始，遇見更喜歡的自己" />
  <section class="container section">
    <div v-if="success" class="success panel" role="status">
      <CheckCircle2 :size="48" />
      <h2>體驗申請已送出</h2>
      <p>{{ success }}</p>
      <RouterLink class="button" to="/member">查看我的申請</RouterLink>
    </div>
    <form v-else class="trial-grid" @submit.prevent="submit">
      <div>
        <section class="panel">
          <h2>選擇你的課程</h2>
          <p v-if="loadingSessions" role="status">讀取場次中…</p>
          <p v-else-if="!sessions.length" class="empty">目前沒有開放的近期場次。</p>
          <label
            >上課場次
            <select v-model="sessionId" required>
              <option :value="0" disabled>請選擇場次</option>
              <option v-for="s in sessions" :key="s.id" :value="s.id" :disabled="s.enrolled >= s.capacity">{{ date(s.startsAt) }} {{ time(s.startsAt) }} · {{ s.name }}{{ s.enrolled >= s.capacity ? "（額滿）" : "" }}</option>
            </select>
          </label>
          <div v-if="selected" class="selected-course">
            <img src="/images/yoga-hero.png" alt="瑜珈練習示意" />
            <h3>{{ selected.name }}</h3>
            <p><CalendarDays :size="18" />{{ date(selected.startsAt) }}</p>
            <p><Clock3 :size="18" />{{ time(selected.startsAt) }} – {{ time(selected.endsAt) }}</p>
            <p><UserRound :size="18" />{{ selected.teacher }} · {{ selected.enrolled }} / {{ selected.capacity }} 人</p>
            <p><MapPin :size="18" />{{ selected.location }}<br />{{ selected.address }}</p>
          </div>
        </section>
        <section class="panel">
          <h2>選擇體驗方案</h2>
          <label v-for="p in plans" :key="p.id" class="plan-option" :class="{ checked: planId === p.id }">
            <input type="radio" v-model="planId" :value="p.id" required name="plan" />
            <span>
              <strong>{{ p.name }}</strong>
              <b>{{ p.sessionQuota }} 堂 · NT$ {{ money(p.price) }}</b>
              <small>{{
                p.validityUnit === "Days" ? `效期 ${p.validityValue} 天` : "效期依方案規定"
              }}</small>
            </span>
          </label>
          <p v-if="!plans.length" class="empty">目前尚無開放的體驗方案。</p>
        </section>
      </div>
      <section class="panel">
        <h2>填寫申請資料</h2>
        <p v-if="!member" class="notice">送出前請先 <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }"> 登入或註冊體驗生帳號</RouterLink>，即可追蹤申請。</p>
        <label>姓名 *<input v-model="form.name" autocomplete="name" required maxlength="100" /></label><label>電話 *<input v-model="form.phone" autocomplete="tel" type="tel" required maxlength="30" /></label><label>Email *<input v-model="form.email" autocomplete="email" type="email" required maxlength="200" /></label><label>LINE ID<input v-model="form.lineId" maxlength="100" placeholder="選填" /></label
        ><label
          >備註<textarea v-model="form.note" rows="4" maxlength="300" placeholder="有任何想告訴我們的事嗎？（選填）"></textarea><small>{{ form.note.length }} / 300</small></label
        >
        <p class="muted">申請送出後，工作室將聯繫您確認課程與付款。申請不代表完成預約，也不會立即保留名額。</p>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <button class="button wide" :disabled="busy || !selected || !planId || !!!canApply">{{ busy ? "送出中…" : "送出體驗申請" }}</button>
        <p v-if="member?.roles.includes('Teacher')" class="muted">老師帳號請使用會員專區查看授課行程。</p>
        <p class="privacy"><LockKeyhole :size="14" />資料僅供工作室聯繫與課程安排使用。</p>
      </section>
    </form>
  </section>
</template>
