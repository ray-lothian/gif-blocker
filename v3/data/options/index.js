'use strict';

const toast = document.getElementById('toast');

const restore = () => chrome.storage.local.get({
  extensions: ['gif', 'webp'],
  css: false,
  video: false
}, prefs => {
  document.getElementById('gif').checked = prefs.extensions.map(s => s.toLowerCase()).includes('gif');
  document.getElementById('webp').checked = prefs.extensions.map(s => s.toLowerCase()).includes('webp');
  document.getElementById('css').checked = prefs.css;
  document.getElementById('video').checked = prefs.video;
});
restore();

document.getElementById('save').addEventListener('click', () => {
  const extensions = [];
  if (document.getElementById('gif').checked) {
    extensions.push('gif');
  }
  if (document.getElementById('webp').checked) {
    extensions.push('webp');
  }
  if (extensions.length === 0) {
    extensions.push('gif', 'webp');
  }
  chrome.storage.local.set({
    extensions,
    css: document.getElementById('css').checked,
    video: document.getElementById('video').checked
  }, () => {
    toast.textContent = 'Options Saved';
    restore();
    window.setTimeout(() => toast.textContent = '', 750);
  });
});
// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
