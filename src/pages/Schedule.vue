<script setup>
import { chineseValidation as vChineseValidation, scheduleDateRangeIssue } from '../chineseValidation'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CalendarDays, List, MapPin, SlidersHorizontal, UserRound } from 'lucide-vue-next'
import { api, date, time } from '../api'
import { catalog, catalogRevision } from '../state'
import { groupSessionsByDay, monthRange, shiftMonth, summarizeSessionDays, taiwanDateKey } from '../scheduleCalendar'
import Hero from '../components/Hero.vue'
import SessionMonthCalendar from '../components/SessionMonthCalendar.vue'

const route = useRoute()
const courseId = ref(Number(route.query.course) || '')
const termId = ref('')
const category = ref('')
const teacher = ref('')
const location = ref('')
const now = ref(Date.now())
const today = computed(() => taiwanDateKey(now.value))
const month = ref(today.value.slice(0, 7))
const appliedRange = ref(monthRange(month.value))
const from = ref(appliedRange.value.from)
const until = ref(appliedRange.value.until)
const selectedDay = ref('')
const calendar = ref(true)
const sessions = ref([])
const busy = ref(false)
const error = ref('')

// Keep the selected filter available when browsing a month with no matching sessions.
function optionsFor(key, selected) {
  return [...new Set([...sessions.value.map(session => session[key]), selected].filter(Boolean))]
}
const categories = computed(() => optionsFor('category', category.value))
const teachers = computed(() => optionsFor('teacher', teacher.value))
const locations = computed(() => optionsFor('location', location.value))
const filtered = computed(() => sessions.value.filter(session =>
  (!courseId.value || session.courseId === Number(courseId.value)) &&
  (!termId.value || session.termId === Number(termId.value)) &&
  (!category.value || session.category === category.value) &&
  (!teacher.value || session.teacher === teacher.value) &&
  (!location.value || session.location === location.value)
))
const groups = computed(() => groupSessionsByDay(filtered.value))
const summaries = computed(() => summarizeSessionDays(groups.value))
const visibleGroups = computed(() => {
  if (!calendar.value) return [...groups.value]
  if (!selectedDay.value) return []
  return [[selectedDay.value, groups.value.get(selectedDay.value) || []]]
})
const visibleCount = computed(() => {
  if (!calendar.value) return filtered.value.length
  let count = 0
  for (const [day, summary] of summaries.value) {
    if (day.startsWith(month.value)) count += summary.count
  }
  return count
})

let requestVersion = 0
async function load() {
  const version = ++requestVersion
  const range = appliedRange.value
  const issue = scheduleDateRangeIssue(range.from, range.until)
  if (issue) { error.value = issue; busy.value = false; return }
  const start = range.from + 'T00:00:00+08:00'
  // The UI includes the final date; the API excludes the upper bound.
  const end = new Date(Date.parse(range.until + 'T00:00:00+08:00') + 86400000)
  const query = new URLSearchParams({ from: start, until: end.toISOString() })
  busy.value = true
  error.value = ''
  try {
    const result = await api('/sessions?' + query)
    if (version === requestVersion) {
      sessions.value = result
      now.value = Date.now()
    }
  } catch (cause) {
    if (version === requestVersion) {
      sessions.value = []
      error.value = cause.message
    }
  } finally {
    if (version === requestVersion) busy.value = false
  }
}
function applyRange(range, displayMonth) {
  from.value = range.from
  until.value = range.until
  appliedRange.value = range
  month.value = displayMonth
  selectedDay.value = ''
  sessions.value = []
  load()
}
function search() {
  const issue = scheduleDateRangeIssue(from.value, until.value)
  if (issue) { error.value = issue; return }
  applyRange({ from: from.value, until: until.value }, from.value.slice(0, 7))
}
function openDatePicker(event) {
  try {
    event.currentTarget.showPicker?.()
  } catch (error) {
    // The native calendar icon may already have used this click to open the picker.
    if (error.name !== 'NotAllowedError' && error.name !== 'SecurityError') throw error
  }
}
function changeMonth(delta) {
  const target = shiftMonth(month.value, delta)
  const range = appliedRange.value
  if (target >= range.from.slice(0, 7) && target <= range.until.slice(0, 7)) {
    month.value = target
    selectedDay.value = ''
  } else {
    applyRange(monthRange(target), target)
  }
}
function currentMonth() {
  const target = taiwanDateKey(Date.now()).slice(0, 7)
  applyRange(monthRange(target), target)
}
function reset() {
  courseId.value = ''
  termId.value = ''
  category.value = ''
  teacher.value = ''
  location.value = ''
  currentMonth()
}
let clockTimer
onMounted(() => {
  load()
  clockTimer = window.setInterval(() => { now.value = Date.now() }, 30000)
})
onUnmounted(() => window.clearInterval(clockTimer))
watch(catalogRevision, load)
watch(() => route.query.course, value => { courseId.value = Number(value) || '' })
</script>
<template>
  <Hero title="公開課表" subtitle="探索適合你的練習時光" />
  <section class="container section">
    <form v-chinese-validation class="filters" @submit.prevent="search"><label>學期<select v-model="termId"><option value="">全部學期</option><option v-for="term in catalog.terms" :key="term.id" :value="term.id">{{ term.name }}</option></select></label><label>課程<select v-model="courseId"><option value="">全部課程</option><option v-for="c in catalog.courses" :key="c.id" :value="c.id">{{ c.name }} · {{ c.termName }}</option></select></label>
      <label class="schedule-date">開始日期
        <input type="date" data-validation-label="開始日期" v-model="from" required @click="openDatePicker">
      </label>
      <label class="schedule-date">結束日期
        <input type="date" data-validation-label="結束日期" v-model="until" :min="from" required @click="openDatePicker">
      </label>
      <label>課程類型<select
          v-model="category">
          <option value="">全部類型</option>
          <option v-for="c in categories" :key="c">{{ c }}</option>
        </select></label><label>老師<select v-model="teacher">
          <option value="">全部老師</option>
          <option v-for="t in teachers" :key="t">{{ t }}</option>
        </select></label><label class="schedule-location">上課地點<select v-model="location">
          <option value="">全部地點</option>
          <option v-for="l in locations" :key="l">{{ l }}</option>
        </select></label><div class="schedule-filter-actions"><button type="submit" class="button" :disabled="busy">
        <SlidersHorizontal :size="16" />搜尋
      </button><button type="button" class="button outline" @click="reset">重設</button></div></form>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">讀取課表中…</p>
    <div class="section-heading">
      <div class="segmented">
        <button type="button" :class="{ selected: calendar }" :aria-pressed="calendar" @click="calendar = true">
          <CalendarDays :size="17" />月曆課表
        </button>
        <button type="button" :class="{ selected: !calendar }" :aria-pressed="!calendar" @click="calendar = false">
          <List :size="17" />卡片列表
        </button>
      </div>
      <span v-if="!busy && !error">{{ calendar ? '本月' : '共' }} {{ visibleCount }} 堂課程</span>
    </div>
    <div :class="{ 'month-layout': calendar }">
      <SessionMonthCalendar v-if="calendar" :month="month" :selected-day="selectedDay" :today="today"
        :days="summaries" :range="appliedRange" :busy="busy" @select-day="selectedDay = $event"
        @change-month="changeMonth" @today="currentMonth" />
      <div v-if="!busy && !error" aria-live="polite">
        <p v-if="calendar && !selectedDay" class="empty">
          {{ visibleCount ? '點選月曆日期，查看當日場次。' : '本月沒有符合條件的課程。' }}
        </p>
        <p v-if="!calendar && !filtered.length" class="empty">這段時間沒有符合條件的課程，試試其他日期或篩選條件。</p>
      <section v-for="[day, items] in visibleGroups" :key="day" class="day-group">
        <h3>{{ date(day + 'T00:00:00+08:00') }}</h3>
        <p v-if="!items.length" class="empty">這一天沒有符合條件的課程。</p>
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
              :class="{ full: s.enrolled >= s.capacity }">{{ Date.parse(s.startsAt) <= now ? '已開課' : s.enrolled >= s.capacity ? '已額滿' : `剩餘 ${s.capacity - s.enrolled} 位` }} ·
              {{ s.enrolled }} / {{ s.capacity }}</span>
            <div class="actions">
              <RouterLink class="button small outline" :to="`/courses/${s.courseId}`">查看詳情</RouterLink>
              <RouterLink v-if="s.enrolled < s.capacity && Date.parse(s.startsAt) > now" class="button small"
                :to="`/trial?session=${s.id}`">申請體驗</RouterLink>
            </div>
          </div>
        </article>
      </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.filters input[type="date"] {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  min-inline-size: 0;
  max-inline-size: 100%;
  block-size: 42px;
}
/* iOS 原生日期內容有自己的排版尺寸，限定在欄位內並保留原生日曆操作。 */
.filters input[type="date"]::-webkit-date-and-time-value { min-height: 1.5em; text-align: left; }
.filters input[type="date"]::-webkit-datetime-edit { padding: 0; }
.schedule-filter-actions { display: flex; gap: 12px; }
.schedule-filter-actions .button { white-space: nowrap; flex-shrink: 0; }
.schedule-filter-actions svg { flex-shrink: 0; }
.month-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
}
.month-layout .day-group > h3 { margin-top: 0; }
.month-layout .empty { margin: 0; }
@media (max-width: 900px) {
  .month-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
@media (max-width: 700px) {
  .filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; }
  .filters label { min-width: 0; }
  .filters .schedule-date,
  .filters .schedule-location,
  .schedule-filter-actions { grid-column: 1 / -1; }
  .filters input, .filters select { width: 100%; max-width: 100%; height: 44px; font-size: 16px; }
  .filters select { padding-top: 0; padding-bottom: 0; }
  .filters input[type="date"] { block-size: 44px; }
  .schedule-filter-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .schedule-filter-actions .button { width: 100%; min-width: 0; min-height: 44px; }
}
</style>
