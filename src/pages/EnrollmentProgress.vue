<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, date, money } from "../api";
import MemberPage from "../components/MemberPage.vue";
import MemberToolbar from "../components/MemberToolbar.vue";
const route = useRoute(),
  router = useRouter(),
  rows = ref([]),
  busy = ref(false),
  error = ref("");
const statuses = { Pending: "待審核", Approved: "已核准入班", Rejected: "未核准", Cancelled: "已取消" };
const payments = { Pending: "待確認收款", Confirmed: "已確認收款", Cancelled: "款項已取消", RefundPending: "待人工退款", Refunded: "已登記退款" };
const methods = { Cash: "現場現金", Transfer: "銀行轉帳", LinePay: "Line Pay" };
async function load() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    rows.value = await api("/enrollments");
  } catch (e) {
    rows.value = [];
    if (e.status === 401) await router.replace("/login?redirect=/member/enrollments");
    else error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <MemberPage class="enrollment-progress" title="報名紀錄" eyebrow="MY ENROLLMENTS" description="查看您的報名進度、入班審核與付款狀態。">
    <MemberToolbar title="報名申請" :busy="busy" @refresh="load">
      <RouterLink to="/courses">瀏覽課程 →</RouterLink>
    </MemberToolbar>
    <p class="notice">申請不保留名額。確認收款並核准後才完成入班；轉帳請等候工作室確認名額及通知。</p>
    <p v-if="busy" role="status">正在查詢報名進度…</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <article v-for="r in rows" :key="r.id" class="panel enrollment-record" :class="{ selected: String(r.id) === route.query.application }">
      <p class="muted">報名 #{{ r.id }} · {{ date(r.submittedAt) }}</p>
      <h2>{{ r.courseName }}</h2>
      <p>{{ r.termName }} · {{ r.quotedSessionCount }} 堂 · NT$ {{ money(r.quotedAmount) }}</p>
      <div class="actions">
        <span class="badge" :class="{ approved: r.status === 'Approved' }">報名：{{ statuses[r.status] || r.status }}</span
        ><span class="badge">付款：{{ payments[r.paymentStatus] || "尚未建立款項" }}</span>
      </div>
      <p>{{ r.paymentStatus === "Pending" ? "預計付款方式" : "付款方式" }}：{{ methods[r.paymentMethod] || "請洽工作室確認" }}</p>
      <p v-if="r.status === 'Pending'">
        {{ r.paymentStatus === "Confirmed" ? "已確認收款，請等候工作室完成入班審核。" : "請等候工作室確認名額與付款安排，現在尚未保留名額。" }}
      </p>
      <p v-else-if="r.status === 'Approved'">您的報名已核准，可至「我的課程」查看目前的上課安排與請假資格。</p>
      <p v-else>如需重新安排課程或確認款項，請聯繫工作室。</p>
      <p v-if="r.reviewNote" class="notice">工作室回覆：{{ r.reviewNote }}</p>
      <RouterLink v-if="r.status === 'Approved'" class="button" :to="`/member/courses?course=${r.courseId}`">查看我的課程</RouterLink>
      <RouterLink v-else :to="`/courses/${r.courseId}`">查看課程資訊 →</RouterLink>
    </article>
    <section v-if="!busy && !error && !rows.length" class="panel">
      <h2>目前沒有正式報名申請</h2>
      <p>選擇適合的整期課程，確認課表後即可提出報名。</p>
      <RouterLink class="button" to="/courses">探索課程 →</RouterLink>
    </section>
  </MemberPage>
</template>
<style scoped>
.enrollment-record {
  margin-top: 20px;
}

.enrollment-record.selected {
  border: 2px solid #698a72;
}

.enrollment-record h2 {
  margin: 8px 0;
}

.enrollment-record .badge {
  white-space: normal;
}

.approved {
  background: #e2f0e5;
  color: #315d3e;
}
</style>
