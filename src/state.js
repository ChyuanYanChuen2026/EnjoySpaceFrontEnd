import { ref } from "vue";
import { api } from "./api.js";
export const member = ref(null);
// Keep unsent contact details in memory while navigating to login, never browser storage.
export const trialDraft = ref(null);
export async function refreshMember() {
  try {
    member.value = await api("/me");
  } catch {
    member.value = null;
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
