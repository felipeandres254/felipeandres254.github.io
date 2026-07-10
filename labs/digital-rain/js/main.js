//
import Canvas from './controllers/Canvas.js'

document.addEventListener('DOMContentLoaded', () => {
  new Canvas()

  // Fade-out loading
  const loading = document.getElementById('loading')
  if (!loading) return
  loading.style.transition = 'opacity 0.5s ease'
  loading.style.opacity = '0'
  loading.addEventListener('transitionend', () => {
    loading.style.display = 'none'
  }, { once: true })
})
