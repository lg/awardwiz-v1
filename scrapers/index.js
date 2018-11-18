/* eslint-disable */

const process = require("process")
const platform = (process.env.LAMBDA_TASK_ROOT && process.env.AWS_EXECUTION_ENV) ? "aws" : "other"

// Modules are loaded at runtime because sometimes the node modules still
// need to be generated (ex. AWS)
let puppeteer = null
let chromeAwsLambda = null
let cors = null
let proxyChain = null

// Used for caching incase the runner doesn't throw away our environment
let browser = null
let proxyServer = null

exports.gcfEntry = async(req, res) => {
  //cors = cors || require("cors")
  //const corsMiddleware = cors()
  //await corsMiddleware(req, res, () => handleRequest(req, res))
}

exports.awsEntry = async(event, context) => {
  // AWS doesn't pre-package modules, as such, download them and install
  // to /tmp/node_modules. Note: make sure the uploaded zip has a symlink
  // of "node_modules" to "/tmp/node_modules". Also note: AWS will cache
  // the node_modules if the lambda is run a bunch.
  const {execSync} = require("child_process")
  process.env.HOME = "/tmp"
  //execSync("if [ ! -f /tmp/headless_shell ]; then curl -sL -o /tmp/headless_shell.zip https://github.com/Kikobeats/aws-lambda-chrome/raw/master/dist/headless_shell.zip && unzip /tmp/headless_shell.zip -d /tmp; fi")
//  execSync("ls /tmp")
  execSync("cp -f /var/task/package.json /tmp && cd /tmp && npm install")

//

let result = null;
  let browser = null;

  let chromium = require("chrome-aws-lambda")
  let puppeteer = require('puppeteer-core')

  //try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--enable-logging=stderr",
        "--v=1",

        "--disable-software-rasterizer",
        "--disable-gpu"

        // "--password-store=basic",
        // "--disable-extensions",
        // "--disable-gpu"
        // "--no-sandbox",
        // "--disable-dev-shm-usage",
        // "--single-process"

      ],
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      dumpio: true
    });

    let page = await browser.newPage();
    await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))


/*
  await page.setRequestInterception(true)
  page.on('request', interceptedRequest => {
    console.log("INTERCEPT: " + interceptedRequest.url())

    var blocked = ["ual_check", "abmr", "clientdata", "ensighten"]

    var blockit = false
    blocked.forEach(text => {
      if (interceptedRequest.url().indexOf(text) > -1) {
        blockit = true
      }
    })

    if (blockit) {
      console.log("CANCEL")
      interceptedRequest.abort()

    } else {
      console.log("OK")
      interceptedRequest.continue();
    }


  });
*/




    //await page.goto('https://www.united.com')
    await page.goto('https://www.united.com')

    result = await page.title();
  // } catch (error) {
  //   return context.fail(error);
  // } finally {
  //   if (browser !== null) {
  //     await browser.close();
  //   }
  // }

  return context.succeed(result);
/*
*//*
  const response = await handleRequest(event)

  return context.succeed(response)*/
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

    // if (platform === "aws") {
    chromeAwsLambda = chromeAwsLambda || require("chrome-aws-lambda")
    puppeteer = puppeteer || require('puppeteer-core')

    // console.log([
    //   ...chromeAwsLambda.args,
    //   "--proxy-server=http://127.0.0.1:8203"])

    console.log(await chromeAwsLambda.executablePath)

    browser = await puppeteer.launch({
      args: [
        ...chromeAwsLambda.args,
        "--proxy-server=http://127.0.0.1:8203",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-setuid-sandbox"

        //"--disable-gpu",
        //"--disable-accelerated-2d-canvas"

      ],

      /*
      args: [
        //"--proxy-server=http://127.0.0.1:8203",
        "--no-sandbox",               // required for gcf
        //"--disable-dev-shm-usage",

        "--single-process",


        '--disable-gpu'
        //'--homedir=/tmp',

        // '--data-path=/tmp/data-path',
        // '--disk-cache-dir=/tmp/cache-dir',
        // '--remote-debugging-port=9222',

        // "--no-zygote",
        // "--disable-setuid-sandbox",
        // "--disable-accelerated-2d-canvas"




        // "--no-zygote",
        // "--disable-accelerated-2d-canvas",
        // "--disable-gpu",
        // "--disable-setuid-sandbox",
        // "--no-first-run"


      ],*/
      executablePath: await chromeAwsLambda.executablePath,  //"/tmp/headless_shell"
      headless: chromeAwsLambda.headless, // true
      dumpio: true
    })

    // } else {
      // Using these params for faster launch as per https://github.com/GoogleChrome/puppeteer/issues/3120

    // puppeteer = puppeteer || require('puppeteer')
    // browser = await puppeteer.launch({
    //   args: [
    //     "--proxy-server=http://127.0.0.1:8203",
    //     "--no-sandbox",               // required for gcf
    //     "--disable-dev-shm-usage",
    //     "--no-zygote",
    //     "--disable-accelerated-2d-canvas",
    //     "--disable-gpu",
    //     "--disable-setuid-sandbox",
    //     "--no-first-run"
    //   ],
    //   headless: typeof headless === "undefined" ? true : headless
    // })

    //}
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

//const handleRequest = async(req, res) => {      // remember to use req.body
const handleRequest = async params => {
  console.log(`Welcome! Request is: ${JSON.stringify(params)}`)

  if (params && params.hashCheck) {
    return {hashCheck: "{{HASH_CHECK_AUTO_REPLACE}}"}
    // res.status(200).send({hashCheck: "{{HASH_CHECK_AUTO_REPLACE}}"})
    // return
  }

  await startProxyServer(params.proxy)
  await startPuppeteer(params.headless)

  // Using a context is important to disallow caching between requests (esp if using different proxies)
  //console.log("Creating new Puppeteer context...")
  //const context = await browser.createIncognitoBrowserContext()
  console.log("New page...")
  const page = await browser.newPage();//const page = await context.newPage()
  //console.log("user agent")
  //const page = await browser.newPage()

  await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"))
  await page.setDefaultNavigationTimeout(90000)

  //await page.setJavaScriptEnabled(false)
  // await page.setRequestInterception(true)
  // page.on('request', interceptedRequest => {
  //   console.log("INTERCEPT: " + interceptedRequest.url())
  //   if (interceptedRequest.url().endsWith('.png') || interceptedRequest.url().endsWith('.jpg') ||
  //       interceptedRequest.url().endsWith("ual_check.js") || interceptedRequest.url().endsWith("quantum-united.js") ||
  //       interceptedRequest.url().endsWith("analytics.js") ||
  //       interceptedRequest.url().endsWith("oo_engine.min.js") ||
  //       interceptedRequest.url().endsWith("js") ||
  //       interceptedRequest.url().indexOf("css") > -1 ||
  //       interceptedRequest.url().indexOf("regionMaps") > -1) {
  //     console.log("CANCEL")
  //     interceptedRequest.abort();
  //   } else {
  //     console.log("OK")
  //     interceptedRequest.continue();
  //   }
  // });

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

  response.screenshot = null //await page.screenshot({type: "jpeg", quality: 90, fullPage: true, encoding: "base64"})

  console.log("Closing context...")
  //await context.close()

  //res.status(response.error ? 500 : 200).send(response)
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
