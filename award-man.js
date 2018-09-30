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

      projectName: this.config.gcfProjectName,
      functionName: this.config.gcfFunctionName,
      projectLocation: this.config.gcfProjectLocation,
      clientId: this.config.gcfClientId
    })
    this.gcf.initOnPage()

    this.grid = new AwardManGrid(AwardMan.onRowClicked)
    this.grid.configureGrid(document.querySelector("#resultsGrid"))
  }

  static loadConfigAndUpdateDocument() {
    const config = {
      gcfProjectName: localStorage.gcfProjectName || "award-man",
      gcfFunctionName: localStorage.gcfFunctionName || "award-man",
      gcfProjectLocation: localStorage.gcfProjectLocation || "us-central1",
      gcfClientId: localStorage.gcfClientId || "224829437062-cfk51jtehv7mbeq5i60uf82n11s343rr.apps.googleusercontent.com",   // should be ok to share?

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

    const unitedDiv = await this.genScraperDebugRow("united", raw)
    document.getElementById("searchStatus").innerHTML = ""
    document.getElementById("searchStatus").appendChild(unitedDiv)

    this.grid.grid.api.hideOverlay()

    this.grid.grid.api.setRowData(raw.scraperResult.searchResults)

    console.log("Done.")
  }

  async genScraperDebugRow(scraper, rawResponse) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(`${scraper} - `))

    const debugItems = []
    debugItems.push({item: "screenshot", mime: "image/jpeg", extension: "jpg", base64: rawResponse.puppeteerInfo.screenshot})
    debugItems.push({item: "log", mime: "application/json", extension: "json", base64: btoa(JSON.stringify(rawResponse.consoleLog))})
    debugItems.push({item: "har", mime: "application/json", extension: "har", base64: btoa(JSON.stringify(rawResponse.puppeteerInfo.har))})
    debugItems.forEach(async debugItem => {
      const blob = await (await fetch(`data:${debugItem.mime};base64,${debugItem.base64}`)).blob()
      const linkEl = document.createElement("a")
      linkEl.addEventListener("click", () => {
        window.saveAs(blob, `${scraper}-${debugItem.item}.${debugItem.extension}`)
      })
      linkEl.href = "#"
      linkEl.innerText = `show ${debugItem.item}`
      div.appendChild(linkEl)
      div.appendChild(document.createTextNode(" "))
    })

    return div
  }

  static onRowClicked(params) {
    console.log(`Selected flight details: ${JSON.stringify(params.data, null, 2)}`)
  }
}
