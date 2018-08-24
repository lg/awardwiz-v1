// This file tests the United parser locally

/* eslint-env node, module */
/* eslint no-sync: ["error", { allowAtRootLevel: true }] */

const fs = require("fs")
const body = JSON.parse(fs.readFileSync("united_sample_response.json", "utf-8"))
const flights = body.raw.data.Trips[0].Flights

const results = []
for (const flight of flights) {
  const result = {
    fromDateTime: flight.DepartDateTime,
    toDateTime: flight.LastDestinationDateTime,
    fromAirport: flight.Origin,
    toAirport: flight.LastDestination.Code,
    flights: `${flight.OperatingCarrier}${flight.FlightNumber}`,
    costs: {
      economy: {miles: null, cash: null},
      business: {miles: null, cash: null},
      first: {miles: null, cash: null}
    }
  }

  // Append all connections to flight list
  for (const connection of flight.Connections)
    result.flights += `,${connection.OperatingCarrier}${connection.FlightNumber}`

  // Convert united format to standardized miles and cash formats
  for (const product of flight.Products) {
    if (product.Prices.length === 0)
      continue

    const milesRequired = product.Prices[0].Amount
    const cashRequired = product.TaxAndFees ? product.TaxAndFees.Amount : 0

    for (const cabin of ["Economy", "Business", "First"]) {
      if (product.ProductTypeDescription.startsWith(cabin)) {
        const cabinLower = cabin.toLowerCase()
        if (!result.costs[cabinLower].miles || milesRequired < result.costs[cabinLower].miles) {
          result.costs[cabinLower].miles = milesRequired
          result.costs[cabinLower].cash = cashRequired
        }
      }
    }
  }

  results.push(result)
}

const util = require("util")
console.log(util.inspect(results, {showHidden: false, depth: null}))
