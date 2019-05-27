/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  /** @param {string} selector */
  const waitAndClick = (selector, timeoutMs = 90000) => {
    return page.waitForSelector(selector, {timeout: timeoutMs}).then(() => {
      return page.click(selector)
    })
  }

  console.log("Going to homepage and selecting language...")
  await page.goto("https://www.aeroplan.com")

  try {     // eslint-disable-line no-useless-catch
    let result = 0
    result = await Promise.race([
      page.waitForSelector(".btn-primary", {timeout: 90000}).then(() => 0),
      page.waitForXPath("//p[contains(text(), 'currently undergoing routine maintenance')]", {timeout: 90000}).then(() => 1)
    ])
    if (result === 1)
      throw new Error("Aeroplan down")
  } catch (err) {
    throw err
  }

  console.log("Selecting language...")
  await waitAndClick(".btn-primary")
  await page.waitForSelector(".header-login-btn", {timeout: 90000})

  console.log("Logging in...")
  await waitAndClick(".header-login-btn")
  await page.type(".header-login-form-inner-wrapper #aeroplanNumber", input.username)
  await page.type(".header-login-form-inner-wrapper input[type=password]", input.password)
  await page.click(".header-login-form-inner-wrapper .form-login-submit")

  try {     // eslint-disable-line no-useless-catch
    let result = 0
    result = await Promise.race([
      page.waitForSelector(".header-logout-btn", {timeout: 90000}).then(() => 0),
      page.waitForXPath("//span[contains(text(), 'Page Temporarily Unavailable')]", {timeout: 90000}).then(() => 1)
    ])
    if (result === 1)
      throw new Error("Aeroplan down")
  } catch (err) {
    throw err
  }

  console.log("Going to search page and waiting for default airport...")
  await page.goto("https://www.aeroplan.com/en/use-your-miles/travel.html", {waitUntil: "networkidle0"})

  console.log("Selecting one-way...")
  await waitAndClick("input[value=One-way]")

  try {
    console.log("Setting origin...")
    await waitAndClick("div[data-automation=one-way-from-location]")
    await page.keyboard.type(input.origin)
    await waitAndClick(`div[data-value=${input.origin}]`, 5000)

    console.log("Setting destination...")
    await waitAndClick("div[data-automation=one-way-to-location]")
    await page.keyboard.type(input.destination)
    await waitAndClick(`div[data-value=${input.destination}]`, 5000)
  } catch (err) {
    // Airport wasn't found, return empty results
    console.log("Airport wasn't found")
    return {searchResults: []}
  }

  console.log("Turning off 'Compare to AirCanada.com' option...")
  await waitAndClick("#OneWayAirCanadaCompare1")

  console.log("Setting date (mm/dd/yyyy)...")
  const aeroplanDate = `${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}`
  await page.type("div[data-automation=one-way-departure-date] #l1Oneway", aeroplanDate)

  console.log("Starting search and waiting for results window...")
  await page.click("div[data-automation=one-way-submit] button")
  const newWindowTarget = await page.browser().waitForTarget(target => target.url() === "https://www.aeroplan.com/adr/Results.do", {timeout: 90000})
  const newPage = await newWindowTarget.page()

  console.log("Waiting for results...")
  const response = await newPage.waitForResponse("https://www.aeroplan.com/adr/Results_Ajax.jsp?searchType=oneway&forceIkk=false", {timeout: 90000})
  const raw = await response.json()

  console.log("Parsing results...")
  const standardizedResults = standardizeResults(raw)

  // Allow the page a bit of time to render so the screenshot works
  await page.waitFor(500)
  console.log("Done.")

  return {searchResults: standardizedResults}
}

/**
 * @param {import("./aeroplan").RawAeroplanResult} aeroplanTrip
 */
const standardizeResults = aeroplanTrip => {
  if (!aeroplanTrip.NormalResults)
    return []

  const flights = aeroplanTrip.NormalResults.product[0].tripComponent[0].ODoption || []

  // Aeroplan has two modes (basically Saver and Standard from United), this checks for that second type
  flights.push(...(aeroplanTrip.NormalResults.product[1].tripComponent[0].ODoption || []))

  /** @type {SearchResult[]} */
  const results = []
  for (const flight of flights) {
    if (flight.segment.length > 1)
      continue

    /** @type {SearchResult} */
    let result = {
      // Clean up format of flight times and also remove seconds
      departureDateTime: flight.segment[0].departureDateTime.toString().replace("T", " ").substr(0, 16),
      arrivalDateTime: flight.segment[flight.segment.length - 1].arrivalDateTime.toString().replace("T", " ").substr(0, 16),
      flightNo: `${flight.segment[0].flightNo.substr(0, 2)} ${flight.segment[0].flightNo.substr(2)}`,
      aircraft: flight.segment[0].aircraft,
      airline: aeroplanTrip.NormalResults.filters.airlines[flight.segment[0].airline],
      origin: flight.segment[0].origin,
      destination: flight.segment[flight.segment.length - 1].destination,
      duration: null,
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    // Look if we already have this entry, and if so, switch to it
    let foundPrevResult = false
    for (const checkResult of results) {
      if (checkResult.flightNo === result.flightNo) {
        foundPrevResult = true
        result = checkResult
        break
      }
    }

    // The cabin code says the class of service. ME or MB means mixed.
    let cabin = "first"
    if (flight.cabin.includes("E") || flight.cabin.includes("P"))   // E = economy, P = premium economy
      cabin = "economy"
    else if (flight.cabin.includes("B"))
      cabin = "business"

    // Aeroplan has mileage as 0 if you need to look it up on the chart
    const chart = {economy: aeroplanTrip.RewardQuoteStar.X, business: aeroplanTrip.RewardQuoteStar.I, first: aeroplanTrip.RewardQuoteStar.O}
    const miles = flight.mileage || chart[cabin]

    // There could already be a mileage here based on Classic vs ClassicPlus
    if (result.costs[cabin].miles) {
      result.costs[cabin].miles = Math.min(miles, result.costs[cabin].miles)
    } else {
      result.costs[cabin].miles = miles
    }

    // Aeroplan requires you hit up individual endpoints for the cash amount. Skip for now.
    result.costs[cabin].cash = null

    if (!foundPrevResult)
      results.push(result)
  }

  return results
}
