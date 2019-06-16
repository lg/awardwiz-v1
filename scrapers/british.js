// Notes about British:
// - it only returns 3 classes of service at once with Premium Economy amongst them.
//   this means to get both Economy and First you need to do two searches: Economy
//   which returnd Economy, Premium Economy, and Business, and you need to search for
//   First, which returns Premium Economy, Business and First. to test this, LAX-NRT
//   flights usually have some availabily in both Economy and First on JAL.

/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  /** @type {SearchResult[]} */
  const flights = []

  // We need to search twice due to how the results are given back for economy vs first
  for (const searchMode of ["economy", "first"]) {
    console.log("Going to search page...")
    await page.goto("https://www.britishairways.com/travel/redeem/execclub/_gf/en_us")

    let result = 0
    try {     // eslint-disable-line no-useless-catch
      result = await Promise.race([
        page.waitForSelector("#membershipNumber").then(() => 0),
        page.waitForSelector("#departurePoint").then(() => 1)
      ])
    } catch (err) {   // necessary to deal with a puppeteer bug where closing the browser causes a race condition
      throw err
    }

    if (result === 0) {
      console.log("Logging in first...")
      await page.type("#membershipNumber", input.username)
      await page.type("#input_password", input.password)

      console.log("Clicking login and waiting...")
      await page.click("#ecuserlogbutton")
      await page.waitForSelector("#departurePoint")

      console.log("Filling in search parameters...")
      await page.type("#departurePoint", input.origin)
      await page.type("#destinationPoint", input.destination)
      await page.click("#oneWayBox")
      await page.$eval("#departInputDate", (element, argInput) => ((/** @type {HTMLInputElement} */(element)).value = `${argInput.date.substr(5, 2)}/${argInput.date.substr(8, 2)}/${argInput.date.substr(2, 2)}`), input)
    }

    await page.select("#cabin", searchMode === "economy" ? "M" : "F")
    await page.click("#submitBtn")

    result = 0
    try {     // eslint-disable-line no-useless-catch
      result = await Promise.race([
        page.waitForSelector("#sector_1", {timeout: 60000}).then(() => 0),
        page.waitForSelector("#stopOverForm").then(() => 1),
        page.waitForSelector("#captcha_form").then(() => 2)
      ])
    } catch (err) {   // necessary to deal with a puppeteer bug where closing the browser causes a race condition
      throw err
    }

    if (result === 1) {
      console.log("Stopover screen received, clicking to skip...")
      await page.click("#continueTopPod")
      await page.waitForSelector("#sector_1", {timeout: 60000})
    } else if (result === 2) {
      throw new Error("Captcha")
    }

    /** @param {import("puppeteer").ElementHandle<Element> | import("puppeteer").Page} parentElement
     * @param {string} selector
     * @returns {Promise<string>} */
    const innerText = async(parentElement, selector) => {
      const stopsEl = await parentElement.$(selector)
      return page.evaluate(pageEl => pageEl.innerText, stopsEl)
    }

    /** @param {string} timestamp
     * @returns {string} */
    const timestampToDateTime = (timestamp) => (new Date(parseInt(timestamp, 10))).toISOString().replace("T", " ").substr(0, 16)

    console.log("Parsing page...")
    const rows = await page.$$(".direct")
    for (const row of rows) {
      /** @type {SearchResult} */
      const flight = {
        departureDateTime: timestampToDateTime((await innerText(row, "td:nth-of-type(2)")).substr(0, 13)),
        arrivalDateTime: timestampToDateTime((await innerText(row, "td:nth-of-type(2)")).substr(13)),
        origin: await innerText(row, "div.departure a.airportCodeLink"),
        destination: await innerText(row, "div.arrival a.airportCodeLink"),
        airline: await innerText(row, "p.career-and-flight span:nth-of-type(1)"),
        flightNo: `${(await innerText(row, "p.career-and-flight span:nth-of-type(2)")).substr(0, 2)} ${parseInt((await innerText(row, "p.career-and-flight span:nth-of-type(2)")).substr(2), 10)}`,
        duration: `${(await innerText(row, "td:nth-of-type(3)")).substr(0, 2)}h ${(await innerText(row, "td:nth-of-type(3)")).substr(2, 2)}m`,
        aircraft: null,     // it's possible to get, but via a navigation
        costs: {
          economy: {miles: null, cash: null},
          business: {miles: null, cash: null},
          first: {miles: null, cash: null}
        }
      }

      for (const cabinCol of await row.$$("div.seats-available")) {
        await page.evaluate(el => el.scrollIntoView(), cabinCol)
        await cabinCol.click()
        await page.waitForSelector(".totalPriceAviosTxt", {timeout: 5000})

        const text = await innerText(page, ".totalPriceAviosTxt")
        await page.$eval(".totalPriceAviosTxt", el => el.remove())    // gets recreated after clicking a cabin

        const textParts = text.split(" Avios + $")
        const cashMiles = {miles: parseInt(textParts[0], 10), cash: parseFloat(textParts[1])}

        const cabinName = await innerText(cabinCol, ".travel-class")
        if (cabinName === "Economy" || cabinName === "Premium Economy") {
          if (flight.costs.economy.miles === null || cashMiles.miles < flight.costs.economy.miles)
            flight.costs.economy = cashMiles
        } else if (cabinName === "Business Class") {
          flight.costs.business = cashMiles
        } else if (cabinName === "First") {
          flight.costs.first = cashMiles
        } else {
          throw new Error("Unknown class of service")
        }
      }

      // merge costs from the searches of economy and first
      let addToFlights = true
      for (const checkFlight of flights) {
        if (checkFlight.departureDateTime === flight.departureDateTime && checkFlight.arrivalDateTime === flight.arrivalDateTime) {
          addToFlights = false;
          ["economy", "business", "first"].forEach(cabin => {
            if (flight.costs[cabin].miles !== null && flight.costs[cabin].cash !== null)    // if this result's cabin does have data, take it
              if (flight.costs[cabin].miles < checkFlight.costs[cabin].miles)
                checkFlight.costs[cabin] = flight.costs[cabin]
          })
        }
      }

      if (addToFlights)
        flights.push(flight)
    }
  }

  return {searchResults: flights}
}
