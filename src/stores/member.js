import { ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useMemberStore = defineStore('member', () => {
  const member = ref(null);
  const memberError = ref("");
  const refreshingMember = ref(false);
  let memberRequestVersion = 0;
  async function refreshMember() {
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

  return { member, memberError, refreshingMember, refreshMember };
});
