/* exported ApifyRunner */

const ACTOR_MEMORY_SIZE = 2048
const ACTOR_TIMEOUT_SEC = 60

class ApifyRunner {
  constructor(config) {
    this.config = config
  }

  async prepActor(actorName, localFile) {
    console.log(`Prepping actor ${actorName}...`)
    console.log("  Getting local source for actor...")
    const localCode = await (await fetch(localFile)).text()

    const actors = await (await fetch(`https://api.apify.com/v2/acts?token=${this.config.token}`)).json()
    let actor = actors.data.items.find(checkActor => checkActor.name === actorName)

    if (actor) {
      console.log("  Getting existing Apify actor details...")
      const actorFull = await (await fetch(`https://api.apify.com/v2/acts/${actor.id}?token=${this.config.token}`)).json()
      actor = actorFull.data
    }

    // Create the actor worker or update it if it has changed
    if (!actor || localCode !== actor.versions.find(version => version.versionNumber === "0.0").sourceCode) {
      const body = {
        name: actorName,
        isPublic: false,
        versions: [{
          versionNumber: "0.0",
          sourceType: "SOURCE_CODE",
          buildTag: "latest",
          baseDockerImage: "apify/actor-node-chrome",
          sourceCode: localCode
        }]
      }

      if (actor) {
        console.log("  Updating actor in Apify...")
        const req = await fetch(`https://api.apify.com/v2/acts/${actor.id}?token=${this.config.token}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})
        actor = (await req.json()).data

      } else {
        console.log("  Creating actor in Apify...")
        const req = await fetch(`https://api.apify.com/v2/acts?token=${this.config.token}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})
        actor = (await req.json()).data
      }

      console.log("  Building actor...")
      await (await fetch(`https://api.apify.com/v2/acts/${actor.id}/builds?token=${this.config.token}&version=0.0&useCache=1&tag=latest&waitForFinish=${ACTOR_TIMEOUT_SEC}`, {method: "POST"})).json()

      console.log("  Ready!")
    } else {
      console.log("  No updates necessary for actor.")
    }

    return actor
  }

  async runActor(actor) {
    console.log(`Running actor ${actor.name}...`)
    const body = {
      proxyUrl: self.config.proxyUrl
    }
    const req = await fetch(`https://api.apify.com/v2/acts/${actor.id}/run-sync?token=${this.config.token}&memory=${ACTOR_MEMORY_SIZE}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})
    return req.json()
  }
}
