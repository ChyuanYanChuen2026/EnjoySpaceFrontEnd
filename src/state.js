import { ref } from "vue";
import { api } from "./api.js";
export const member = ref(null);
export const trialDraft = ref(null);
export const memberError = ref("");
export const refreshingMember = ref(false);
let memberRequestVersion = 0;
export async function refreshMember() {
  const version = ++memberRequestVersion;
  const previousMember = member.value;
  refreshingMember.value = true;
  try {
    const currentMember = await api("/me");
    if (!currentMember || Array.isArray(currentMember) || typeof currentMember.displayName !== 'string' ||
        !Array.isArray(currentMember.roles) || !currentMember.roles.every(role => typeof role === 'string')) {
      throw new Error('會員資料格式不正確。');
    }
    // 舊請求與登出前的回應，不能蓋掉較新的會員狀態。
    if (version !== memberRequestVersion || member.value !== previousMember) return false;
    member.value = currentMember;
    memberError.value = "";
    return true;
  } catch (error) {
    if (version !== memberRequestVersion || member.value !== previousMember) return false;
    if (error?.status === 401) {
      member.value = null;
      memberError.value = "";
    } else {
      // 網路與伺服器故障不代表已登出；權限仍由每次後端請求檢查。
      memberError.value = previousMember
        ? "目前無法確認登入狀態，暫時保留上次會員資訊，請重新確認。"
        : "目前無法確認登入狀態，請檢查連線後重新確認。";
    }
    return false;
  } finally {
    if (version === memberRequestVersion) refreshingMember.value = false;
  }
}
export const catalog = ref({ courses: [], plans: [], locations: [], terms: [] });
export const loading = ref(false);
export const loadError = ref("");
export const refreshedAt = ref(null);
export const catalogRevision = ref(0);
let pendingCatalog;
export async function loadCatalog() {
  if (pendingCatalog) return pendingCatalog;
  loading.value = true;
  loadError.value = "";
  pendingCatalog = (async () => {
    try {
      catalog.value = await api("/catalog");
      refreshedAt.value = new Date();
      catalogRevision.value++;
    } catch (e) {
      loadError.value = e.message;
    } finally {
      loading.value = false;
      pendingCatalog = null;
    }
  })();
  return pendingCatalog;
}
