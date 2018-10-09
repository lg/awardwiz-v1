import AwardWizGrid from "./awardwiz-grid.js"
import GCFProvider from "./cloud-providers/gcf-provider.js"

export default class AwardWiz {
  constructor() {
    this.config = AwardWiz.loadConfigAndUpdateDocument()

    this.united = null
    this.gcf = new GCFProvider({
      files: ["united.js", "aeroplan.js", "index.js", "package.json"],
      filesDir: "scrapers",
      authSignInDivId: "googleSignIn",
      authSignOutDivId: "googleSignOut",

      clientId: this.config.gcpClientId,
      projectId: this.config.gcpProjectId,

      projectLocation: this.config.gcfProjectLocation,
      functionName: this.config.gcfFunctionName
    })
    this.gcf.initOnPage()

    this.grid = new AwardWizGrid(AwardWiz.onRowClicked)
    this.grid.configureGrid(document.querySelector("#resultsGrid"))
  }

  static loadConfigAndUpdateDocument() {
    const config = {
      gcpClientId: localStorage.gcpClientId || "224829437062-cfk51jtehv7mbeq5i60uf82n11s343rr.apps.googleusercontent.com",
      gcpProjectId: localStorage.gcpProjectId || "awardwiz-218722",
      gcfFunctionName: localStorage.gcfFunctionName || "awardwiz",
      gcfProjectLocation: localStorage.gcfProjectLocation || "us-central1",
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
    await this.gcf.prep()
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
      const result = await this.gcf.run(scraperParams)
      console.log(`Scraper '${scraperParams.scraper}' returned ${result.scraperResult.searchResults.length} result(s).`)

      // Individual status per scraper
      const consoleLog = result.consoleLog.map(item => `[${item.date}] ${item.type} - ${item.text}`.replace("T", " ").replace("Z", "")).join("\n")
      statusDiv.innerHTML = `${scraperParams.scraper} -
        ${result.scraperResult.searchResults.length} result(s) -
        <a href="data:image/jpeg;base64,${result.screenshot}">show screenshot</a>
        <a href="data:text/plain;base64,${btoa(consoleLog)}">show log</a> (right click to open)`

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
      runScraper({scraper: "aeroplan", params: Object.assign(searchParams, {aeroplanUsername: this.config.aeroplanUsername, aeroplanPassword: this.config.aeroplanPassword})})
    ])

    console.log("Completed search.")

    this.grid.grid.api.hideOverlay()
  }

  static onRowClicked(params) {
    console.log(`Selected flight details: ${JSON.stringify(params.data, null, 2)}`)
  }
}
