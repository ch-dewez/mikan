const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0]?.url || args[0];

  // Intercept player requests
  if (typeof url === 'string' && url.includes('/youtubei/v1/player')) {
    try {
      const response = await originalFetch.apply(this, args);
      const clone = response.clone();

      clone.json().then(data => {
        if (data?.videoDetails?.videoId) {
          console.log("Mikan: debug data interception ", data);
          window.postMessage({
            source: 'youtube-request-intercerptor', // Unique ID to filter your own messages
            url: args[0],
            videoDetails: data.videoDetails,
            captions: data.captions
          }, "*");
        }
      }).catch(e => console.log('Mikan: Error parsing player response:', e));

      return response;
    } catch (e) {
      return originalFetch.apply(this, args);
    }
  }

  // Also intercept reel requests (Shorts use this)
  if (typeof url === 'string' && url.includes('/youtubei/v1/reel')) {
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
