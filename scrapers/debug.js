/* eslint-disable no-process-env */

const index = require("./index")
const process = require("process")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "british",
    params: {
      origin: "LAX",
      destination: "NRT",
      date: "2019-07-03",
      username: process.env.BRITISH_USERNAME || "",
      password: process.env.BRITISH_PASSWORD || "",
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
