<script setup>
import { RefreshCw } from 'lucide-vue-next'
defineProps({ title: String, busy: Boolean, disabled: Boolean })
defineEmits(['refresh'])
</script>

<template>
  <div class="member-toolbar">
    <h2>{{ title }}</h2>
    <div class="member-toolbar-actions">
      <slot />
      <button type="button" class="member-refresh" :disabled="busy || disabled" :aria-label="`重新整理${title}`" @click="$emit('refresh')">
        <RefreshCw :size="17" aria-hidden="true" />{{ busy ? '更新中…' : '重新整理' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.member-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.member-toolbar h2{margin:0}
.member-toolbar-actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-left:auto;font-size:13px;color:var(--green)}
.member-refresh{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 0;border:0;background:transparent;color:#40634f;font-size:13px;white-space:nowrap}
.member-refresh:hover:not(:disabled){text-decoration:underline;text-underline-offset:4px}
@media(max-width:600px){.member-toolbar{gap:8px}.member-toolbar-actions{gap:12px}}
</style>
