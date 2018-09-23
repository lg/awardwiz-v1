// Note: Requires a jest.config.js with globals:
//   testProxy - a working proxy server in http://user:pass@domain.com form

/* eslint-env node, module */
/* eslint-disable global-require */
/* globals testProxy */

let index = null
const fetch = require("node-fetch")

//////

jest.mock("./awesomescraper.js", () => {
  const AwesomeScraperMock = jest.fn()
  const awesomeScraper = new AwesomeScraperMock()
  awesomeScraper.scraperMain = async(page, input) => {
    await page.goto("https://ifconfig.co/json")
    const debugText = await page.evaluate("document.body.innerHTML")
    return {input, debugText}
  }
  return awesomeScraper
}, {virtual: true})

jest.spyOn(global.console, "log").mockImplementation(() => jest.fn())

class ScraperResponse {
  status(code) {
    this.statusCode = code
    return {
      send: dummy => {
        this.debugText = dummy.debugText   // eslint-disable-line prefer-destructuring
      }
    }
  }
}

//////

beforeEach(async() => {
  index = require("./index")
})

afterEach(async() => {
  await index.shutdown()
})

test("can use Chrome to get our IP", async() => {
  const response = new ScraperResponse()
  await index.gcfEntryWithCORS({body: {scraper: "awesomescraper", params: {}}}, response)

  expect(response.statusCode).toBe(200)

  const ipResp = await (await fetch("https://ifconfig.co/json")).json()
  expect(response.debugText).toContain(ipResp.ip)
})

test("using a proxy works and can be switched on the same browser", async() => {
  let response = new ScraperResponse()
  await index.gcfEntryWithCORS({body: {scraper: "awesomescraper", proxy: testProxy, params: {}}}, response)
  expect(response.statusCode).toBe(200)

  const {URL} = require("url")
  const {hostname} = new URL(testProxy)

  const {Resolver} = require("dns").promises
  const resolver = new Resolver()
  const ip = await resolver.resolve4(hostname)
  expect(response.debugText).toContain(ip)

  response = new ScraperResponse()
  await index.gcfEntryWithCORS({body: {scraper: "awesomescraper", params: {}}}, response)
  expect(response.statusCode).toBe(200)
  expect(response.debugText).not.toContain(ip)
})


