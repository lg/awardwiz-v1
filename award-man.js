import ApifyRunner from "./apify-runner.js"

export default class AwardMan {
  constructor(config) {
    this.config = config

    this.apify = null
    this.united = null
  }

  async prep() {
    this.apify = new ApifyRunner({token: this.config.apifyToken})
    this.united = await this.apify.prepActor("awardman-united", "scrapers/united.js")
    console.log("Prepped successfully.")
  }

  async test() {
    await this.apify.runActor(this.united, {
      proxyUrl: this.config.proxyUrl,
      from: "SFO",
      to: "YOW",
      date: "2018-08-31"
    })

    console.log("Done.")
  }
}
