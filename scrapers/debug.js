/* eslint-disable no-process-env */

const index = require("./index")
//const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "alaska",
    params: {
      origin: "JFK",
      destination: "YYZ",
      date: "2019-01-23"
      // username: process.env.AEROPLAN_USERNAME || "",
      // password: process.env.AEROPLAN_PASSWORD || ""
    }
  })
  console.log("Done")
  console.log(result)
  await index.shutdown()
}

main()
