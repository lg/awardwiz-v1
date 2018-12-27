import AwardWizGrid from "./awardwiz-grid.js"
import AWSProvider from "./cloud-providers/aws-provider.js"

export default class AwardWiz {
  constructor() {
    this.config = AwardWiz.loadConfigAndUpdateDocument()

    this.cloud = new AWSProvider({
      files: ["ita.js", "united.js", "aeroplan.js", "index.js", "package.json"],
      filesDir: "scrapers",

      accessKey: this.config.awsAccessKey,
      secretAccessKey: this.config.awsSecretAccessKey,
      regionZone: this.config.awsRegionZone,
      lambdaRoleArn: this.config.awsLambdaRoleArn,

      functionName: this.config.functionName
    })
    this.cloud.initOnPage()

    this.gridView = new AwardWizGrid(/** @type {HTMLDivElement} */ (document.querySelector("#resultsGrid")), AwardWiz.onRowClicked)
  }

  static loadConfigAndUpdateDocument() {
    /** @type {AwardWizConfig} */
    const config = {
      awsAccessKey: localStorage.getItem("awsAccessKey") || "",
      awsSecretAccessKey: localStorage.getItem("awsSecretAccessKey") || "",
      awsRegionZone: localStorage.getItem("awsRegionZone") || "us-west-1a",
      awsLambdaRoleArn: localStorage.getItem("awsLambdaRoleArn") || "",

      functionName: localStorage.getItem("functionName") || "awardwiz",
      proxyUrl: localStorage.getItem("proxyUrl") || "",
      aeroplanUsername: localStorage.getItem("aeroplanUsername") || "",
      aeroplanPassword: localStorage.getItem("aeroplanPassword") || "",
      origin: localStorage.getItem("origin") || "",
      destination: localStorage.getItem("destination") || "",
      date: localStorage.getItem("date") || "",

      searchITA: localStorage.getItem("searchITA") || "true",
      searchUnited: localStorage.getItem("searchUnited") || "true",
      searchAeroplan: localStorage.getItem("searchAeroplan") || "true"
    }

    for (const configToSave of Object.getOwnPropertyNames(config)) {
      const element = /** @type {HTMLInputElement?} */ (document.getElementById(configToSave))
      if (!element)
        continue

      if (configToSave.startsWith("search"))
        element.checked = config[configToSave] === "true"
      else
        element.value = config[configToSave]

      element.addEventListener("change", () => {
        if (configToSave.startsWith("search"))
          config[element.id] = element.checked ? "true" : "false"
        else
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

  async search() {
    this.gridView.grid.api.showLoadingOverlay()

    /** @type {SearchQuery} */
    const searchParams = {
      origin: this.config.origin,
      destination: this.config.destination,
      date: this.config.date,
      maxConnections: 0
    }

    /** @type {Array<SearchResultRow>} */
    const resultRows = []

    /** @type {Object<string, Array<SearchResult>>} */
    const scraperResults = {}

    const statusElement = /** @type {HTMLDivElement?} */ (document.getElementById("searchStatus"))
    if (!statusElement)
      throw new Error("Missing status div")
    statusElement.innerHTML = ""

    /** @param {ScraperParams} scraperParams */
    const runScraper = async(scraperParams) => {
      const scraperName = scraperParams.scraper
      const startTime = (new Date()).valueOf()

      // Keep a per-scraper status visible
      const statusDiv = document.createElement("div")
      statusDiv.innerHTML = `Searching ${scraperName}...`
      statusElement.appendChild(statusDiv)

      // Wait for scraper results
      console.log(`Running scraper '${scraperName}'...`)

      const result = await this.cloud.run(scraperParams)
      if (result.scraperResult) {
        console.log(`Scraper '${scraperName}' returned ${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}.`)
      } else {
        console.log(`Scraper '${scraperName}' errored.`)
        result.scraperResult = {searchResults: []}
      }

      // Individual status per scraper
      const consoleLog = result.error ? "" : result.consoleLog.map(item => `[${item.date}] ${item.type} - ${item.text}`.replace("T", " ").replace("Z", "")).join("\n")
      const statusLine = result.error ? `Error: ${result.error.name}` : `${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}`
      statusDiv.innerHTML = `${scraperName} -
        ${statusLine} (${((new Date()).valueOf() - startTime) / 1000}s) -
        <a href="data:image/jpeg;base64,${result.screenshot}">show screenshot</a>
        <a href="data:text/plain;base64,${btoa(consoleLog)}">show log</a>
        <a href="data:application/json;base64,${btoa(JSON.stringify(Object.assign(result, {screenshot: "[FILTERED OUT]"}), null, 2))}">show result</a> (right click to open)`

      // Store and merge the results into the table
      scraperResults[scraperName] = result.scraperResult.searchResults
      for (const newFlight of scraperResults[scraperName]) {
        let foundRow = false
        for (const checkResultRow of resultRows) {
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

          resultRows.push(newRow)
        }
      }
      this.gridView.grid.api.setRowData(resultRows)
    }

    console.log("Starting search...")
    const queries = []
    if (this.config.searchITA === "true")
      queries.push(runScraper({scraper: "ita", proxy: this.config.proxyUrl, params: searchParams}))
    if (this.config.searchUnited === "true")
      queries.push(runScraper({scraper: "united", proxy: this.config.proxyUrl, params: searchParams}))
    if (this.config.searchAeroplan === "true")
      queries.push(runScraper({scraper: "aeroplan", params: Object.assign(searchParams, {aeroplanUsername: this.config.aeroplanUsername, aeroplanPassword: this.config.aeroplanPassword})}))
    await Promise.all(queries)

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
