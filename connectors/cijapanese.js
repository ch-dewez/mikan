// connectors/cijapanese.js
import Connector from "./connector.js";
class CijConnector extends Connector {
  constructor() {
    super();
  }

  isThereAVideo() {
    return this.getVideoElement() != undefined;
  }

  getName() {
    return "Comprehensible Japanese";
  }

  getTargetLanguage() {
    return "ja";
  }

  getVideoElement() {
    const v = document.querySelector('video');
    return v;
  }

  getVideoId() {
    // For cijapanese.com, we can use the ID from the track element as a unique video identifier
    let url = window.location.href;
    let index = url.indexOf("/video/");
    index += "/video/".length;
    let id = url.substring(index);

    if (id == undefined) {
      return "cijapanese"
    }

    return id;
  }

  isWatchPage() {
    return window.location.href.includes("/video/");
  }

  isActive() {
    const videoEl = document.querySelector('video');
    return videoEl != undefined;
  }

  getNavigationEvents() {
    return []; // TODO: maybe I should get rid of this event, idk what it do
  }

  isAdPlaying() {
    return false;// can't detect
  }

};

export default function connectorFactory() {
  return new CijConnector();
}

