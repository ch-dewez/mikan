# How to add support for other websites

1. import Connector from "./connector.js";
2. extend Connetor
3. follow cijapanese.js, it's a good example
4. create a function that return new ExampleConnector();
5. export default that function

6. go to content.js and add it to siteConnectors.
7. go to manifest.json and modify the accessible ressources.
