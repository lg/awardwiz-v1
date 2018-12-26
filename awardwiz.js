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

    /** @type {Array<SearchResultWithService>} */
    let allResults = []
    const statusElement = /** @type {HTMLDivElement?} */ (document.getElementById("searchStatus"))
    if (!statusElement)
      throw new Error("Missing status div")
    statusElement.innerHTML = ""

    /** @param {ScraperParams} scraperParams */
    const runScraper = async(scraperParams) => {
      const startTime = (new Date()).valueOf()

      // Keep a per-scraper status visible
      const statusDiv = document.createElement("div")
      statusDiv.innerHTML = `Searching ${scraperParams.scraper}...`
      statusElement.appendChild(statusDiv)

      // Wait for scraper results
      console.log(`Running scraper '${scraperParams.scraper}'...`)

      const result = await this.cloud.run(scraperParams)
      if (result.scraperResult) {
        console.log(`Scraper '${scraperParams.scraper}' returned ${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}.`)
      } else {
        console.log(`Scraper '${scraperParams.scraper}' errored.`)
        result.scraperResult = {searchResults: []}
      }

      // Individual status per scraper
      const consoleLog = result.error ? "" : result.consoleLog.map(item => `[${item.date}] ${item.type} - ${item.text}`.replace("T", " ").replace("Z", "")).join("\n")
      const statusLine = result.error ? `Error: ${result.error.name}` : `${result.scraperResult.searchResults.length} result${result.scraperResult.searchResults.length === 1 ? "" : "s"}`
      statusDiv.innerHTML = `${scraperParams.scraper} -
        ${statusLine} (${((new Date()).valueOf() - startTime) / 1000}s) -
        <a href="data:image/jpeg;base64,${result.screenshot}">show screenshot</a>
        <a href="data:text/plain;base64,${btoa(consoleLog)}">show log</a>
        <a href="data:application/json;base64,${btoa(JSON.stringify(Object.assign(result, {screenshot: "[FILTERED OUT]"}), null, 2))}">show result</a> (right click to open)`

      // Append results to existing results w/ service name
      allResults = allResults.concat(result.scraperResult.searchResults.map(searchResult => {
        const newResult = /** @type {SearchResultWithService} */ (searchResult)
        newResult.service = scraperParams.scraper
        return newResult
      }))
      this.gridView.grid.api.setRowData(allResults)
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
