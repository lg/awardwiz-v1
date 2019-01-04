/* eslint-disable no-process-env */

const index = require("./index")
const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "southwest",
    params: {
      origin: "SJC",
      destination: "LAX",
      date: "2019-03-12",
      aeroplanUsername: process.env.AEROPLAN_USERNAME,
      aeroplanPassword: process.env.AEROPLAN_PASSWORD
    }
  })
  console.log("Done")
  console.log(result)
  await index.shutdown()
}

main()
