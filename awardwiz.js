import MiniORM from "./miniorm.js"
import AwardWizGrid from "./awardwiz-grid.js"
import AWSProvider from "./cloud-providers/aws-provider.js"

/* global JSON5 */

export default class AwardWiz {
  constructor() {
    // @ts-ignore because the type checker isn't very good at async constructors
    return (async() => {
      /** @type {AwardWizConfig} */
      this.config = {
        awsAccessKey: "", awsSecretAccessKey: "", awsRegionZone: "us-west-1a", awsLambdaRoleArn: "",
        functionName: "awardwiz", proxyUrl: "",
        origin: "", originNearby: true, destination: "", destinationNearby: true, date: "",
        checkChase: true,

        // The scrapers can change a lot, so we maintain the list in a json
        // @ts-ignore because the import isn't working for JSON5
        scrapers: await fetch("scrapers.json").then(result => result.text()).then(result => JSON5.parse(result)),
        // @ts-ignore because the import isn't working for JSON5
        firstRegions: await fetch("first.json").then(result => result.text()).then(result => JSON5.parse(result))
      }

      const regionSearchEl = /** @type {HTMLSelectElement} */ (document.querySelector("#regionSearch"))
      this.config.firstRegions.forEach((route, index) => {
        regionSearchEl.innerHTML += `<option value='route${index}-ab'>${route.region1}→${route.region2}</option>`
        regionSearchEl.innerHTML += `<option value='route${index}-ba'>${route.region2}→${route.region1}</option>`
      })

      this.miniorm = new MiniORM(this.config)
      this.miniorm.addAndAttachDynamicSettingsToDOM(this.config.scrapers, "#scraperExtraParams")
      this.miniorm.attachSettingsToDOM()

      this.cloud = new AWSProvider({
        files: ["index.js", "package.json", ...Object.keys(this.config.scrapers).map(scraperName => `${scraperName}.js`)],
        filesDir: "scrapers",

        accessKey: this.config.awsAccessKey,
        secretAccessKey: this.config.awsSecretAccessKey,
        regionZone: this.config.awsRegionZone,
        lambdaRoleArn: this.config.awsLambdaRoleArn,

        functionName: this.config.functionName
      })
      this.cloud.initOnPage()

      this.gridView = new AwardWizGrid(/** @type {HTMLDivElement} */ (document.querySelector("#resultsGrid")), AwardWiz.onRowClicked)

      /** @type {Array<SearchResultRow>} */
      this.resultRows = []    // the data more aggregated for the grid view
      /** @type {Object<string, Array<SearchResult>>} */
      this.scraperResults = {};    // the raw result data from the scrapers

      (async() => {
        const commits = await fetch("https://api.github.com/repos/lg/awardwiz/commits").then(result => result.json())
        let commitsHTML = ""
        for (let curCommitIndex = 0; curCommitIndex < 5; curCommitIndex += 1) {
          const commit = commits[curCommitIndex]
          commitsHTML += `[${commit.commit.committer.date.substr(0, 10)}] ${commit.commit.message} <a href='${commit.html_url}'>view</a><br/>`
        }
        commitsHTML += "<a href='https://github.com/lg/awardwiz/commits/master'>view all</a>";
        /** @type {HTMLDivElement} */ (document.querySelector("#latestCommits")).innerHTML = commitsHTML
      })()

      return this
    })()
  }

  exportSettings() {
    this.miniorm.exportSettings()
  }

  importSettings() {
    this.miniorm.importSettings()
  }

  async prep() {
    await this.cloud.prep()
    console.log("Prepped successfully.")
  }

  /** Runs a scraper and outputs status/debug text to console and text fields.
   * @param {string} scraperName
   * @param {SearchQuery} searchQuery
   * @param {HTMLElement} statusElement */
  async searchUsingScraper(scraperName, searchQuery, statusElement) {
    /** @type {ScraperParams} */
    const scraperParams = {
      scraper: scraperName,
      params: {...searchQuery}
    }

    // Some scrapers require a proxy be used, set it if necessary
    if (this.config.scrapers[scraperName].useProxy)
      scraperParams.proxy = this.config.proxyUrl

    // Some scrapers have extra settings (like usernames/passwords that need to be used)
    if (this.config.scrapers[scraperName].extraParams)
      for (const paramName of Object.keys(this.config.scrapers[scraperName].extraParams))
        scraperParams.params[paramName] = this.config.scrapers[scraperName].extraParams[paramName].value

    // Keep a per-scraper status visible
    const statusDiv = document.createElement("div")
    const scraperIdentifier = `${scraperName} (${searchQuery.origin}→${searchQuery.destination})`
    statusDiv.innerHTML = `Searching ${scraperIdentifier}...`
    statusElement.appendChild(statusDiv)

    // Wait for scraper results
    console.log(`Running scraper ${scraperIdentifier}...`)

    const startTime = (new Date()).valueOf()
    const result = await this.cloud.run(scraperParams)
    if (result.scraperResult) {
      console.log(`Scraper ${scraperIdentifier} returned ${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}.`)
    } else {
      console.log(`Scraper ${scraperIdentifier} errored.`)
      result.scraperResult = {searchResults: []}
    }

    // Individual status per scraper
    const statusLine = result.error ? `Error: ${result.error.name || result.error.message.substr(0, 50)}` : `${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}`
    statusDiv.innerHTML = `${scraperIdentifier} -
      ${statusLine} (${((new Date()).valueOf() - startTime) / 1000}s) -
      <a href="data:image/jpeg;base64,${result.screenshot}" target="_blank">show screenshot</a>
      <a href="data:application/json;base64,${btoa(JSON.stringify(Object.assign(result, {screenshot: "[FILTERED OUT]"}), null, 2))}" target="_blank">show result</a>
      <a href="${result.awsLogURL}" target="_blank">show cloudwatch log</a>
      <a id='retry' href="javascript:void(0)">retry</a>
      (right click to open)`

    const retryLink = /** @type {HTMLDivElement} */ (statusDiv.querySelector("#retry"))
    retryLink.addEventListener("click", () => this.runScraperAndAddToGrid(scraperName, searchQuery, statusElement))

    return result
  }

  /** @param {string} scraperName */
  addScraperResultsToGrid(scraperName) {
    // Store and merge the results into the table
    for (const newFlight of this.scraperResults[scraperName]) {

      // Go over all new rows, if they're already in the grid (as identified by the departure and
      // arrival times being the same), combine them, though display the cheapest mileage fare first
      let foundRow = false
      for (const checkResultRow of this.resultRows) {
        if (checkResultRow.departureDateTime === newFlight.departureDateTime && checkResultRow.arrivalDateTime === newFlight.arrivalDateTime) {
          foundRow = true
          checkResultRow.scrapersUsed[scraperName] = newFlight

          for (const className of ["economy", "business", "first"]) {
            if (newFlight.costs[className].miles !== null) {
              let overwrite = false
              if (newFlight.costs[className].miles < checkResultRow.costs[className].miles)
                overwrite = true

              // This is the first time we add miles into an existing row
              if (newFlight.costs[className].miles > 0 && checkResultRow.costs[className].miles === null)
                overwrite = true

              // If miles are the same on this new one, select it if it's less cash than the existing one
              // or if it actually has a cash amount.
              if (newFlight.costs[className].miles === checkResultRow.costs[className].miles) {
                if (newFlight.costs[className].cash !== null) {
                  if (checkResultRow.costs[className].cash === null) {
                    overwrite = true
                  } else if (newFlight.costs[className].cash < checkResultRow.costs[className].cash) {
                    overwrite = true
                  }
                }
              }

              if (overwrite) {
                // A better match was found
                checkResultRow.costs[className].miles = newFlight.costs[className].miles
                checkResultRow.costs[className].cash = newFlight.costs[className].cash
                checkResultRow.costs[className].scraper = scraperName
              }
            }
          }
          break
        }
      }
      if (!foundRow) {
        /** @type {SearchResultRow} */
        const newRow = {
          scrapersUsed: {[scraperName]: newFlight},
          ...JSON.parse(JSON.stringify(newFlight))    // copy the object
        }

        // We'll assume this is the cheapest mileage option since it's the first
        for (const className of ["economy", "business", "first"]) {
          if (newRow.costs[className].miles !== null)
            newRow.costs[className].scraper = scraperName
        }

        this.resultRows.push(newRow)
      }
    }

    this.gridView.grid.api.setRowData(this.resultRows)
  }

  /** Runs a scraper and adds its results to the grid
   * @param {string} scraperName
   * @param {SearchQuery} query
   * @param {HTMLElement} statusElement */
  async runScraperAndAddToGrid(scraperName, query, statusElement) {
    const result = await this.searchUsingScraper(scraperName, query, statusElement)
    if (result && result.scraperResult) {
      this.scraperResults[scraperName] = result.scraperResult.searchResults
      this.addScraperResultsToGrid(scraperName)
    }
    return result
  }

  async search() {
    const statusElement = /** @type {HTMLDivElement} */ (document.getElementById("searchStatus"))
    this.startNewSearch(`${this.config.origin}→${this.config.destination}`, statusElement)

    /** @type {SearchQuery} */
    const query = {
      origin: this.config.origin,
      destination: this.config.destination,
      date: this.config.date
    }

    console.log("Searching ita to find flights and airlines...")
    const itaResults = await this.runScraperAndAddToGrid("ita", {...query, originNearby: this.config.originNearby.toString(), destinationNearby: this.config.destinationNearby.toString()}, statusElement)
    this.gridView.grid.api.hideOverlay()

    // Convert the airline codes to all the scrapers which support those airlines and do
    // it per origin->destination mapping from ita. Also skip Chase if requested.
    const scrapersAndOrigDest = []
    for (const row of this.resultRows)
      for (const checkScraperName of Object.keys(this.config.scrapers))
        if ((checkScraperName === "chase" && this.config.checkChase) || checkScraperName !== "chase")
          if (this.config.scrapers[checkScraperName].searchesAllAirlines || this.config.scrapers[checkScraperName].searchesAirlines.some((/** @type {string} */ checkCode) => checkCode === (row.flightNo || "").substr(0, 2)))
            scrapersAndOrigDest.push(`${checkScraperName}|${row.origin}|${row.destination}`)

    // Some airlines will always get searched depending on if we're considering airports they serve
    // const searchingAirports = [this.config.origin, this.config.destination]
    const origins = [this.config.origin, ...((itaResults.scraperResult || {nearbyOriginAirports: []}).nearbyOriginAirports || [])]
    const destinations = [this.config.destination, ...((itaResults.scraperResult || {nearbyDestinationAirports: []}).nearbyDestinationAirports || [])]
    for (const checkScraperName of Object.keys(this.config.scrapers)) {
      if (this.config.scrapers[checkScraperName].alwaysForAirports) {
        /** @type {Array<string>} */
        const alwaysForAirports = this.config.scrapers[checkScraperName].alwaysForAirports || []

        const matchedOrigins = origins.filter(origin => alwaysForAirports.some(alwaysForAirport => origin === alwaysForAirport))
        const matchedDestinations = destinations.filter(destination => alwaysForAirports.some(alwaysForAirport => destination === alwaysForAirport))

        for (const origin of matchedOrigins)
          for (const destination of matchedDestinations)
            scrapersAndOrigDest.push(`${checkScraperName}|${origin}|${destination}`)
      }
    }

    await this.runSearch(scrapersAndOrigDest, statusElement)

    console.log("Completed search.")
    this.gridView.grid.api.hideOverlay()
  }

  /**
   * @param {string} title
   * @param {HTMLDivElement} statusElement
   */
  async startNewSearch(title, statusElement) {
    // Reset the previous results if any
    statusElement.innerHTML = ""
    this.resultRows = []
    this.scraperResults = {}
    this.gridView.grid.api.setRowData([])

    this.gridView.grid.api.showLoadingOverlay()
    document.title = `AwardWiz - ${title}`
  }

  async searchRegion() {
    const statusElement = /** @type {HTMLDivElement} */ (document.getElementById("searchStatus"))

    const regionSearch = /** @type {HTMLSelectElement} */ (document.querySelector("#regionSearch")).value
    let searchRoutes = /** @type {AwardWizConfig["firstRegions"][0]["flights"]} */ ([])
    this.config.firstRegions.forEach((route, index) => {
      if (regionSearch === `route${index}-ab`) {
        searchRoutes = route.flights
        this.startNewSearch(`${route.region1}→${route.region2}`, statusElement)
      } else if (regionSearch === `route${index}-ba`) {
        searchRoutes = route.flights.map(curRoute => {
          return {airline: curRoute.airline, airport1: curRoute.airport2, airport2: curRoute.airport1}
        })
        this.startNewSearch(`${route.region2}→${route.region1}`, statusElement)
      }
    })

    const scrapersAndOrigDest = []
    for (const firstFlight of searchRoutes) {
      for (const checkScraperName of Object.keys(this.config.scrapers))
        if (this.config.scrapers[checkScraperName].searchesAirlines && this.config.scrapers[checkScraperName].searchesAirlines.some((/** @type {string} */ checkCode) => checkCode === firstFlight.airline))
          scrapersAndOrigDest.push(`${checkScraperName}|${firstFlight.airport1}|${firstFlight.airport2}`)
    }

    await this.runSearch(scrapersAndOrigDest, statusElement)

    console.log("Completed search.")
    this.gridView.grid.api.hideOverlay()
  }

  /**
   * @param {string[]} scrapersAndOrigDest
   * @param {HTMLElement} statusElement
   */
  async runSearch(scrapersAndOrigDest, statusElement) {
    const uniqueScrapersAndOrigDest = [...new Set(scrapersAndOrigDest)].sort()
    if (uniqueScrapersAndOrigDest.length > 0) {
      console.log("Starting search...")
      await Promise.all(uniqueScrapersAndOrigDest.map(scaperAndOrigDest => {
        const [scraperName, origin, destination] = scaperAndOrigDest.split("|")
        const properOrigDestQuery = {origin, destination, date: this.config.date}
        return this.runScraperAndAddToGrid(scraperName, properOrigDestQuery, statusElement)
      }))
    }
  }

  /**
   * @param {import("AgGrid").RowClickedEvent} event
   */
  static onRowClicked(event) {
    console.log(`Selected flight details: ${JSON.stringify(event.data, null, 2)}`)
  }
}
