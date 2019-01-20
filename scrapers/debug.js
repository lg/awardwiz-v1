/* eslint-disable no-process-env */

const index = require("./index")
const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "ita",
    params: {
      origin: "SFO",
      destination: "LAS",
      date: "2019-01-20",
      username: process.env.AEROPLAN_USERNAME || "",
      password: process.env.AEROPLAN_PASSWORD || ""
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
