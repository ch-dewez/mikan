(function() {
  let video = null;
  let lastTime = 0;
  let totalWatchedSeconds = 0;
  let isTargetLanguage = false;
  let currentVideoId = null;
  let lastSaveTime = 0;
  let hasError = false;
  let detectionDone = false;
  let connectorReady = false;
  let videoElementReady = false; //TODO: is it really necessary, maybe remove this flag (that was added by ai)
  let connectorHost = null;

  let alwaysCheckConnectorLoaded = false; // Are the always Check Connector loaded
  let awaysCheckConnectorActive = false;


  const TARGET_LANGUAGE = 'ja';

  const siteConnectors = {
    'youtube.com': 'connectors/youtube.js',
    'cijapanese.com': 'connectors/cijapanese.js',
  };

  // thing like asbplayer -> if present then check
  // TODO: Adding multiple always check connectors might break the messaging system
  const alwaysCheckConnectors = [
    'connectors/asbplayer.js'
  ]

  const host = window.location.hostname.replace('www.', '');
  const connectorPath = siteConnectors[host];

  console.log("Mikan: Connector path: ", connectorPath);

  if (!connectorPath) {
    alwaysCheckConnectorLoaded = true;
    for (let i = 0; i < alwaysCheckConnectors.length; i++) {
      injectScript(alwaysCheckConnectors[i]);
    }
  } else {
    injectScript(connectorPath);
  }

  function injectScript(path) {
    console.log("injecting " + path);
    const s = document.createElement('script');
    s.src = browser.runtime.getURL(path);
    document.documentElement.appendChild(s);
  }

  // Promise-based message sending to the connector
  function sendConnectorMessage(requestType, payload = {}) {
    return new Promise((resolve) => {
      const messageId = `mikan_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const handler = (event) => {
        if (event.data?.type === 'MIKAN_RESPONSE_DATA' && event.data.messageId === messageId) {
          window.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'MIKAN_REQUEST_DATA', request: requestType, messageId, payload }, '*');
    });
  }

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'MIKAN_CONNECTOR_READY') {
      console.log(`Mikan Content: Connector ready for ${event.data.host}`);
      connectorReady = true;
      connectorHost = event.data.host;
      // init() will be called when videoElementReady is also true
      checkAndInit();
    }

    if (event.data?.type === 'MIKAN_VIDEO_ELEMENT_READY') {
      console.log('Mikan Content: Video element signaled as ready by connector.');
      videoElementReady = true;
      checkAndInit();
    }
  });


  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function saveProgress(targetHostOverride = null) {
    if (totalWatchedSeconds < 1) return;

    const activeHost = targetHostOverride || connectorHost;

    const today = getLocalDateString();
    browser.storage.local.get(['watchData'], (result) => {
      const watchData = result.watchData || {};
      if (!watchData[today]) watchData[today] = { totalSeconds: 0, websites: {} };
      if (!watchData[today].websites) watchData[today].websites = {};

      if (!watchData[today].websites[activeHost]) {
        watchData[today].websites[activeHost] = { totalSeconds: 0, videos: {} };
      }

      if (!watchData[today].websites[activeHost].videos[currentVideoId]) {
        watchData[today].websites[activeHost].videos[currentVideoId] = 0;
      }

      watchData[today].websites[activeHost].videos[currentVideoId] += totalWatchedSeconds;

      // Reset counter and recalculate totals
      totalWatchedSeconds = 0;
      watchData[today].websites[activeHost].totalSeconds = Object.values(watchData[today].websites[activeHost].videos).reduce((a, b) => a + b, 0);
      watchData[today].totalSeconds = Object.values(watchData[today].websites).reduce((sum, site) => sum + site.totalSeconds, 0);

      browser.storage.local.set({ watchData });
    });
  }

  async function getCurrentTargetLanguage() {
    let currentTargetLanguage = await sendConnectorMessage('getTargetLanguage');
    console.log("Current Target Language : ", currentTargetLanguage);
    isTargetLanguage = (TARGET_LANGUAGE == currentTargetLanguage) || (currentTargetLanguage == "Custom");
  }

  async function shouldTrack() {
    let shouldTrack = true;

    getCurrentTargetLanguage();
    if (!isTargetLanguage) {
      shouldTrack = false;
    }
    console.log(`Mikan Content: shouldTrack: ${shouldTrack} (isTargetLanguage: ${isTargetLanguage})`);

    return shouldTrack;
  }

  async function handleTimeUpdate() {
    //TODO: re-enable the detection if ad that are playing
    //if (!video || video.paused || await sendConnectorMessage('isAdPlaying')) return;
    if (!video || video.paused) return;

    const currentTime = video.currentTime;
    const delta = currentTime - lastTime;

    if (delta > 0 && delta < 2) {
      totalWatchedSeconds += delta;

      const now = Date.now();
      // Only process/save every 1 second to keep performance high
      if (now - lastSaveTime >= 1000) {

        if (isTargetLanguage && connectorHost) {
          saveProgress(connectorHost);
        }
        else {
          // idf if this is even reachable (
          totalWatchedSeconds = 0;
        }
        lastSaveTime = now;
      }
    }
    lastTime = currentTime;
  }

  async function startTrackingIfPlaying() {
    if (video && !video.paused && await shouldTrack()) {
      lastTime = video.currentTime;
      lastSaveTime = Date.now();
      console.log('Mikan Content: Video already playing, starting to track');
    }
  }

  async function runDetection(retryCount = 0) {
    updateIconState();
    startTrackingIfPlaying();
  }

  function updateIconState() {
    console.log(`Mikan Content: updateIconState: isTargetLanguage: ${isTargetLanguage}`);
    browser.runtime.sendMessage({
      type: 'updateIcon',
      state: isTargetLanguage ? 'active' : 'inactive'
    }).catch(e => console.error('Mikan Content: Error sending updateIcon message:', e));
  }

  function handlePlay() {
    console.log('Mikan Content: Video play event.');
    if (!video) return;
    lastTime = video.currentTime;
    lastSaveTime = Date.now();


    updateIconState();
    startTrackingIfPlaying();

    console.log('Mikan Content: Video playing, tracking:', shouldTrack());
  }

  function handlePause() {
    console.log('Mikan Content: Video pause event.');
    saveProgress();
    console.log('Mikan Content: Video paused, progress saved');
  }

  function handleSeeked() {
    console.log('Mikan Content: Video seeked event.');
    lastTime = video.currentTime;
  }

  async function resetForNewVideo(newVideoId) {
    console.log(`Mikan Content: resetForNewVideo called for ${newVideoId}. Old currentVideoId: ${currentVideoId}`);
    if (currentVideoId && totalWatchedSeconds > 0) {
      saveProgress();
    }

    console.log(`Mikan Content: New video detected: ${newVideoId}`);

    currentVideoId = newVideoId;
    totalWatchedSeconds = 0;
    lastTime = 0;
    lastSaveTime = 0;
    detectionDone = false;
    isTargetLanguage = false;
  }

  function attachVideoListeners(videoElement) {
    console.log('Mikan Content: attachVideoListeners called.');
    if (!videoElement) {
      console.log('Mikan Content: attachVideoListeners: No video element provided.');
      return;
    }

    if (video && video !== videoElement) {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      console.log('Mikan Content: Removed listeners from old video element');
    }

    video = videoElement;

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    console.log('Mikan Content: Attached listeners to video, paused:', video.paused, 'currentTime:', video.currentTime);
  }

  async function initializeTracker() {
    // is watch page means that it can activate on this page
    console.log('Mikan Content: initializeTracker called.');
    const isWatchPage = await sendConnectorMessage('isWatchPage');
    console.log('Mikan Content: isWatchPage:', isWatchPage);
    if (!isWatchPage) {
      console.log('Mikan Content: initializeTracker: Not a watch page, skipping');
      return;
    }

    // is active means that it is active right now
    if (!await sendConnectorMessage("isActive")) {
      console.log('Mikan, possibly an immersion page, but not yet active');
      setTimeout(initializeTracker, 1000); // retry in one second
      return;
    }

    getCurrentTargetLanguage();// is also called later because maybe here it's too early

    const newVideoId = await sendConnectorMessage('getVideoId');
    console.log('Mikan Content: newVideoId from connector:', newVideoId);
    if (!newVideoId) {
      console.log('Mikan Content: initializeTracker: No video ID found');
      return;
    }

    if (newVideoId !== currentVideoId) {
      resetForNewVideo(newVideoId);
    }

    const videoElement = document.querySelector('video'); // Now this should be reliable due to MIKAN_VIDEO_ELEMENT_READY

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
    console.log(`Mikan Content: checkAndInit called. connectorReady: ${connectorReady}, videoElementReady: ${videoElementReady}`);
    if (connectorReady && videoElementReady) {
      console.log('Mikan Content: Both connector and video element are ready. Initializing tracker.');
      await initializeTracker();

      const navigationEvents = await sendConnectorMessage('getNavigationEvents');
      console.log('Mikan Content: Attaching navigation event listeners:', navigationEvents);
      for (const event of navigationEvents) {
        window.addEventListener(event, () => {
          console.log(`Mikan Content: Navigation event (${event}) detected.`);
          // Reset flags to allow re-initialization on navigation
          detectionDone = false;
          videoElementReady = false;
          setTimeout(checkAndInit, 100);
        });
      }

      window.addEventListener('popstate', () => {
        console.log('Mikan Content: Popstate detected.');
        detectionDone = false;
        videoElementReady = false;
        setTimeout(checkAndInit, 100);
      });

      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          console.log('Mikan Content: URL change detected via polling.');
          detectionDone = false;
          videoElementReady = false;
          setTimeout(checkAndInit, 100);
        }
      }, 500);
    } else {
      console.log('Mikan Content: Waiting for connector and/or video element. Status: Connector Ready:', connectorReady, 'Video Element Ready:', videoElementReady);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
  } else {
    // If connector is already ready (e.g. page load was fast)
    checkAndInit();
  }

  window.addEventListener('beforeunload', saveProgress);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Mikan Content: Message received from background/popup:', message);
    if (message.type === 'getStatus') {
      sendResponse({
        isTargetLanguage,
        currentVideoId,
        hasError,
        host: connectorHost, // Include host for popup to make decisions
      });

    } else if (message.type === 'toggleForce') {
      console.log(`Mikan Content: toggleForce message received. Current isTargetLanguage: ${isTargetLanguage}`);
      isTargetLanguage = !isTargetLanguage;
      hasError = false; // If manually toggled, clear any auto-detection error
      updateIconState();
      startTrackingIfPlaying();
      console.log(`Mikan Content: isTargetLanguage after toggle: ${isTargetLanguage}`);
      sendResponse({ success: true, isTargetLanguage });
    }
    return true; // Keep the message channel open for sendResponse
  });
})();
