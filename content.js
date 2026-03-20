(async function() {
  let video = null;
  let lastTime = 0;
  let totalWatchedSeconds = 0;

  let isWatchPage = false;// here so that updateIcon can access it
  let isActive = false;
  let shouldTrack = false;

  let isTargetLanguage = false;
  let targetLanguageToggle = false;

  let lastSaveTime = 0;
  let hasError = false;

  let connector = null;
  //let connectorName = null;

  const TARGET_LANGUAGE = 'ja';

  const siteConnectors = {
    'youtube.com': 'connectors/youtube.js',
    'cijapanese.com': 'connectors/cijapanese.js',
  };

  const host = window.location.hostname.replace('www.', '');
  let connectorPath = siteConnectors[host];

  if (!connectorPath) {
    connectorPath = "connectors/any-website.js"
  }

  console.log("Mikan: Connector path: ", connectorPath);

  const moduleUrl = browser.runtime.getURL(connectorPath);
  let module = await import(moduleUrl);
  connector = module.default();

  function saveProgress(targetHostOverride = null) {
    if (totalWatchedSeconds < 1) return;

    const activeHost = targetHostOverride || connector.getName();

    const today = new Date().toISOString().split("T")[0];

    browser.runtime.sendMessage({
      type: 'addTime',
      category: connector.getCategory(),
      date: today,
      website: activeHost,
      time: totalWatchedSeconds
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));

    totalWatchedSeconds = 0;
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
    if (!isTargetLanguage) {
      shouldTrack = false;
    }
  }

  async function handleTimeUpdate() {
    //TODO: re-enable the detection of ad that are playing
    //if (!video || video.paused || await sendConnectorMessage('isAdPlaying')) return;
    if (!video || video.paused || !shouldTrack) return;

    const currentTime = video.currentTime;
    const delta = currentTime - lastTime;

    if (delta > 0 && delta < 2) {
      totalWatchedSeconds += delta;

      const now = Date.now();
      // Only process/save every 1 second to keep performance high
      if (now - lastSaveTime >= 1000) {

        if (shouldTrack) {
          saveProgress();
        }
        else {
          totalWatchedSeconds = 0;
        }
        lastSaveTime = now;
      }
    }
    lastTime = currentTime;
  }

  function startTrackingIfPlaying() {
    refreshShouldTrack();
    if (video && !video.paused && shouldTrack) {
      lastTime = video.currentTime;
      lastSaveTime = Date.now();
    }
    updateIconState();
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
    browser.runtime.sendMessage({
      type: 'updateIcon',
      state: state
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));
  }

  function handlePlay() {
    if (!video) return;
    startTrackingIfPlaying();
  }

  function handlePause() {
    saveProgress();
  }

  function handleSeeked() {
    lastTime = video.currentTime;
  }

  async function resetForNewVideo() {
    if (totalWatchedSeconds > 0) {
      saveProgress();
    }

    totalWatchedSeconds = 0;
    lastTime = 0;
    lastSaveTime = 0;
    isTargetLanguage = false;
  }

  function attachVideoListeners(videoElement) {
    if (!videoElement) {
      console.log('Mikan Content: attachVideoListeners: No video element provided.');
      return;
    }

    if (video && video !== videoElement) {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
    }

    video = videoElement;

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
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

          resetForNewVideo();
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

    resetForNewVideo();

    const videoElement = connector.getVideoElement();

    if (videoElement) {
      attachVideoListeners(videoElement);
      lastTime = video.currentTime;

      updateIconState();
      startTrackingIfPlaying();

      console.log('Mikan Content: Tracker initialized successfully.');
    } else {
      console.log('Mikan Content: No video element found, will retry initialization.');
      setTimeout(initializeTracker, 200); // Retry if video element not found yet
    }
  }

  async function checkAndInit() {
    if (!connector) {
      console.log('Mikan Content: Waiting for connector and/or video element. Status: Connector Ready:', connectorReady);
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

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
