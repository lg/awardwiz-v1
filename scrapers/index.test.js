// Note: Requires a jest.config.js with globals:
//   testProxy - a working proxy server in http://user:pass@domain.com form
//   aeroplanUsername - your aeroplan membership id
//   aeroplanPassword - your aeroplan password
/* globals testProxy, aeroplanUsername, aeroplanPassword */
/* eslint-disable global-require */

const JestDateMock = require("jest-date-mock")
const fetch = require("node-fetch")
const {promisify} = require("util")

////// Helpers

const genMockScraper = (requireName, code) => {
  jest.doMock(`./${requireName}.js`, () => {
    const ScraperMock = jest.fn()
    const scraper = new ScraperMock()
    scraper.scraperMain = code
    return scraper
  }, {virtual: true})
}

// What is typically returned from, for example, gcfEntryWithCORS
class ExpressResponse {
  status(code) {
    this.statusCode = code
    return {
      send: response => {
        this.response = response
      }
    }
  }
}

//////

let index = null
beforeEach(async() => {
  index = require("./index")
})

afterEach(async() => {
  await index.shutdown()
})

test("console instrumenting works", async() => {
  JestDateMock.advanceTo()

  const prevConsoleInfo = console.log
  let instrumentedConsoleInfo = null
  const resultLog = await index.instrumentConsole(async() => {
    console.log("a")
    console.info("b")
    console.error("c")
    instrumentedConsoleInfo = console.log
  })
  const finalConsoleInfo = console.log

  expect(prevConsoleInfo).toBe(finalConsoleInfo)
  expect(instrumentedConsoleInfo).not.toBe(prevConsoleInfo)
  expect(resultLog).toMatchSnapshot()

  JestDateMock.clear()
})

test("can use Chrome to open about:blank", async() => {
  genMockScraper("about-blank-scraper", async(page, input) => {
    await page.goto("about:blank")
    return {success: true}
  })

  const expressResponse = new ExpressResponse()
  await index.gcfEntryWithCORS({body: {scraper: "about-blank-scraper", params: {}}}, expressResponse)
  expect(expressResponse.response.scraperResult.success).toBe(true)
})

describe("do some IP tests with Chrome", async() => {
  let realIp = null
  beforeAll(async() => {
    genMockScraper("get-your-ip-scraper", async(page, input) => {
      await page.goto("https://ifconfig.co/json")
      const debugText = await page.evaluate("document.body.innerHTML")
      return {debugText}
    })

    realIp = (await (await fetch("https://ifconfig.co/json")).json()).ip
  })

  test("can use Chrome to get our IP", async() => {
    const expressResponse = new ExpressResponse()
    await index.gcfEntryWithCORS({body: {scraper: "get-your-ip-scraper", params: {}}}, expressResponse)

    expect(expressResponse.statusCode).toBe(200)
    expect(expressResponse.response.scraperResult.debugText).toContain(realIp)
  })

  test("using a proxy works and can be switched on the same browser", async() => {
    let expressResponse = new ExpressResponse()
    await index.gcfEntryWithCORS({body: {scraper: "get-your-ip-scraper", proxy: testProxy, params: {}}}, expressResponse)
    expect(expressResponse.statusCode).toBe(200)

    const {URL} = require("url")
    const {hostname} = new URL(testProxy)
    const dns = require("dns")
    const resolve4 = promisify(dns.resolve4)
    const ip = await resolve4(hostname)
    expect(expressResponse.response.scraperResult.debugText).toContain(ip)

    expressResponse = new ExpressResponse()
    await index.gcfEntryWithCORS({body: {scraper: "get-your-ip-scraper", params: {}}}, expressResponse)
    expect(expressResponse.statusCode).toBe(200)
    expect(expressResponse.response.scraperResult.debugText).toContain(realIp)
  })
})

describe("scrapers are properly working", async() => {
  jest.setTimeout(90000)

  const searchDate = new Date()
  searchDate.setDate(searchDate.getDate() + 100)
  const searchDateStr = searchDate.toISOString().substr(0, 10)

  test("United scraper for EWR->SFO", async() => {
    const expressResponse = new ExpressResponse()
    const searchParams = {
      from: "EWR",
      to: "SFO",
      date: searchDateStr
    }
    await index.gcfEntryWithCORS({body: {scraper: "united", proxy: testProxy, params: searchParams}}, expressResponse)
    expect(expressResponse.response.scraperResult.searchResults.length).toBeGreaterThan(0)
  })

  test("Aeroplan scraper for YOW->YYZ", async() => {
    const expressResponse = new ExpressResponse()
    const searchParams = {
      from: "YOW",
      to: "YYZ",
      date: searchDateStr,
      aeroplanUsername,
      aeroplanPassword
    }
    await index.gcfEntryWithCORS({body: {scraper: "aeroplan", params: searchParams}}, expressResponse)
    expect(expressResponse.response.scraperResult.searchResults.length).toBeGreaterThan(0)
  })
})
