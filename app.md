<div id="app"></div>

<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'
  import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'

  const API_URL = 'https://app-74ijiatkua-uc.a.run.app'
  initializeApp({
    projectId: 'app-514b35c713e28fcb31fc',
    authDomain: 'app-514b35c713e28fcb31fc.firebaseapp.com',
    apiKey: 'AIzaSyBmrvd67uft_jBntHOvhij49NAudCxxcAI',
  })

  let [expired_at, access_token] = (localStorage.getItem('access_token') || '0,').split(',')
  expired_at = parseInt(expired_at) || 0

  function login() {
    localStorage.removeItem('access_token')
    access_token = null
    expired_at = -1
    return new Promise((resolve, reject) => {
      signInWithPopup(getAuth(), new GoogleAuthProvider())
        .then((result) => {
          expired_at = 1000*JSON.parse(atob(result.user.accessToken.split('.')[1])).exp
          access_token = result.user.accessToken
          localStorage.setItem('access_token', `${expired_at},${result.user.accessToken}`)
          resolve(true)
        })
        .catch((error) => {
          console.error('login error', error)
          localStorage.removeItem('access_token')
          access_token = null
          expired_at = -1
          reject(error)
        })
    })
  }

  // MAIN PROGRAM
  document.addEventListener('DOMContentLoaded', async () => {
    if (!access_token || Date.now() > expired_at)
      await login()
    try {
      await fetch(API_URL, {
        headers: { Authorization: `Bearer ${access_token}` } })
    } catch {
      await login()
    }

    const $app = { id: window.location.search.split('?')[1] }
    $app.content = await fetch(`${API_URL}?${$app.id}`, {
      headers: { Authorization: `Bearer ${access_token}` } })
    document.querySelector('#app').innerHTML = await $app.content.text()

    const style = document.createElement('style')
    style.setAttribute('type', 'text/css')
    $app.style = await fetch(`${API_URL}?${$app.id}&path=style.css`, {
      headers: { Authorization: `Bearer ${access_token}` } })
    style.text = await $app.style.text()
    document.body.appendChild(style)

    const script = document.createElement('script')
    script.setAttribute('type', 'application/javascript')
    $app.script = await fetch(`${API_URL}?${$app.id}&path=script.js`, {
      headers: { Authorization: `Bearer ${access_token}` } })
    script.text = await $app.script.text()
    document.body.appendChild(script)
  }, { once: true })
</script>
