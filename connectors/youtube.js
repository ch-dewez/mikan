// connectors/youtube.js

(function() {
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    const watchId = urlParams.get('v');
    if (watchId) {
      console.log('Mikan Connector: getVideoId - Found v parameter:', watchId);
      return watchId;
    }
  
    const shortsMatch = window.location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      console.log('Mikan Connector: getVideoId - Found shorts match:', shortsMatch[1]);
      return shortsMatch[1];
    }
  
    console.log('Mikan Connector: getVideoId - No video ID found.');
    return null;
  }
  
  function isWatchPage() {
    const isWatch = window.location.pathname.includes('/watch') ||
                    window.location.pathname.includes('/shorts/');
    console.log('Mikan Connector: isWatchPage - result:', isWatch);
    return isWatch;
  }
  
  function getCurrentTitle() {
    const isShorts = window.location.pathname.includes('/shorts');
    let title = '';

    if (isShorts) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        const titleEl = activeReel.querySelector('h2.ytd-reel-player-header-renderer');
        if (titleEl?.textContent?.trim()) {
          title = titleEl.textContent.trim();
        }
      }
    } else {
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string');
      title = titleElement?.textContent?.trim() || '';
    }
    console.log('Mikan Connector: getCurrentTitle - result:', title);
    return title;
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

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'MIKAN_REQUEST_DATA') {
      const messageId = event.data.messageId;
      let responseData = null;
      let requestHandled = true;

      console.log(`Mikan Connector: Received request from content script: ${event.data.request}`);
      switch(event.data.request) {
        case 'getVideoId':
          responseData = getVideoId();
          break;
        case 'isWatchPage':
          responseData = isWatchPage();
          break;
        case 'getCurrentTitle':
          responseData = getCurrentTitle();
          break;
        case 'getNavigationEvents':
          responseData = getNavigationEvents();
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