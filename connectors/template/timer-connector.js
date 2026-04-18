import Connector from "./connector.js";

export default class TimerConnector extends Connector {
  constructor() {
    super();
    this.lastTime = undefined;
    // for afk detection by children
    this.timeSinceBeginning = 0;
    this.timeSinceLastReset = 0;
  }

  getNavigationEvents() {
    return [];
  }

  setAfk = (value) => this.isAfk = value;

  getTimeSinceLastCall() {
    if (!this.lastTime || this.isAfk) {
      this.lastTime = new Date();
      return 0;
    }


    let currentTime = new Date();
    let diffMs = currentTime - this.lastTime;
    let diffSec = diffMs / 1000.0;

    this.lastTime = currentTime;
    this.timeSinceBeginning += diffSec;
    this.timeSinceLastReset += diffSec;

    return diffSec;
  }

  resetTime() {
    this.lastTime = undefined;
    this.timeSinceLastReset = 0;
  }
}
