// connectors/cijapanese.js

(function() {
  function getVideoId() {
    // For cijapanese.com, we can use the ID from the track element as a unique video identifier
    const trackElement = document.querySelector('video track[id^="CIJ_"]');
    if (trackElement) {
      console.log('Mikan Connector [cijapanese]: getVideoId - Found track ID:', trackElement.id);
      return trackElement.id;
    }
    const sourceElement = document.querySelector('video source[src*="hls/main.m3u8"]');
    if (sourceElement && sourceElement.src) {
      const match = sourceElement.src.match(/\/hls\/([a-zA-Z0-9-]+)\/main\.m3u8/);
      if (match && match[1]) {
        console.log('Mikan Connector [cijapanese]: getVideoId - Found video ID from HLS source:', match[1]);
        return match[1];
      }
    }
    console.log('Mikan Connector [cijapanese]: getVideoId - No video ID found.');
    return null;
  }
  
  function isWatchPage() {
    // cijapanese.com is primarily a video site, so most pages will be watch pages.
    // We can be a bit more specific if needed, but for now, assuming if a video element exists, it's a watch page.
    const hasVideo = document.querySelector('video') !== null;
    console.log('Mikan Connector [cijapanese]: isWatchPage - result:', hasVideo);
    return hasVideo;
  }
  
  function getCurrentTitle() {
    const titleElement = document.querySelector('media-title.vds-chapter-title');
    if (titleElement && titleElement.textContent) {
      console.log('Mikan Connector [cijapanese]: getCurrentTitle - result:', titleElement.textContent.trim());
      return titleElement.textContent.trim();
    }
    // Fallback to document title
    console.log('Mikan Connector [cijapanese]: getCurrentTitle - Fallback to document title:', document.title);
    return document.title.replace(' - CI Japanese', '').trim();
  }
  
  function findActiveVideo() {
    const videoEl = document.querySelector('video');
    if (videoEl) {
      console.log('Mikan Connector [cijapanese]: findActiveVideo - Found video element:', videoEl);
    } else {
      console.log('Mikan Connector [cijapanese]: findActiveVideo - No video element found.');
    }
    return videoEl;
  }
  
  function getNavigationEvents() {
    // CI Japanese seems to be a SPA, so URL polling and popstate are relevant.
    // No specific custom navigation events like YouTube.
    console.log('Mikan Connector [cijapanese]: getNavigationEvents - returning [] (relying on polling/popstate)');
    return []; // content.js already handles polling and popstate
  }
  
  // No API interception needed for CI Japanese based on initial analysis
  function _injectAPIInterceptor() {
    // No-op
  }

  // Function to monitor for the video element and signal when ready
  let videoMonitorInterval = null;
  function monitorVideoElement() {
    if (videoMonitorInterval) {
      console.log('Mikan Connector [cijapanese]: monitorVideoElement - already running.');
      return;
    }
    if (!isWatchPage()) {
      console.log('Mikan Connector [cijapanese]: monitorVideoElement - Not a watch page, skipping monitor setup.');
      return;
    }

    console.log('Mikan Connector [cijapanese]: Starting video element monitor.');
    // No API interceptor needed for cijapanese.com, so no MIKAN_INJECT_API_INTERCEPTOR message
    videoMonitorInterval = setInterval(() => {
      const activeVideo = findActiveVideo();
      if (activeVideo) {
        window.postMessage({ type: 'MIKAN_VIDEO_ELEMENT_READY' }, '*');
        clearInterval(videoMonitorInterval);
        videoMonitorInterval = null;
        console.log('Mikan Connector [cijapanese]: Video element detected and signaled ready, stopping monitor.');
      } else {
        console.log('Mikan Connector [cijapanese]: Video element not yet found by monitor.');
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

      console.log(`Mikan Connector [cijapanese]: Received request from content script: ${event.data.request}`);
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
          console.warn(`Mikan Connector [cijapanese]: Unknown request type from content script: ${event.data.request}`);
          break;
      }

      if (requestHandled) {
        window.postMessage({ type: 'MIKAN_RESPONSE_DATA', request: event.data.request, messageId, data: responseData }, '*');
        console.log(`Mikan Connector [cijapanese]: Sent response for ${event.data.request} with data:`, responseData);
      }
    }
  });

  // Announce that the connector is ready
  window.postMessage({ type: 'MIKAN_CONNECTOR_READY', host: 'cijapanese.com', forceJapanese: true }, '*');
  console.log('Mikan Connector [cijapanese]: MIKAN_CONNECTOR_READY sent.');

  // Re-monitor for video element on navigation events (URL changes, popstate)
  // content.js will handle polling and popstate, and trigger checkAndInit, which will then call monitorVideoElement.
})();