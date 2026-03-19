// connectors/youtube.js
import Connector from "./connector.js";
class YoutubeConnector extends Connector {
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
    s.src = browser.runtime.getURL("connectors/youtube-request-interceptor.js");
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
    console.log(`Mikan Content: === Detection Start for ${this.videoId} === `);

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

    console.log(`Mikan Content: --- Detection Summary-- - `);
    console.log(`Mikan Content: Title: "${this.title}"`);
    console.log(`Mikan Content: Channel: "${this.channelName}"`);
    console.log(`Mikan Content: Captions: ${this.languages.length > 0 ? `[${this.languages.join(', ')}]` : 'none found'} `);
    console.log(`Mikan Content: Japanese chars: ${totalJapanese}/${titleLength} (${(japaneseRatio * 100).toFixed(0)}%) - Kana: ${hiraganaKatakana}, Kanji: ${kanji}`);
    console.log(`Mikan Content: Result: ${isJapanese ? 'JAPANESE' : 'NOT JAPANESE'}`);
    console.log(`Mikan Content: Reason: ${reason}`);
    console.log(`Mikan Content: === Detection End ===`);

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

  getVideoId() {
    return this.videoId || "youtube";
  }

  isWatchPage() {
    const isWatch = window.location.pathname.includes('/watch') ||
      window.location.pathname.includes('/shorts/');
    return isWatch;
  }

  isActive() {
    return true;
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

};

export default function connectorFactory() {
  return new YoutubeConnector();
}
