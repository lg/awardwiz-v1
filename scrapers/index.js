/* eslint-disable */

const process = require("process")
const {execSync} = require("child_process")

// Modules are loaded at runtime because sometimes the node modules still
// need to be generated (ex. AWS)
let puppeteer = null
let chromeAwsLambda = null
let proxyChain = null

// Used for caching incase the runner doesn't throw away our environment
let browser = null
let proxyServer = null

exports.awsEntry = async(event, context) => {
  // AWS doesn't pre-package modules, as such, download them and install
  // to /tmp/node_modules. Note: make sure the uploaded zip has a symlink
  // of "node_modules" to "/tmp/node_modules". Also note: AWS will cache
  // the node_modules if the lambda is run a bunch.
  process.env.HOME = "/tmp"
  execSync("cp -f /var/task/package.json /tmp && cd /tmp && npm install")

  const response = await handleRequest(event)
  return context.succeed(response)
}

/////////////////

const startProxyServer = async proxyUrl => {
  // The proxy server will always run, but it won't go through any external server unless enabled
  // with a 'proxy' attribute in the request body. Running our own proxy server is necessary because
  // Puppeteer doesn't allow us to pass in a username/password for proxy auth, plus we want
  // per-context/per-auth proxies to benefit from re-using the already-running Chromium.
  if (!proxyServer) {
    proxyChain = proxyChain || require("proxy-chain")
    proxyServer = new proxyChain.Server({port: 8203})
  }
  proxyServer.prepareRequestFunction = () => {
    return {upstreamProxyUrl: proxyUrl || null, requestAuthentication: false}
  }
  if (!proxyServer.server.listening)
    await proxyServer.listen()
}

const startPuppeteer = async headless => {
  if (!browser) {
    console.log("Launching new Puppeteer...")

    chromeAwsLambda = chromeAwsLambda || require("chrome-aws-lambda")
    puppeteer = puppeteer || require('puppeteer-core')

    browser = await puppeteer.launch({
      args: [
        ...chromeAwsLambda.args,
        "--proxy-server=http://127.0.0.1:8203",

        // Necessary for loading certain websites (ex. united.com)
        "--disable-software-rasterizer",
        "--disable-gpu"
      ],

      executablePath: await chromeAwsLambda.executablePath,
      headless: chromeAwsLambda.headless
    })
  }
}

const instrumentConsole = async toRun => {
  const fullConsoleLog = []
  const consoleMethods = ["error", "log", "info"]
  const oldConsole = {}
  for (const consoleMethod of consoleMethods) {
    oldConsole[consoleMethod] = console[consoleMethod]
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

const handleRequest = async params => {
  console.log(`Welcome! Request is: ${JSON.stringify(params)}`)

  if (params && params.hashCheck) {
    return {hashCheck: "{{HASH_CHECK_AUTO_REPLACE}}"}
  }

  console.log("Starting proxy and Chromium...")
  await startProxyServer(params.proxy)

  await startPuppeteer(params.headless)
  const page = await browser.newPage()

  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  await page.setDefaultNavigationTimeout(90000)

  console.log(`Launching scraper '${params.scraper}'...`)
  const scraper = require(`./${params.scraper}.js`)             // eslint-disable-line global-require

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

  console.log("Closing context...")
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
  if (browser) {
    await browser.close()
    browser = null
  }
}
