<script setup lang="js">
import { ref, computed, onMounted, watch } from 'vue'; 
import { api, date, time } from '../api';
import { useRoute } from 'vue-router';
import { catalog, catalogRevision } from '../state';
const route = useRoute(); 
const courseId = ref(Number(route.query.course) || ''); 
const termId = ref(''); 
import Hero from '../components/Hero.vue'; 
import { CalendarDays, List, UserRound, MapPin, SlidersHorizontal } from 'lucide-vue-next';

const sessions = ref([]), busy = ref(false), error = ref(''), category = ref(''), teacher = ref(''), location = ref(''), calendar = ref(false)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const from = ref(today), until = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 30 * 86400000)))
const categories = computed(() => [...new Set(sessions.value.map(s => s.category))]); 
const teachers = computed(() => [...new Set(sessions.value.map(s => s.teacher))]);
const locations = computed(() => [...new Set(sessions.value.map(s => s.location))]);
const filtered = computed(() => sessions.value.filter(s => (!courseId.value || s.courseId === Number(courseId.value)) && (!termId.value || s.termId === Number(termId.value)) && (!category.value || s.category === category.value) && (!teacher.value || s.teacher === teacher.value) && (!location.value || s.location === location.value)))
const groups = computed(() => Object.entries(filtered.value.reduce((days, session) => { (days[date(session.startsAt)] ||= []).push(session); return days }, {})))

let requestVersion = 0
async function load() {
  const version = ++requestVersion
  busy.value = true; error.value = ''
  try {
    const result = await api(`/sessions?from=${encodeURIComponent(from.value + 'T00:00:00+08:00')}&until=${encodeURIComponent(until.value + 'T23:59:59+08:00')}`)
    if (version === requestVersion) sessions.value = result
  } catch (e) { if (version === requestVersion) error.value = e.message }
  finally { if (version === requestVersion) busy.value = false }
}
function reset() { courseId.value = ''; termId.value = ''; category.value = ''; teacher.value = ''; location.value = ''; from.value = today; until.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 30 * 86400000)); load() }
onMounted(load)
watch(catalogRevision, load)
watch(() => route.query.course, value => { courseId.value = Number(value) || '' })
</script>
<template>
  <Hero title="公開課表" subtitle="探索適合你的練習時光" />
  <section class="container section">
    <form class="filters" @submit.prevent="load"><label>學期<select v-model="termId"><option value="">全部學期</option><option v-for="term in catalog.terms" :key="term.id" :value="term.id">{{ term.name }}</option></select></label><label>課程<select v-model="courseId"><option value="">全部課程</option><option v-for="c in catalog.courses" :key="c.id" :value="c.id">{{ c.name }} · {{ c.termName }}</option></select></label><label>開始日期<input type="date" v-model="from"
          required></label><label>結束日期<input type="date" v-model="until" :min="from" required></label><label>課程類型<select
          v-model="category">
          <option value="">全部類型</option>
          <option v-for="c in categories" :key="c">{{ c }}</option>
        </select></label><label>老師<select v-model="teacher">
          <option value="">全部老師</option>
          <option v-for="t in teachers" :key="t">{{ t }}</option>
        </select></label><label>上課地點<select v-model="location">
          <option value="">全部地點</option>
          <option v-for="l in locations" :key="l">{{ l }}</option>
        </select></label><button class="button" :disabled="busy">
        <SlidersHorizontal :size="16" />搜尋
      </button><button type="button" class="button outline" @click="reset">重設</button></form>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">讀取課表中…</p>
    <div class="section-heading">
      <div class="segmented"><button :class="{ selected: !calendar }" @click="calendar = false">
          <List :size="17" />卡片列表
        </button><button :class="{ selected: calendar }" @click="calendar = true">
          <CalendarDays :size="17" />每日課表
        </button></div><span>共 {{ filtered.length }} 堂課程</span>
    </div>
    <div :class="{ 'calendar-grid': calendar }">
      <section v-for="[day, items] in groups" :key="day" class="day-group">
        <h3>{{ day }}</h3>
        <article v-for="s in items" :key="s.id" class="session-card" :class="{ compact: calendar }"><img
            src="/images/yoga-hero.png" alt="瑜珈練習示意">
          <div class="session-time">{{ time(s.startsAt) }}<span>— {{ time(s.endsAt) }}</span></div>
          <div class="session-info">
            <RouterLink :to="`/courses/${s.courseId}`">
              <h3>{{ s.name }}</h3>
            </RouterLink><span class="badge">{{ s.category }}</span> <span class="badge" v-if="s.isExtraSession">額外加開</span><p class="session-term">{{ s.termName }}</p>
            <div class="meta"><span>
                <UserRound :size="14" />{{ s.teacher }}
              </span><span>
                <MapPin :size="14" />{{ s.location }}
              </span></div>
          </div>
          <div class="session-actions"><span class="badge"
              :class="{ full: s.enrolled >= s.capacity }">{{ s.enrolled >= s.capacity ? '已額滿' : `剩餘 ${s.capacity - s.enrolled} 位` }} ·
              {{ s.enrolled }} / {{ s.capacity }}</span>
            <div class="actions">
              <RouterLink class="button small outline" :to="`/courses/${s.courseId}`">查看詳情</RouterLink>
              <RouterLink v-if="s.enrolled < s.capacity && new Date(s.startsAt) > new Date()" class="button small"
                :to="`/trial?session=${s.id}`">申請體驗</RouterLink>
            </div>
          </div>
        </article>
      </section>
    </div>
    <p v-if="!busy && !error && !filtered.length" class="empty">這段時間沒有符合條件的課程，試試其他日期或篩選條件。</p>
  </section>
</template>
