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
    chrome.contextMenus.removeAll();
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
    console.log(enableRulesetIds, disableRulesetIds);
    chrome.contextMenus.create({
      id: 'reload-image',
      title: 'Show this Image',
      contexts: ['image'],
      documentUrlPatterns: ['*://*/*'],
      targetUrlPatterns: prefs.extensions.map(e => '*://*/*.' + e.toLowerCase() + '*')
    }, () => chrome.runtime.lastError);
  }
});

chrome.runtime.onInstalled.addListener(state);
chrome.runtime.onStartup.addListener(state);
chrome.storage.onChanged.addListener(state);

chrome.action.onClicked.addListener(() => chrome.storage.local.get({
  disabled: false
}, prefs => chrome.storage.local.set({
  disabled: !prefs.disabled
})));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'reload-image') {
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
