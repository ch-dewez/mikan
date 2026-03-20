// abstract class for connector that work based on video
import Connector from "./connector.js";
export default class VideoConnector extends Connector {
  constructor() {
    super()

    this.video = null;
    this.lastTime = 0;
    this.totalWatchedSeconds = 0;
    this.lastTotalWatchSeconds = 0;
  }

  getTimeSinceLastCall() {
    let result = this.totalWatchedSeconds - this.lastTotalWatchSeconds;
    this.lastTotalWatchSeconds = this.totalWatchedSeconds;
    return result;
  }

  resetTime() {
    this.totalWatchedSeconds = 0;
    this.lastTotalWatchSeconds = 0;
  }

  handleSeeked = () => {
    this.lastTime = this.video.currentTime;
  }

  handleTimeUpdate = async () => {
    //TODO: re-enable the detection of ad that are playing
    //if (!video || video.paused || await sendConnectorMessage('isAdPlaying')) return;
    if (!this.video || this.video.paused) return;

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
      this.lastTime = 0;
      this.totalWatchedSeconds = 0;
      this.lastTotalWatchSeconds = 0;
    }

    this.video = videoElement;


    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('seeked', this.handleSeeked);
  }


  getCategory() {
    return "Watching"
  }
}
