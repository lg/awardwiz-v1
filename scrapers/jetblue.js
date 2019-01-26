// It appears OAK-LAS is a different page from SFO-BOS or SFO-LAS

/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to search page with pre-filled fields...")
  await page.goto(`https://book.jetblue.com/shop/search/#/book/from/${input.origin}/to/${input.destination}/depart/${input.date.substr(8, 2)}-${input.date.substr(5, 2)}-${input.date.substr(0, 4)}/return/false/pax/ADT-1/redemption/true/promo/false`, {waitUntil: "networkidle0"})

  console.log("Starting search and waiting for results...")
  await page.waitForSelector("input[value='Find it']", {timeout: 90000})
  await page.click("input[value='Find it']")

  let result = 0
  do {
    try {     // eslint-disable-line no-useless-catch
      result = await Promise.race([
        page.waitForSelector("#AIR_SEARCH_RESULT_CONTEXT_ID0 tbody[id]", {timeout: 90000}).then(() => 0),
        page.waitForXPath("//p[contains(text(), 'No flights have been found')]", {timeout: 90000}).then(() => 1),
        page.waitForXPath("//h1[text()='Select Your Flight']", {timeout: 90000}).then(() => 2),
        page.waitForXPath("//div[contains(text(),'Please enter valid ')]", {timeout: 90000}).then(() => 3),
        page.waitForXPath("//p[contains(text(),'Jetblue.com is temporarily unavailable')]", {timeout: 90000}).then(() => 4),
        page.waitForXPath("//div[contains(text(),\"Because you've selected today's date\")]", {timeout: 90000}).then(() => 5),
        page.waitForXPath(`//div[@class='date' and contains(text(), '\t${parseInt(input.date.substr(8, 2), 10)} ')]/../div[contains(@class, 'notAvailText')]`, {timeout: 90000}).then(() => 6)
      ])
    } catch (err) {   // necessary to deal with a puppeteer bug where closing the browser causes a race condition
      throw err
    }

    if (result === 1 || result === 6) {
      console.log("No flights found")
      return {searchResults: []}
    } else if (result === 2) {
      throw new Error("Alternate UI")
    } else if (result === 3) {
      console.log("One or more airports not supported")
      return {searchResults: []}
    } else if (result === 4) {
      throw new Error("Jetblue down")
    } else if (result === 5) {
      await page.click(".continue_button")
    }
  } while (result !== 0)

  /** @param {import("puppeteer").ElementHandle<Element>} parentElement
   * @param {string} selector
   * @returns {Promise<string>} */
  const innerText = async(parentElement, selector) => {
    const stopsEl = await parentElement.$(selector)
    return page.evaluate(pageEl => pageEl.innerText, stopsEl)
  }

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

  console.log("Parsing page...")
  /** @type {SearchResult[]} */
  const flights = []
  const rows = await page.$$("#AIR_SEARCH_RESULT_CONTEXT_ID0 tbody[id]")
  for (const row of rows) {
    // Skip flights with connections
    if (await row.$(".combineRows") !== null)
      continue

    const flightDetails = (await row.$eval("a[onclick]", el => el.getAttribute("onclick"))) || ""
    const sections = /AirFlightDetailsGetAction\.do\?(.*)'/u.exec(flightDetails)
    if (!sections || !sections[1])
      throw new Error("Flight is missing details URL")

    /** @type {{[name: string]: string}} */
    const flightDetailsMap = {}
    sections[1].split("&").forEach(pair => {
      const keyVal = pair.split("=")
      flightDetailsMap[keyVal[0]] = keyVal[1]       // eslint-disable-line prefer-destructuring
    })

    const arrivalTimeRaw = (await innerText(row, ".colArrive .time")).replace("\nFlight Arrives Next Day", "")
    const arrivalTime24 = convert12HourTo24Hour(arrivalTimeRaw.replace("+1", ""))
    let arrivalDate = input.date
    if (arrivalTimeRaw.endsWith("+1")) {
      const oldDate = new Date(parseInt(input.date.substr(0, 4), 10), parseInt(input.date.substr(5, 2), 10) - 1, parseInt(input.date.substr(8, 2), 10))
      const nextDayDate = new Date(oldDate.getFullYear(), oldDate.getMonth(), oldDate.getDate() + 1)
      arrivalDate = `${nextDayDate.getFullYear()}-${(nextDayDate.getMonth() + 1).toString().padStart(2, "0")}-${nextDayDate.getDate().toString().padStart(2, "0")}`
    }

    /** @type {SearchResult} */
    const flight = {
      departureDateTime: `${input.date} ${convert12HourTo24Hour(await innerText(row, ".colDepart .time"))}`,
      arrivalDateTime: `${arrivalDate} ${arrivalTime24}`,
      origin: flightDetailsMap.origin,
      destination: flightDetailsMap.destination,
      airline: flightDetailsMap.companyShortName,
      flightNo: `${flightDetailsMap.operatingAirlineCode} ${flightDetailsMap.flightNumber}`,
      duration: (await innerText(row, ".colDuration div")).trim(),
      aircraft: (await innerText(row, ".equipType")).replace("Aircraft\n", "").replace("/Mint", "").trim(),
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    for (const fareCode of ["AT", "TC", "BT", "TM"]) {
      if (await row.$(`.colCost_${fareCode} .ptsValue`) === null || await page.$(`.colCost_${fareCode} .taxesValue`) === null)
        continue

      const miles = parseInt((await innerText(row, `.colCost_${fareCode} .ptsValue`)).replace(" pts", "").replace(",", ""), 10)
      const cash = parseInt((await innerText(row, `.colCost_${fareCode} .taxesValue`)).replace("+ $", "").replace(" taxes/fees", ""), 10)

      if (fareCode === "TM") {
        flight.costs.first.miles = miles
        flight.costs.first.cash = cash
      } else if (flight.costs.economy.miles === null || miles < flight.costs.economy.miles) {
        flight.costs.economy.miles = miles
        flight.costs.economy.cash = cash
      }
    }

    flights.push(flight)
  }

  return {searchResults: flights}
}
