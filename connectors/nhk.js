import TimerAfkConnector from "./template/timer-afk-connector.js";

// connectors/cijapanese.js
class NHKConnector extends TimerAfkConnector {
  constructor() {
    super();
  }

  getName() {
    return "NHK news";
  }

  getTargetLanguage() {
    return "ja";
  }

  isWatchPage() {
    let location = window.location.href;
    let isNHKeasy = location.includes("/news/easy") && !(location.endsWith("easy/") || location.endsWith("easy"));
    let isNHK = location.includes("/newsweb/na/na");

    return isNHK || isNHKeasy;
  }

  isActive() {
    return true;
  }

  getTimeSinceLastCall() {
    return super.getTimeSinceLastCall();
  }

  getCategory() {
    return "Reading"
  }

};

export default function connectorFactory() {
  return new NHKConnector();
}

