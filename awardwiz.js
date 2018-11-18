import AwardWizGrid from "./awardwiz-grid.js"
import AWSProvider from "./cloud-providers/aws-provider.js"

export default class AwardWiz {
  constructor() {
    this.config = AwardWiz.loadConfigAndUpdateDocument()

    this.united = null
    this.cloud = new AWSProvider({
      files: ["united.js", "aeroplan.js", "index.js", "package.json"],
      filesDir: "scrapers",

      accessKey: this.config.awsAccessKey,
      secretAccessKey: this.config.awsSecretAccessKey,
      regionZone: this.config.awsRegionZone,
      lambdaRoleArn: this.config.awsLambdaRoleArn,

      functionName: this.config.functionName
    })
    this.cloud.initOnPage()

    this.grid = new AwardWizGrid(AwardWiz.onRowClicked)
    this.grid.configureGrid(document.querySelector("#resultsGrid"))
  }

  static loadConfigAndUpdateDocument() {
    const config = {
      awsAccessKey: localStorage.awsAccessKey || "",
      awsSecretAccessKey: localStorage.awsSecretAccessKey || "",
      awsRegionZone: localStorage.awsRegionZone || "us-west-1a",
      awsLambdaRoleArn: localStorage.awsLambdaRoleArn || "",

      functionName: localStorage.functionName || "awardwiz",
      proxyUrl: localStorage.proxyUrl || "",
      aeroplanUsername: localStorage.aeroplanUsername || "",
      aeroplanPassword: localStorage.aeroplanPassword || "",
      origin: localStorage.origin || "",
      destination: localStorage.destination || "",
      date: localStorage.date || ""
    }

    for (const configToSave of Object.getOwnPropertyNames(config)) {
      const element = document.getElementById(configToSave)
      if (!element)
        continue

      element.value = config[configToSave]
      element.addEventListener("change", () => (config[element.id] = element.value))
      element.addEventListener("change", () => localStorage.setItem(element.id, element.value))
    }

    return config
  }

  async prep() {
    await this.cloud.prep()
    console.log("Prepped successfully.")
  }

  async search() {
    this.grid.grid.api.showLoadingOverlay()

    const searchParams = {
      from: this.config.origin,
      to: this.config.destination,
      date: this.config.date,
      maxConnections: 1
    }

    let allResults = []
    document.getElementById("searchStatus").innerHTML = ""

    const runScraper = async scraperParams => {
      // Keep a per-scraper status visible
      const statusDiv = document.createElement("div")
      statusDiv.innerHTML = `Searching ${scraperParams.scraper}...`
      document.getElementById("searchStatus").appendChild(statusDiv)

      // Wait for scraper results
      console.log(`Running scraper '${scraperParams.scraper}'...`)
      const result = await this.cloud.run(scraperParams)
      console.log(`Scraper '${scraperParams.scraper}' returned ${result.scraperResult.searchResults.length} result(s).`)

      // Individual status per scraper
      const consoleLog = result.consoleLog.map(item => `[${item.date}] ${item.type} - ${item.text}`.replace("T", " ").replace("Z", "")).join("\n")
      statusDiv.innerHTML = `${scraperParams.scraper} -
        ${result.scraperResult.searchResults.length} result(s) -
        <a href="data:image/jpeg;base64,${result.screenshot}">show screenshot</a>
        <a href="data:text/plain;base64,${btoa(consoleLog)}">show log</a>
        <a href="data:application/json;base64,${btoa(JSON.stringify(Object.assign(result, {screenshot: "[FILTERED OUT]"}), null, 2))}">show result</a> (right click to open)`

      // Append results to existing results w/ serice name
      allResults = allResults.concat(result.scraperResult.searchResults.map(searchResult => {
        searchResult.service = scraperParams.scraper
        return searchResult
      }))
      this.grid.grid.api.setRowData(allResults)
    }

    console.log("Starting search...")
    await Promise.all([
      runScraper({scraper: "united", proxy: this.config.proxyUrl, params: searchParams}),
      //runScraper({scraper: "aeroplan", params: Object.assign(searchParams, {aeroplanUsername: this.config.aeroplanUsername, aeroplanPassword: this.config.aeroplanPassword})})
    ])

    console.log("Completed search.")

    this.grid.grid.api.hideOverlay()
  }

  static onRowClicked(params) {
    console.log(`Selected flight details: ${JSON.stringify(params.data, null, 2)}`)
  }
}
