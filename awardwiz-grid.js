const PAGINATION_SIZE = 100

export default class AwardWizGrid {
  constructor(onRowClicked) {
    this.grid = null
    this.onRowClicked = onRowClicked
  }

  static milesAndCashFormatter(params) {
    const cost = params.data.costs[params.colDef.headerName.toLowerCase()]
    if (!cost.miles)
      return ""

    const cashFormatter = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2})
    const milesFormatter = new Intl.NumberFormat("en-US")
    return `${milesFormatter.format(cost.miles / 1000)}k + ${cashFormatter.format(cost.cash)}`
  }

  static timeOnlyFormatter(params) {
    const formatter = new Intl.DateTimeFormat("en-US", {month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"})
    return formatter.format(new Date(params.value))
  }

  static milesAndCashStyler(params) {
    if (params.value)
      return {backgroundColor: "#D5F5E3"}
    return null
  }

  // Sort empty/null values as infinite
  static milesComparator(valueA, valueB) {
    if (valueA === null && valueB === null)
      return 0
    if (valueA === null)
      return 1
    if (valueB === null)
      return -1
    return valueA - valueB
  }

  static updateFilterValue(params) {
    let totalFilterString = ""
    const model = params.api.getFilterModel()
    for (const fieldName of Object.getOwnPropertyNames(model)) {
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

    const mainDiv = params.api.gridOptionsWrapper.environment.eGridDiv.querySelector("span[ref=eSummaryPanel]")
    mainDiv.firstChild.textContent = totalFilterString ? `${totalFilterString} -- ` : ""
  }

  configureGrid(gridDiv) {
    const gridOptions = {
      columnDefs: [
        {headerName: "Origin Time", field: "fromDateTime", valueFormatter: this.timeOnlyFormatter, width: 110},
        {headerName: "Dest Time", field: "toDateTime", valueFormatter: this.timeOnlyFormatter, width: 110},
        {headerName: "Airports", field: "airports", valueGetter: params => `${params.data.fromAirport} -> ${params.data.toAirport}`, width: 100},
        {headerName: "Flights", field: "flights"},
        {headerName: "Economy", field: "costs.economy.miles", valueFormatter: this.milesAndCashFormatter, cellStyle: this.milesAndCashStyler, comparator: this.milesComparator, filter: "agNumberColumnFilter", width: 110},
        {headerName: "Business", field: "costs.business.miles", valueFormatter: this.milesAndCashFormatter, cellStyle: this.milesAndCashStyler, comparator: this.milesComparator, filter: "agNumberColumnFilter", width: 110},
        {headerName: "First", field: "costs.first.miles", valueFormatter: this.milesAndCashFormatter, cellStyle: this.milesAndCashStyler, comparator: this.milesComparator, filter: "agNumberColumnFilter", width: 110}
      ],
      enableSorting: true,
      enableFilter: true,

      rowSelection: "single",
      suppressCellSelection: false,
      suppressRowClickSelection: true,

      pagination: true,
      paginationPageSize: PAGINATION_SIZE,

      onFilterChanged: this.updateFilterValue,
      onRowClicked: this.onRowClicked
    }

    new window.agGrid.Grid(gridDiv, gridOptions)   // eslint-disable-line no-new
    this.grid = gridOptions
    this.grid.api.setRowData([])
  }
}
