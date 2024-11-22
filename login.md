---
title: Login
---

<div id="btn-google"></div>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script type="application/javascript">
window.onload = function () {
  google.accounts.id.initialize({
    client_id: '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com',
    context: 'use', callback: console.log, 
  })
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      const parent = document.getElementById('btn-google')
      google.accounts.id.renderButton(parent, { theme: 'filled_blue' });
    }
  })
}
</script>
