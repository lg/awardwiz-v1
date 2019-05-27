/* eslint-disable no-process-env */

const index = require("./index")
const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "aeroplan",
    params: {
      origin: "SFO",
      destination: "LAS",
      date: "2019-05-29",
      username: process.env.AEROPLAN_USERNAME || "",
      password: process.env.AEROPLAN_PASSWORD || "",
      originNearby: "true",
      destinationNearby: "true"
    }
  })
  console.log("Done")

  // @ts-ignore
  if (result.screenshot)
    // @ts-ignore
    result.screenshot = "[...filtered...]"
  console.log(JSON.stringify(result, null, 2))
  await index.shutdown()
}

main()
