import { ref } from 'vue'
import { api } from './api'
export const member = ref(null)
export async function refreshMember() { try { member.value = await api('/me') } catch { member.value = null } }
export const catalog = ref({ courses: [], plans: [], locations: [] })
export const loading = ref(false)
export const loadError = ref('')
export async function loadCatalog() {
  loading.value = true; loadError.value = ''
  try { catalog.value = await api('/catalog') } catch (e) { loadError.value = e.message } finally { loading.value = false }
}
