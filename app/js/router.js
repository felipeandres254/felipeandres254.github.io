//
import AsyncRenderer from './components/AsyncRenderer';

const router = VueRouter.createRouter({
  history: VueRouter.createMemoryHistory(),
  routes: [
    { path: '/', component: AsyncRenderer },
  ],
})

router.push('/')
export default router
