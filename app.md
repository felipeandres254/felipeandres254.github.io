---
title: App
---

<div id="app"></div>
<div id="overlay-loading">
  <img src="assets/images/loading.svg">
</div>

<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'
  import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'

  window.env = {}
  window.env.API_URL = 'https://app-74ijiatkua-uc.a.run.app'
  window.env.access_token = () => localStorage.getItem('access_token') || null
  window.env.access_token.expires_at = () => {
    try {
      return 1000*JSON.parse(atob(window.env.access_token().split('.')[1])).exp
    } catch {
      return 0
    }
  }
  window.env.login = () => {
    localStorage.removeItem('access_token')
    return new Promise((resolve, reject) => {
      signInWithPopup(getAuth(), new GoogleAuthProvider())
        .then((result) => {
          localStorage.setItem('access_token', result.user.accessToken)
          resolve(true)
        })
        .catch((error) => {
          console.error('login error', error)
          localStorage.removeItem('access_token')
          reject(error)
        })
    })
  }

  initializeApp({
    projectId: 'app-514b35c713e28fcb31fc',
    authDomain: 'app-514b35c713e28fcb31fc.firebaseapp.com',
    apiKey: 'AIzaSyBmrvd67uft_jBntHOvhij49NAudCxxcAI',
  })

  // MAIN PROGRAM
  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.env.access_token() || Date.now() > expired_at)
      await window.env.login()
    try {
      await fetch(`${window.env.API_URL}/users/@me`, {
        headers: { Authorization: `Bearer ${window.env.access_token()}` } })
    } catch {
      await window.env.login()
    }

    const $app = { id: (window.location.search.split('?')[1] || 'index') }
    $app.content = await fetch(`${window.env.API_URL}?${$app.id}`, {
      headers: { Authorization: `Bearer ${window.env.access_token()}` } })
    document.querySelector('#app').innerHTML = await $app.content.text()

    const style = document.createElement('style')
    style.setAttribute('type', 'text/css')
    $app.style = await fetch(`${window.env.API_URL}?${$app.id}&path=style.css`, {
      headers: { Authorization: `Bearer ${window.env.access_token()}` } })
    style.innerHTML = await $app.style.text()
    document.body.appendChild(style)

    const script = document.createElement('script')
    script.setAttribute('type', 'application/javascript')
    $app.script = await fetch(`${window.env.API_URL}?${$app.id}&path=script.js`, {
      headers: { Authorization: `Bearer ${window.env.access_token()}` } })
    script.text = await $app.script.text()
    document.body.appendChild(script)

    // Show #app
    document.querySelector('.markdown-body>div#app').style.display = 'block'
  }, { once: true })
</script>
