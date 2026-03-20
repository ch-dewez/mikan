import VideoConnector from "./video-connector.js";

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// connectors/youtube.js
class YoutubeConnector extends VideoConnector {
  constructor() {
    super();

    console.log("Mikan: creating youtube connector")


    this.videoDetails = undefined;
    this.videoId = "";
    this.title = "";
    this.channelName = "";
    this.captions = [];
    this.languages = [];


    const s = document.createElement('script');
    s.src = browserAPI.runtime.getURL("connectors/youtube-request-interceptor.js");
    document.documentElement.appendChild(s);

    window.addEventListener("message", (event) => {
      // SECURITY: Always check the source to ignore messages from other scripts
      //if (event.source !== window) return;

      if (event.data && event.data.source === 'youtube-request-intercerptor') {
        console.log("MIKAN: message is from interceptor", event);

        this.videoDetails = event.data.videoDetails;
        this.videoId = this.videoDetails.videoId;
        this.title = this.videoDetails.title || '';
        this.channelName = this.videoDetails.author || '';

        this.captions = event.data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        this.languages = this.captions.map(t => t.languageCode);
      }
    }, false);
  }

  getName() {
    return "Youtube";
  }

  getTargetLanguage() {
    let hasJapaneseCaptions = false;

    for (let i = 0; i < this.languages.length; i++) {
      if (this.languages[i] == "ja") {
        hasJapaneseCaptions = true;
        break;
      }
    }

    // Analyze Japanese content
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    const hiraganaKatakana = (this.title.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const kanji = (this.title.match(/[\u4E00-\u9FAF]/g) || []).length;
    const totalJapanese = hiraganaKatakana + kanji;
    const titleLength = this.title.length;

    const hasKana = hiraganaKatakana > 0;
    const japaneseRatio = titleLength > 0 ? totalJapanese / titleLength : 0;
    const channelHasKana = japaneseRegex.test(this.channelName);

    let isJapanese = false;
    let reason = '';

    // Japanese captions = definitely Japanese
    if (hasJapaneseCaptions) {
      isJapanese = true;
      reason = `Japanese captions found[${this.languages.join(', ')}]`;
    }
    // No Japanese captions (or no captions at all) = use heuristics
    else if (hasKana && japaneseRatio > 0.3) {
      isJapanese = true;
      reason = `Heuristics: Has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars(> 30 % threshold)`;
    } else if (channelHasKana && japaneseRatio > 0.1) {
      isJapanese = true;
      reason = `Heuristics: Channel has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars(> 10 % threshold)`;
    } else {
      isJapanese = false;
      reason = `Heuristics: ${(japaneseRatio * 100).toFixed(0)}% Japanese chars, hasKana = ${hasKana}, channelHasKana = ${channelHasKana} `;
    }

    console.log(`Mikan Content: Detected video language: ${isJapanese ? 'JAPANESE' : 'NOT JAPANESE'}`);

    if (isJapanese) {
      return "ja";
    }
    return "other";
  }

  getVideoElement() {
    const isShorts = window.location.pathname.includes('/shorts');
    let videoEl = null;

    if (isShorts) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        videoEl = activeReel.querySelector('video');
        if (videoEl) {
          return videoEl;
        }
      }
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (!v.paused && v.src) {
          return v;
        }
      }
    } else {
      videoEl = document.querySelector('video');
    }

    return videoEl;
  }

  isWatchPage() {
    const isWatch = window.location.pathname.includes('/watch') ||
      window.location.pathname.includes('/shorts/');
    return isWatch;
  }

  isActive() {
    let video = this.getVideoElement();
    if (video != undefined) {
      this.attachVideoListeners(video);
      return true;
    }
    return false;
  }

  getNavigationEvents() {
    return [];
    console.log('Mikan Connector: getNavigationEvents - returning yt-navigate-finish');
    return ['yt-navigate-finish'];
  }

  isAdPlaying() {
    const isAd = !!(
      document.querySelector('.ad-showing') ||
      document.querySelector('.ytp-ad-player-overlay') ||
      document.querySelector('.ytp-ad-text')
    );
    if (isAd) console.log('Mikan Content: Ad detected.');
    return isAd;
  }


  getCategory() {
    return "Watching"
  }
};

export default function connectorFactory() {
  return new YoutubeConnector();
}
