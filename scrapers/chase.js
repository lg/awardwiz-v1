/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Doing straight search...")

  const urlForCabin = /** @param {string} cabin */ (cabin) => `https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:${input.origin},to:${input.destination},departure:${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}TANT&passengers=children:0,adults:1,seniors:0,infantinlap:&options=cabinclass:${cabin},nopenalty:N,sortby:price,maxhops:0&mode=search`

  const legs = {}
  for (const cabin of ["economy", "premium", "business", "first"]) {
    page.goto(urlForCabin(cabin))
    const raw = await page.waitForResponse("https://www.expedia.com/flight/search/", {timeout: 90000}).then(result => result.json())
    for (const legName of Object.keys(raw.content.legs))
      if (legName.length > 0)   // Some dirty results are returned for whatever reason
        legs[legName] = raw.content.legs[legName]
  }

  /** @type {SearchResult[]} */
  const flights = []
  for (const legName of Object.keys(legs)) {
    const leg = legs[legName]

    // Only process non-stops for now
    if (leg.stops > 0)
      continue

    /** @type {SearchResult} */
    const flight = {
      departureDateTime: leg.departureTime.isoStr.substr(0, 16).replace("T", " "),
      arrivalDateTime: leg.arrivalTime.isoStr.substr(0, 16).replace("T", " "),
      origin: leg.departureLocation.airportCode,
      destination: leg.arrivalLocation.airportCode,
      airline: leg.carrierSummary.airlineName,
      flightNo: `${leg.timeline[0].carrier.airlineCode} ${leg.timeline[0].carrier.flightNumber}`,
      duration: `${leg.duration.hours}h ${leg.duration.minutes}m`,
      aircraft: leg.timeline[0].carrier.plane,
      costs: {
        economy: {miles: null, cash: null, isSaverFare: false},
        business: {miles: null, cash: null, isSaverFare: false},
        first: {miles: null, cash: null, isSaverFare: false}
      }
    }

    // starting at 1: first, business, coach, ?, premium coach
    const cabin = {"1": "first", "2": "business", "3": "economy", "4": "economy", "5": "economy"}[leg.timeline[0].carrier.cabinClass]    // eslint-disable-line quote-props
    const miles = Math.floor(leg.price.totalPriceAsDecimal * 66.666134440364043)    // on the Chase Sapphire Reserve

    const foundFlight = flights.find(checkFlight => checkFlight.flightNo === flight.flightNo)
    if (foundFlight) {
      // The flight already exists, change pricing to the new flight if this is cheaper
      if (!foundFlight.costs[cabin].miles || (foundFlight.costs[cabin].miles && miles < foundFlight.costs[cabin].miles)) {
        foundFlight.costs[cabin].miles = miles
        foundFlight.costs[cabin].cash = 0
      }
      continue
    }

    flight.costs[cabin].miles = miles
    flight.costs[cabin].cash = 0

    flights.push(flight)
  }

  return {searchResults: flights}
}
