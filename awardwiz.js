import AwardWizGrid from "./awardwiz-grid.js"
import AWSProvider from "./cloud-providers/aws-provider.js"

export default class AwardWiz {
  constructor() {
    // @ts-ignore because the type checker isn't very good at async constructors
    return (async() => {
      this.config = await AwardWiz.loadConfigAndUpdateDocument()

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
      this.scraperResults = {}    // the raw result data from the scrapers

      return this
    })()
  }

  exportSettings() {
    const settingsString = btoa(JSON.stringify(this.config))
    console.log(`Your settings string is: ${settingsString}`)
    console.log("Please remember not to spread this to friends, personal credentials are contained in these strings!")
  }

  importSettings() {
    const settingsString = window.prompt("Paste the settings string from someone here. Please remember not to spread this to friends, personal credentials are contained in these strings!") || ""  // eslint-disable-line no-alert
    const settings = JSON.parse(atob(settingsString))

    // Settings for scrapers are stored in the scrapers object, but HTML elements are globally namespaced
    for (const scraperName of Object.keys(settings.scrapers))
      if (settings.scrapers[scraperName].extraParams)
        for (const extraParamName of Object.keys(settings.scrapers[scraperName].extraParams))
          settings[`${scraperName}${extraParamName}`] = settings.scrapers[scraperName].extraParams[extraParamName].value

    for (const key of Object.keys(settings)) {
      const el = /** @type {HTMLInputElement} */ (document.getElementById(key))
      if (el) {
        el.value = settings[key]
        const evt = document.createEvent("HTMLEvents")
        evt.initEvent("change", false, true)
        el.dispatchEvent(evt)
      }
    }

    window.location.reload()
  }

  static async loadConfigAndUpdateDocument() {
    /** @type {AwardWizConfig} */
    const config = {
      awsAccessKey: localStorage.getItem("awsAccessKey") || "",
      awsSecretAccessKey: localStorage.getItem("awsSecretAccessKey") || "",
      awsRegionZone: localStorage.getItem("awsRegionZone") || "us-west-1a",
      awsLambdaRoleArn: localStorage.getItem("awsLambdaRoleArn") || "",

      functionName: localStorage.getItem("functionName") || "awardwiz",
      proxyUrl: localStorage.getItem("proxyUrl") || "",
      origin: localStorage.getItem("origin") || "",
      destination: localStorage.getItem("destination") || "",
      date: localStorage.getItem("date") || "",

      // The scrapers can change a lot, so we maintain the list in a json
      scrapers: await fetch("scrapers.json").then(result => result.json())
    }

    const extraParamsDiv = document.querySelector("#scraperExtraParams")
    if (!extraParamsDiv)
      throw new Error("Missing extra params div")

    // Scrapers can have custom parameters
    Object.keys(config.scrapers).forEach((/** @type {string} */ scraperName) => {
      if (config.scrapers[scraperName].extraParams) {
        Object.keys(config.scrapers[scraperName].extraParams).forEach((/** @type {string} */ paramName) => {
          const extraParamKey = `${scraperName}${paramName}`
          config.scrapers[scraperName].extraParams[paramName].value = localStorage.getItem(extraParamKey) || ""

          const extraParamLabel = document.createElement("label")
          extraParamLabel.htmlFor = extraParamKey
          extraParamLabel.innerText = `${scraperName} ${paramName}: `
          const extraParamInput = document.createElement("input")
          extraParamInput.type = "text"
          extraParamInput.id = extraParamKey
          extraParamInput.value = config.scrapers[scraperName].extraParams[paramName].value
          extraParamInput.addEventListener("change", () => {
            config.scrapers[scraperName].extraParams[paramName].value = extraParamInput.value
            localStorage.setItem(extraParamKey, extraParamInput.value)
          })
          const extraParamBR = document.createElement("br")

          extraParamsDiv.append(extraParamLabel, extraParamInput, extraParamBR)
        })
      }
    })

    for (const configToSave of Object.getOwnPropertyNames(config)) {
      const element = /** @type {HTMLInputElement?} */ (document.getElementById(configToSave))
      if (!element)
        continue

      element.value = config[configToSave]
      element.addEventListener("change", () => {
        config[element.id] = element.value
        localStorage.setItem(element.id, config[element.id])
      })
    }

    return config
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
    statusDiv.innerHTML = `Searching ${scraperName}...`
    statusElement.appendChild(statusDiv)

    // Wait for scraper results
    console.log(`Running scraper '${scraperName}'...`)

    const startTime = (new Date()).valueOf()
    const result = await this.cloud.run(scraperParams)
    if (result.scraperResult) {
      console.log(`Scraper '${scraperName}' returned ${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}.`)
    } else {
      console.log(`Scraper '${scraperName}' errored.`)
      result.scraperResult = {searchResults: []}
    }

    // Individual status per scraper
    const statusLine = result.error ? `Error: ${result.error.name || result.error.message.substr(0, 50)}` : `${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}`
    statusDiv.innerHTML = `${scraperName} -
      ${statusLine} (${((new Date()).valueOf() - startTime) / 1000}s) -
      <a href="data:image/jpeg;base64,${result.screenshot}" target="_blank">show screenshot</a>
      <a href="data:application/json;base64,${btoa(JSON.stringify(Object.assign(result, {screenshot: "[FILTERED OUT]"}), null, 2))}" target="_blank">show result</a>
      <a href="${result.awsLogURL}" target="_blank">show cloudwatch log</a>
      (right click to open)`

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
  }

  async search() {
    // Reset the previous results if any
    const statusElement = /** @type {HTMLDivElement} */ (document.getElementById("searchStatus"))
    statusElement.innerHTML = ""
    this.resultRows = []
    this.scraperResults = {}

    this.gridView.grid.api.showLoadingOverlay()

    /** @type {SearchQuery} */
    const query = {
      origin: this.config.origin,
      destination: this.config.destination,
      date: this.config.date
    }

    console.log("Searching ita/southwest to find flights and airlines...")
    await Promise.all([
      this.runScraperAndAddToGrid("ita", query, statusElement),
      this.runScraperAndAddToGrid("southwest", query, statusElement)
    ])
    this.gridView.grid.api.hideOverlay()

    const uniqueAirlineCodes = [...new Set(this.resultRows.map(row => (row.flightNo || "").substr(0, 2)))]
    const useScrapers = []
    for (const scraperName of Object.keys(this.config.scrapers))
      if (this.config.scrapers[scraperName].searchedAirlines.some((/** @type {string} */ checkCode) => uniqueAirlineCodes.includes(checkCode)))
        if (useScrapers.indexOf(scraperName) === -1 && scraperName !== "southwest")
          useScrapers.push(scraperName)

    if (useScrapers.length > 0) {
      console.log(`Starting search with scrapers: ${useScrapers.join(", ")}...`)
      await Promise.all(useScrapers.map(scraperName => this.runScraperAndAddToGrid(scraperName, query, statusElement)))
    }

    console.log("Completed search.")
    this.gridView.grid.api.hideOverlay()
  }

  /**
   * @param {import("AgGrid").RowClickedEvent} event
   */
  static onRowClicked(event) {
    console.log(`Selected flight details: ${JSON.stringify(event.data, null, 2)}`)
  }
}
