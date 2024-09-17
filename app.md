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

  let access_token = localStorage.getItem('access_token')

  function login() {
    return new Promise((resolve, reject) => {
      signInWithPopup(getAuth(), new GoogleAuthProvider())
        .then((result) => {
          access_token = result.user.accessToken
          localStorage.setItem('access_token', result.user.accessToken)
          resolve(true)
        })
        .catch((error) => {
          console.error('login error', error)
          localStorage.removeItem('access_token')
          access_token = null
          reject(error)
        })
    })
  }

  // MAIN PROGRAM
  document.addEventListener('DOMContentLoaded', async () => {
    if (!access_token)
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
    const script = document.createElement('script')
    script.src = `${API_URL}?${$app.id}&path=script.js`
    document.body.appendChild(script)
  }, { once: true })
</script>