/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to homepage...")
  await page.goto("https://www.alaskaair.com/planbook")

  console.log("Setting one way...")
  await page.click("#oneWay")

  console.log("Setting miles...")
  await page.click("#awardReservation")

  console.log("Setting origin...")
  /** @param {string} textBoxSelector
   * @param {string} textToFind */
  const fillFromAutocomplete = async(textBoxSelector, textToFind) => {
    await page.click(textBoxSelector)
    await page.keyboard.type(`${textToFind}`)
    await page.waitForSelector(`li[citycode='${textToFind}']`, {timeout: 90000})
    await page.click(`li[citycode='${textToFind}']`)
  }
  await fillFromAutocomplete("#fromCity", input.origin)

  console.log("Setting destination...")
  await fillFromAutocomplete("#toCity", input.destination)

  console.log("Setting date and starting search...")
  await page.click("#departureDate")
  await page.waitForSelector("#as-datepicker[aria-hidden='false']", {timeout: 90000})
  await page.click("#departureDate")
  for (let backspace = 0; backspace < 8; backspace += 1)
    await page.keyboard.press("Backspace")
  await page.keyboard.type(`${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(2, 2)}`)
  await page.keyboard.press("Enter")

  await page.waitForNavigation({timeout: 90000})

  /** @param {import("puppeteer").ElementHandle<Element>} parentElement
   * @param {string} selector
   * @returns {Promise<string>} */
  const innerText = async(parentElement, selector) => {
    const stopsEl = await parentElement.$(selector)
    return page.evaluate(pageEl => pageEl.innerText, stopsEl)
  }

  /** Converts a given date string to a YYYY-MM-DD HH:MM formatted string
   * @param {string} dateStr */
  const formatDateStr = dateStr => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.toTimeString().substr(0, 5)}`
  }

  console.log("Parsing page...")
  const results = []
  const rows = await page.$$("tr[role=listitem]")
  for (const row of rows) {
    // Only support non-stops for now
    const stopsText = await innerText(row, "a[title='Details']")
    if (stopsText.indexOf("Nonstop") === -1)
      continue

    /** @param {string} selector */
    const parseMilesAndCashFromSelector = async selector => {
      if (!(await row.$(selector)))
        return {miles: null, cash: null}
      const fare = (await row.$eval(selector, el => /** @type {HTMLLabelElement} */ (el).innerText)).match(/(.+)k \+\n\$(.+)\n/u)
      if (!fare)
        return {miles: null, cash: null}
      return {miles: Math.floor(parseFloat(fare[1]) * 1000), cash: parseInt(fare[2], 10)}
    }

    /** @type {SearchResult} */
    const result = {
      departureDateTime: formatDateStr(await row.$eval("a[data-seatmap]", el => (el.getAttribute("data-seatmap") || "").split(",")[5])),
      arrivalDateTime: formatDateStr(await row.$eval("a[data-seatmap]", el => (el.getAttribute("data-seatmap") || "").split(",")[7])),
      origin: await page.evaluate(rowEl => rowEl.getAttribute("orig"), row),
      destination: await page.evaluate(rowEl => rowEl.getAttribute("dest"), row),
      airline: await row.$eval(".FlightCarrierImage img", el => el.getAttribute("alt")),
      flightNo: `${await page.evaluate(rowEl => rowEl.getAttribute("class").substr(7, 2), row)} ${await row.$eval(".FlightNumber span", el => /** @type {HTMLSpanElement} */ (el).innerText)}`,
      duration: await row.$eval(".SegmentDiv:nth-of-type(2) span", el => /** @type {HTMLSpanElement} */ (el).innerText.split("\n").filter((val, index) => index === 0 || index === 2).join(" ")),
      aircraft: null,   // Note that Alaska DOES have some aircraft types, but they do stuff like 737-800 being "738"
      costs: {
        economy: await parseMilesAndCashFromSelector(".coach-fare .Price"),
        business: await parseMilesAndCashFromSelector(".business-fare .Price"),
        first: await parseMilesAndCashFromSelector(".first-fare .Price")
      }
    }

    results.push(result)
  }

  return {searchResults: results}
}
