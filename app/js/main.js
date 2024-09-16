//
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'

const API_URL = 'https://app-74ijiatkua-uc.a.run.app'
const app = initializeApp({
  projectId: 'app-514b35c713e28fcb31fc',
  // appId: "APP_ID",
  // For Firebase JavaScript SDK v7.20.0 and later, `measurementId` is an optional field
  // measurementId: "G-MEASUREMENT_ID",
})

document.addEventListener('DOMContentLoaded', async () => {

signInWithPopup(getAuth(), new GoogleAuthProvider())
  .then((result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result)
    console.log('result', result)
    console.log('credential', credential)
  })
  .catch((error) => {
    console.error('error', error)
  })

})
