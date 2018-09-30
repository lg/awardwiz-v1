const puppeteer = require("puppeteer")
const cors = require("cors")
const proxyChain = require("proxy-chain")

// Used for caching incase the runner doesn't throw away our environment
let browser = null
let proxyServer = null

const startProxyServer = async proxyUrl => {
  // The proxy server will always run, but it won't go through any external server unless enabled
  // with a 'proxy' attribute in the request body. Running our own proxy server is necessary because
  // Puppeteer doesn't allow us to pass in a username/password for proxy auth, plus we want
  // per-context/per-auth proxies to benefit from re-using the already-running Chromium.
  proxyServer = proxyServer || new proxyChain.Server({port: 8203})
  proxyServer.prepareRequestFunction = () => {
    return {upstreamProxyUrl: proxyUrl || null, requestAuthentication: false}
  }
  if (!proxyServer.server.listening)
    await proxyServer.listen()
}

const startPuppeteer = async headless => {
  if (!browser) {
    console.log("Launching new Puppeteer...")

    // Using these params for faster launch as per https://github.com/GoogleChrome/puppeteer/issues/3120
    // eslint-disable-next-line require-atomic-updates
    browser = await puppeteer.launch({
      args: [
        "--proxy-server=http://127.0.0.1:8203",
        "--no-sandbox",               // required for gcf
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-setuid-sandbox",
        "--no-first-run"
      ],
      headless: typeof headless === "undefined" ? true : headless
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

const gcfEntryWithCORS = async(req, res) => {
  console.log(`Welcome! Request is: ${JSON.stringify(req.body)}`)

  await startProxyServer(req.body.proxy)
  await startPuppeteer(req.body.headless)

  // Using a context is important to disallow caching between requests (esp if using different proxies)
  console.log("Creating new Puppeteer context...")
  const context = await browser.createIncognitoBrowserContext()
  const page = await context.newPage()

  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  await page.setDefaultNavigationTimeout(90000)

  console.log(`Launching scraper '${req.body.scraper}'...`)
  const scraper = require(`./${req.body.scraper}.js`)             // eslint-disable-line global-require

  const response = {}
  response.consoleLog = await instrumentConsole(async() => {
    try {
      response.scraperResult = await scraper.scraperMain(page, req.body.params)
    } catch (err) {
      console.error(err)
      response.error = err
    }
  })

  response.screenshot = await page.screenshot({type: "jpeg", quality: 90, fullPage: true, encoding: "base64"})

  console.log("Closing context...")
  await context.close()

  res.status(response.error ? 500 : 200).send(response)
}

exports.gcfEntry = async(req, res) => {
  const corsMiddleware = cors()
  await corsMiddleware(req, res, () => gcfEntryWithCORS(req, res))
}

// Used by the test suite
exports.instrumentConsole = instrumentConsole
exports.gcfEntryWithCORS = gcfEntryWithCORS
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
