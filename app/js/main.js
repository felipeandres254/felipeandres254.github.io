//
import router from './router.js'

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
      })
    })
  }
  config.headers.Authorization = `Bearer ${access_token.value}`
  return config
})

Vue.createApp({
  //
}).use(router).mount('#app')
