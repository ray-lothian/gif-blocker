'use strict';

const config = {
  regexps: [],
  patterns: []
};

const listen = {
  webRequest: d => {
    if (d.tabId > 0) {
      if (config.regexps.some(f => f.test(d.url))) {
        return {
          redirectUrl: chrome.runtime.getURL('/data/block.svg')
        };
      }
    }
  }
};

function install() {
  chrome.contextMenus.remove('reload-image', () => {
    chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: 'reload-image',
      title: 'Reload this image',
      contexts: ['image'],
      documentUrlPatterns: ['*://*/*'],
      targetUrlPatterns: config.patterns
    });
  });
  chrome.webRequest.onHeadersReceived.addListener(listen.webRequest, {
    urls: ['<all_urls>'],
    types: ['image']
  }, ['blocking']);
  chrome.browserAction.setIcon({
    path: {
      '16': 'data/icons/16.png',
      '32': 'data/icons/32.png',
      '48': 'data/icons/48.png',
      '64': 'data/icons/64.png'
    }
  });
  chrome.browserAction.setTitle({
    title: 'GIF Blocker (enabled)'
  });
}

function remove() {
  chrome.webRequest.onHeadersReceived.removeListener(listen.webRequest);
  chrome.contextMenus.remove('reload-image');
  chrome.browserAction.setIcon({
    path: {
      '16': 'data/icons/disabled/16.png',
      '32': 'data/icons/disabled/32.png',
      '48': 'data/icons/disabled/48.png',
      '64': 'data/icons/disabled/64.png'
    }
  });
  chrome.browserAction.setTitle({
    title: 'GIF Blocker (disabled)'
  });
}

function state(disabled) {
  if (disabled) {
    remove();
  }
  else {
    chrome.storage.local.get({
      extensions: ['gif', 'webp']
    }, prefs => {
      config.regexps = prefs.extensions.map(e => new RegExp('\\.' + e, 'i'));
      config.patterns = prefs.extensions.map(e => '*://*/*.' + e + '*');
      install();
    });
  }
}

chrome.storage.local.get({
  disabled: true
}, prefs => {
  state(prefs.disabled);
});
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.disabled) {
    state(prefs.disabled.newValue);
  }
});

chrome.browserAction.onClicked.addListener(() => {
  chrome.storage.local.get({
    disabled: true
  }, prefs => {
    prefs.disabled = !prefs.disabled;
    chrome.storage.local.set(prefs);
  });
});

function get(url, tabId, frameId) {
  const details = {
    frameId,
    allFrames: false,
    runAt: 'document_start'
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
          window.setTimeout(() => URL.revokeObjectURL(objectURL), 30000);

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
{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '?version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
