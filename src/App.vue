<script setup>
import { ref, onMounted } from 'vue'
import { Menu, X, Flower2, ArrowUpRight } from 'lucide-vue-next'
import { member, refreshMember, loadCatalog, loadError, loading } from './state'
const menu = ref(false)
onMounted(() => { refreshMember(); loadCatalog() })
</script>
<template>
  <header class="header"><div class="nav-shell">
    <RouterLink class="brand" to="/" @click="menu=false"><Flower2 :size="43" :stroke-width="1.1"/><span>Enjoy Space<small>米 亞 工 作 室</small></span></RouterLink>
    <button class="menu-toggle icon-button" @click="menu=!menu" :aria-expanded="menu" aria-label="開啟導覽選單"><X v-if="menu"/><Menu v-else/></button>
    <nav :class="{open:menu}" aria-label="主要導覽"><RouterLink v-for="[url,label] in [['/','首頁'],['/courses','課程介紹'],['/schedule','公開課表'],['/trial','體驗課'],['/studio','教室資訊']]" :key="url" :to="url" @click="menu=false">{{ label }}</RouterLink><RouterLink class="button small" :to="member?'/member':'/login'" @click="menu=false">{{ member?'會員專區':'登入' }}</RouterLink></nav>
  </div></header>
  <main><div v-if="loadError" class="notice error" role="alert">{{ loadError }} <button @click="loadCatalog">重新載入</button></div><div v-if="loading" class="loading" role="status">正在讀取工作室課程…</div><RouterView/></main>
  <footer><div class="container footer-inner"><div class="brand"><Flower2 :size="30"/><span>Enjoy Space<small>讓練習，成為生活的一部分</small></span></div><span>慢下來，找回自己的節奏。</span><RouterLink to="/trial">從一堂體驗課開始 <ArrowUpRight :size="16"/></RouterLink></div></footer>
</template>
