//
import component from './components/AsyncRenderless.js';

const router = VueRouter.createRouter({
  history: VueRouter.createMemoryHistory(),
  routes: [
    { path: '/', component },
  ],
})

router.push('/')
export default router
