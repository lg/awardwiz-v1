// A quick and dirty ORM that maps HTML elements to variables, can save/load
// to localstorage, and allows for import/export. Currently only text and
// checkbox settings are supported.

export default class MiniORM {
  /**
   * @param {{[name: string]: any}} config
   */
  constructor(config) {
    this.config = config

    for (const key of Object.keys(config)) {
      if (typeof config[key] === "string") {
        config[key] = localStorage.getItem(key) || config[key]
      } else if (typeof config[key] === "boolean") {
        config[key] = localStorage.getItem(key) === null ? true : localStorage.getItem(key) === "true"
      } else {
        // Skip
      }
    }
  }

  /** Outputs the settings string to the console for the user */
  exportSettings() {
    const settingsString = btoa(JSON.stringify(this.config))
    console.log(`Your settings string is: ${settingsString}`)
    console.log("Please remember not to spread this to friends, personal credentials are contained in these strings!")
  }

  /** Allows the user to input a settings string and this will set it and reload the page */
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
        if (el.type === "text")
          el.value = settings[key]
        else if (el.type === "checkbox")
          el.checked = settings[key]
        const evt = document.createEvent("HTMLEvents")
        evt.initEvent("change", false, true)
        el.dispatchEvent(evt)
      }
    }

    window.location.reload()
  }

  /**
   * The passed in object will have its keys' extraParams attribute added to the DOM
   * as managed settings. Only text fields are supported.
   * @param {{ [name: string]: any}} obj
   * @param {string} selectorToAppendTo
   */
  addAndAttachDynamicSettingsToDOM(obj, selectorToAppendTo) {
    const extraParamsDiv = document.querySelector(selectorToAppendTo)
    if (!extraParamsDiv)
      throw new Error("Missing extra params div")

    // Scrapers can have custom parameters
    Object.keys(obj).forEach((/** @type {string} */ scraperName) => {
      if (obj[scraperName].extraParams) {
        Object.keys(obj[scraperName].extraParams).forEach((/** @type {string} */ paramName) => {
          const extraParamKey = `${scraperName}${paramName}`
          obj[scraperName].extraParams[paramName].value = localStorage.getItem(extraParamKey) || ""

          const extraParamLabel = document.createElement("label")
          extraParamLabel.htmlFor = extraParamKey
          extraParamLabel.innerText = `${scraperName} ${paramName}: `
          const extraParamInput = document.createElement("input")
          extraParamInput.type = "text"
          extraParamInput.id = extraParamKey
          extraParamInput.value = obj[scraperName].extraParams[paramName].value
          extraParamInput.addEventListener("change", () => {
            obj[scraperName].extraParams[paramName].value = extraParamInput.value
            localStorage.setItem(extraParamKey, extraParamInput.value)
          })
          const extraParamBR = document.createElement("br")

          extraParamsDiv.append(extraParamLabel, extraParamInput, extraParamBR)
        })
      }
    })
  }

  attachSettingsToDOM() {
    const {config} = this

    for (const configToSave of Object.getOwnPropertyNames(config)) {
      const element = /** @type {HTMLInputElement?} */ (document.getElementById(configToSave))
      if (!element)
        continue

      if (element.type === "text")
        element.value = config[configToSave]
      else if (element.type === "checkbox")
        element.checked = config[configToSave]

      element.addEventListener("change", () => {    // eslint-disable-line no-loop-func
        if (element.type === "text")
          config[element.id] = element.value
        else if (element.type === "checkbox")
          config[element.id] = element.checked
        localStorage.setItem(element.id, config[element.id].toString())
      })
    }
  }
}
