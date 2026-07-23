import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/catalog', component: () => import('../views/CatalogView.vue') },
    { path: '/missions', component: () => import('../views/MissionView.vue') },
    { path: '/sky-map', component: () => import('../views/SkyMapView.vue') }
  ]
})

export default router
