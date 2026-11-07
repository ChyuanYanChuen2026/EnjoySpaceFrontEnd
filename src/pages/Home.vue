<script setup lang="js">

import Hero from '../components/Hero.vue'; 
import CourseCard from '../components/CourseCard.vue'; 
import PlanCard from '../components/PlanCard.vue'; 
import { catalog, loading, loadError } from '../state'; 
import { money } from '../api'; 
import { Sprout, Heart, UsersRound, Flower2, ArrowRight, Check } from 'lucide-vue-next';

const features = [
  { icon: Sprout, title: '適合各種程度', copy: '從初學者到進階者，找到適合自己的練習。' }, 
  { icon: UsersRound, title: '小班制教學', copy: '照顧每一位學員的練習品質與身心狀態。' }, 
  { icon: Flower2, title: '身心整合', copy: '結合體位法與呼吸，讓練習延伸到生活。' }, 
  { icon: Heart, title: '溫暖支持的社群', copy: '在這裡，遇見同樣用心照顧自己的夥伴。' }
  ];
</script>

<template>
  <Hero home title="Enjoy Space 米亞工作室" subtitle="在瑜珈中，遇見更平靜、更喜歡的自己">
    <div class="actions">
      <RouterLink class="button" to="/courses">查看課程
        <ArrowRight :size="17" />
      </RouterLink>
      <RouterLink class="button outline" to="/trial">預約體驗</RouterLink>
    </div>
  </Hero>
  <div class="container">
    <section class="section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">A SPACE FOR YOU</p>
          <h2>讓練習，從此刻開始</h2>
          <p>多元課程，陪伴你在瑜珈的路上持續前進。</p>
        </div>
      </div>
      <div class="features">
        <article v-for="f in features" :key="f.title">
          <component :is="f.icon" :size="26" />
          <div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.copy }}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">FIND YOUR PRACTICE</p>
          <h2>探索你的瑜珈時光</h2>
        </div>
        <RouterLink to="/courses">查看全部課程
          <ArrowRight :size="16" />
        </RouterLink>
      </div>
      <div class="course-grid">
        <CourseCard v-for="c in catalog.courses.slice(0, 3)" :key="c.id" :course="c" />
      </div>
      <p v-if="!loading && !loadError && !catalog.courses.length" class="empty">目前尚無公開課程，歡迎稍後再來看看。</p>
    </section>
    <section class="section bottom-grid">
      <div>
        <div class="section-heading">
          <div>
            <p class="eyebrow">YOUR OWN PACE</p>
            <h2>適合你的練習方案</h2><RouterLink to="/plans">查看全部方案 →</RouterLink>
          </div>
        </div>
        <div class="plans">
          <PlanCard v-for="p in catalog.plans.slice(0, 3)" :key="p.id" :plan="p" />
        </div>
      </div>
      <div class="studio-teaser panel">
        <p class="eyebrow">OUR STUDIO</p>
        <h2>一個安心練習的地方</h2>
        <p v-for="l in catalog.locations" :key="l.id">{{ l.name }}<br>{{ l.address }}</p>
        <RouterLink to="/studio">認識教室
          <ArrowRight :size="16" />
        </RouterLink>
      </div>
    </section>
    <section class="cta">
      <Flower2 :size="60" :stroke-width="1" />
      <div>
        <h2>從一堂體驗課開始，遇見更好的自己</h2>
        <p>給自己一個放鬆的時刻，讓瑜珈帶來改變。</p>
      </div>
      <RouterLink class="button" to="/trial">立即預約體驗
        <ArrowRight :size="17" />
      </RouterLink>
    </section>
  </div>
</template>
