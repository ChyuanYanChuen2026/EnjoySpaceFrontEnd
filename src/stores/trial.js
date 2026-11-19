import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useTrialStore = defineStore('trial', () => {
  const trialDraft = ref(null);
  return { trialDraft };
});
