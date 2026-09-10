import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/catalog', name: 'catalog', component: () => import('../views/CatalogView.vue') },
    { path: '/explore', name: 'explore', component: () => import('../views/ExploreView.vue') },
    { path: '/explore/:slug', name: 'explore-detail', component: () => import('../views/ExploreDetailView.vue') },
    {
      path: '/catalog/:objectType/:objectKey',
      name: 'catalog-detail',
      component: () => import('../views/CatalogDetailView.vue')
    },
    { path: '/admin/catalog', name: 'catalog-admin', component: () => import('../views/CatalogAdminView.vue') },
    { path: '/admin/explore', name: 'explore-admin', component: () => import('../views/ExploreAdminView.vue') },
    { path: '/demos', name: 'demos', component: () => import('../views/DemosView.vue') },
    { path: '/sky-map', component: () => import('../views/SkyMapView.vue') }
  ]
})

export default router
