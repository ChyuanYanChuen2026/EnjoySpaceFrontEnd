<script setup>
import { computed, ref } from 'vue'
import { date, time } from '../api'
import { groupSessionsByDay, shiftMonth, taiwanDateKey } from '../scheduleCalendar'
import SessionMonthCalendar from './SessionMonthCalendar.vue'

const props = defineProps({
  options: { type: Object, required: true },
  busy: Boolean,
})
const choices = defineModel({ type: Array, required: true })
const emit = defineEmits(['invalid'])
const grouped = computed(() => groupSessionsByDay(props.options.sessions))
const days = computed(() => new Map(
  Array.from(grouped.value, ([day, sessions]) => [day, { count: sessions.length }])
))
const sessionsById = computed(() => new Map(props.options.sessions.map(session => [session.id, session])))
const eligibleDates = computed(() => [...grouped.value.keys()])
const range = computed(() => ({
  from: eligibleDates.value[0],
  until: eligibleDates.value.at(-1),
}))
const today = taiwanDateKey()
const month = ref(range.value.from?.slice(0, 7) || today.slice(0, 7))
const day = ref('')
const multiple = ref(false)
const activeIndex = ref(0)
const daySessions = computed(() => grouped.value.get(day.value) || [])
const selectionSummary = computed(() => choices.value.map(id => {
  const session = sessionsById.value.get(id)
  if (!session) return '尚未選擇場次'
  return `${date(session.startsAt)} ${time(session.startsAt)}–${time(session.endsAt)} · ${session.name}`
}))

function edit(index, selectedIds = choices.value) {
  activeIndex.value = index
  const session = sessionsById.value.get(selectedIds[index])
  day.value = session ? taiwanDateKey(session.startsAt) : ''
  if (day.value) month.value = day.value.slice(0, 7)
}

function chooseMode(isMultiple) {
  multiple.value = isMultiple
  if (!isMultiple) {
    choices.value = choices.value.slice(0, 1)
    edit(0)
  }
}

function addChoice() {
  if (choices.value.length >= props.options.remaining) return
  const updated = [...choices.value, 0]
  choices.value = updated
  edit(updated.length - 1, updated)
}

function removeChoice(index) {
  const updated = choices.value.filter((_, position) => position !== index)
  choices.value = updated
  const nextIndex = index < activeIndex.value ? activeIndex.value - 1 : activeIndex.value
  edit(Math.min(nextIndex, updated.length - 1), updated)
}

function showMonth(target) {
  if (target < range.value.from.slice(0, 7) || target > range.value.until.slice(0, 7)) return
  month.value = target
  day.value = ''
}

function selectDay(value) {
  day.value = value
  const existing = sessionsById.value.get(choices.value[activeIndex.value])
  if (existing && taiwanDateKey(existing.startsAt) !== value) setChoice(0)
}

function setChoice(id) {
  choices.value = choices.value.map((old, index) => index === activeIndex.value ? id : old)
}

function selectSession(event) {
  const id = Number(event.target.value)
  if (choices.value.some((other, index) => index !== activeIndex.value && other === id)) {
    event.target.value = String(choices.value[activeIndex.value])
    emit('invalid', '重複選擇同一堂課，請調整後再送出。')
    return
  }
  setChoice(id)
}
</script>

<template>
  <p v-if="!options.sessions.length" class="empty">目前沒有符合效期的可預約場次，請聯繫工作室。</p>
  <template v-else>
    <fieldset v-if="options.remaining > 1" class="booking-mode">
      <legend>預約方式</legend>
      <label><input type="radio" name="booking-mode" :checked="!multiple" :disabled="busy" @change="chooseMode(false)"> 單堂預約</label>
      <label><input type="radio" name="booking-mode" :checked="multiple" :disabled="busy" @change="chooseMode(true)"> 一次預約多堂</label>
    </fieldset>

    <ol class="choice-list" aria-label="本次預約場次">
      <li v-for="(summary, index) in selectionSummary" :key="index">
        <button type="button" class="choice-summary" :aria-pressed="activeIndex === index"
          :disabled="busy" @click="edit(index)">
          <strong>第 {{ index + 1 }} 堂</strong><span>{{ summary }}</span>
        </button>
        <button v-if="choices.length > 1" type="button" class="text-button"
          :aria-label="`移除第 ${index + 1} 堂`" :disabled="busy" @click="removeChoice(index)">移除</button>
      </li>
    </ol>
    <button v-if="multiple && choices.length < options.remaining" type="button" class="button outline small"
      :disabled="busy" @click="addChoice">＋ 再預約一堂</button>

    <div class="picker-layout">
      <SessionMonthCalendar :month="month" :selected-day="day" :days="days" :show-seats="false"
        :today="today" :range="range" :first-month="range.from.slice(0, 7)" :last-month="range.until.slice(0, 7)"
        :busy="busy" @select-day="selectDay" @change-month="showMonth(shiftMonth(month, $event))"
        @today="showMonth(today.slice(0, 7))" />
      <section class="day-sessions" aria-live="polite">
        <h4>選擇第 {{ activeIndex + 1 }} 堂場次</h4>
        <p v-if="!day">請先點選月曆上的上課日期。</p>
        <template v-else>
          <p>{{ date(day + 'T00:00:00+08:00') }}</p>
          <label v-if="daySessions.length">當日場次
            <select :value="choices[activeIndex]" :disabled="busy" required
              :data-validation-label="`第 ${activeIndex + 1} 堂上課場次`" data-empty-value="0" @change="selectSession">
              <option value="0" disabled>請選擇場次</option>
              <option v-for="session in daySessions" :key="session.id" :value="session.id">
                {{ time(session.startsAt) }}–{{ time(session.endsAt) }} · {{ session.name }} · {{ session.teacher }} · {{ session.location }}
              </option>
            </select>
          </label>
          <p v-else>當天沒有可預約的體驗場次。</p>
        </template>
      </section>
    </div>
  </template>
</template>

<style scoped>
.booking-mode { padding: 0; border: 0; margin: 16px 0; }
.booking-mode label { display: inline-flex; align-items: center; gap: 6px; margin: 6px 20px 0 0; }
.booking-mode input { width: auto; margin: 0; }
.choice-list { list-style: none; padding: 0; margin: 12px 0; }
.choice-list li { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
.choice-summary {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px;
  padding: 9px 14px; text-align: left; color: inherit; background: white;
  border: 1px solid var(--line); border-radius: 6px;
}
.choice-summary[aria-pressed="true"] { border-color: var(--green); box-shadow: inset 3px 0 var(--green); }
.choice-summary span { font-size: 14px; }
.picker-layout {
  display: grid; grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 16px; align-items: start; margin: 16px 0;
}
.day-sessions { min-width: 0; padding: 16px; border: 1px solid var(--line); background: white; border-radius: 8px; }
.day-sessions h4 { margin: 0 0 10px; }
.day-sessions p { margin: 0 0 6px; }
.day-sessions label { margin-bottom: 0; }
@media (max-width: 800px) {
  .picker-layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
