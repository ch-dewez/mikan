// connectors/any-website.js
import VideoConnector from "./video-connector.js";

class AnyWebsiteConnector extends VideoConnector {
  constructor() {
    super();
  }

  isAsbplayerLoaded() {
    // class names present when using asbplayer
    const ASB_INDICATORS = [
      "asbplayer-offscreen",
      //"asbplayer-token-container"
    ]
    return ASB_INDICATORS.some(cls => document.getElementsByClassName(cls).length > 0)
  }


  async getName() {
    try {
      return window.top.location.hostname.replace('www.', '');
    } catch {
      return (await browserAPI.runtime.sendMessage({ type: "getTopHost" })).replace('www.', '');
    }
  }

  getTargetLanguage() {
    if (this.isAsbplayerLoaded()) {
      return "Custom";// Custom means always yes
    }
    else {
      return "";// will always be false
    }

  }

  getVideoElement() {
    let v = document.querySelector('video');
    return v;
  }

  isWatchPage() {
    if (this.isAsbplayerLoaded()) {
      return true;
    }
    let video = this.getVideoElement();
    if (video != undefined) {
      this.attachVideoListeners(video);
      return true;
    }
    return false;
  }

  isActive() {
    return true;
  }

  getNavigationEvents() {
    return [];
  }

  isAdPlaying() {
    return false;// can't detect
  }

  getCategory() {
    return "Watching"
  }

};

export default function connectorFactory() {
  return new AnyWebsiteConnector();
}
