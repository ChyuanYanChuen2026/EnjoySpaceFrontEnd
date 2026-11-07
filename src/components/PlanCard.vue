<script setup lang="js">
import { money, validity, audience } from '../api'
defineProps({ plan: { type: Object, required: true } })
</script>
<template>
  <article class="panel plan-card">
    <span class="badge">{{ audience(plan) }}</span>
    <h3>{{ plan.name }}</h3>
    <p class="price"><small>NT$</small> {{ money(plan.price) }}</p>
    <p>{{ plan.sessionQuota }} 堂課程</p>
    <p v-if="!plan.requiresReferrer">{{ validity(plan) }}</p>
    <p v-else>須填寫介紹人，並直接聯繫管理員登記安排上課。</p>
    <RouterLink class="button small" :to="plan.planType === 'Trial' && plan.audienceType === 'TrialGuest' ? `/trial?plan=${plan.id}` : '/schedule'">
      {{ plan.planType === 'Trial' && plan.audienceType === 'TrialGuest' ? '申請此體驗方案' : '查看課表' }}
    </RouterLink>
  </article>
</template>
