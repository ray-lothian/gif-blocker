'use strict';

const toast = document.getElementById('toast');

const restore = () => chrome.storage.local.get({
  extensions: ['gif', 'webp']
}, prefs => {
  document.getElementById('gif').checked = prefs.extensions.map(s => s.toLowerCase()).indexOf('gif') !== -1;
  document.getElementById('webp').checked = prefs.extensions.map(s => s.toLowerCase()).indexOf('webp') !== -1;
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
    extensions
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
