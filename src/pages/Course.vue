<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { catalogRevision } from '../state'
import { api, date, time, money, calendarDate } from '../api'
import { CalendarDays, MapPin, UserRound } from 'lucide-vue-next'
const route = useRoute(), course = ref(null), sessions = ref([]), busy = ref(true), error = ref('')
const next = computed(() => sessions.value.find(s => s.enrolled < s.capacity) || sessions.value[0])
let requestVersion = 0
async function load() {
  const version = ++requestVersion
  busy.value = true; error.value = ''
  try {
    const data = await api('/courses/' + encodeURIComponent(route.params.id))
    if (version !== requestVersion) return
    course.value = data.course; sessions.value = data.sessions
  } catch (e) { if (version === requestVersion) { course.value = null; sessions.value = []; error.value = e.message } }
  finally { if (version === requestVersion) busy.value = false }
}
watch([() => route.params.id, catalogRevision], load, { immediate: true })
</script>
<template>
  <section class="container section">
    <p class="breadcrumb"><RouterLink to="/">首頁</RouterLink> / <RouterLink to="/courses">課程介紹</RouterLink></p>
    <p v-if="busy" role="status">正在讀取課程資料…</p>
    <p v-if="error" class="notice error" role="alert">{{ error }} <button @click="load">重新載入</button></p>
    <template v-if="course">
      <div class="detail-title"><p class="eyebrow">FIND YOUR BALANCE</p><h1>{{ course.name }}</h1><span class="badge">{{ course.category }}</span> <span class="badge">{{ course.termName }}</span></div>
      <div class="detail-grid">
        <div>
          <img class="detail-image" src="/images/yoga-hero.png" alt="瑜珈練習情境示意">
          <section class="section">
            <h2>課程資訊</h2>
            <dl class="course-facts">
              <div><dt>學期</dt><dd>{{ course.termName }}</dd></div>
              <div><dt>學期狀態</dt><dd>{{ course.termStatusText }}</dd></div>
              <div><dt>期間</dt><dd>{{ calendarDate(course.termStartDate) }}～{{ calendarDate(course.termEndDate) }}</dd></div>
              <div><dt>期課價格</dt><dd>NT$ {{ money(course.termPrice) }}／{{ course.sessionCount }} 堂固定課程</dd></div>
              <div><dt>預設老師</dt><dd>{{ course.teacher }}</dd></div>
              <div><dt>預設教室</dt><dd>{{ course.location }} · {{ course.address }}</dd></div>
              <div><dt>預設名額</dt><dd>{{ course.capacity }} 人（各場次名額如下）</dd></div>
              <div><dt>課程設定</dt><dd>{{ course.allowsFlexibleBooking ? '接受彈性預約' : '不接受彈性預約' }} · {{ course.allowsMakeup ? '接受補課' : '不接受補課' }}</dd></div>
            </dl>
            <p class="muted">照片為品牌情境示意。彈性預約與補課請洽工作室安排，實際老師、教室及名額依各場次資料。</p>
          </section>
          <section class="section"><h2>後續上課場次</h2>
            <article v-for="s in sessions" :key="s.id" class="panel">
              <h3>{{ date(s.startsAt) }} {{ time(s.startsAt) }}–{{ time(s.endsAt) }}</h3>
              <p>{{ s.teacher }} · {{ s.location }}<br>{{ s.address }}</p>
              <div class="section-heading"><span>{{ s.isExtraSession ? '額外加開' : '固定課程' }} · {{ s.enrolled }} / {{ s.capacity }} 人</span><RouterLink v-if="s.enrolled < s.capacity" class="button small" :to="`/trial?session=${s.id}`">申請體驗</RouterLink><span v-else class="badge full">已額滿</span></div>
            </article>
            <p v-if="!sessions.length" class="empty">目前沒有後續公開場次。</p>
          </section>
        </div>
        <aside><div class="panel booking"><h2>開始你的練習</h2>
          <template v-if="next">
            <p><CalendarDays :size="18"/>{{ date(next.startsAt) }}</p>
            <p>{{ time(next.startsAt) }}–{{ time(next.endsAt) }}</p>
            <p><UserRound :size="18"/>{{ next.teacher }} 老師</p>
            <p><MapPin :size="18"/>{{ next.location }}</p>
            <p>{{ next.address }}</p><span class="badge">{{ next.enrolled }} / {{ next.capacity }} 人</span>
            <RouterLink v-if="next.enrolled < next.capacity" class="button" :to="`/trial?session=${next.id}`">申請體驗 →</RouterLink>
          </template>
          <p v-else>目前沒有後續公開場次。</p>
          <RouterLink class="button outline" :to="`/schedule?course=${course.id}`">查看此課程課表</RouterLink>
          <RouterLink class="button outline" to="/plans">查看課程方案</RouterLink>
        </div></aside>
      </div>
    </template>
  </section>
</template>
