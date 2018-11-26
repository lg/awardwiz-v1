/* eslint-disable */

// @ts-ignore
const process = require("process")
// @ts-ignore
const {execSync} = require("child_process")

const platform = (process.env.LAMBDA_TASK_ROOT && process.env.AWS_EXECUTION_ENV) ? "aws" : "other"

// Modules are loaded at runtime because sometimes the node modules still
// need to be generated (ex. AWS)

/** @type {import("puppeteer")?} */
let puppeteer = null

/** @type {ChromeAwsLambda?} */
let chromeAwsLambda = null

/** @type {ProxyChain?} */
let proxyChain = null

// Used for caching incase the runner doesn't throw away our environment
/** @type {ProxyServer?} */
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
    // @ts-ignore
    proxyChain = proxyChain || require("proxy-chain")
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

  // @ts-ignore
  chromeAwsLambda = chromeAwsLambda || require("chrome-aws-lambda")
  puppeteer = /** @type {import("puppeteer")} */ (puppeteer || chromeAwsLambda.puppeteer)

  const browser = await puppeteer.launch({
    args: [
      ...chromeAwsLambda.args,
      "--proxy-server=http://127.0.0.1:8203",

      // Necessary for loading certain websites (ex. united.com)
      "--disable-software-rasterizer",
      "--disable-gpu"
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

  /** @type {Map<string, function(ConsoleMethod)>} */
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

// Used by the test suite
exports.instrumentConsole = instrumentConsole
exports.handleRequest = handleRequest
exports.shutdown = async() => {
  if (proxyServer) {
    await proxyServer.close(true)
    proxyServer = null
  }
}
