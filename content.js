(async function() {
  let video = null;
  let lastTime = 0;
  let totalWatchedSeconds = 0;

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

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function saveProgress(targetHostOverride = null) {
    if (totalWatchedSeconds < 1) return;

    const activeHost = targetHostOverride || connector.getName();

    const today = getLocalDateString();
    browser.storage.local.get(['watchData'], (result) => {
      const watchData = result.watchData || {};
      if (!watchData[today]) watchData[today] = { totalSeconds: 0, websites: {} };
      if (!watchData[today].websites) watchData[today].websites = {};

      if (!watchData[today].websites[activeHost]) {
        watchData[today].websites[activeHost] = { totalSeconds: 0 }
      };

      if (!watchData[today].websites[activeHost].totalSeconds) {
        watchData[today].websites[activeHost].totalSeconds = 0;
      }

      watchData[today].websites[activeHost].totalSeconds += totalWatchedSeconds;

      // Reset counter and recalculate totals
      totalWatchedSeconds = 0;
      watchData[today].totalSeconds = Object.values(watchData[today].websites).reduce((sum, site) => sum + site.totalSeconds, 0);

      browser.storage.local.set({ watchData });
    });
  }

  function getCurrentTargetLanguage() {
    let currentTargetLanguage = connector.getTargetLanguage();
    isTargetLanguage = (TARGET_LANGUAGE == currentTargetLanguage) || (currentTargetLanguage == "Custom");
    if (targetLanguageToggle) {
      isTargetLanguage = !isTargetLanguage;
    }
  }

  function shouldTrack() {
    let shouldTrack = true;

    getCurrentTargetLanguage();
    if (!isTargetLanguage) {
      shouldTrack = false;
    }

    return shouldTrack;
  }

  async function handleTimeUpdate() {
    //TODO: re-enable the detection of ad that are playing
    //if (!video || video.paused || await sendConnectorMessage('isAdPlaying')) return;
    if (!video || video.paused) return;

    const currentTime = video.currentTime;
    const delta = currentTime - lastTime;

    if (delta > 0 && delta < 2) {
      totalWatchedSeconds += delta;

      const now = Date.now();
      // Only process/save every 1 second to keep performance high
      if (now - lastSaveTime >= 1000) {

        if (isTargetLanguage) {
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
    if (video && !video.paused && shouldTrack()) {
      lastTime = video.currentTime;
      lastSaveTime = Date.now();
    }
    updateIconState();
  }

  function updateIconState() {
    console.log(`Mikan Content: updateIconState: isTargetLanguage: ${isTargetLanguage}`);
    browser.runtime.sendMessage({
      type: 'updateIcon',
      state: isTargetLanguage ? 'active' : 'inactive'
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));
  }

  function handlePlay() {
    if (!video) return;
    lastTime = video.currentTime;
    lastSaveTime = Date.now();


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
    targetLanguageToggle = false;
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

  async function initializeTracker(isWatchPageNbTry = 0) {
    // is watch page means that it can activate on this page
    const isWatchPage = connector.isWatchPage();
    if (!isWatchPage) {
      console.log('Mikan Content: initializeTracker: Not a watch page, skipping');
      if (isWatchPageNbTry < 3) {
        setTimeout(() => initializeTracker(isWatchPageNbTry += 1), 1000); // The page might not be loaded interely
      } else if (isWatchPageNbTry < 6) {
        setTimeout(() => initializeTracker(isWatchPageNbTry += 1), 5000);

      }
      return;
    }

    // is active means that it is active right now
    if (!connector.isActive()) {
      console.log('Mikan, possibly an immersion page, but not yet active');
      setTimeout(initializeTracker, 1000); // retry in one second
      return;
    }

    getCurrentTargetLanguage();// is also called later because maybe here it's too early


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
        isTargetLanguage,
        hasError,
      });

    } else if (message.type === 'toggleForce') {
      targetLanguageToggle = !targetLanguageToggle;
      getCurrentTargetLanguage();
      hasError = false; // If manually toggled, clear any auto-detection error
      updateIconState();
      startTrackingIfPlaying();
      console.log(`Mikan Content: isTargetLanguage after toggle: ${isTargetLanguage}`);
      sendResponse({ success: true, isTargetLanguage });
    }
    return true; // Keep the message channel open for sendResponse
  });
})();
