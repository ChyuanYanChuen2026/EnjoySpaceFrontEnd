import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { registrationWindowReason } from './registrationWindow.js';

// 以 API 的伺服器時間為基準；留在頁面或手機切回前景時也會更新。
// 此時鐘只控制畫面，實際報名權限仍由後端每次送出時驗證。
export function useRegistrationWindow(details) {
  const now = ref(Date.now());
  let serverTime = now.value, receivedAt = Date.now(), monotonicAt = performance.now();
  let timer;
  function update() {
    now.value = serverTime + Math.max(performance.now() - monotonicAt, Date.now() - receivedAt);
  }
  watch(details, value => {
    receivedAt = Date.now();
    monotonicAt = performance.now();
    const parsed = Date.parse(value?.serverNowUtc);
    serverTime = Number.isFinite(parsed) ? parsed : receivedAt;
    update();
  }, { immediate: true });
  onMounted(() => {
    timer = window.setInterval(update, 250);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
  });
  onUnmounted(() => {
    window.clearInterval(timer);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', update);
  });
  return { reason: computed(() => registrationWindowReason(details.value, now.value)), update };
}
