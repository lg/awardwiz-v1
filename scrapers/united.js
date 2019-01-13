/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Getting United cookie...")
  await page.goto("https://www.united.com/ual/en/us/flight-search/book-a-flight")

  console.log("Searching for flights...")

  const maxConnectionsCode = 1  // only support non-stop flights for now. other valid codes: 3 (1 connection), 7 (2 connections)
  await page.goto(`https://www.united.com/ual/en/us/flight-search/book-a-flight/results/awd?f=${input.origin}&t=${input.destination}&d=${input.date}&tt=1&at=1&sc=${maxConnectionsCode}&px=1&taxng=1&idx=1`)

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
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
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

      for (const cabin of ["Economy", "Business", "First"]) {
        if (product.ProductTypeDescription.startsWith(cabin)) {
          const cabinLower = cabin.toLowerCase()
          if (!result.costs[cabinLower].miles || milesRequired < result.costs[cabinLower].miles) {
            result.costs[cabinLower].miles = milesRequired
            result.costs[cabinLower].cash = cashRequired
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
