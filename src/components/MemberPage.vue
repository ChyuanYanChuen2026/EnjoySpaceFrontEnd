<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { member } from '../state'

defineProps({ title: String, eyebrow: String, description: String })
const router = useRouter()
const signingOut = ref(false), logoutError = ref('')
const links = [
  ['/member', '會員首頁'],
  ['/member/courses', '我的課程'],
  ['/member/makeup', '我的補課'],
  ['/member/enrollments', '報名紀錄'],
  ['/member/profile', '會員資料'],
]
async function logout() {
  if (signingOut.value) return
  signingOut.value = true; logoutError.value = ''
  try {
    await api('/logout', {})
    member.value = null
    await router.push('/')
  } catch (e) { logoutError.value = e.message }
  finally { signingOut.value = false }
}
</script>

<template>
  <section class="container section member-page">
    <div v-if="member" class="member-identity">
      <p>{{ member.displayName }}，您好</p>
      <button type="button" class="button outline small" :disabled="signingOut" @click="logout">{{ signingOut ? '登出中…' : '登出' }}</button>
    </div>
    <p v-if="logoutError" class="notice error" role="alert">{{ logoutError }}</p>
    <header class="member-title">
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>
    <nav v-if="member?.roles?.includes('Student')" class="member-nav" aria-label="學生會員選單">
      <RouterLink v-for="[path, label] in links" :key="path" :to="path" exact-active-class="member-nav-current">{{ label }}</RouterLink>
    </nav>
    <div class="member-content"><slot /></div>
  </section>
</template>

<style scoped>
.member-page{max-width:1000px;padding-top:28px}
.member-identity{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:20px;margin-bottom:30px;border-bottom:1px solid var(--line)}
.member-identity p{margin:0;color:#354e43;overflow-wrap:anywhere}
.member-identity button{flex-shrink:0;min-height:40px}
.member-title{margin-bottom:28px}
.member-title>p:last-child{margin-bottom:0}
.member-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid #81998b;border-radius:8px;overflow:hidden;margin-bottom:32px;background:#fff}
.member-nav a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:58px;padding:14px 12px;color:#3e624f;font-weight:600;border-right:1px solid #81998b;transition:background .15s}
.member-nav a:last-child{border-right:0}
.member-nav a:hover{background:#edf2ee}
.member-nav a.member-nav-current{background:var(--green);color:#fff}
.member-nav a:focus-visible{outline:3px solid #aa7c35;outline-offset:-4px}
.member-content{min-width:0}
@media(max-width:600px){
  .member-page{padding-top:20px}
  .member-identity{padding-bottom:16px;margin-bottom:24px}
  .member-title{margin-bottom:22px}
  .member-title h1{font-size:32px}
  .member-nav{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:24px}
  .member-nav a{min-height:48px;padding:12px 8px;font-size:14px}
  .member-nav a:nth-child(even){border-right:0}
  .member-nav a:not(:last-child){border-bottom:1px solid #81998b}
  .member-nav a:last-child{grid-column:1/-1}
}
</style>
