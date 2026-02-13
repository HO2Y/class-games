let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  setInstallButtonVisible(true);
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  setInstallButtonVisible(false);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors for local environments that do not support SW.
    });
  });
}

const installBtn = document.getElementById('installAppBtn');
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setInstallButtonVisible(false);
  });
}

function setInstallButtonVisible(visible) {
  if (!installBtn) {
    return;
  }
  installBtn.hidden = !visible;
}
