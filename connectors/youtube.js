import VideoConnector from "./video-connector.js";

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// connectors/youtube.js
class YoutubeConnector extends VideoConnector {
  constructor() {
    super();

    console.log("Mikan: creating youtube connector")

    this.title = "";
  }

  scrapData() {
    this.title = document.querySelector('h1 > yt-formatted-string')?.textContent || document.querySelector("h2.ytShortsVideoTitleViewModelShortsVideoTitle")?.textContent;
  }

  getName() {
    return "Youtube";
  }

  getTargetLanguage() {
    this.scrapData();

    if (!this.title || this.title == "") {
      return "";
    }

    // Analyze Japanese content
    //const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    const hiraganaKatakana = (this.title.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const kanji = (this.title.match(/[\u4E00-\u9FAF]/g) || []).length;
    const totalJapanese = hiraganaKatakana + kanji;
    const titleLength = this.title.length;

    const hasKana = hiraganaKatakana > 0;
    const japaneseRatio = titleLength > 0 ? totalJapanese / titleLength : 0;

    let isJapanese = false;

    if (hasKana && japaneseRatio > 0.3) {
      isJapanese = true;
    }
    // else if (japaneseRatio > 0.1) {
    //   isJapanese = true;
    //   reason = `Heuristics: Channel has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars(> 10 % threshold)`;
    // } 
    else {
      isJapanese = false;
    }

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
