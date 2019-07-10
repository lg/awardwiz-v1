/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to search page...")
  await page.goto("https://www.united.com/ual/en/us/flight-search/book-a-flight")

  console.log("Selecting points...")
  await page.click("label[for=RedeemMiles_rMiles]")

  console.log("Selecting one-way...")
  await page.click("label[for=TripTypes_ow]")

  console.log("Setting origin...")
  await page.click("label[for=Trips_0__Origin]")
  await page.keyboard.type(input.origin)

  console.log("Setting destination...")
  await page.click("label[for=Trips_0__Destination]")
  await page.keyboard.type(input.destination)

  console.log("Setting date...")
  await page.click("label[for=Trips_0__DepartDate]")
  await page.keyboard.type(input.date)

  console.log("Searching...")
  await page.click("#btn-search")

  console.log("Waiting for JSON results...")
  const response = await page.waitForResponse("https://www.united.com/ual/en/us/flight-search/book-a-flight/flightshopping/getflightresults/awd", {timeout: 90000})
  const raw = await response.json()

  const standardizedResults = []
  if (raw.data.Trips !== null)
    standardizedResults.push(...standardizeResults(raw.data.Trips[0]))
  const warnings = []
  if (raw.errors)
    warnings.push(raw.errors[0])

  console.log("Done.")

  return {searchResults: standardizedResults, warnings}
}

/**
 * @param {any} unitedTrip
 */
const standardizeResults = (unitedTrip) => {
  /** @type {SearchResult[]} */
  const results = []
  for (const flight of unitedTrip.Flights) {
    /** @type {SearchResult} */
    const result = {
      departureDateTime: monthDayYearToYearMonthDayDateTime(flight.DepartDateTime),
      arrivalDateTime: monthDayYearToYearMonthDayDateTime(flight.LastDestinationDateTime),
      origin: flight.Origin,
      destination: flight.LastDestination.Code,
      flightNo: `${flight.MarketingCarrier} ${flight.FlightNumber}`,
      airline: flight.MarketingCarrierDescription,
      aircraft: flight.EquipmentDisclosures.EquipmentDescription,
      duration: null,
      costs: {
        economy: {miles: null, cash: null, isSaverFare: null},
        business: {miles: null, cash: null, isSaverFare: null},
        first: {miles: null, cash: null, isSaverFare: null}
      }
    }

    // United's API has a way of returning flights with more connections than asked
    if (flight.StopsandConnections > 0)
      continue

    // Convert united format to standardized miles and cash formats
    for (const product of flight.Products) {
      if (product.Prices.length === 0)
        continue

      /** @type {number} */
      const milesRequired = product.Prices[0].Amount
      /** @type {number} */
      const cashRequired = product.TaxAndFees ? product.TaxAndFees.Amount : 0
      /** @type {boolean} */
      const isSaverFare = product.AwardType === "Saver"

      for (const cabin of ["Economy", "Business", "First"]) {
        if (product.ProductTypeDescription.startsWith(cabin)) {
          const cabinLower = cabin.toLowerCase()
          if (!result.costs[cabinLower].miles || milesRequired < result.costs[cabinLower].miles) {
            result.costs[cabinLower].miles = milesRequired
            result.costs[cabinLower].cash = cashRequired
            result.costs[cabinLower].isSaverFare = isSaverFare
          }
        }
      }
    }

    results.push(result)
  }
  return results
}

/** @param {string} monthDayYear */
const monthDayYearToYearMonthDayDateTime = monthDayYear => {
  return `${monthDayYear.substr(6, 4)}-${monthDayYear.substr(0, 2)}-${monthDayYear.substr(3, 2)} ${monthDayYear.substr(11)}`
}
