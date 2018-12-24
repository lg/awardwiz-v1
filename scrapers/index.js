/* eslint-disable */

const process = require("process")
const {execSync} = require("child_process")

const platform = (process.env.LAMBDA_TASK_ROOT && process.env.AWS_EXECUTION_ENV) ? "aws" : "other"

// Modules are loaded at runtime because sometimes the node modules still
// need to be generated (ex. AWS)

/** @type {import("puppeteer")?} */
let puppeteer = null

/** @type {import("chrome-aws-lambda")?} */
let chromeAwsLambda = null

/** @type {import("proxy-chain")?} */
let proxyChain = null

// Used for caching incase the runner doesn't throw away our environment
/** @type {import("proxy-chain").Server?} */
let proxyServer = null

/**
 * @param {ScraperParams & ScraperHashCheckParams} event
 * @param {AWSContext} context
 */
exports.awsEntry = async(event, context) => {
  // AWS doesn't pre-package modules, as such, download them and install
  // to /tmp/node_modules. Note: make sure the uploaded zip has a symlink
  // of "node_modules" to "/tmp/node_modules". Also note: AWS will cache
  // the node_modules if the lambda is run a bunch.
  process.env.HOME = "/tmp"
  process.env.NODE_ENV = "production"
  execSync("cp -f /var/task/package.json /tmp && cd /tmp && npm install")

  const response = await handleRequest(event)
  return context.succeed(response)
}

/**
 * @param {ScraperParams} params
 */
exports.debugEntry = async(params) => {
  return await handleRequest(/** @type {ScraperParams & ScraperHashCheckParams} */ (params))
}

/////////////////

/**
 * @param {string | null} proxyUrl
 */
const startProxyServer = async proxyUrl => {
  // The proxy server will always run, but it won't go through any external server unless enabled
  // with a 'proxy' attribute in the request body. Running our own proxy server is necessary because
  // Puppeteer doesn't allow us to pass in a username/password for proxy auth, plus we want
  // per-context/per-auth proxies to benefit from re-using the already-running Chromium.
  if (!proxyServer) {
    proxyChain = /** @type {import("proxy-chain")} */ (proxyChain || require("proxy-chain"))
    proxyServer = new proxyChain.Server({port: 8203})
  }
  proxyServer.prepareRequestFunction = () => {
    return {upstreamProxyUrl: proxyUrl, requestAuthentication: false}
  }
  if (!proxyServer.server.listening)
    await proxyServer.listen()
}

/**
 * @param {boolean} headless
 */
const startPuppeteer = async headless => {
  console.log("Launching new Puppeteer...")


  chromeAwsLambda = /** @type {import("chrome-aws-lambda")} */ (chromeAwsLambda || require("chrome-aws-lambda"))
  puppeteer = /** @type {import("puppeteer")} */ (puppeteer || chromeAwsLambda.puppeteer)

  const browser = await puppeteer.launch({
    args: [
      // Use chromeAwsLambda params for proper compatibility on Lambda, but do not disable notifications
      // since some websites use this to detect headless browsers
      ...chromeAwsLambda.args.filter(checkParam => checkParam != "--disable-notifications"),
      platform === "other" ? "" : "--proxy-server=http://127.0.0.1:8203"
    ],

    executablePath: await chromeAwsLambda.executablePath,
    headless: chromeAwsLambda.headless,
    devtools: platform === "other"
  })

  return browser
}

/**
 * @param {function(): Promise} toRun
 */
const instrumentConsole = async toRun => {
  /** @type {Array<LogItem>} */
  const fullConsoleLog = []

  /** @type {Array<ConsoleMethod>} */
  const consoleMethods = ["error", "log", "info"]

  /** @type {Map<string, function(ConsoleMethod): void>} */
  const oldConsole = new Map()
  for (const consoleMethod of consoleMethods) {
    oldConsole[consoleMethod] = console[consoleMethod]

    /** @param {ConsoleMethod} text */
    console[consoleMethod] = text => {
      oldConsole[consoleMethod](text)
      fullConsoleLog.push({type: consoleMethod, date: new Date().toISOString(), text})
    }
  }

  await toRun()

  for (const consoleMethod of consoleMethods)
    console[consoleMethod] = oldConsole[consoleMethod]
  return fullConsoleLog
}

/** @param {ScraperParams & ScraperHashCheckParams} params */
const handleRequest = async params => {
  console.log(`Welcome! Request is: ${JSON.stringify(params)}`)

  if (params && params.hashCheck)
    return {hashCheck: "{{HASH_CHECK_AUTO_REPLACE}}"}

  console.log("Starting proxy and Chromium...")
  await startProxyServer(params.proxy || null)

  const browser = await startPuppeteer(params.headless === undefined ? true : params.headless)
  const page = await browser.newPage()

  await applyBrowserDetectionEvasion(page)
  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  await page.setDefaultNavigationTimeout(90000)

  console.log(`Launching scraper '${params.scraper}'...`)
  /** @type {Scraper} */
  const scraper = require(`./${params.scraper}.js`)             // eslint-disable-line global-require

  /** @type {ScraperResult} */
  const response = {}
  response.consoleLog = await instrumentConsole(async() => {
    try {
      response.scraperResult = await scraper.scraperMain(page, params.params)
    } catch (err) {
      console.error(err)
      response.error = err
    }
  })

  response.screenshot = await page.screenshot({type: "jpeg", quality: 90, fullPage: true, encoding: "base64"})

  console.log("Closing browser...")
  await browser.close()

  return response
}

/** @param {import("puppeteer").Page} page */
const applyBrowserDetectionEvasion = async page => {
  // Apply evasions for detecting that we're a browser as per https://github.com/paulirish/headless-cat-n-mouse/blob/master/apply-evasions.js
  await page.evaluateOnNewDocument(() => {
    // Pass the Webdriver Test.
    // @ts-ignore
    const newProto = navigator.__proto__;
    delete newProto.webdriver;
    // @ts-ignore
    navigator.__proto__ = newProto;

    // Pass the Chrome Test.
    window.chrome = {
      runtime: {}
    };
    window.console.debug = () => {
      return null;
    };

    // overwrite the `languages` property to use a custom getter
    Object.defineProperty(navigator, "languages", {
      get: function() {
        return ["en-US", "en"];
      }
    });

    // overwrite the `plugins` property to use a custom getter
    Object.defineProperty(navigator, 'plugins', {
      get: function() {
        // this just needs to have `length > 0`, but we could mock the plugins too
        return [1, 2, 3, 4, 5];
      },
    });

    // @ts-ignore
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.__proto__.query = parameters =>
      parameters.name === 'notifications'
        ? Promise.resolve({state: Notification.permission})
        : originalQuery(parameters);

    // Inspired by: https://github.com/ikarienator/phantomjs_hide_and_seek/blob/master/5.spoofFunctionBind.js
    const oldCall = Function.prototype.call;
    function call() {
      // @ts-ignore
      return oldCall.apply(this, arguments);
    }
    Function.prototype.call = call;

    const nativeToStringFunctionString = Error.toString().replace(/Error/g, "toString");
    const oldToString = Function.prototype.toString;

    function functionToString() {
      // @ts-ignore
      if (this === window.navigator.permissions.query) {
        return "function query() { [native code] }";
      }
      // @ts-ignore
      if (this === functionToString) {
        return nativeToStringFunctionString;
      }
      // @ts-ignore
      return oldCall.call(oldToString, this);
    }
    Function.prototype.toString = functionToString;
  })
}

// Used by the test suite
exports.instrumentConsole = instrumentConsole
exports.handleRequest = handleRequest
exports.shutdown = async() => {
  if (proxyServer) {
    await proxyServer.close(true)
    proxyServer = null
  }
}
