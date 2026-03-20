import VideoConnector from "./video-connector.js";

// connectors/cijapanese.js
class CijConnector extends VideoConnector {
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

  isWatchPage() {
    return window.location.href.includes("/video/");
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
    return []; // TODO: maybe I should get rid of this event, idk what it do
  }

  isAdPlaying() {
    return false;// can't detect
  }

};

export default function connectorFactory() {
  return new CijConnector();
}

