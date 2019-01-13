/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to search page...")
  await page.goto("https://www.southwest.com/air/booking/")

  console.log("Selecting one-way...")
  await page.click("input[value='oneway']")

  console.log("Selecting points...")
  await page.click("input[value='POINTS']")

  /** @param {string} textBoxSelector
   * @param {string} textToFind
   * @param {boolean} waitForAutocomplete */
  const fillFromAutocomplete = async(textBoxSelector, textToFind, waitForAutocomplete) => {
    await page.type(textBoxSelector, textToFind)
    if (waitForAutocomplete)
      await page.waitForSelector(`button[aria-label~=${textToFind}]`, {timeout: 90000})
    await page.click(`button[aria-label~=${textToFind}]`)
  }

  try {
    console.log("Setting origin...")
    await fillFromAutocomplete("#originationAirportCode", input.origin, false)

    console.log("Setting destination...")
    await fillFromAutocomplete("#destinationAirportCode", input.destination, false)
  } catch (err) {
    // Airport wasn't found, return empty results
    console.log("Airport wasn't found")
    return {searchResults: []}
  }

  console.log("Setting date...")
  await page.type("#departureDate", `${input.date.substr(5, 2)}/${input.date.substr(8, 2)}`)
  await page.keyboard.press("Enter")

  console.log("Starting search...")
  await page.click("#form-mixin--submit-button")
  const response = await page.waitForResponse("https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping", {timeout: 90000})
  const raw = await response.json()

  const rawResults = raw.data.searchResults.airProducts[0].details
  const flights = []
  for (const result of rawResults) {
    if (result.flightNumbers.length > 1)
      continue

    /** @type {SearchResult} */
    const flight = {
      departureDateTime: result.departureDateTime.substr(0, 19).replace("T", " "),
      arrivalDateTime: result.arrivalDateTime.substr(0, 19).replace("T", " "),
      origin: result.originationAirportCode,
      destination: result.destinationAirportCode,
      flightNo: `${result.stopsDetails[0].operatingCarrierCode} ${result.flightNumbers[0]}`,
      airline: result.stopsDetails[0].operatingCarrierCode === "WN" ? "Southwest" : null,
      aircraft: result.stopsDetails[0].aircraftEquipmentType,
      duration: `${Math.floor(result.stopsDetails[0].legDuration / 60)}h ${result.stopsDetails[0].legDuration % 60}m`,
      costs: {
        economy: {miles: null, cash: null},
        business: {miles: null, cash: null},
        first: {miles: null, cash: null}
      }
    }

    if (result.fareProducts.ADULT.WGA.availabilityStatus === "AVAILABLE") {
      flight.costs.economy.miles = parseInt(result.fareProducts.ADULT.WGA.fare.totalFare.value, 10)
      flight.costs.economy.cash = parseInt(result.fareProducts.ADULT.WGA.fare.totalTaxesAndFees.value, 10)

    } else if (result.fareProducts.ADULT.ANY.availabilityStatus === "AVAILABLE") {
      flight.costs.economy.miles = parseInt(result.fareProducts.ADULT.ANY.fare.totalFare.value, 10)
      flight.costs.economy.cash = parseInt(result.fareProducts.ADULT.ANY.fare.totalTaxesAndFees.value, 10)
    }

    // We don't process any "business" fares for Southwest since their Business is really just early boarding

    flights.push(flight)
  }

  return {searchResults: flights}
}
