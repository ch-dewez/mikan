(function() {
  let video = null;
  let lastTime = 0;
  let totalWatchedSeconds = 0;
  let isTargetLanguage = false;
  let currentVideoId = null;
  let lastSaveTime = 0;
  let hasError = false;
  let detectionDone = false;
  let lastDetectedTitle = '';
  let pendingDetectionVideoId = null;
  let interceptedVideoData = {};
  let connectorReady = false;
  let videoElementReady = false; // New flag for video element status
  let connectorHost = null;
  let connectorForcesJapanese = false;

  const TARGET_LANGUAGE = 'ja';

  const siteConnectors = {
    'youtube.com': 'connectors/youtube.js',
    'cijapanese.com': 'connectors/cijapanese.js',
  };

  const host = window.location.hostname.replace('www.', '');
  const connectorPath = siteConnectors[host];

  if (!connectorPath) {
    console.log(`Mikan Content: No connector found for ${host}`);
    return;
  }

  // Inject the connector script
  const script = document.createElement('script');
  script.src = browser.runtime.getURL(connectorPath);
  document.documentElement.appendChild(script);

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

  function injectAPIInterceptor() {
    if (document.querySelector('script[data-mikan-interceptor]')) {
      console.log('Mikan Content: API interceptor already injected.');
      return;
    }
    
    console.log('Mikan Content: Injecting API interceptor script.');
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('connectors/youtube-api-reader.js');
    script.dataset.mikanInterceptor = 'true';
    document.documentElement.appendChild(script);
  }

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'MIKAN_CONNECTOR_READY') {
      console.log(`Mikan Content: Connector ready for ${event.data.host}`);
      connectorReady = true;
      connectorHost = event.data.host;
      connectorForcesJapanese = event.data.forceJapanese || false; // Store the forceJapanese flag
      // init() will be called when videoElementReady is also true
      checkAndInit();
    }

    if (event.data?.type === 'MIKAN_VIDEO_ELEMENT_READY') {
      console.log('Mikan Content: Video element signaled as ready by connector.');
      videoElementReady = true;
      checkAndInit();
    }

    if (event.data?.type === 'MIKAN_INJECT_API_INTERCEPTOR') {
      console.log('Mikan Content: Received request to inject API interceptor.');
      injectAPIInterceptor();
    }

  	if (event.data?.type === 'MIKAN_VIDEO_DATA') {
  		console.log('Mikan Content: Received video data from interceptor:', event.data);
  		interceptedVideoData[event.data.videoId] = {
  		  title: event.data.title,
  		  channelName: event.data.channelName,
  		  captionLanguages: event.data.captionLanguages
  		};
  		
  		// If we're waiting on detection for this video, trigger it now!
  		if (pendingDetectionVideoId === event.data.videoId && !detectionDone) {
  		  console.log('Mikan Content: Video data arrived for pending video, running detection now!');
  		  runDetectionNow();
  		}
  	}
  });

  function detectLanguage(videoId) {
    console.log(`Mikan Content: === Detection Start for ${videoId} ===`);
    
    let title = '';
    let channelName = '';
    let captionLanguages = [];
    let hasJapaneseCaptions = false;

    // Check for Japanese subtitle tracks directly in the DOM
    const trackElements = document.querySelectorAll('video track');
    const domCaptionLanguages = Array.from(trackElements)
      .filter(track => track.kind === 'captions' || track.kind === 'subtitles')
      .map(track => track.srclang || track.label.toLowerCase())
      .filter(lang => lang.includes('ja')); // Check for 'ja' or 'ja-JP' etc.
    if (domCaptionLanguages.length > 0) {
      captionLanguages = [...new Set([...captionLanguages, ...domCaptionLanguages])];
      hasJapaneseCaptions = true;
      console.log(`Mikan Content: Detected Japanese captions from DOM track elements: ${domCaptionLanguages.join(', ')}`);
    }

    // Use intercepted data as primary source
    if (interceptedVideoData[videoId]) {
      const data = interceptedVideoData[videoId];
      title = data.title;
      channelName = data.channelName;
      // Merge caption languages from interceptor and DOM
      captionLanguages = [...new Set([...captionLanguages, ...data.captionLanguages])];
      if (captionLanguages.includes('ja')) hasJapaneseCaptions = true;
      
      console.log(`Mikan Content: Using intercepted data`);
      console.log(`Mikan Content: Title: "${title}"`);
      console.log(`Mikan Content: Channel: "${channelName}"`);
      console.log(`Mikan Content: Captions: [${captionLanguages.join(', ')}]`);
    } else {
      console.log(`Mikan Content: No intercepted data available, falling back to DOM`);
      // Fallback using direct DOM access (less reliable/robust than connector)
      const isShorts = window.location.pathname.includes('/shorts');
      
      if (isShorts) {
        title = document.title.replace(' - YouTube', '').trim();
        const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
        if (activeReel) {
          const channelEl = activeReel.querySelector('a.yt-core-attributed-string__link[href*="/@"]');
          channelName = channelEl?.textContent?.trim() || '';
        }
      } else {
        const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
        title = titleElement?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();
        const channelElement = document.querySelector('#channel-name yt-formatted-string a');
        channelName = channelElement?.textContent?.trim() || '';
      }
      
      console.log(`Mikan Content: Title from DOM: "${title}"`);
      console.log(`Mikan Content: Channel from DOM: "${channelName}"`);
    }

    // Analyze Japanese content
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    const hiraganaKatakana = (title.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const kanji = (title.match(/[\u4E00-\u9FAF]/g) || []).length;
    const totalJapanese = hiraganaKatakana + kanji;
    const titleLength = title.length;
    
    const hasKana = hiraganaKatakana > 0;
    const japaneseRatio = titleLength > 0 ? totalJapanese / titleLength : 0;
    const channelHasKana = japaneseRegex.test(channelName);

    let isJapanese = false;
    let reason = '';

    // Japanese captions = definitely Japanese
    if (hasJapaneseCaptions) {
    isJapanese = true;
    reason = `Japanese captions found [${captionLanguages.join(', ')}]`;
    }
    // No Japanese captions (or no captions at all) = use heuristics
    else if (hasKana && japaneseRatio > 0.3) {
    isJapanese = true;
    reason = `Heuristics: Has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars (>30% threshold)`;
    } else if (channelHasKana && japaneseRatio > 0.1) {
    isJapanese = true;
    reason = `Heuristics: Channel has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars (>10% threshold)`;
    } else {
    isJapanese = false;
    reason = `Heuristics: ${(japaneseRatio * 100).toFixed(0)}% Japanese chars, hasKana=${hasKana}, channelHasKana=${channelHasKana}`;
    }

    console.log(`Mikan Content: --- Detection Summary ---`);
    console.log(`Mikan Content: Title: "${title}"`);
    console.log(`Mikan Content: Channel: "${channelName}"`);
    console.log(`Mikan Content: Captions: ${captionLanguages.length > 0 ? `[${captionLanguages.join(', ')}]` : 'none found'}`);
    console.log(`Mikan Content: Japanese chars: ${totalJapanese}/${titleLength} (${(japaneseRatio * 100).toFixed(0)}%) - Kana: ${hiraganaKatakana}, Kanji: ${kanji}`);
    console.log(`Mikan Content: Result: ${isJapanese ? 'JAPANESE' : 'NOT JAPANESE'}`);
    console.log(`Mikan Content: Reason: ${reason}`);
    console.log(`Mikan Content: === Detection End ===`);
    
    return isJapanese;
  }

  function isAdPlaying() {
    const isAd = !!(
      document.querySelector('.ad-showing') ||
      document.querySelector('.ytp-ad-player-overlay') ||
      document.querySelector('.ytp-ad-text')
    );
    if (isAd) console.log('Mikan Content: Ad detected.');
    return isAd;
  }

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function saveProgress() {
    console.log(`Mikan Content: saveProgress called. totalWatchedSeconds: ${totalWatchedSeconds}`);
    if (totalWatchedSeconds < 1) return;
    
    if (!browser.runtime?.id) {
      console.log('Mikan Content: Extension context invalidated, skipping save');
      return;
    }

    const today = getLocalDateString();

    browser.storage.local.get(['watchData'], (result) => {
      if (browser.runtime.lastError) {
        console.log('Mikan Content: Storage error:', browser.runtime.lastError);
        return;
      }
      
      const watchData = result.watchData || {};
    
      if (!watchData[today]) {
        watchData[today] = { totalSeconds: 0, videos: {}, websites: {} };
      }
      
      // Ensure the websites object exists
      if (!watchData[today].websites) {
        watchData[today].websites = {};
      }
      
      // Ensure the current connectorHost entry exists
      if (!watchData[today].websites[connectorHost]) {
        watchData[today].websites[connectorHost] = { totalSeconds: 0, videos: {} };
      }
    
      if (!watchData[today].websites[connectorHost].videos[currentVideoId]) {
        watchData[today].websites[connectorHost].videos[currentVideoId] = 0;
      }
    
      const previouslyStored = watchData[today].websites[connectorHost].videos[currentVideoId];
      watchData[today].websites[connectorHost].videos[currentVideoId] = previouslyStored + totalWatchedSeconds;
    
      totalWatchedSeconds = 0;
      lastTime = video ? video.currentTime : 0;
      
      // Recalculate total for this website
      watchData[today].websites[connectorHost].totalSeconds = Object.values(watchData[today].websites[connectorHost].videos)
        .reduce((sum, secs) => sum + secs, 0);
    
      // Recalculate overall total for the day
      watchData[today].totalSeconds = Object.values(watchData[today].websites)
        .reduce((sum, websiteData) => sum + websiteData.totalSeconds, 0);
    
      browser.storage.local.set({ watchData });
      console.log('Mikan Content: Progress saved:', watchData);
    });
  }

  function shouldTrack() {
    const track = isTargetLanguage;
    console.log(`Mikan Content: shouldTrack: ${track} (isTargetLanguage: ${isTargetLanguage})`);
    return track;
  }

  function handleTimeUpdate() {
    // console.log('Mikan Content: handleTimeUpdate called.');
    if (!video) {
      console.log('Mikan Content: handleTimeUpdate: No video element.');
      return;
    }
    if (!shouldTrack()) {
      console.log('Mikan Content: handleTimeUpdate: Not tracking (shouldTrack is false).');
      return;
    }
    if (video.paused) {
      console.log('Mikan Content: handleTimeUpdate: Video is paused.');
      return;
    }
    if (isAdPlaying()) {
      console.log('Mikan Content: handleTimeUpdate: Ad is playing, not tracking.');
      return;
    }
  
    const currentTime = video.currentTime;
    const delta = currentTime - lastTime;
  
    if (delta > 0 && delta < 2) { // Ensure time is advancing and not a huge jump (e.g., seek)
      totalWatchedSeconds += delta;
      // console.log(`Mikan Content: totalWatchedSeconds: ${totalWatchedSeconds.toFixed(2)}`);
    }
  
    lastTime = currentTime;
    
    const now = Date.now();
    if (now - lastSaveTime >= 1000) { // Save every second
      saveProgress();
      lastSaveTime = now;
    }
  }

  function startTrackingIfPlaying() {
    if (video && !video.paused && shouldTrack()) {
      lastTime = video.currentTime;
      lastSaveTime = Date.now();
      console.log('Mikan Content: Video already playing, starting to track');
    }
  }

  // Split detection into two functions
  async function runDetectionNow() {
    console.log('Mikan Content: runDetectionNow called.');
    const videoId = await sendConnectorMessage('getVideoId');
    if (!videoId) {
      console.log('Mikan Content: runDetectionNow: No videoId found.');
      return;
    }
    if (detectionDone) {
      console.log('Mikan Content: runDetectionNow: Detection already done.');
      return;
    }
    
    detectionDone = true;
    pendingDetectionVideoId = null;
    lastDetectedTitle = await sendConnectorMessage('getCurrentTitle');
    console.log(`Mikan Content: runDetectionNow: videoId: ${videoId}, title: ${lastDetectedTitle}`);
    
    isTargetLanguage = detectLanguage(videoId);
    hasError = false; // Reset error on new detection attempt
    
    updateIconState();
    startTrackingIfPlaying();
  }

  async function runDetection(retryCount = 0) {
    console.log(`Mikan Content: runDetection called (retry: ${retryCount}).`);
    if (detectionDone) {
      console.log('Mikan Content: runDetection: Detection already done.');
      return;
    }
    
    const videoId = await sendConnectorMessage('getVideoId');
    if (!videoId) {
      console.log('Mikan Content: runDetection: No videoId found.');
      return;
      // No video ID found means we can't really do anything, so return.
      // This might be the cause of `currentVideoId: null` in the popup
      // if `initializeTracker` also doesn't find it.
    }
    
    pendingDetectionVideoId = videoId;
    
    // Check if we already have intercepted data for THIS video
    if (interceptedVideoData[videoId]) {
      console.log('Mikan Content: Have intercepted data for current video, detecting immediately');
      runDetectionNow();
      return;
    }
    
    // No data yet - retry up to 3 seconds
    const maxRetries = 20; // 20 retries * 150ms = 3000ms (3 seconds)
    const retryDelay = 150;
    
    if (retryCount < maxRetries) {
      console.log(`Mikan Content: No intercepted data yet, retrying detection in ${retryDelay}ms.`);
      setTimeout(() => runDetection(retryCount + 1), retryDelay);
    } else {
      // Timeout - proceed with DOM fallback
      console.log('Mikan Content: Detection timeout, proceeding with DOM fallback');
      runDetectionNow();
    }
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
    
    if (!detectionDone) {
      runDetection();
    }
    
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
    console.log('Mikan Content: initializeTracker called.');
    const isWatchPage = await sendConnectorMessage('isWatchPage');
    console.log('Mikan Content: isWatchPage:', isWatchPage);
    if (!isWatchPage) {
      console.log('Mikan Content: initializeTracker: Not a watch page, skipping');
      return;
    }
    
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
      
      if (!detectionDone) {
        runDetection();
      }
      
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
      if (connectorForcesJapanese) {
        sendResponse({
          isTargetLanguage: true,
          currentVideoId,
          hasError: false,
          host: connectorHost, // Include host for popup to make decisions
          forceJapanese: true // Indicate that connector forces Japanese
        });
      } else {
        sendResponse({
          isTargetLanguage,
          currentVideoId,
          hasError,
          host: connectorHost, // Include host for popup to make decisions
          forceJapanese: false // Indicate that connector does not force Japanese
        });
      }

  } else if (message.type === 'toggleForce') {
    if (connectorForcesJapanese) {
      console.log('Mikan Content: toggleForce ignored as connector forces Japanese.');
      sendResponse({ success: true, isTargetLanguage: true }); // Always report true if forced
    } else {
      console.log(`Mikan Content: toggleForce message received. Current isTargetLanguage: ${isTargetLanguage}`);
      isTargetLanguage = !isTargetLanguage;
      hasError = false; // If manually toggled, clear any auto-detection error
      updateIconState();
      startTrackingIfPlaying();
      console.log(`Mikan Content: isTargetLanguage after toggle: ${isTargetLanguage}`);
      sendResponse({ success: true, isTargetLanguage });
    }
  }
    return true; // Keep the message channel open for sendResponse
  });
})();