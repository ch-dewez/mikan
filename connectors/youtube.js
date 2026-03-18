// connectors/youtube.js

(function() {
  function isWatchPage() {
    const isWatch = window.location.pathname.includes('/watch') ||
      window.location.pathname.includes('/shorts/');
    console.log('Mikan Connector: isWatchPage - result:', isWatch);
    return isWatch;
  }

  function findActiveVideo() {
    const isShorts = window.location.pathname.includes('/shorts');
    let videoEl = null;

    if (isShorts) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        videoEl = activeReel.querySelector('video');
        if (videoEl) {
          console.log('Mikan Connector: findActiveVideo - Found video in active reel.');
          return videoEl;
        }
      }
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (!v.paused && v.src) {
          console.log('Mikan Connector: findActiveVideo - Found playing video as fallback for shorts.');
          return v;
        }
      }
    } else {
      videoEl = document.querySelector('video');
    }

    if (videoEl) {
      console.log('Mikan Connector: findActiveVideo - Found video element:', videoEl);
    } else {
      console.log('Mikan Connector: findActiveVideo - No video element found.');
    }
    return videoEl;
  }

  function getNavigationEvents() {
    console.log('Mikan Connector: getNavigationEvents - returning yt-navigate-finish');
    return ['yt-navigate-finish'];
  }

  // This function is no longer called directly from here.
  // It's just a placeholder to know what logic to communicate.
  function _injectAPIInterceptor() {
    // Logic for injecting youtube-api-reader.js
  }

  // Function to monitor for the video element and signal when ready
  let videoMonitorInterval = null;
  function monitorVideoElement() {
    if (videoMonitorInterval) {
      console.log('Mikan Connector: monitorVideoElement - already running.');
      return;
    }
    if (!isWatchPage()) {
      console.log('Mikan Connector: monitorVideoElement - Not a watch page, skipping monitor setup.');
      return;
    }

    console.log('Mikan Connector: Starting video element monitor.');
    window.postMessage({ type: 'MIKAN_INJECT_API_INTERCEPTOR' }, '*'); // Request API interceptor injection
    videoMonitorInterval = setInterval(() => {
      const activeVideo = findActiveVideo();
      if (activeVideo) {
        window.postMessage({ type: 'MIKAN_VIDEO_ELEMENT_READY' }, '*');
        clearInterval(videoMonitorInterval);
        videoMonitorInterval = null;
        console.log('Mikan Connector: Video element detected and signaled ready, stopping monitor.');
      } else {
        console.log('Mikan Connector: Video element not yet found by monitor.');
      }
    }, 500); // Check every 500ms
  }

  // Initial call to start monitoring
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorVideoElement);
  } else {
    monitorVideoElement();
  }

  let videoDetails;
  let videoId;
  let title;
  let channelName;
  let captions;
  let languages;

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0]?.url || args[0];

    // Log all YouTube API requests to see what Shorts uses
    if (typeof url === 'string' && url.includes('youtube.com/youtubei/')) {
      console.log('Mikan: YouTube API request:', url.split('?')[0]);
    }

    // Intercept player requests
    if (typeof url === 'string' && url.includes('/youtubei/v1/player')) {
      console.log('Mikan: Intercepted player request!');
      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();

        clone.json().then(data => {
          if (data?.videoDetails?.videoId) {
            console.log("Mikan: debug data interception ", data);
            videoDetails = data.videoDetails;
            videoId = videoDetails.videoId;
            title = videoDetails.title || '';
            channelName = videoDetails.author || '';

            captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            languages = captions.map(t => t.languageCode);

            console.log(`Mikan: video ID: ${videoId}`);
            console.log(`Mikan: Title: "${title}"`);
            console.log(`Mikan: Channel: "${channelName}"`);
            console.log(`Mikan: Captions: [${languages.join(', ')}]`);
          }
        }).catch(e => console.log('Mikan: Error parsing player response:', e));

        return response;
      } catch (e) {
        return originalFetch.apply(this, args);
      }
    }

    // Also intercept reel requests (Shorts use this)
    if (typeof url === 'string' && url.includes('/youtubei/v1/reel')) {
      console.log('Mikan: Intercepted reel request!');
      try {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();

        clone.json().then(data => {
          console.log('Mikan: Reel response:', JSON.stringify(data, null, 2).substring(0, 2000));
        }).catch(e => console.log('Mikan: Error parsing reel response:', e));

        return response;
      } catch (e) {
        return originalFetch.apply(this, args);
      }
    }

    return originalFetch.apply(this, args);
  };

  function detectLanguage() {
    console.log(`Mikan Content: === Detection Start for ${videoId} ===`);

    let captionLanguages = [];
    let hasJapaneseCaptions = false;
    // Check for Japanese subtitle tracks directly in the DOM
    const trackElements = document.querySelectorAll('video track');
    const domCaptionLanguages = Array.from(trackElements)
      .filter(track => track.kind === 'captions' || track.kind === 'subtitles')
      .map(track => track.srclang || track.label.toLowerCase())
      .filter(lang => lang.includes('ja')); // Check for 'ja' or 'ja-JP' etc.
    if (domCaptionLanguages.length > 0) {
      captionLanguages = [...new Set([...captions, ...domCaptionLanguages])];
      hasJapaneseCaptions = true;
      console.log(`Mikan Content: Detected Japanese captions from DOM track elements: ${domCaptionLanguages.join(', ')}`);
    }

    // Use intercepted data as primary source
    if (videoId) {
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

    if (isJapanese) {
      return "ja";
    }
    return "other";
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

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'MIKAN_REQUEST_DATA') {
      const messageId = event.data.messageId;
      let responseData = null;
      let requestHandled = true;

      console.log(`Mikan Connector: Received request from content script: ${event.data.request}`);
      switch (event.data.request) {
        case 'getTargetLanguage':
          responseData = detectLanguage();
          break;
        case 'getVideoId':
          responseData = videoId;
          break;
        case 'isWatchPage':
          responseData = isWatchPage();
          break;
        case 'isActive':
          responseData = true; // if it's a watch page it's active
          break;
        case 'getCurrentTitle':
          responseData = title;
          break;
        case 'getNavigationEvents':
          responseData = getNavigationEvents();
          break;
        case 'isAdPlaying':
          responseData = isAdPlaying();
          break;
        default:
          requestHandled = false;
          console.warn(`Mikan Connector: Unknown request type from content script: ${event.data.request}`);
          break;
      }

      if (requestHandled) {
        window.postMessage({ type: 'MIKAN_RESPONSE_DATA', request: event.data.request, messageId, data: responseData }, '*');
        console.log(`Mikan Connector: Sent response for ${event.data.request} with data:`, responseData);
      }
    }
  });

  // Announce that the connector is ready
  window.postMessage({ type: 'MIKAN_CONNECTOR_READY', host: 'youtube.com' }, '*');
  console.log('Mikan Connector: MIKAN_CONNECTOR_READY sent.');

  // Re-monitor for video element on navigation events
  const navigationEvents = getNavigationEvents();
  for (const event of navigationEvents) {
    window.addEventListener(event, () => {
      console.log('Mikan Connector: Navigation detected, restarting video monitor.');
      if (videoMonitorInterval) {
        clearInterval(videoMonitorInterval);
        videoMonitorInterval = null;
      }
      monitorVideoElement();
    });
  }

  window.addEventListener('popstate', () => {
    console.log('Mikan Connector: Popstate detected, restarting video monitor.');
    if (videoMonitorInterval) {
      clearInterval(videoMonitorInterval);
      videoMonitorInterval = null;
    }
    monitorVideoElement();
  });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('Mikan Connector: URL change detected via polling, restarting video monitor.');
      if (videoMonitorInterval) {
        clearInterval(videoMonitorInterval);
        videoMonitorInterval = null;
      }
      monitorVideoElement();
    }
  }, 500);
})();
