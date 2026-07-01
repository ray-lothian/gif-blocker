const state = () => chrome.storage.local.get({
  disabled: false,
  extensions: ['gif', 'webp']
}, prefs => {
  if (prefs.disabled) {
    chrome.action.setIcon({
      path: {
        '16': 'data/icons/disabled/16.png',
        '32': 'data/icons/disabled/32.png',
        '48': 'data/icons/disabled/48.png'
      }
    });
    chrome.action.setTitle({
      title: 'GIF Blocker (disabled)'
    });
    chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['ruleset_gif', 'ruleset_webp']
    });
    chrome.declarativeNetRequest.getSessionRules().then(rules => chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: rules.map(r => r.id)
    }));
    chrome.contextMenus.remove('reload-image');
  }
  else {
    chrome.action.setIcon({
      path: {
        '16': 'data/icons/16.png',
        '32': 'data/icons/32.png',
        '48': 'data/icons/48.png'
      }
    });
    chrome.action.setTitle({
      title: 'GIF Blocker (enabled)'
    });
    const enableRulesetIds = prefs.extensions.map(s => 'ruleset_' + s)
      .filter(r => ['ruleset_gif', 'ruleset_webp'].indexOf(r) !== -1)
      .filter((s, i, l) => l.indexOf(s) === i);
    const disableRulesetIds = ['ruleset_gif', 'ruleset_webp'].filter(s => enableRulesetIds.indexOf(s) === -1);

    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds,
      disableRulesetIds
    });
    chrome.contextMenus.create({
      id: 'reload-image',
      title: 'Show this Image',
      contexts: ['image'],
      documentUrlPatterns: ['*://*/*'],
      targetUrlPatterns: prefs.extensions.map(e => '*://*/*.' + e.toLowerCase() + '*')
    }, () => chrome.runtime.lastError);
  }
});

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;
    state();
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}
chrome.storage.onChanged.addListener(ps => {
  if ('disabled' in ps || 'extensions' in ps) {
    state();
  }
});

chrome.action.onClicked.addListener(() => chrome.storage.local.get({
  disabled: false
}, prefs => chrome.storage.local.set({
  disabled: !prefs.disabled
})));

{
  const once = async () => {
    if (once.done) {
      return;
    }
    once.done = true;

    const prefs = await chrome.storage.local.get({
      css: false,
      video: false
    });
    chrome.contextMenus.create({
      id: 'pref-css',
      title: 'Block "CSS" animation',
      contexts: ['action'],
      type: 'checkbox',
      checked: prefs.css
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'pref-video',
      title: 'Pause video playing',
      contexts: ['action'],
      type: 'checkbox',
      checked: prefs.video
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'clear-network-rules',
      title: 'Clear networks rules',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
  };
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}

chrome.storage.onChanged.addListener(ps => {
  if ('css' in ps) {
    chrome.contextMenus.update('pref-css', {
      checked: ps.css.newValue
    });
  }
  if ('video' in ps) {
    chrome.contextMenus.update('pref-video', {
      checked: ps.video.newValue
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'clear-network-rules') {
    chrome.declarativeNetRequest.getSessionRules().then(rules => {
      if (rules.length) {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: rules.map(r => r.id)
        });
      }
    });
  }
  else if (info.menuItemId === 'reload-image') {
    const rules = await chrome.declarativeNetRequest.getSessionRules();

    chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        'id': rules.length + 1,
        'priority': 2,
        'action': {
          'type': 'allow'
        },
        'condition': {
          'urlFilter': info.srcUrl,
          'resourceTypes': ['image']
        }
      }]
    });

    await chrome.scripting.insertCSS({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      css: `
        @keyframes imgFetching {
          0%   {opacity:1;}
          50%  {opacity:0;}
          100% {opacity:1;}
        }
        [data-fetching=true] {
          animation: imgFetching 0.7s infinite;
        }
      `
    });
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId]
      },
      func: src => {
        const images = [...document.images];
        try {
          images.push(...document.querySelectorAll(`source[srcset="${src}"]`));
        }
        catch (e) {}
        images.filter(i => i.src === src || i.srcset === src).forEach(i => {
          if (i.src === src) {
            i.dataset.fetching = true;
            i.addEventListener('load', () => delete i.dataset.fetching);
            i.src = i.src + (i.src.indexOf('?') === -1 ? '?' : '&') + Math.random();
          }
          if (i.srcset === src) {
            i.srcset = i.srcset + (i.srcset.indexOf('?') === -1 ? '?' : '&') + Math.random();
          }
        });
      },
      args: [info.srcUrl]
    });
  }
  else if (info.menuItemId === 'pref-css' || info.menuItemId === 'pref-video') {
    chrome.storage.local.set({
      [info.menuItemId.replace('pref-', '')]: info.checked
    });
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
