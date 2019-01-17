/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to homepage...")
  await page.goto("https://www.delta.com/flight-search/book-a-flight")

  console.log("Setting one way...")
  await page.click("input[aria-label='One way']")

  console.log("Setting miles...")
  await page.click("input[aria-label='MILES']")

  /** @param {string} textBoxSelector
   * @param {string} textToFind */
  const fillFromAutocomplete = async(textBoxSelector, textToFind) => {
    await page.click(textBoxSelector)
    for (let backspace = 0; backspace < 3; backspace += 1)
      await page.keyboard.press("Backspace")
    await page.keyboard.type(`${textToFind}`)
    await page.waitForXPath(`//p[contains(text(), '(${textToFind})')]`, {timeout: 5000})
    await page.keyboard.press("Enter")
  }

  try {
    console.log("Setting origin...")
    await fillFromAutocomplete("#input_origin_1", input.origin)

    console.log("Setting destination...")
    await fillFromAutocomplete("#input_destination_1", input.destination)
  } catch (err) {
    // Airport wasn't found, return empty results
    console.log("Airport wasn't found")
    return {searchResults: []}
  }

  console.log("Opening up calendar for date and selecting date...")
  await page.click("#departureDate")

  for (let monthClick = 0; monthClick < 12; monthClick += 1) {
    const element = await page.$(`a[data-date*='${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}']`)
    if (element) {
      await element.click()
      break
    }

    await page.click("a[aria-label='Next']")
  }

  console.log("Starting first search...")
  await page.click(".btn-find-results")

  console.log("Waiting for Flexible Dates table...")
  try {     // eslint-disable-line no-useless-catch
    const resultFoundPromise = page.waitForSelector(".exactMatchCell a", {timeout: 90000}).then(() => 0)
    const errorMessagePromise = page.waitForXPath("//div[contains(text(), 'there are no scheduled Delta/Partner')]", {timeout: 90000}).then(() => 1)
    if (await Promise.race([resultFoundPromise, errorMessagePromise]) === 1) {
      console.log("No flights found")
      return {searchResults: []}
    }
  } catch (err) {
    throw err
  }

  await page.waitForSelector(".exactMatchCell a", {timeout: 90000})
  await page.click(".exactMatchCell a")

  const results = await page.waitForResponse("https://www.delta.com/shop/ow/search", {timeout: 90000})
  const raw = await results.json()

  const searchResults = []
  for (const itinerary of raw.itinerary) {
    const [trip] = itinerary.trip

    // Only non-stop flights
    if (trip.flightSegment.length > 1)
      continue

    /** @type {SearchResult} */
    const result = {
      departureDateTime: trip.schedDepartLocalTs.replace("T", " "),
      arrivalDateTime: trip.schedArrivalLocalTs.replace("T", " "),
      origin: trip.originAirportCode,
      destination: trip.destAirportCode,
      airline: trip.flightSegment[0].marketingCarrier.name,
      flightNo: `${trip.flightSegment[0].marketingCarrier.code} ${trip.flightSegment[0].marketingFlightNum}`,
      duration: `${trip.totalTripTime.hour}h ${trip.totalTripTime.minute}m`,
      aircraft: trip.flightSegment[0].flightLeg[0].aircraft.fleetName.trim(),
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    for (const fare of itinerary.fare) {
      // Make sure the class is available
      if (!fare.totalPrice)
        continue

      let classOfService = null
      if (fare.dominantSegmentBrandId === "FIRST" || fare.dominantSegmentBrandId === "D1") {
        classOfService = "first"
      } else if (fare.dominantSegmentBrandId === "MAIN" || fare.dominantSegmentBrandId === "DCP" || fare.dominantSegmentBrandId === "E") {
        classOfService = "economy"
      } else {
        throw new Error(`Unknown fare type ${fare.dominantSegmentBrandId}`)
      }

      let cash = fare.totalPrice.currency.amount
      const {miles} = fare.totalPrice.miles

      if (fare.totalPrice.currency.code === "CAD") {
        cash *= 1.33
      } else if (fare.totalPrice.currency.code !== "USD")
        throw new Error("Only USD prices are allowed")

      let setCosts = true
      if (result.costs[classOfService] && result.costs[classOfService].miles)
        if (miles > result.costs[classOfService].miles)
          setCosts = false
      if (setCosts) {
        result.costs[classOfService].cash = cash
        result.costs[classOfService].miles = miles
      }
    }

    searchResults.push(result)
  }

  return {searchResults}
}
