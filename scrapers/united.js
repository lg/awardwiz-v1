/* This file is uploaded by AwardMan to Apify and run as an Actor */
/* eslint-env node, module */

const Apify = require("apify")

Apify.main(async() => {
  console.log("Hello world from actor!")
  const input = await Apify.getValue("INPUT")

  console.log("Launching Puppeteer...")
  const browser = await Apify.launchPuppeteer({
    proxyUrl: input.proxyUrl || null
  })

  if (!input.from || !input.to || !input.date) {
    console.error("Some parameters missing for call. from, to, and date are required.")
    return
  }

  console.log("Getting United cookie...")
  const page = await browser.newPage()
  await page.goto("https://www.united.com/ual/en/us/flight-search/book-a-flight")

  console.log("Searching for flights...")

  /* eslint-disable no-magic-numbers */
  let maxConnectionsCode = 7
  if (input.maxConnections === 0)
    maxConnectionsCode = 1
  else if (input.maxConnections === 1)
    maxConnectionsCode = 3
  /* eslint-enable no-magic-numbers */

  await page.goto(`https://www.united.com/ual/en/us/flight-search/book-a-flight/results/awd?f=${input.from}&t=${input.to}&d=${input.date}&tt=1&at=1&sc=${maxConnectionsCode}&px=1&taxng=1&idx=1`)

  console.log("Waiting for JSON results...")
  const response = await page.waitForResponse("https://www.united.com/ual/en/us/flight-search/book-a-flight/flightshopping/getflightresults/awd")
  const raw = await response.json()

  console.log("Closing Puppeteer...")
  await browser.close()

  console.log("Done.")

  const output = {raw}
  await Apify.setValue("OUTPUT", output)
})
