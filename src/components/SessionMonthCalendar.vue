<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { monthCells, shiftMonth } from '../scheduleCalendar.js'

const props = defineProps({
  month: { type: String, required: true },
  selectedDay: { type: String, default: '' },
  days: { type: Map, required: true },
  today: { type: String, required: true },
  range: { type: Object, required: true },
  showSeats: { type: Boolean, default: true },
  firstMonth: String,
  lastMonth: String,
  busy: Boolean,
})
const emit = defineEmits(['select-day', 'change-month', 'today'])
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const cells = computed(() => monthCells(props.month, 1))
const monthLabel = computed(() => `${props.month.slice(0, 4)} 年 ${Number(props.month.slice(5))} 月`)
const weeks = computed(() => {
  const rows = []
  for (let start = 0; start < cells.value.length; start += 7) {
    rows.push(cells.value.slice(start, start + 7))
  }
  return rows
})

function monthAllowed(month) {
  return (!props.firstMonth || month >= props.firstMonth) && (!props.lastMonth || month <= props.lastMonth)
}

function dayLabel(day) {
  const date = `${monthLabel.value} ${Number(day.slice(-2))} 日`
  const sessions = props.days.get(day)
  if (!sessions) return `${date}，無場次`
  if (!props.showSeats) return `${date}，${sessions.count} 堂`
  return `${date}，${sessions.count} 堂，剩餘名額 ${sessions.remaining} 位，已報名 ${sessions.enrolled} 人次`
}

// Native buttons support Tab and Enter. Arrow keys also move between dates in a week or column.
const arrowOffsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
function moveFocus(event) {
  const offset = arrowOffsets[event.key]
  const day = event.target.dataset.day
  if (!offset || !day) return
  event.preventDefault()
  const target = cells.value[cells.value.indexOf(day) + offset]
  if (target) event.currentTarget.querySelector(`button[data-day="${target}"]:enabled`)?.focus()
}
</script>

<template>
  <section class="session-month" :class="{ 'counts-only': !showSeats }" aria-label="課程月曆" :aria-busy="busy">
    <header class="month-header">
      <h2 aria-live="polite">{{ monthLabel }}</h2>
      <div class="month-nav">
        <button type="button" aria-label="上個月" :disabled="busy || !monthAllowed(shiftMonth(month, -1))" @click="emit('change-month', -1)">
          <ChevronLeft :size="18" aria-hidden="true" />
        </button>
        <button type="button" :disabled="busy || !monthAllowed(today.slice(0, 7))" @click="emit('today')">本月</button>
        <button type="button" aria-label="下個月" :disabled="busy || !monthAllowed(shiftMonth(month, 1))" @click="emit('change-month', 1)">
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>
    <table :aria-label="monthLabel + '課程月曆'" @keydown="moveFocus">
      <thead>
        <tr><th v-for="weekday in weekdays" :key="weekday" scope="col">週{{ weekday }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(week, row) in weeks" :key="row">
          <td v-for="(day, column) in week" :key="column" :class="{ padding: !day }">
            <button
              v-if="day" type="button" class="day"
              :class="{ scheduled: days.has(day), selected: day === selectedDay }"
              :data-day="day" :aria-label="dayLabel(day)"
              :aria-current="day === today ? 'date' : undefined"
              :aria-pressed="day === selectedDay"
              :disabled="busy || day < range.from || day > range.until"
              @click="emit('select-day', day)"
            >
              <span class="day-heading">
                <span class="day-number">{{ Number(day.slice(-2)) }}</span>
                <span v-if="days.has(day)" class="count">{{ days.get(day).count }} 堂</span>
              </span>
              <span v-if="showSeats && days.has(day)" class="day-seats">
                <span><span class="full-label">剩餘名額 </span><span class="short-label">餘 </span>{{ days.get(day).remaining }}</span>
                <span><span class="full-label">已報名 </span><span class="short-label">報 </span>{{ days.get(day).enrolled }}</span>
              </span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="showSeats" class="mobile-key">餘＝剩餘名額　報＝已報名人次</p>
  </section>
</template>

<style scoped>
.session-month {
  container-type: inline-size;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: white;
}
.month-header, .month-nav, .day-heading {
  display: flex;
  align-items: center;
}
.month-header {
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
}
.month-header h2 { margin: 0; font-size: 20px; }
.month-nav { gap: 5px; }
.month-nav button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  min-height: 38px;
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: white;
  color: #365b48;
}
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
th {
  padding: 8px 0;
  color: #586963;
  background: #f6f8f5;
  font-size: 13px;
  font-weight: 500;
}
td { padding: 0; vertical-align: top; border-top: 1px solid var(--line); }
td + td { border-left: 1px solid var(--line); }
.padding { background: #fafbf9; }
.day {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  min-height: 86px;
  padding: 8px;
  border: 0;
  text-align: left;
  background: white;
  color: #43554d;
  font-variant-numeric: tabular-nums;
}
.day-heading { width: 100%; gap: 4px; justify-content: space-between; }
.counts-only .day { min-height: 62px; }
.counts-only .day-heading { flex-direction: column; align-items: flex-start; }
.day-number {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  min-height: 24px;
  border-radius: 50%;
  font-weight: 600;
  font-size: 15px;
}
.day[aria-current="date"] .day-number { box-shadow: inset 0 0 0 1px currentColor; }
.scheduled { background: #e5f0e8; color: #284d3b; }
.day.selected { background: #476b58; color: white; }
.day:not(:disabled):hover { box-shadow: inset 0 0 0 2px #829c89; }
.day:focus-visible { outline-offset: -3px; outline-color: #213f31; }
.day:disabled { opacity: .52; }
.count, .day-seats { font-size: 12px; }
.day-seats { display: flex; flex-direction: column; line-height: 1.5; }
.short-label, .mobile-key { display: none; }
@container (max-width: 660px) {
  .month-header { padding: 10px; }
  .month-header h2 { font-size: 18px; }
  .day { min-height: 74px; gap: 1px; padding: 4px 3px; }
  .day-heading { justify-content: center; }
  .count, .full-label { display: none; }
  .counts-only .day-heading { align-items: center; }
  .counts-only .count { display: inline; }
  .short-label { display: inline; }
  .day-seats { text-align: center; width: 100%; font-size: 11px; }
  .mobile-key { display: block; margin: 0; padding: 6px 10px; border-top: 1px solid var(--line); font-size: 12px; }
}
</style>
