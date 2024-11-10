---
title: Login
---

<script src="https://accounts.google.com/gsi/client" async defer></script>
<script type="application/javascript">
window.onload = function () {
  google.accounts.id.initialize({
    client_id: '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com',
    login_uri: 'https://api.felipeandres254.io/login',
    context: 'sign_in',
    ux_mode: 'redirect',
  })
  google.accounts.id.prompt()
}
</script>
