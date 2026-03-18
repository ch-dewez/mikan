// connectors/asbplayer.js
(function() {
  const ASB_INDICATORS = ['asbplayer-offscreen'];

  function isThereAVideo() {
    const v = document.querySelector('video');
    return v != undefined;
  }

  function isAsbplayerLoaded() {
    return ASB_INDICATORS.some(cls => document.getElementsByClassName(cls).length > 0)
  }

  window.addEventListener('message', (event) => {

    if (event.data?.type === 'MIKAN_REQUEST_DATA') {
      const messageId = event.data.messageId;
      let responseData = null;
      let requestHandled = true;


      console.log(`Mikan Connector [asbplayer]: Received request from content script: ${event.data.request}`);
      switch (event.data.request) {
        case 'getTargetLanguage':
          responseData = "Custom";// Custom means always yes
          break;
        case 'getVideoId':
          responseData = "asbplayer"; // dummy video id
          break;
        case 'isWatchPage':
          //responseData = isThereAVideo();
          responseData = true;// TODO: the video might not be loaded faste enough for isThereAVideo();
          break;
        case 'isActive':
          responseData = isAsbplayerLoaded();
          break;
        case 'getCurrentTitle':
          responseData = "asplayer - dummy title";
          break;
        case 'getNavigationEvents':
          responseData = []; // TODO: maybe I should get rid of this event, idk what it do
          break;
        case 'isAdPlaying':
          responseData = false;// can't detect
          break;
        default:
          requestHandled = false;
          console.warn(`Mikan Connector [asbplayer]: Unknown request type from content script: ${event.data.request}`);
          break;
      }

      if (requestHandled) {
        window.postMessage({ type: 'MIKAN_RESPONSE_DATA', request: event.data.request, messageId, data: responseData }, '*');
        console.log(`Mikan Connector [asbplayer]: Sent response for ${event.data.request} with data:`, responseData);
      }
    }
  })


  window.postMessage({ type: 'MIKAN_CONNECTOR_READY', host: 'asbplayer' }, '*');
  window.postMessage({ type: 'MIKAN_VIDEO_ELEMENT_READY' }, '*');// Bypass 
  console.log('Mikan Connector [asbplayer]: MIKAN_CONNECTOR_READY sent.');
})();
