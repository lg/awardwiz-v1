/* eslint-env node, module */
/* eslint-disable global-require */

exports.gcfEntry = async(req, res) => {
  console.log("Launching Puppeteer...")
  const puppeteer = require("puppeteer")

  // Using these params for faster launch as per https://github.com/GoogleChrome/puppeteer/issues/3120
  const browser = await puppeteer.launch({
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

  console.log(`Launching scraper '${req.body.scraper}' with params: ${JSON.stringify(req.body.params)}`)
  const scraper = require(`./${req.body.scraper}.js`)
  const result = await scraper.scraperMain(browser, req.body.params)

  res.status(200).send(result)
}
