import { ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '../services/api.js';

export const useCatalogStore = defineStore('catalog', () => {
  const catalog = ref({ courses: [], plans: [], locations: [], terms: [] });
  const loading = ref(false);
  const loadError = ref("");
  const refreshedAt = ref(null);
  const catalogRevision = ref(0);
  let pendingCatalog;
  async function loadCatalog() {
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

  return { catalog, loading, loadError, refreshedAt, catalogRevision, loadCatalog };
});
