//
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
        console.log(result)
        access_token = result.user.access_token
        localStorage.setItem('access_token', result.user.access_token)
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

const $app = { id: window.location.search.split('?')[1] }
$app.response = await fetch(`${API_URL}?${$app.id}`, {
  headers: { Authorization: `Bearer ${access_token}` } })
$app.content = await $app.response.text()
console.log($app)

})
