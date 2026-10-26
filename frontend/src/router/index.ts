import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 24 }
    return { top: 0, left: 0 }
  },
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
    { path: '/demos/:slug', name: 'demo-detail', component: () => import('../views/DemoDetailView.vue') },
    { path: '/sky-map', component: () => import('../views/SkyMapView.vue') },
    { path: '/learn/sky', name: 'sky-learning', component: () => import('../views/SkyLearningView.vue') },
    { path: '/learn/chinese', name: 'chinese-learning', component: () => import('../views/SkyLearningView.vue') },
    { path: '/learn/sky/session', name: 'sky-learning-session', component: () => import('../views/SkyLearningView.vue') },
    { path: '/learn/sky/progress', name: 'sky-learning-progress', component: () => import('../views/SkyLearningView.vue') }
  ]
})

export default router
