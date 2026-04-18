import TimerAfkConnector from "./template/timer-afk-connector.js";

class NHKConnector extends TimerAfkConnector {
  constructor() {
    super();
  }

  isEasyVersion() {
    let location = window.location.href;
    let isNHKeasy = location.includes("/news/easy") && !(location.endsWith("easy/") || location.endsWith("easy"));
    return isNHKeasy;
  }

  isNormalVersion() {
    let location = window.location.href;
    let isNHK = location.includes("/newsweb/na/na");
    return isNHK;
  }

  getName() {
    if (this.isEasyVersion()) {
      return "NHK news easy";
    }
    return "NHK news";
  }

  getTargetLanguage() {
    return "ja";
  }

  isWatchPage() {
    return this.isEasyVersion() || this.isNormalVersion();
  }

  isActive() {
    return true;
  }

  getCategory() {
    return "Reading"
  }

};

export default function connectorFactory() {
  return new NHKConnector();
}

