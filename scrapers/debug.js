/* eslint-disable */

const index = require("./index")

const main = async() => {
  console.log("Starting")
  const result = await index.debugEntry({
    scraper: "aeroplan",
    params: {
      from: "SFO",
      to: "YOW",
      date: "2018-12-01",
      maxConnections: 1,
      aeroplanUsername: "USERNAMEHERE",
      aeroplanPassword: "PASSWORDHERE"
    }
  })
  console.log("Done")
  console.log(result)
  await index.shutdown()
}

main()
