/* eslint-disable no-process-env */

const index = require("./index")
const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "aeroplan",
    params: {
      from: "SFO",
      to: "YOW",
      date: "2018-12-01",
      maxConnections: 1,
      aeroplanUsername: process.env.AEROPLAN_USERNAME,
      aeroplanPassword: process.env.AEROPLAN_PASSWORD
    }
  })
  console.log("Done")
  console.log(result)
  await index.shutdown()
}

main()
