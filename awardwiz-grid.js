const PAGINATION_SIZE = 100

export default class AwardWizGrid {
  /** @param {HTMLDivElement} gridDiv
   * @param {(event: import("AgGrid").RowClickedEvent) => void} onRowClicked */
  constructor(gridDiv, onRowClicked) {
    /** @type {(event: import("AgGrid").RowClickedEvent) => void} */
    this.onRowClicked = onRowClicked

    this.grid = this.configureGrid(gridDiv)
  }

  /** @param {import("AgGrid").ValueFormatterParams} params */
  static costFormatter(params) {
    if (!params.colDef.headerName)
      return ""
    const classOfService = params.colDef.headerName

    const cost = params.data.costs[classOfService.toLowerCase()]
    if (!cost.miles)
      return ""

    const cashFormatter = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0})
    const milesFormatter = new Intl.NumberFormat("en-US", {maximumFractionDigits: 1, minimumFractionDigits: 1})

    const cashFormatted = cost.cash ? cashFormatter.format(cost.cash) : "$?"
    let totalQuotes = 0
    Object.keys(params.data.scrapersUsed).forEach(scraperName => {
      const quote = params.data.scrapersUsed[scraperName]
      if (quote.costs[classOfService.toLowerCase()].miles !== null) {
        totalQuotes += 1
      }
    })

    return `(${cost.scraper}${totalQuotes > 1 ? `+${totalQuotes - 1}` : ""}) ${cashFormatted} + ${milesFormatter.format(cost.miles / 1000)}k`
  }

  /** @param {import("AgGrid").ValueFormatterParams} params */
  static dateTimeFormatter(params) {
    const hourMinuteFormatter = new Intl.DateTimeFormat("en-US", {hour: "numeric", minute: "numeric"})
    const dayDiff = (new Date(params.value.substr(0, 10)).valueOf() - new Date(params.data.departureDateTime.substr(0, 10)).valueOf()) / 86400000
    return `${dayDiff === 0 ? "" : "("}${dayDiff > 0 ? "+" : ""}${dayDiff === 0 ? "" : `${dayDiff}) `}${hourMinuteFormatter.format(new Date(params.value))}`
  }

  /** @param {import("AgGrid").ValueFormatterParams} params */
  static milesAndCashStyler(params) {
    if (params.value)
      return {textAlign: "right", backgroundColor: "#D5F5E3"}
    return {textAlign: "right"}
  }

  /** Sort empty/null values as infinite
   * @param {any} valueA
   * @param {any} valueB
   * @param {import("AgGrid").RowNode} [nodeA]
   * @param {import("AgGrid").RowNode} [nodeB]
   * @param {boolean} [isInverted]
   * @returns {number}
  */
  static milesComparator(valueA, valueB, nodeA, nodeB, isInverted) {    // eslint-disable-line max-params
    if (valueA === null && valueB === null)
      return 0
    if (valueA === null)
      return 1
    if (valueB === null)
      return -1
    return valueA - valueB
  }

  /** @param {import("AgGrid").FilterChangedEvent} event */
  static updateFilterValue(event) {
    if (!event.api)
      return

    let totalFilterString = ""
    const model = event.api.getFilterModel()
    for (const fieldName of Object.getOwnPropertyNames(model)) {
      /**
       * @param {string} name
       * @param {{type: string, filter: any, filterTo: any, filterType: string}} clause */
      const clauseToString = (name, clause) => `${name} ${clause.type} "${clause.filter}"`

      // There are multiple filters
      if (model[fieldName].condition1) {
        totalFilterString += `, (${clauseToString(fieldName, model[fieldName].condition1)} ${model[fieldName].operator} ${clauseToString(fieldName, model[fieldName].condition2)})`
      } else {
        totalFilterString += `, (${clauseToString(fieldName, model[fieldName])})`
      }
    }

    if (totalFilterString)
      totalFilterString = totalFilterString.substring(2)

    // @ts-ignore because this was a hack to begin with
    const mainDiv = event.api.gridOptionsWrapper.environment.eGridDiv.querySelector("span[ref=eSummaryPanel]")
    mainDiv.firstChild.textContent = totalFilterString ? `${totalFilterString} -- ` : ""
  }

  /**
  * @param {HTMLDivElement} gridDiv
  */
  configureGrid(gridDiv) {
    const style = document.createElement("style")
    style.type = "text/css"
    style.innerHTML = `
      .ag-cell {
        padding-left: 2px !important;
        padding-right: 2px !important;
      }
      .ag-header-cell {
        padding-left: 4px !important;
        padding-right: 4px !important;
      }
    `
    document.getElementsByTagName("head")[0].appendChild(style)

    /** @type {import("AgGrid").GridOptions} */
    const gridOptions = {
      columnDefs: [
        {headerName: "Flight", field: "flightNo", width: 70, tooltip: (params) => `${params.data.airline} flight ${params.data.flightNo.substr(3)}`},
        {headerName: "Depart", field: "departureDateTime", valueFormatter: AwardWizGrid.dateTimeFormatter, tooltipField: "departureDateTime", width: 90, sort: "asc", cellStyle: {textAlign: "right"}},
        {headerName: "Arrive", field: "arrivalDateTime", valueFormatter: AwardWizGrid.dateTimeFormatter, tooltipField: "arrivalDateTime", width: 90, cellStyle: {textAlign: "right"}},
        {headerName: "Economy", field: "costs.economy.miles", valueFormatter: AwardWizGrid.costFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 160},
        {headerName: "Business", field: "costs.business.miles", valueFormatter: AwardWizGrid.costFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 160},
        {headerName: "First", field: "costs.first.miles", valueFormatter: AwardWizGrid.costFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 160}
      ],
      enableSorting: true,
      enableFilter: true,

      rowSelection: "single",
      suppressCellSelection: false,
      suppressRowClickSelection: true,

      pagination: true,
      paginationPageSize: PAGINATION_SIZE,

      onFilterChanged: AwardWizGrid.updateFilterValue,
      onRowClicked: this.onRowClicked
    }

    new window.agGrid.Grid(gridDiv, gridOptions)   // eslint-disable-line no-new

    const gridOptionsWithApi = /** @type {import("AgGrid").GridOptions & {api: import("AgGrid").GridApi}} */ (gridOptions)
    gridOptionsWithApi.api.setRowData([])

    return gridOptionsWithApi
  }
}
