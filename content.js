const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

(async function() {
  let isWatchPage = false;// here so that updateIcon can access it
  let isActive = false;
  let shouldTrack = false;

  let isTargetLanguage = false;
  let targetLanguageToggle = false;

  let hasError = false;

  let connector = null;
  //let connectorName = null;

  const TARGET_LANGUAGE = 'ja';

  const siteConnectors = [
    {
      url: "youtube.com",
      connectorPath: "connectors/youtube.js",
      all_frames: false
    },
    {
      url: "cijapanese.com",
      connectorPath: "connectors/cijapanese.js",
      all_frames: false
    },
    {
      url: "reader.ttsu.app",
      connectorPath: "connectors/ttsu.js",
      all_frames: false
    },
    {
      url: "news.web.nhk",
      connectorPath: "connectors/nhk.js",
      all_frames: false
    },
  ];

  let host;
  try {
    host = window.top.location.hostname.replace('www.', '');
  } catch {
    host = (await browserAPI.runtime.sendMessage({ type: "getTopHost" })).replace('www.', '');
  }
  let connectorInfo = siteConnectors.find((e) => e.url == host);

  if (!connectorInfo) {
    const anyWebsiteInfo = {
      url: host,
      connectorPath: "connectors/any-website.js",
      all_frames: true
    }
    connectorInfo = anyWebsiteInfo;
  }

  if (!connectorInfo.all_frames && window != window.top) {
    console.log("Mikan: not top frame, stopping");
    return;
  }

  console.log("Mikan: Connector: ", connectorInfo);

  const moduleUrl = browserAPI.runtime.getURL(connectorInfo.connectorPath);
  let module = await import(moduleUrl);
  connector = module.default();

  async function saveProgress(time) {
    const activeHost = await connector.getName();

    const today = new Date().toISOString().split("T")[0];

    browserAPI.runtime.sendMessage({
      type: 'addTime',
      category: connector.getCategory(),
      date: today,
      website: activeHost,
      time: time
    }).catch(e => console.error('Mikan Content: Error adding time:', e));
  }

  function getCurrentTargetLanguage() {
    let currentTargetLanguage = isTargetLanguage;
    let connectorTargetLanguage = connector.getTargetLanguage();
    isTargetLanguage = (TARGET_LANGUAGE == connectorTargetLanguage) || (connectorTargetLanguage == "Custom");
    if (targetLanguageToggle) {
      isTargetLanguage = !isTargetLanguage;
    }
    if (currentTargetLanguage != isTargetLanguage) {
      updateIconState();
    }
  }

  function refreshShouldTrack() {

    refreshIsWatchPage();
    if (!isWatchPage) {
      shouldTrack = false;
      return;
    }
    refreshIsActive();
    if (!isActive) {
      shouldTrack = false;
      return;
    }
    getCurrentTargetLanguage();
    if (!isTargetLanguage) {
      shouldTrack = false;
      return;
    }
    shouldTrack = true;
  }


  let trackingIntervalId = undefined;
  function startTracking() {
    connector.resetTime();
    if (trackingIntervalId) {
      clearInterval(trackingIntervalId);
    }
    trackingIntervalId = setInterval(
      () => {
        refreshShouldTrack();
        if (!connector || !shouldTrack) {
          console.log("MIKAN: stop tracking time");
          connector.resetTime();
          clearInterval(trackingIntervalId);
        }

        let time = connector.getTimeSinceLastCall();
        saveProgress(time);
      },
      500
    );
  }

  function updateIconState() {
    let state = "";
    if (isTargetLanguage && isWatchPage) {
      state = "active";
    } else if (!isTargetLanguage && isWatchPage) {
      state = "default";
    } else if (!isWatchPage) {
      state = "inactive";
    } else {
      state = "inactive"
    }

    console.log(`Mikan Content: updateIconState: isTargetLanguage: ${isTargetLanguage}`);
    browserAPI.runtime.sendMessage({
      type: 'updateIcon',
      state: state
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));
  }

  function refreshIsActive() {
    isActive = connector.isActive();
  }
  function refreshIsWatchPage() {
    isWatchPage = connector.isWatchPage();
  }

  let watchStateIntervalId = undefined;
  let lastIsWatchPage = isWatchPage;
  let lastShouldTrack = shouldTrack;
  let lastIsActive = isActive;
  function watchStateAndRefresh() {
    if (watchStateIntervalId) {
      clearInterval(watchStateIntervalId);
    }
    lastIsWatchPage = isWatchPage;
    lastShouldTrack = shouldTrack;
    lastIsActive = isActive;

    watchStateIntervalId = setInterval(
      () => {
        function refresh() {
          console.log("MIKAN: refresh");
          initializeTracker();
        }

        // if we are already tracking, the tracking function is already refreshing
        if (lastShouldTrack !== true) {
          refreshShouldTrack();
        }

        if (lastShouldTrack != shouldTrack || lastIsActive != isActive || isWatchPage != lastIsWatchPage) {
          refresh();
        }
        lastIsWatchPage = isWatchPage;
        lastShouldTrack = shouldTrack;
        lastIsActive = isActive;
      },
      3000
    );
  }

  async function initializeTracker() {
    // reset
    connector.resetTime();
    if (trackingIntervalId) {
      clearInterval(trackingIntervalId);
    }

    updateIconState();

    if (!isWatchPage) {
      console.log('Mikan Content: initializeTracker: Not a watch page, skipping');
      return;
    }

    if (!connector.isActive()) {
      console.log('Mikan, possibly an immersion page, but not yet active');
      return;
    }

    // It's active, prevent other content script in other frames to continue sending to popup or tracking
    browserAPI.runtime.sendMessage({
      type: 'broadcastMikanActive',
    })

    if (!shouldTrack) {
      console.log("Mikan: should not track");
      return;
    }

    const navigationEvents = connector.getNavigationEvents();
    for (const event of navigationEvents) {
      window.addEventListener(event, () => {
        console.log(`Mikan Content: Navigation event (${event}) detected.`);
        // Reset flags to allow re-initialization on navigation
        targetLanguageToggle = false;
        setTimeout(initializeTracker(), 100);
      });
    }

    startTracking();

    console.log('Mikan Content: Tracker initialized successfully.');
  }

  function checkAndInit() {
    if (!connector) {
      console.log('Mikan Content: Waiting for connector. Status: Connector Ready:', connectorReady);
    }

    watchStateAndRefresh(); // if it becomes disable or become enable, it will refresh
  }

  function stop() {
    if (watchStateIntervalId) {
      clearInterval(watchStateIntervalId);
    }
    if (trackingIntervalId) {
      clearInterval(trackingIntervalId);
    }
    if (refreshUrlIntervalId) {
      clearInterval(refreshUrlIntervalId)
    }
    connector.resetTime();
  }

  window.addEventListener('popstate', () => {
    targetLanguageToggle = false;
    setTimeout(checkAndInit, 100);
  });

  let lastUrl = location.href;
  let refreshUrlIntervalId = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      targetLanguageToggle = false;
      setTimeout(checkAndInit, 100);
    }
  }, 500);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
  } else {
    // If connector is already ready (e.g. page load was fast)
    checkAndInit();
  }

  window.addEventListener('beforeunload', saveProgress);

  let respondToMessage = true;
  function browserMessageListener(message, sender, sendResponse) {
    if (!respondToMessage) {
      return false;
    }
    if (message.type === 'getStatus') {
      sendResponse({
        isWatchPage,
        isActive,
        isTargetLanguage,
        hasError,
      });

    } else if (message.type === 'toggleForce') {
      targetLanguageToggle = !targetLanguageToggle;
      getCurrentTargetLanguage();
      hasError = false; // If manually toggled, clear any auto-detection error
      updateIconState();
      initializeTracker();
      console.log(`Mikan Content: isTargetLanguage after toggle: ${isTargetLanguage}`);
      sendResponse({ success: true, isTargetLanguage });
    }
    // If content.js is active in an other frame, stop this script
    else if (message.type === "MikanActive") {
      stop();
      respondToMessage = false;
      browserAPI.runtime.onMessage.removeListener(browserMessageListener);
    }
    return false;
  };

  browserAPI.runtime.onMessage.addListener(browserMessageListener);

})()
