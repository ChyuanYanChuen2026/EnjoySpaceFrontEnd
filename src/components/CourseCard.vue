<script setup lang="js">  import { money, calendarDate } from '../api'; import { UserRound, MapPin, ArrowUpRight } from 'lucide-vue-next'; defineProps({ course: { type: Object, required: true } })</script>
<template>
  <RouterLink class="course-card" :to="`/courses/${course.id}`">
    <div class="course-image"><img src="/images/yoga-hero.png" alt="自然採光瑜珈空間中的練習示意" /><span
        class="badge">{{ course.category }}</span></div>
    <div class="course-body">
      <h3>{{ course.name }}
        <ArrowUpRight :size="18" />
      </h3>
      <p>{{ course.termName }} · {{ calendarDate(course.termStartDate) }}～{{ calendarDate(course.termEndDate) }}</p>
      <p>期課 NT$ {{ money(course.termPrice) }} · {{ course.sessionCount }} 堂 · 預設 {{ course.capacity }} 人</p>
      <div class="meta">
        <span>
          <UserRound :size="15" />{{ course.teacher }}
        </span>
        <span>
          <MapPin :size="15" />{{ course.location }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
