/* global ApifyRunner */
/* exported AwardMan */

class AwardMan {
  constructor(config) {
    this.config = config

    this.apify = null
    this.united = null
  }

  async prep() {
    this.apify = new ApifyRunner({token: this.config.apifyToken})
    this.united = await this.apify.prepActor("awardman-united", "remote-apify-united.js")
    console.log("Prepped successfully.")
  }
}
