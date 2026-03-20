import Connector from "./connector.js";

// connectors/cijapanese.js
class CijConnector extends Connector {
  constructor() {
    super();
    this.lastTime = undefined;
  }

  getName() {
    return "っつ reader";
  }

  getTargetLanguage() {
    return "ja";
  }

  isWatchPage() {
    return window.location.href.includes("id=");
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

  getTimeSinceLastCall() {
    if (!this.lastTime) {
      this.lastTime = new Date();
    }

    let currentTime = new Date();
    let diffMs = currentTime - this.lastTime;
    let diffSec = diffMs / 1000.0;

    this.lastTime = currentTime;
    return diffSec;
  }

  resetTime() {
    this.lastTime = undefined;
  }

  getCategory() {
    return "Reading"
  }

};

export default function connectorFactory() {
  return new CijConnector();
}

