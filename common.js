'use strict';

chrome.webRequest.onHeadersReceived.addListener(d => {
  if (/\.gif/.test(d.url) && d.tabId > 0) {
    return {
      redirectUrl: chrome.runtime.getURL('/data/block.svg')
    };
  }
}, {
  urls: ['<all_urls>'],
  types: ['image']
}, ['blocking']);

chrome.contextMenus.create({
  id: 'reload-image',
  title: 'Reload this image',
  contexts: ['image'],
  documentUrlPatterns: ['*://*/*'],
  targetUrlPatterns: ['*://*/*.gif*']
});

function get(url, tabId, frameId) {
  const details = {
    frameId,
    allFrames: false,
    runAt: 'document_start',
  };
  chrome.tabs.insertCSS(tabId, Object.assign(details, {
    code: `
      @keyframes imgFetching {
        0%   {opacity:1;}
        50%  {opacity:0;}
        100% {opacity:1;}
      }
      [data-fetching=true] {
        animation: imgFetching 0.7s infinite;
      }
    `
  }), () => {
    chrome.tabs.executeScript(tabId, Object.assign(details, {
      code: `{
        [...document.images].filter(i => i.src === '${url}').forEach(i => i.dataset.fetching = true);
      }`
    }), () => {
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const objectURL = URL.createObjectURL(blob);

          chrome.tabs.executeScript(tabId, Object.assign(details, {
            code: `{
              const images = [...document.images].filter(i => i.src === '${url}')
                .forEach(i => {
                  const req = new XMLHttpRequest();
                  req.open('GET', '${objectURL}');
                  req.responseType = 'blob';
                  req.onload = () => {
                    const url = URL.createObjectURL(req.response);
                    i.src = url;
                    i.dataset.fetching = false;
                  };
                  req.onerror = () => {
                    i.dataset.fetching = false;
                  };
                  req.send()
                });
            }`
          }));
        });
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'reload-image') {
    get(info.srcUrl, tab.id, info.frameId);
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': /Firefox/.test(navigator.userAgent) === false
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    chrome.storage.local.set({version}, () => {
      chrome.tabs.create({
        url: 'http://add0n.com/gif-blocker.html?version=' + version +
          '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
      });
    });
  }
});

(function() {
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
})();
