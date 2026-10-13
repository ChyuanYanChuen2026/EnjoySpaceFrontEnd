import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './pages/Home.vue'
import Courses from './pages/Courses.vue'
import Course from './pages/Course.vue'
import Schedule from './pages/Schedule.vue'
import Trial from './pages/Trial.vue'
import Login from './pages/Login.vue'
import Member from './pages/Member.vue'
import Studio from './pages/Studio.vue'
import Plans from './pages/Plans.vue'
import './style.css'
const router = createRouter({ history: createWebHistory(), scrollBehavior: () => ({ top: 0 }), routes: [
  { path: '/', component: Home }, { path: '/courses', component: Courses }, { path: '/courses/:id', component: Course },
  { path: '/schedule', component: Schedule }, { path: '/trial', component: Trial }, { path: '/login', component: Login },
  { path: '/member', component: Member }, { path: '/studio', component: Studio },
  { path: '/plans', component: Plans },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] })
createApp(App).use(router).mount('#app')
