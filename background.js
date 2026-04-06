import { addTime, getAllData, getDayTotal, removeTime } from "./indexedDb.js";

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Service worker - handles extension lifecycle
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Mikan JP Tracker installed');

  // Initialize storage
  browserAPI.storage.local.get(['watchData'], (result) => {
    if (!result.watchData) {
      browserAPI.storage.local.set({ watchData: {} });
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

  browserAPI.action.setIcon({
    tabId: tabId,
    path: {
      "16": `icons/icon16${suffix}.png`,
      "48": `icons/icon48${suffix}.png`,
      "128": `icons/icon128${suffix}.png`
    }
  });
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  } else if (message.type === "removeTime") {
    removeTime(message.category, message.date, message.website, message.time);
  } else if (message.type === "getDayTotal") {
    getDayTotal(message.date)
      .then((total) => sendResponse(total));
    return true;
  } else if (message.type === "getAllData") {
    getAllData()
      .then((data) => sendResponse(data));
    return true;
  } else if (message.type === "getTopHost") {
    const url = new URL(sender.tab.url);
    sendResponse(url.host);
  }
  // Router, a frame is active, tell other frame to stop
  else if (message.type === "broadcastMikanActive" && sender.tab) {
    const tabId = sender.tab.id;
    const sourceFrameId = sender.frameId;

    browserAPI.webNavigation.getAllFrames({ tabId })
      .then((allFrames) => {
        for (const frame of allFrames) {

          if (frame.frameId !== sourceFrameId) {
            browserAPI.tabs.sendMessage(tabId, {
              type: "MikanActive",
            }, { frameId: frame.frameId })
              .catch((e) => console.log("Mikan: error when broadcasting MikanActive:", e));
          }
        }
      });
  }
  return false;
});
