import { addTime, getAllData, getDayTotal } from "./indexedDb.js";

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
      "16": `icons/icon16${suffix}.png`,
      "48": `icons/icon48${suffix}.png`,
      "128": `icons/icon128${suffix}.png`
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
  } else if (message.type === "addTime") {
    addTime(message.category, message.date, message.website, message.time);
  } else if (message.type === "getDayTotal") {
    getDayTotal(message.date)
      .then((total) => sendResponse(total));
    return true;
  } else if (message.type === "getAllData") {
    getAllData()
      .then((data) => sendResponse(data));
    return true;
  }
});
