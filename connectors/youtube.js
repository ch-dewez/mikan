import VideoConnector from "./template/video-connector.js";

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// connectors/youtube.js
class YoutubeConnector extends VideoConnector {
  constructor() {
    super();

    console.log("Mikan: creating youtube connector")
  }

  scrapData() {
    this.videoDetails = undefined;
    this.captionLanguages = undefined;
    this.title = undefined;

    const player = document.querySelector("#movie_player");
    let initialPlayerResponse;

    initialPlayerResponse = window.ytInitialPlayerResponse;

    initialPlayerResponse = typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : null;

    if (!initialPlayerResponse) {
      const player = document.querySelector(".html5-video-player");
      initialPlayerResponse = typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : null;
    }

    if (!initialPlayerResponse) {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('ytInitialPlayerResponse')) {
          const match = script.textContent.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
          if (match) {
            initialPlayerResponse = JSON.parse(match[1]);
            break;
          }
        }
      }
    }



    this.videoDetails = initialPlayerResponse?.videoDetails ?? undefined;

    const urlMatch = window.location.href.match(/[?&]v=([^&]+)/) ||
      window.location.pathname.match(/\/shorts\/([^/?]+)/);
    const urlVideoId = urlMatch?.[1];

    // the videoId of the player response does not match the current video. the this.title will still be used
    if (this.videoDetails.videoId != urlVideoId) {
      this.videoDetails = undefined;
    }

    this.title = document.querySelector('h1 > yt-formatted-string')?.textContent || document.querySelector("h2.ytShortsVideoTitleViewModelShortsVideoTitle")?.textContent;
  }

  getName() {
    return "YouTube";
  }

  getTargetLanguage() {
    this.scrapData();

    if (!this.videoDetails && !this.title) {
      return "";
    }

    let title = "";
    let channelName = "";

    if (this.videoDetails) {
      title = this.videoDetails.title;
      channelName = this.videoDetails.channelName || this.videoDetails.author;
    } else {
      title = this.title;
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
    //let reason = '';

    if (hasKana && japaneseRatio > 0.3) {
      isJapanese = true;
      //reason = `Heuristics: Has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars (>30% threshold)`;
    } else if (channelHasKana && japaneseRatio > 0.1) {
      isJapanese = true;
      //reason = `Heuristics: Channel has kana + ${(japaneseRatio * 100).toFixed(0)}% Japanese chars (>10% threshold)`;
    } else {
      isJapanese = false;
      //reason = `Heuristics: ${(japaneseRatio * 100).toFixed(0)}% Japanese chars, hasKana=${hasKana}, channelHasKana=${channelHasKana}`;
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
      if (video == this.video) {
        return true;
      }
      this.attachVideoListeners(video);
      return true;
    }
    return false;
  }

  getNavigationEvents() {
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
