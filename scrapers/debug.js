/* eslint-disable no-process-env */

const index = require("./index")
//const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "ita",
    params: {
      origin: "LAX",
      destination: "JFK",
      date: "2019-02-25",
      maxConnections: 0
    }
  })
  console.log("Done")
  console.log(result)
  await index.shutdown()
}

main()
