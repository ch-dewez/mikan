import Connector from "./connector.js";

// connectors/cijapanese.js
class CijConnector extends Connector {
  constructor() {
    super();
    this.lastTime = undefined;
    this.lastPercentageValue = "";
    this.nbTimeAFK = 0;

    this.aftThreshold = 480; // 0.5 * 480 = 5 minutes
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
    return [];
  }

  isAdPlaying() {
    return false;// can't detect
  }

  getPercentageValue() {
    return document.querySelector("#ttu-page-footer > .writing-horizontal-tb").textContent;
  }

  getTimeSinceLastCall() {
    if (!this.lastTime) {
      this.lastTime = new Date();
      return 0;
    }

    let percentageValue = this.getPercentageValue();
    if (this.lastPercentageValue == percentageValue) {
      this.nbTimeAFK += 1;
    } else {
      this.lastPercentageValue = percentageValue;
      this.nbTimeAFK = 0;
    }

    if (this.nbTimeAFK > this.aftThreshold) {
      this.lastTime = new Date();
      return 0;
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

