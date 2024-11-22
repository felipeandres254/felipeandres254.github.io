---
title: Login
---

<script src="https://accounts.google.com/gsi/client" async defer></script>
<script type="application/javascript">
window.onload = function () {
  google.accounts.id.initialize({
    client_id: '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com',
    context: 'signin', callback: console.log,
  })
  google.accounts.id.prompt()
}
</script>
