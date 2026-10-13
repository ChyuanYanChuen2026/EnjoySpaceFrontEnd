<script setup>  import Hero from '../components/Hero.vue'; 
  import CourseCard from '../components/CourseCard.vue'; 
  import { computed, ref } from 'vue'; import { catalog, loading, loadError } from '../state'; const termId = ref(''); const courses = computed(() => catalog.value.courses.filter(c => !termId.value || c.termId === Number(termId.value)))</script>
<template>
  <Hero title="找到適合你的練習" subtitle="每一種節奏，都有屬於你的課程" />
  <section class="container section">
    <div class="section-heading">
      <h2>課程介紹</h2><span>{{ courses.length }} 種課程</span>
    </div>
    <label>學期<select v-model="termId"><option value="">全部公開學期</option><option v-for="term in catalog.terms" :key="term.id" :value="term.id">{{ term.name }}</option></select></label><div class="course-grid">
      <CourseCard v-for="c in courses" :key="c.id" :course="c" />
    </div>
    <p v-if="!loading && !loadError && !courses.length" class="empty">目前尚無公開課程。</p>
  </section>
</template>
