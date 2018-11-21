/** @typedef {import("./node_modules/ag-grid-community/main")} AgGrid */
/** @typedef {import("./node_modules/ag-grid-community/main").GridOptions} GridOptions */
/** @typedef {import("./node_modules/ag-grid-community/main").GridApi} GridApi */
/** @typedef {import("./node_modules/ag-grid-community/main").RowClickedEvent} RowClickedEvent */
/** @typedef {import("./node_modules/ag-grid-community/main").RowNode} RowNode */
/** @typedef {import("./node_modules/ag-grid-community/main").ValueFormatterParams} ValueFormatterParams */
/** @typedef {import("./node_modules/ag-grid-community/main").FilterChangedEvent} FilterChangedEvent */

const PAGINATION_SIZE = 100

export default class AwardWizGrid {
  /** @param {HTMLDivElement} gridDiv
   * @param {(event: RowClickedEvent) => void} onRowClicked */
  constructor(gridDiv, onRowClicked) {
    /** @type {(event: RowClickedEvent) => void} */
    this.onRowClicked = onRowClicked

    this.grid = this.configureGrid(gridDiv)
  }

  /** @param {ValueFormatterParams} params */
  static milesAndCashFormatter(params) {
    if (!params.colDef.headerName)
      return ""

    const cost = params.data.costs[params.colDef.headerName.toLowerCase()]
    if (!cost.miles)
      return ""

    const cashFormatter = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2})
    const milesFormatter = new Intl.NumberFormat("en-US")
    return `${milesFormatter.format(cost.miles / 1000)}k + ${cashFormatter.format(cost.cash)}`
  }

  /** @param {ValueFormatterParams} params */
  static dateTimeFormatter(params) {
    const formatter = new Intl.DateTimeFormat("en-US", {month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"})
    return formatter.format(new Date(params.value))
  }

  /** @param {ValueFormatterParams} params */
  static milesAndCashStyler(params) {
    if (params.value)
      return {backgroundColor: "#D5F5E3"}
    return null
  }

  /** Sort empty/null values as infinite
   * @param {any} valueA
   * @param {any} valueB
   * @param {RowNode | undefined} nodeA
   * @param {RowNode | undefined} nodeB
   * @param {boolean | undefined} isInverted
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

  /** @param {FilterChangedEvent} event */
  static updateFilterValue(event) {
    if (!event.api)
      return

    let totalFilterString = ""
    const model = event.api.getFilterModel()
    for (const fieldName of Object.getOwnPropertyNames(model)) {
      /** TODO:
       * @param {string} name
       * @param {{type: string, filter: string}} clause */
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
    /** @type {GridOptions} */
    const gridOptions = {
      columnDefs: [
        {headerName: "Service", field: "service", width: 100},
        {headerName: "Origin Time", field: "fromDateTime", valueFormatter: AwardWizGrid.dateTimeFormatter, width: 110, sort: "asc"},
        {headerName: "Dest Time", field: "toDateTime", valueFormatter: AwardWizGrid.dateTimeFormatter, width: 110},
        {headerName: "Airports", field: "airports", valueGetter: params => `${params.data.fromAirport} -> ${params.data.toAirport}`, width: 100},
        {headerName: "Flights", field: "flights"},
        {headerName: "Economy", field: "costs.economy.miles", valueFormatter: AwardWizGrid.milesAndCashFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 110},
        {headerName: "Business", field: "costs.business.miles", valueFormatter: AwardWizGrid.milesAndCashFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 110},
        {headerName: "First", field: "costs.first.miles", valueFormatter: AwardWizGrid.milesAndCashFormatter, cellStyle: AwardWizGrid.milesAndCashStyler, comparator: AwardWizGrid.milesComparator, filter: "agNumberColumnFilter", width: 110}
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

    const windowWithAgGrid = /** @type {Window & {agGrid: AgGrid}} */ (window)
    new windowWithAgGrid.agGrid.Grid(gridDiv, gridOptions)   // eslint-disable-line no-new

    if (gridOptions.api)
      gridOptions.api.setRowData([])
    return /** @type {GridOptions & {api: GridApi}} */ (gridOptions)
  }
}
