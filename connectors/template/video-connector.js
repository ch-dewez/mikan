// abstract class for connector that work based on video
import Connector from "./connector.js";
export default class VideoConnector extends Connector {
  constructor() {
    super()

    this.video = null;
    this.lastTime = -1;
    this.totalWatchedSeconds = 0;
    this.lastTotalWatchSeconds = -1;
  }

  getTimeSinceLastCall() {
    if (this.lastTotalWatchSeconds == -1) {
      this.lastTotalWatchSeconds = this.totalWatchedSeconds;
    }
    let result = this.totalWatchedSeconds - this.lastTotalWatchSeconds;

    // safe guard for bugs: sometimes even though I reset time when seeked, it sometimes doesn't work on youtube
    if (result > 1 || result < 0) {
      console.warn("MIKAN: time change is too large");
      this.resetTime();
      return 0;
    }

    this.lastTotalWatchSeconds = this.totalWatchedSeconds;
    return result;
  }

  resetTime() {
    this.totalWatchedSeconds = 0;
    this.lastTotalWatchSeconds = -1;
    this.lastTime = -1;
  }

  handleSeeked = () => {
    console.log("MIKAN: video seeked, resut current time")
    this.resetTime();
  }

  handleTimeUpdate = async () => {
    if (!this.video || this.video.paused || this.isAdPlaying()) return;

    if (this.lastTime == -1) {
      this.lastTime = this.video.currentTime;
    }

    const currentTime = this.video.currentTime;
    let delta = currentTime - this.lastTime;

    delta = delta / this.video.playbackRate;

    this.totalWatchedSeconds += delta;

    this.lastTime = currentTime;
  }

  attachVideoListeners(videoElement) {
    if (!videoElement) {
      console.log('Mikan Content: attachVideoListeners: No video element provided.');
      return;
    }

    if (this.video && typeof this.video != "undefined" && this.video !== videoElement) {
      this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.video.removeEventListener('seeked', this.handleSeeked);
      this.video = null;
      this.resetTime();
    }

    this.video = videoElement;


    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('seeked', this.handleSeeked);
  }


  getCategory() {
    return "Watching"
  }

  isAdPlaying() {
    return false;
  }
}
