---
title: Login
---

<style type="text/css">
  #btn-google {
    width: fit-content;
    position: relative;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
<div id="btn-google"></div>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script type="application/javascript">
window.onload = function () {
  google.accounts.id.initialize({
    client_id: '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com',
    context: 'use', callback: onGoogleCredential,
  })
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      const parent = document.getElementById('btn-google')
      google.accounts.id.renderButton(parent, {
        type: 'icon', size: 'large', shape: 'circle',
      })
    }
  })

  function onGoogleCredential(event) {
    console.log(`credential`, event.credential)
  }
}
</script>
