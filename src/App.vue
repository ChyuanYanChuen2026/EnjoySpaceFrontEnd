<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, X, ArrowUpRight } from 'lucide-vue-next'
import BrandMark from './components/BrandMark.vue'
import { member, refreshMember, loadCatalog, loadError, loading, refreshedAt } from './state'
const menu = ref(false)
const route = useRoute()
function refreshWhenVisible() { if (document.visibilityState === 'visible') loadCatalog() }
watch(() => route.path, () => { menu.value = false; loadCatalog() }, { immediate: true })
onMounted(() => { refreshMember(); window.addEventListener('focus', refreshWhenVisible) })
onUnmounted(() => window.removeEventListener('focus', refreshWhenVisible))
</script>
<template>
  <header class="header"><div class="nav-shell">
    <RouterLink class="brand" to="/" @click="menu=false">
      <BrandMark />
      <span>Enjoy Space<small>米 亞 工 作 室</small></span>
    </RouterLink>
    <button class="menu-toggle icon-button" @click="menu=!menu" :aria-expanded="menu" aria-label="開啟導覽選單">
      <X v-if="menu"/>
      <Menu v-else/>
    </button>
    <nav :class="{open:menu}" aria-label="主要導覽">
      <RouterLink v-for="[url,label] in [['/','首頁'],['/courses','課程介紹'],['/schedule','公開課表'],['/plans','課程方案'],['/trial','體驗課'],['/studio','教室資訊']]" :key="url" :to="url" @click="menu=false">{{ label }}</RouterLink>
      <RouterLink class="button small" :to="member?'/member':'/login'" @click="menu=false">{{ member?'會員專區':'登入' }}</RouterLink>
    </nav>
  </div>
</header>
  <main>
    <div class="container data-refresh"><span v-if="refreshedAt">{{ loadError ? '目前顯示上次資料' : '資料更新' }}：{{ refreshedAt.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) }}</span><button class="text-button" @click="loadCatalog" :disabled="loading">{{ loading ? '更新中…' : '更新資料' }}</button></div>
    <div v-if="loadError" class="notice error" role="alert">{{ loadError }} 
      <button @click="loadCatalog">重新載入</button>
    </div>
    <div v-if="loading" class="loading" role="status">正在讀取工作室課程…</div>
    <RouterView/>
  </main>
  <footer>
    <div class="container footer-inner">
      <div class="brand">
        <BrandMark />
        <span>Enjoy Space<small>讓練習，成為生活的一部分</small></span>
      </div>
        <span>慢下來，找回自己的節奏。</span>
        <RouterLink to="/trial">從一堂體驗課開始 
          <ArrowUpRight :size="16"/>
        </RouterLink>
      </div>
  </footer>
</template>
