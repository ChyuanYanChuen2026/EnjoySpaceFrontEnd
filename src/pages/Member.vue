<script setup lang="js">
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { api, date, time, money, calendarDate, ApiError } from "../api";
import { member, refreshMember, catalogRevision } from "../state";
import MemberPage from "../components/MemberPage.vue";
import MemberToolbar from "../components/MemberToolbar.vue";

const router = useRouter(),
  data = ref({ sessions: [], requests: [], passes: [] }),
  error = ref(""),
  busy = ref(true);
const status = {
  Pending: "待審核",
  Contacted: "已聯繫",
  Approved: "已核准",
  Rejected: "已退回",
  Cancelled: "已取消",
};

let requestVersion = 0;
async function load() {
  const version = ++requestVersion;
  busy.value = true;
  error.value = "";
  await refreshMember();
  if (version !== requestVersion) return;
  try {
    const result = await api("/dashboard");
    if (version === requestVersion) data.value = result;
  } catch (e) {
    if (version !== requestVersion) return;
    data.value = { sessions: [], requests: [], passes: [] };
    if (e instanceof ApiError && e.status === 401) router.replace("/login?redirect=/member");
    else error.value = e.message;
  } finally {
    if (version === requestVersion) busy.value = false;
  }
}
onMounted(load);
watch(catalogRevision, load);
</script>

<template>
  <MemberPage title="會員首頁" eyebrow="YOUR PRACTICE" :description="member?.roles.includes('Teacher') ? '在這裡查看你的授課行程。' : '在這裡，繼續你的練習旅程。'">
    <MemberToolbar :title="member?.roles.includes('Teacher') ? '近期授課' : '近期上課'" :busy="busy" @refresh="load" />
    <p v-if="busy" role="status">讀取會員資料中…</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <section class="panel">
      <article class="member-row" v-for="s in data.sessions" :key="s.id">
        <div>
          <h3>{{ s.name }}</h3>
          <p>{{ s.location }}</p>
        </div>
        <span>{{ date(s.startsAt) }} · {{ time(s.startsAt) }}–{{ time(s.endsAt) }}</span>
      </article>
      <p v-if="!busy && !data.sessions.length" class="empty">目前沒有已安排的近期課程。</p>
    </section>
    <section class="panel">
      <h2>我的課程方案與付款</h2>
      <article v-for="p in data.passes" :key="p.id" class="member-row">
        <div>
          <h3>{{ p.name }}</h3>
          <p>購買堂數 {{ p.quota }} 堂 · NT$ {{ money(p.price) }}</p>
          <p>{{ calendarDate(p.validFromDate) }}～{{ p.validUntilDate ? calendarDate(p.validUntilDate) : "不限期" }}</p>
          <p>{{ p.paymentStatus }}</p>
        </div>
        <span class="badge">{{ { Pending: "待付款", Active: "已啟用", Cancelled: "已取消", Expired: "已到期" }[p.status] || p.status }}</span>
      </article>
      <p v-if="!busy && !data.passes?.length" class="empty">目前沒有購買方案紀錄。</p>
    </section>
    <section class="panel">
      <h2>我的體驗申請</h2>
      <RouterLink class="button outline" to="/member/trials">查看體驗進度與預約場次</RouterLink>
      <article class="member-row" v-for="r in data.requests" :key="r.id">
        <div>
          <h3>{{ r.name }}</h3>
          <p>{{ date(r.startsAt) }} · {{ time(r.startsAt) }} · {{ r.planName }} · NT$ {{ money(r.quotedPrice) }}</p>
          <p v-if="r.referrerName">介紹人：{{ r.referrerName }}（由工作室核對）</p>
          <p v-if="r.status !== 'Cancelled'">由工作室人工審核並安排登記上課。</p>
        </div>
        <span class="badge">{{ status[r.status] || r.status }}</span>
      </article>
      <p v-if="!busy && !data.requests.length" class="empty">還沒有體驗申請。<RouterLink to="/trial">探索第一堂練習 →</RouterLink></p>
    </section>
  </MemberPage>
</template>
