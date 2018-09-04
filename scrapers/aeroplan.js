/* This file is uploaded by AwardMan to Apify and run as an Actor */
/* eslint-env node, module */

const Apify = require("apify")

const apifyMain = async() => {
  const input = await Apify.getValue("INPUT")

  console.log("Launching Puppeteer for Aeroplan...")
  const browser = await Apify.launchPuppeteer({
    proxyUrl: input.proxyUrl || null
  })

  if (!input.from || !input.to || !input.date || !input.aeroplanUsername || !input.aeroplanPassword) {
    console.error("Some parameters missing for call. from, to, date, aeroplanUsername, aeroplanPassword are required.")
    return
  }

  const page = await browser.newPage()

  const waitAndClick = selector => {
    return page.waitForSelector(selector).then(() => {
      return page.click(selector)
    })
  }

  await page.goto("https://www.aeroplan.com")

  // Language selection
  await waitAndClick(".btn-primary")
  await page.waitForSelector(".header-login-btn")

  // Login
  await waitAndClick(".header-login-btn")
  await page.type(".header-login-form-inner-wrapper #aeroplanNumber", input.aeroplanUsername)
  await page.type(".header-login-form-inner-wrapper input[type=password]", input.aeroplanPassword)
  await page.click(".header-login-form-inner-wrapper .form-login-submit")
  await page.waitForSelector(".header-logout-btn")

  // Search (and first wait for the default airport to get populated)
  await page.goto("https://www.aeroplan.com/en/use-your-miles/travel.html", {waitUntil: "networkidle0"})

  // Search - One-way
  await waitAndClick("div[data-automation=round-trip-trip-type]")
  await waitAndClick("div[data-value=One-way]")

  // Search - Origin
  await waitAndClick("div[data-automation=one-way-from-location]")
  await page.keyboard.type(input.from)
  await waitAndClick("div[data-automation=one-way-from-location] div[data-selectable]")

  // Search - Destination
  await waitAndClick("div[data-automation=one-way-to-location]")
  await page.keyboard.type(input.to)
  await waitAndClick("div[data-automation=one-way-to-location] div[data-selectable]")

  // Search - Date (mm/dd/yyyy)
  const aeroplanDate = `${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}`
  await page.type("div[data-automation=one-way-departure-date] #l1Oneway", aeroplanDate)

  // Start search and wait for results
  const clickNav = page.waitForNavigation({waitUntil: "networkidle0"})
  await page.click("div[data-automation=one-way-submit] button")
  const response = await page.waitForResponse("https://www.aeroplan.com/adr/Results_Ajax.jsp?searchType=oneway&forceIkk=false")
  const raw = await response.json()
  await clickNav
  await browser.close()

  console.log("Done.")

  const output = {results: standardizeResults(raw)}   // eslint-disable-line no-use-before-define
  await Apify.setValue("OUTPUT", output)
}

const standardizeResults = aeroplanTrip => {
  // Aeroplan has two modes (basically Saver and Standard from United)
  const classicFlights = aeroplanTrip.NormalResults.product[0].tripComponent[0].ODoption
  const classicPlusFlights = aeroplanTrip.NormalResults.product[1].tripComponent[0].ODoption
  const flights = classicFlights.concat(classicPlusFlights)

  const results = []
  for (const flight of flights) {
    let result = {
      fromDateTime: flight.segment[0].departureDateTime.replace("T", " "),
      toDateTime: flight.segment[flight.segment.length - 1].arrivalDateTime.replace("T", " "),
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

Apify.main(apifyMain)
