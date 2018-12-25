/* eslint-disable no-await-in-loop */

// ITA has multiple methods to mess with scraping such that search results will be arbitrarily
// delayed and only give 10 direct flights. Things that trigger this protection:
//   - Existance of navigator.webdriver
//   - Having notifications disabled in the webbrowser
//   - Spending a very short amount of time on the search screen

/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to homepage...")
  await page.goto("https://matrix.itasoftware.com")

  console.log("Setting one way...")
  const tabs = await page.$$(".gwt-TabBarItem .gwt-HTML")
  await tabs[1].click()

  console.log("Setting origin...")
  const fields = await page.$$(".gwt-SuggestBox")
  await fields[2].focus()
  await page.keyboard.type(input.origin)
  const originXPath = `//span[contains(text(), '(${input.origin})')]`
  await page.waitForXPath(originXPath, {timeout: 0})
  await page.evaluate(`document.evaluate("${originXPath}", document).iterateNext().click()`)

  console.log("Setting destination...")
  await fields[3].focus()
  await page.keyboard.type(input.destination)
  const destinationXPath = `//span[contains(text(), '(${input.destination})')]`
  await page.waitForXPath(destinationXPath, {timeout: 0})
  await page.evaluate(`document.evaluate("${destinationXPath}", document).iterateNext().click()`)

  console.log("Setting no connections...")
  const [stopsElement] = (await page.$x("//label[contains(text(), 'Stops')]/..//select"))
  stopsElement.focus()
  stopsElement.press("N")
  stopsElement.press("Enter")

  console.log("Setting date...")
  await (await page.$x("(//div[contains(text(), 'Departure Date')]/..)[1]/div[2]/input"))[0].focus()
  await page.keyboard.type(`${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}`)    // mm/dd/year
  await tabs[1].click()     // hide calendar

  console.log("Waiting 5 seconds to make sure ITA doesnt flag us as a bot...")
  await page.waitFor(5000)

  console.log("Starting search...")
  await Promise.all([
    page.click("button"),
    page.waitForResponse("https://matrix.itasoftware.com/search", {timeout: 0}),
    page.waitForResponse("https://matrix.itasoftware.com/pricecurve", {timeout: 0})
  ])

  // If there are multiple pages, request everything
  const allLink = await page.$x("//a[text()='All']")
  if (allLink.length > 0) {
    console.log("Loading the 'All' page...")
    await Promise.all([
      allLink[0].click(),
      page.waitForXPath("//span[text()='All']", {timeout: 0})
    ])
  }

  // Unfortunately the AJAX request is all messed up, so we'll need to scrape the UI
  console.log("Parsing results UI...")

  /** Takes a 12-hour (1 or 2 digit hour) time, and converts it to 24-hour (2 digit hour)
   * @param {string} twelveHour
   * @returns {string} */
  const convert12HourTo24Hour = twelveHour => {
    const [rawHour, rawMinute] = twelveHour.split(":")
    const [hour, minute] = [parseInt(rawHour, 10), parseInt(rawMinute.substr(0, 2), 10)]
    if (twelveHour.toUpperCase().indexOf("AM") >= 0)
      return `${(hour === 12 ? 0 : hour).toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
    return `${(hour === 12 ? 12 : hour + 12).toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }

  /** Returns the innerText of an XPath query on a page/element
   * @param {string} xPath
   * @param {import("puppeteer").ElementHandle?} contextElement */
  const xPathInnerText = async(xPath, contextElement = null) => {
    if (contextElement && !xPath.startsWith("."))
      throw new Error("When using a context XPath element, the path must start with a '.'")
    const [foundElement] = (await (contextElement || page).$x(xPath))
    return page.evaluate(pageEl => pageEl.innerText, foundElement)
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // We're using XPath because ITA puts an extra effort in not giving IDs/names to elements
  const resultElements = await page.$x("//tbody/*/*//span[contains(text(), '$')]/../../../../../../../../div[not(@aria-hidden='true')]")

  /** @type {SearchResult[]} */
  const results = []
  for (const resultElement of resultElements) {
    /** @type {SearchResult} */
    const result = {
      departureDateTime: "",
      arrivalDateTime: "",
      origin: await xPathInnerText(".//table/*//td[5]/div[1]/span[1]", resultElement),
      destination: await xPathInnerText(".//table/*//td[5]/div[1]/span[2]", resultElement),
      flights: "",    // ITA doesn't give connection info unless we make individual requests
      costs: {
        economy: {miles: null, cash: parseInt((await xPathInnerText(".//span[1]", resultElement)).replace("$", ""), 10)},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    const departureTime = convert12HourTo24Hour(await xPathInnerText(".//table/*//td[2]/div[1]", resultElement))
    result.departureDateTime = `${input.date} ${departureTime}`

    // Arrival time is a bit annoying because the div might have both a time and date, or just a time
    const rawArrivalTime = await xPathInnerText(".//table/*//td[3]/div[1]", resultElement)
    let arrivalDateTime = ""

    for (const month of months) {
      if (rawArrivalTime.indexOf(month) > -1) {
        const rawArrivalTimeWhenBoth = await xPathInnerText(".//table/*//td[3]/div[1]/div[1]", resultElement)
        const rawArrivalDateWhenBoth = await xPathInnerText(".//table/*//td[3]/div[1]/div[2]", resultElement)

        // Handle the year-change edge-case
        const searchMonthStr = months[parseInt(input.date.substr(6, 2), 10) - 1]
        let resultYear = parseInt(input.date.substr(0, 4), 10)  // Start it at the search year
        if (searchMonthStr === "Dec" && month === "Jan") {
          resultYear += 1
        } else if (searchMonthStr === "Jan" && month === "Dec") {
          resultYear -= 1
        }

        arrivalDateTime = `${resultYear.toString()}-${(months.indexOf(month) + 1).toString().padStart(2, "0")}-${rawArrivalDateWhenBoth.substr(4).padStart(2, "0")} ${convert12HourTo24Hour(rawArrivalTimeWhenBoth)}`
        break
      }
    }
    if (arrivalDateTime === "")
      arrivalDateTime = `${input.date.substr(0, 10)} ${convert12HourTo24Hour(rawArrivalTime)}`
    result.arrivalDateTime = arrivalDateTime

    results.push(result)
  }

  console.log("Done.")
  return {searchResults: results}
}
