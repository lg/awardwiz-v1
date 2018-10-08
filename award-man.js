import AwardManGrid from "./award-man-grid.js"
import GCFProvider from "./cloud-providers/gcf-provider.js"

export default class AwardMan {
  constructor() {
    this.config = AwardMan.loadConfigAndUpdateDocument()

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

    this.grid = new AwardManGrid(AwardMan.onRowClicked)
    this.grid.configureGrid(document.querySelector("#resultsGrid"))
  }

  static loadConfigAndUpdateDocument() {
    const config = {
      gcpClientId: localStorage.gcpClientId || "224829437062-cfk51jtehv7mbeq5i60uf82n11s343rr.apps.googleusercontent.com",
      gcpProjectId: localStorage.gcpProjectId || "award-man-218722",
      gcfFunctionName: localStorage.gcfFunctionName || "award-man",
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

    const raw = await this.gcf.run({
      scraper: "united",
      proxy: this.config.proxyUrl,
      params: {
        from: this.config.origin,
        to: this.config.destination,
        date: this.config.date,
        maxConnections: 1
      }
    })

    const consoleLog = raw.consoleLog.map(item => `[${item.date}] ${item.type} - ${item.text}`.replace("T", " ").replace("Z", "")).join("\n")
    document.getElementById("searchStatus").innerHTML = `
      <a href="data:image/jpeg;base64,${raw.screenshot}">show screenshot</a>
      <a href="data:text/plain;base64,${btoa(consoleLog)}">show log</a> (right click to open)`

    this.grid.grid.api.hideOverlay()
    this.grid.grid.api.setRowData(raw.scraperResult.searchResults)
  }

  static onRowClicked(params) {
    console.log(`Selected flight details: ${JSON.stringify(params.data, null, 2)}`)
  }
}
