/**
 * @param {import("puppeteer").Page} page
 * @param {UnitedSearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Getting United cookie...")
  await page.goto("https://www.united.com/ual/en/us/flight-search/book-a-flight")

  console.log("Searching for flights...")

  if (typeof input.maxConnections === "undefined" || input.maxConnections === null)
    input.maxConnections = 0
  let maxConnectionsCode = 7
  if (input.maxConnections === 0)
    maxConnectionsCode = 1
  else if (input.maxConnections === 1)
    maxConnectionsCode = 3

  await page.goto(`https://www.united.com/ual/en/us/flight-search/book-a-flight/results/awd?f=${input.from}&t=${input.to}&d=${input.date}&tt=1&at=1&sc=${maxConnectionsCode}&px=1&taxng=1&idx=1`)

  console.log("Waiting for JSON results...")
  const response = await page.waitForResponse("https://www.united.com/ual/en/us/flight-search/book-a-flight/flightshopping/getflightresults/awd", {timeout: 90000})
  const raw = await response.json()
  const standardizedResults = standardizeResults(raw.data.Trips[0], input.maxConnections)

  console.log("Done.")

  return {searchResults: standardizedResults}
}

/**
 * @param {any} unitedTrip
 * @param {number} filterMaxConnections
 */
const standardizeResults = (unitedTrip, filterMaxConnections) => {
  const results = []
  for (const flight of unitedTrip.Flights) {
    /** @type {SearchResult} */
    const result = {
      fromDateTime: monthDayYearToYearMonthDayDateTime(flight.DepartDateTime),
      toDateTime: monthDayYearToYearMonthDayDateTime(flight.LastDestinationDateTime),
      fromAirport: flight.Origin,
      toAirport: flight.LastDestination.Code,
      flights: `${flight.OperatingCarrier}${flight.FlightNumber}`,
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    // United's API has a way of returning flights with more connections than asked
    if (flight.StopsandConnections > filterMaxConnections)
      continue

    // Append all connections to flight list
    if (flight.Connections)
      for (const connection of flight.Connections)
        result.flights += `,${connection.OperatingCarrier}${connection.FlightNumber}`

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
