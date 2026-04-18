import TimerConnector from "./timer-connector.js";

export default class TimerAfkConnector extends TimerConnector {
  // 30 seconds in ms
  constructor(timeoutTime = 30000) {
    super();
    this.AFK_TIMEOUT = timeoutTime;
    this.idleTimer;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    // Ajouter les écouteurs
    events.forEach(this.addListener);

    this.resetAfkTimer();
  }
  addListener = (name) => document.addEventListener(name, this.resetAfkTimer, true);

  idleTimerEnd = () => this.setAfk(true);
  resetAfkTimer = () => {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(this.idleTimerEnd, this.AFK_TIMEOUT);
    this.setAfk(false);
  }
}
