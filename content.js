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

  const siteConnectors = {
    'youtube.com': 'connectors/youtube.js',
    'cijapanese.com': 'connectors/cijapanese.js',
    'reader.ttsu.app': 'connectors/ttsu.js'
  };

  const host = window.location.hostname.replace('www.', '');
  let connectorPath = siteConnectors[host];

  if (!connectorPath) {
    connectorPath = "connectors/any-website.js"
  }

  console.log("Mikan: Connector path: ", connectorPath);

  const moduleUrl = browserAPI.runtime.getURL(connectorPath);
  let module = await import(moduleUrl);
  connector = module.default();

  function saveProgress(time) {
    const activeHost = connector.getName();

    const today = new Date().toISOString().split("T")[0];

    browserAPI.runtime.sendMessage({
      type: 'addTime',
      category: connector.getCategory(),
      date: today,
      website: activeHost,
      time: time
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));
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
    shouldTrack = true;

    getCurrentTargetLanguage();
    refreshIsActive();
    refreshIsWatchPage();
    if (!isTargetLanguage || !isWatchPage || !isActive) {
      shouldTrack = false;
    }
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
          clearInterval(watchStateIntervalId);

          updateIconState();
          checkAndInit();
        }

        refreshShouldTrack();
        refreshIsActive();
        refreshIsWatchPage();

        if (lastShouldTrack != shouldTrack || lastIsActive != isActive || isWatchPage != lastIsWatchPage) {
          refresh();
        }
      },
      3000
    );
  }

  async function initializeTracker() {
    // is watch page means that it can activate on this page
    refreshIsWatchPage();
    // is active means that it is active right now
    refreshIsActive();
    refreshShouldTrack();

    updateIconState();

    watchStateAndRefresh(); // if it becomes disable or become enable, it will refresh

    if (!isWatchPage) {
      console.log('Mikan Content: initializeTracker: Not a watch page, skipping');
      return;
    }

    if (!connector.isActive()) {
      console.log('Mikan, possibly an immersion page, but not yet active');
      return;
    }

    if (!shouldTrack) {
      console.log("Mikan: should not track");
      return;
    }


    updateIconState();
    startTracking();

    console.log('Mikan Content: Tracker initialized successfully.');
  }

  async function checkAndInit() {
    if (!connector) {
      console.log('Mikan Content: Waiting for connector. Status: Connector Ready:', connectorReady);
    }

    await initializeTracker();

    const navigationEvents = connector.getNavigationEvents();
    for (const event of navigationEvents) {
      window.addEventListener(event, () => {
        console.log(`Mikan Content: Navigation event (${event}) detected.`);
        // Reset flags to allow re-initialization on navigation
        targetLanguageToggle = false;
        setTimeout(checkAndInit, 100);
      });
    }
  }

  window.addEventListener('popstate', () => {
    targetLanguageToggle = false;
    setTimeout(checkAndInit, 100);
  });

  let lastUrl = location.href;
  setInterval(() => {
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

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    return true; // Keep the message channel open for sendResponse
  });
})();
