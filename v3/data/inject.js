document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    disabled: false,
    css: false
  }, prefs => {
    if (prefs.disabled === false && prefs.css) {
      for (const animation of document.getAnimations({subtree: true})) {
        animation.cancel();
      }
    }
  });
});

chrome.storage.local.get({
  video: false,
  disabled: false
}, prefs => {
  if (prefs.video && prefs.disabled === false) {
    const map = new WeakMap();

    document.addEventListener('play', e => {
      if (e.target.tagName === 'VIDEO' && e.target.paused === false) {
        if (map.get(e.target) !== true) {
          map.set(e.target, true);
          e.target.pause();
        }
      }
    }, true);
  }
});
