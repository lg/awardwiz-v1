import ApifyRunner from "./apify-runner.js"
import AwardManGrid from "./award-man-grid.js"

export default class AwardMan {
  constructor() {
    this.config = AwardMan.loadConfigAndUpdateDocument()

    this.apify = null
    this.united = null

    this.grid = new AwardManGrid(AwardMan.onRowClicked)
    this.grid.configureGrid(document.querySelector("#resultsGrid"))
  }

  static loadConfigAndUpdateDocument() {
    const config = {
      apifyToken: localStorage.apifyToken || "",
      proxyUrl: localStorage.proxyUrl || "",
      aeroplanUsername: localStorage.aeroplanUsername || "",
      aeroplanPassword: localStorage.aeroplanPassword || "",
      origin: localStorage.origin || "",
      destination: localStorage.destination || "",
      date: localStorage.date || ""
    }

    for (const configToSave of Object.getOwnPropertyNames(config)) {
      const element = document.getElementById(configToSave)
      element.value = config[configToSave]
      element.addEventListener("change", () => (config[element.id] = element.value))
      element.addEventListener("change", () => localStorage.setItem(element.id, element.value))
    }

    return config
  }

  async prep() {
    this.apify = new ApifyRunner({token: this.config.apifyToken})
    this.united = await this.apify.prepActor("awardman-united", "scrapers/united.js")
    console.log("Prepped successfully.")
  }

  async test() {
    this.grid.grid.api.showLoadingOverlay()
    const raw = await this.apify.runActor(this.united, {
      proxyUrl: this.config.proxyUrl,
      from: this.config.origin,
      to: this.config.destination,
      date: this.config.date,
      maxConnections: 2
    })
    this.grid.grid.api.hideOverlay()

    this.grid.grid.api.setRowData(raw.results)

    console.log("Done.")
  }

  static onRowClicked(params) {
    console.log(`Selected flight details: ${JSON.stringify(params.data, null, 2)}`)
  }
}
