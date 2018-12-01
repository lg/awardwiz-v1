/**
 * @param {import("puppeteer").Page} page
 * @param {AeroplanSearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  /** @param {string} selector */
  const waitAndClick = selector => {
    return page.waitForSelector(selector).then(() => {
      return page.click(selector)
    })
  }

  console.log("Going to homepage...")
  await page.goto("https://www.aeroplan.com")

  console.log("Selecting language...")
  await waitAndClick(".btn-primary")
  await page.waitForSelector(".header-login-btn")

  console.log("Logging in...")
  await waitAndClick(".header-login-btn")
  await page.type(".header-login-form-inner-wrapper #aeroplanNumber", input.aeroplanUsername)
  await page.type(".header-login-form-inner-wrapper input[type=password]", input.aeroplanPassword)
  await page.click(".header-login-form-inner-wrapper .form-login-submit")
  await page.waitForSelector(".header-logout-btn")

  console.log("Going to search page and waiting for default airport...")
  await page.goto("https://www.aeroplan.com/en/use-your-miles/travel.html", {waitUntil: "networkidle0"})

  console.log("Selecting one-way...")
  await waitAndClick("div[data-automation=round-trip-trip-type]")
  await waitAndClick("div[data-value=One-way]")

  console.log("Setting origin...")
  await waitAndClick("div[data-automation=one-way-from-location]")
  await page.keyboard.type(input.from)
  await waitAndClick("div[data-automation=one-way-from-location] div[data-selectable]")

  console.log("Setting destination...")
  await waitAndClick("div[data-automation=one-way-to-location]")
  await page.keyboard.type(input.to)
  await waitAndClick("div[data-automation=one-way-to-location] div[data-selectable]")

  console.log("Turning off 'Compare to AirCanada.com' option...")
  await waitAndClick("#OneWayAirCanadaCompare1")

  console.log("Setting date (mm/dd/yyyy)...")
  const aeroplanDate = `${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}`
  await page.type("div[data-automation=one-way-departure-date] #l1Oneway", aeroplanDate)

  console.log("Starting search and waiting for results window...")
  await page.click("div[data-automation=one-way-submit] button")
  const newWindowTarget = await page.browser().waitForTarget(target => target.url() === "https://www.aeroplan.com/adr/Results.do")
  const newPage = await newWindowTarget.page()

  console.log("Waiting for results...")
  const response = await newPage.waitForResponse("https://www.aeroplan.com/adr/Results_Ajax.jsp?searchType=oneway&forceIkk=false")
  const raw = await response.json()

  console.log("Parsing results...")
  const standardizedResults = standardizeResults(raw)

  console.log("Done.")

  return {searchResults: standardizedResults}
}

/**
 * @param {import("./aeroplan").RawAeroplanResult} aeroplanTrip
 */
const standardizeResults = aeroplanTrip => {
  const flights = aeroplanTrip.NormalResults.product[0].tripComponent[0].ODoption || []

  // Aeroplan has two modes (basically Saver and Standard from United), this checks for that second type
  flights.push(...(aeroplanTrip.NormalResults.product[1].tripComponent[0].ODoption || []))

  const results = []
  for (const flight of flights) {
    let result = {
      fromDateTime: flight.segment[0].departureDateTime.toString().replace("T", " "),
      toDateTime: flight.segment[flight.segment.length - 1].arrivalDateTime.toString().replace("T", " "),
      fromAirport: flight.segment[0].origin,
      toAirport: flight.segment[flight.segment.length - 1].destination,
      flights: "",
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    for (const segment of flight.segment)
      result.flights += `,${segment.flightNo}`
    result.flights = result.flights.substr(1)

    // Look if we already have this entry, and if so, switch to it
    let foundPrevResult = false
    for (const checkResult of results) {
      if (checkResult.fromDateTime === result.fromDateTime && checkResult.flights === result.flights) {
        foundPrevResult = true
        result = checkResult
        break
      }
    }

    // The cabin code says the class of service. ME or MB means mixed.
    let cabin = "first"
    if (flight.cabin.includes("E"))
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
    result.costs[cabin].cash = 99.99

    if (!foundPrevResult)
      results.push(result)
  }

  return results
}
