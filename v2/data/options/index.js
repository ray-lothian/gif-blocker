'use strict';

const toast = document.getElementById('toast');

const restore = () => chrome.storage.local.get({
  extensions: ['gif', 'gifv', 'webp']
}, prefs => {
  document.getElementById('extensions').value = prefs.extensions.join(', ');
});
restore();

document.getElementById('save').addEventListener('click', () => {
  const extensions = document.getElementById('extensions').value
    .split(/\s*,\s*/)
    .filter((s, i, l) => s && l.indexOf(s) === i)
    .map(s => s.toLowerCase());
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
