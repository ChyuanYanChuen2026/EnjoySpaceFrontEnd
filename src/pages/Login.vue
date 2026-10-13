<script setup>
import { ref } from 'vue'; import { useRouter, useRoute } from 'vue-router'; import { api } from '../api'; import { refreshMember } from '../state'; import { Flower2 } from 'lucide-vue-next'
const router = useRouter(), route = useRoute(), register = ref(false), busy = ref(false), error = ref(''), notice = ref('')
const form = ref({ account: '', password: '', confirmPassword: '', name: '', email: '', phone: '' })
async function submit() { busy.value = true; error.value = ''; notice.value = ''; try { if (register.value) { await api('/register', form.value); register.value = false; notice.value = '帳號已建立，請登入。' } else { await api('/login', { account: form.value.account, password: form.value.password }); await refreshMember(); const target = String(route.query.redirect || '/member'); await router.push(target.startsWith('/') && !target.startsWith('//') ? target : '/member') } } catch (e) { error.value = e.message } finally { busy.value = false } }
</script>
<template>
  <section class="auth-layout">
    <div class="auth-art">
      <div>
        <p class="eyebrow">WELCOME TO ENJOY SPACE</p>
        <h1>把時間<br>留給自己。</h1>
      </div>
    </div>
    <div class="auth-form">
      <Flower2 :size="42" :stroke-width="1" />
      <h1>{{ register ? '開始你的第一堂練習' : '歡迎回來' }}</h1>
      <p>學生・老師・體驗生會員專區</p>
      <form @submit.prevent="submit"><label>帳號<input v-model="form.account" autocomplete="username" maxlength="100"
            required></label><template v-if="register"><label>姓名<input v-model="form.name" autocomplete="name" required
              maxlength="100"></label><label>Email<input v-model="form.email" type="email" autocomplete="email" required
              maxlength="200"></label><label>電話<input v-model="form.phone" type="tel" autocomplete="tel" required
              maxlength="30"></label></template><label>密碼<input v-model="form.password" type="password"
            :autocomplete="register ? 'new-password' : 'current-password'" :minlength="register ? 10 : 1" maxlength="200"
            required></label><label v-if="register">確認密碼<input v-model="form.confirmPassword" type="password"
            autocomplete="new-password" minlength="10" maxlength="200" required></label>
        <p v-if="register" class="muted">註冊建立體驗生帳號。學生與老師請使用工作室提供的帳號。</p>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <p v-if="notice" class="notice" role="status">{{ notice }}</p><button class="button"
          :disabled="busy">{{ busy ? '處理中…' : register ? '建立體驗生帳號' : '登入' }}</button>
      </form><button class="text-button"
        @click="register = !register; error = ''">{{ register ? '已有帳號？返回登入' : '第一次來？註冊體驗生帳號' }}</button>
    </div>
  </section>
</template>
