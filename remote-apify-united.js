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

  console.log("Opening URL...")
  const page = await browser.newPage()
  await page.goto("https://united.com")

  // Grab a screenshot
  console.log("Saving screenshot...")
  const screenshotBuffer = await page.screenshot()
  await Apify.setValue("screenshot.png", screenshotBuffer, {contentType: "image/png"})

  console.log("Closing Puppeteer...")
  await browser.close()

  console.log("Done.")
  console.log("You can check the output in the key-value on the following URLs:")
  const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID          // eslint-disable-line no-process-env
  console.log(`- https://api.apify.com/v2/key-value-stores/${storeId}/records/screenshot.png`)

  const output = {message: "Hello world!"}
  await Apify.setValue("OUTPUT", output)
})
