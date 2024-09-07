//
import router from './router.js'

const CLIENT_ID = '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com'
const SCRIPT_ID = 'AKfycbxZRwM-SIMNN_vA_P2k1UxRV4iIWNum9CCigujzaZPg'

window.$axios = axios.create({
  withCredentials: false,
  method: 'POST',
  baseUrl: `https://script.googleapis.com/v1/scripts/${SCRIPT_ID}:run`,
  headers: { 'Content-Type': 'application/json' },
})
$axios.interceptors.request.use(async (config) => {
  let access_token = JSON.parse(localStorage.getItem('access_token') || '{}')
  if (!access_token) {
    await new Promise((resolve, reject) => {
      google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.profile \
                https://www.googleapis.com/auth/userinfo.email',
        callback: function(response) {
          console.log(response)
          access_token.value = response.access_token
          localStorage.setItem('access_token', JSON.stringify(access_token))
          resolve()
        },
        error_callback: (type) => { reject(type) },
      }).requestAccessToken()
    })
  }
  config.headers.Authorization = `Bearer ${access_token.value}`
  return config
})

Vue.createApp({
  //
}).use(router).mount('#app')
