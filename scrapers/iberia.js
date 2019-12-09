/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async (page, input) => {
  // The strategy is to go to the search URL, force the log-in and go to the
  // search URL again.
  // The website is a bit tricky, for each flight listing it has two elements:
  // an .oculto and an .choose-flight-list, both contain different info,
  // so this algorithms scans the table 3 times, ones for flight info (.oculto),
  // onces for other infos (.choose-flight-list) and once for prices,
  // this is done by clicking on every possible radio button.

  console.log('Going to search page...')
  await page.goto(`https://www.iberia.com/web/affinityTwentyBooking.do?tabId=&menuId=IBRECA&orig=${input.origin}&dest=${input.destination}&op=IB,I2,VY,BA&oneway=true&cabin=&pa=false&fecIda=${input.date.replace(/-/g, '')}&numADT=1&numCHD=0`)

  let result = 0
  try {     // eslint-disable-line no-useless-catch
    result = await Promise.race([
      // body.IBLOIN is the log-in page
      page.waitForSelector('body.IBLOIN').then(() => 0),
      // body.IPEVFA is the flight search page
      page.waitForSelector('body.IPEVFA').then(() => 1)
    ])
  } catch (err) {   // necessary to deal with a puppeteer bug where closing the browser causes a race condition
    throw err
  }

  if (result === 0) {
    console.log('Logging in first...')
    await page.type('#vLogin_1', input.username)
    await page.type('#vPassword_1', input.password)

    console.log('Clicking login and waiting...')
    await page.click('#submitButton')
    await page.waitForSelector('body.IBUPTS')
    console.log('Done logging in')
    await page.waitFor(1000)
    await page.goto(`https://www.iberia.com/web/affinityTwentyBooking.do?tabId=&menuId=IBRECA&orig=${input.origin}&dest=${input.destination}&op=IB,I2,VY,BA&oneway=true&cabin=&pa=false&fecIda=${input.date.replace(/-/g, '')}&numADT=1&numCHD=0`, { waitUntil: 'networkidle0' })
    await page.waitFor(1000)
    console.log('Reload again original page')
  }

  /** @param {import("puppeteer").ElementHandle<Element> | import("puppeteer").Page} parentElement
   * @param {string} selector
   * @returns {Promise<string>} */
  const innerText = async (parentElement, selector) => {
    const stopsEl = await parentElement.$(selector)
    return page.evaluate(pageEl => pageEl.innerText, stopsEl)
  }

  // Part 1: Getting flight number
  console.log('Parsing to get flight details...')
  const flights = []
  for (const row of await page.$$('tr.flight-info.desplegable.oculto')) {
    /** @type {SearchResult} */
    const flight = {
      departureDateTime: null,
      arrivalDateTime: null,
      origin: null,
      destination: null,
      airline: (await innerText(row, '.company')).trim(),
      flightNo: `${(await innerText(row, '.flight-code')).substr(0, 2)} ${parseInt((await innerText(row, '.flight-code')).substr(2), 10)}`,
      duration: null,
      aircraft: null, // it's possible to get, but got lazy
      costs: {
        economy: { miles: null, cash: null, isSaverFare: null },
        business: { miles: null, cash: null, isSaverFare: null },
        first: { miles: null, cash: null, isSaverFare: null }
      }
    }
    flights.push(flight)
  }

  // Part 2: getting all other info
  console.log('Parse again to get more details')
  let i = 0
  for (const row of await page.$$('tr.choose-flight-list')) {
    const codes = await row.$$('.escale-codes abbr')
    if (codes.length > 2) {
      flights[i].hasStops = true
    }
    flights[i].departureDateTime = await page.evaluate(pageEl => {
      const a = pageEl.value
      return `${a.substr(0, 4)}-${a.substr(4, 2)}-${a.substr(6, 2)} ${a.substr(8, 2)}:${a.substr(10, 2)}`
    }, await row.$('input[name="fly-datetime"]'))
    flights[i].arrivalDateTime = await page.evaluate(pageEl => {
      const a = pageEl.value
      return `${a.substr(0, 4)}-${a.substr(4, 2)}-${a.substr(6, 2)} ${a.substr(8, 2)}:${a.substr(10, 2)}`
    }, await row.$('.hora-float input[type="hidden"]'))
    flights[i].origin = await page.evaluate(pageEl => pageEl && pageEl.innerText, codes[0])
    flights[i].destination = await page.evaluate(pageEl => pageEl && pageEl.innerText, codes[codes.length - 1])
    i++
  }

  // Part 3: getting prices
  console.log('Click to get prices')
  let j = 0
  for (const row of await page.$$('tr.choose-flight-list')) {
    let tarifaId = 0
    let tarifas = await row.$$('.rates')
    for (const tarifa of tarifas) {
      tarifaId++

      const tarifExists = await tarifa.$('div.input-height .type-radio')

      if (tarifExists && !flights[j].hasStops) {
        await tarifa.click('.form-radio')
        await page.waitForSelector('#btn')
        await page.click('#btn')
        const priceTag = await page.waitForSelector('.subfooter-rates .heading-1')
        const price = await page.evaluate(pageEl => pageEl.innerText, priceTag)

        const priceParts = price.split(' Avios + ')
        const cashMiles = {
          miles: parseInt(priceParts[0].replace(',', ''), 10),
          cash: parseFloat(priceParts[1].replace('$', '').replace(',', '')),
          isSaverFare: tarifaId == 1
        }

        // Note: Very often the last tarif is the business one
        const cabin = tarifas.length == tarifaId ? 'business' : 'economy'
        if (!flights[j].costs[cabin].miles || flights[j].costs[cabin].miles > cashMiles.miles) {
          flights[j].costs[cabin] = cashMiles
        }
      }
    }

    j++
  }

  return { searchResults: flights.filter(f => !f.hasStops) }
}
