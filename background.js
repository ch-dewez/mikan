// Service worker - handles extension lifecycle
browser.runtime.onInstalled.addListener(() => {
  console.log('Mikan JP Tracker installed');
  
  // Initialize storage
  browser.storage.local.get(['watchData'], (result) => {
    if (!result.watchData) {
      browser.storage.local.set({ watchData: {} });
    }
  });
});

function updateIcon(tabId, state) {
  let suffix = '';
  if (state === 'active') {
    suffix = '-active';
  } else if (state === 'inactive') {
    suffix = '-inactive';
  } else if (state === 'error') {
    suffix = '-error';
  }
  
  browser.action.setIcon({
    tabId: tabId,
    path: {
      "16": `icon16${suffix}.png`,
      "48": `icon48${suffix}.png`,
      "128": `icon128${suffix}.png`
    }
  });
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateIcon') {
    if (sender.tab) {
      // Message from content script
      updateIcon(sender.tab.id, message.state);
    } else if (message.tabId) {
      // Message from popup with explicit tabId
      updateIcon(message.tabId, message.state);
    }
  }
});