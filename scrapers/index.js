/* eslint-env node, module */
/* eslint-disable global-require */

const puppeteer = require("puppeteer")
const cors = require("cors")

// Used for caching incase the runner doesn't throw away our environment
let browser = null

const gcfEntryWithCORS = async(req, res) => {
  console.log("Launching Puppeteer...")
  // Using these params for faster launch as per https://github.com/GoogleChrome/puppeteer/issues/3120
  // eslint-disable-next-line require-atomic-updates
  browser = browser || await puppeteer.launch({
    args: [
      "--no-sandbox",               // required for gcf
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-zygote",
      "--single-process"
    ]
  })

  console.log("Creating new page...")
  const page = await browser.newPage()

  console.log(`Launching scraper '${req.body.scraper}' with params: ${JSON.stringify(req.body.params)}`)
  const scraper = require(`./${req.body.scraper}.js`)
  const result = await scraper.scraperMain(page, req.body.params)

  res.status(200).send(result)
}

exports.gcfEntry = async(req, res) => {
  const corsMiddleware = cors()
  await corsMiddleware(req, res, () => gcfEntryWithCORS(req, res))
}
