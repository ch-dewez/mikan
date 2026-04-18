import TimerAfkConnector from "./template/timer-afk-connector.js";

class AsashiConnector extends TimerAfkConnector {
  constructor() {
    super();
  }

  isEasyVersion() {
    return window.top.location.hostname.replace('www.', '').includes("yasashii");
  }

  getName() {
    if (this.isEasyVersion()) {
      return "やさしい朝日新聞"
    }
    return "朝日新聞";
  }

  getTargetLanguage() {
    return "ja";
  }

  isWatchPage() {
    let location = window.location.href;
    return location.includes("/articles/");
  }

  isActive() {
    return true;
  }

  getCategory() {
    return "Reading"
  }
};

export default function connectorFactory() {
  return new AsashiConnector();
}

