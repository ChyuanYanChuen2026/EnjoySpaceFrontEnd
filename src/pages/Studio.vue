<script setup lang="js">
import Hero from '../components/Hero.vue'
import { catalog } from '../state.js'
import { MapPin } from 'lucide-vue-next'
</script>
<template>
  <Hero title="安放身心的日常空間" subtitle="在城市裡，找到一段安靜的時光" />
  <section class="container section">
    <p class="eyebrow">VISIT US</p>
    <h2>教室資訊</h2>
    <article v-for="location in catalog.locations" :key="location.id" class="panel studio-location">
      <div class="studio-details">
        <MapPin aria-hidden="true" />
        <h3>{{ location.name }}</h3>
        <p>{{ location.address?.trim() || '教室地址尚未公布。' }}</p>
        <a v-if="location.address?.trim()"
          :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address.trim())}`"
          target="_blank" rel="noopener noreferrer">在 Google 地圖開啟 ↗</a>
      </div>
      <iframe v-if="location.address?.trim()" class="studio-map"
        :title="`${location.name}的位置地圖`"
        :src="`https://www.google.com/maps?q=${encodeURIComponent(location.address.trim())}&hl=zh-TW&output=embed`"
        loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </article>
    <p v-if="!catalog.locations.length" class="empty">教室資訊尚未公布。</p>
  </section>
</template>

<style scoped>
.studio-location {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  padding: 0;
  overflow: hidden;
}
.studio-details { align-self: center; padding: clamp(20px, 3vw, 36px); }
.studio-details svg, .studio-details a { color: var(--green); }
.studio-details h3 {
  margin: 12px 0;
  font: 600 22px/1.5 "Noto Serif TC", serif;
  overflow-wrap: anywhere;
}
.studio-details a { text-decoration: underline; text-underline-offset: 3px; }
.studio-map { display: block; width: 100%; height: 340px; border: 0; background: var(--pale); }
@media (max-width: 700px) {
  .studio-location { grid-template-columns: minmax(0, 1fr); }
  .studio-map { height: 280px; }
}
</style>
