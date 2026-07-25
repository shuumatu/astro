import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/catalog', name: 'catalog', component: () => import('../views/CatalogView.vue') },
    {
      path: '/catalog/:objectType/:objectKey',
      name: 'catalog-detail',
      component: () => import('../views/CatalogDetailView.vue')
    },
    { path: '/admin/catalog', name: 'catalog-admin', component: () => import('../views/CatalogAdminView.vue') },
    { path: '/missions', component: () => import('../views/MissionView.vue') },
    { path: '/sky-map', component: () => import('../views/SkyMapView.vue') }
  ]
})

export default router
