// connectors/any-website.js
import Connector from "./connector.js";

class AnyWebsiteConnector extends Connector {
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


  getName() {
    return window.location.host;
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
    let videoElements = [];
    let v = document.querySelector('video');
    if (v != undefined && v != null) {
      videoElements.push(v);
    }
    document.querySelectorAll('iframe').forEach(item => {
      let v = item.contentWindow.document.body.querySelector('video');
      if (v != undefined && v != null) {
        videoElements.push(v);
      }
    })
    if (videoElements.length < 1) {
      return undefined;
    }
    return videoElements[0];
  }

  isWatchPage() {
    return this.getVideoElement() != undefined;
  }

  isActive() {
    return true;
  }

  getNavigationEvents() {
    return []; // TODO: maybe I should get rid of this event, idk what it do
  }

  isAdPlaying() {
    return false;// can't detect
  }

};

export default function connectorFactory() {
  return new AnyWebsiteConnector();
}
