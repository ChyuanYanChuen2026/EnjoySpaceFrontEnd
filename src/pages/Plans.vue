<script setup lang="js">
import Hero from "../components/Hero.vue";
import PlanCard from "../components/PlanCard.vue";
import { catalog, loading, loadError } from "../state";
</script>

<template>
  <Hero title="課程方案" subtitle="依照自己的節奏，選擇適合的練習方式" />
  <section class="container section">
    <div class="section-heading">
      <h2>目前開放的方案</h2>
      <span>共 {{ catalog.plans.length }} 項</span>
    </div>
    <div class="course-grid"><PlanCard v-for="plan in catalog.plans" :key="plan.id" :plan="plan" /></div>
    <p v-if="!loading && !loadError && !catalog.plans.length" class="empty">目前尚無開放的方案。</p>
  </section>
</template>
