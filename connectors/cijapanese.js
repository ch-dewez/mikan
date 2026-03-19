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

