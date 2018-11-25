// Abstract class for cloud providers for AwardWiz

/* global SparkMD5, JSZip */

/** @abstract */
export class CloudProvider {

  /** @param {CloudProviderConfig} config */
  constructor(config) {
    this.config = config
    if (!config.functionName)
      throw new Error("Missing CloudProvider required config params")
  }

  async initOnPage() {
    /** @type {Object<string, string>} */
    const modules = {
      JSZip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js",
      SparkMD5: "https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.0/spark-md5.min.js"
    }

    for (const key of Object.getOwnPropertyNames(modules)) {
      if (!window[key]) {
        /** @type {HTMLScriptElement} */
        const scriptTag = document.createElement("script")
        scriptTag.src = modules[key]
        if (!document.head)
          throw new Error("Missing head element in document")
        document.head.appendChild(scriptTag)
      }
    }
  }

  /**
   * @param {ArrayBuffer} zipFile
   * @param {string} filesHash */
  async stepCreateFunction(zipFile, filesHash) {
    throw new Error("Unimplemented!")
  }

  /**
   * @param {ArrayBuffer} zipFile
   * @param {string} filesHash */
  async stepUpdateFunction(zipFile, filesHash) {
    throw new Error("Unimplemented!")
  }

  /** @returns {Promise<string>} */
  async stepGetExistingFunctionHash() {
    throw new Error("Unimplemented!")
  }

  /**
   * @param {ScraperParams | ScraperHashCheckParams} params
   * @returns {Promise<ScraperResult>}
   */
  async run(params) {
    throw new Error("Unimplemented!")
  }

  /////

  async prep() {
    console.log("Prepping package...")
    const {filesHash, zipFile} = await this.prepPackage()

    console.log("Getting if cloud has up to date function...")
    const existingFunctionHash = await this.stepGetExistingFunctionHash()
    let functionUpdated = true
    if (existingFunctionHash === filesHash) {
      console.log("Up to date!")
      functionUpdated = false
    } else if (existingFunctionHash === null) {
      console.log("Doesn't exist, creating it...")
      await this.stepCreateFunction(zipFile, filesHash)
    } else {
      console.log("Exists, but outdated, updating it...")
      await this.stepUpdateFunction(zipFile, filesHash)
    }

    if (functionUpdated) {
      console.log("Waiting for function to be live...")
      await this.waitFor(5000, 12 * 5, async() => {         // 5 mins timeout
        const out = await this.run({hashCheck: true})
        return out.hashCheck === filesHash
      })
    }
  }

  /** @private
   * @returns {Promise<{filesHash: string, zipFile: ArrayBuffer}>} */
  async prepPackage() {
    /** @type {Object<string, string>} */
    const fileContents = {}
    await Promise.all(this.config.files.map(async filename => {
      fileContents[filename] = await fetch(`${this.config.filesDir}/${filename}`).then(result => result.text())
    }))
    const filesHash = SparkMD5.hash(this.config.files.map(filename => fileContents[filename]).join("")).substr(0, 5)

    const zip = new JSZip()
    this.config.files.forEach(filename => {
      const contents = filename === "index.js" ? fileContents[filename].replace("{{HASH_CHECK_AUTO_REPLACE}}", filesHash) : fileContents[filename]
      zip.file(filename, contents)
    })

    // We unzip a symlink since we cannot write to the main directory at runtime
    zip.file("node_modules", "/tmp/node_modules", {
      // 0120000 for the symlink, 0755 for the permissions (see https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/include/uapi/linux/stat.h#n10)
      unixPermissions: 0o120755
    })

    const zipFile = await zip.generateAsync({type: "arraybuffer", platform: "UNIX"})  // platform UNIX to allow symlinks

    return {filesHash, zipFile}
  }

  /**
   * @private
   * @param {number} attemptDelayMs
   * @param {number} maxAttempts
   * @param {() => Promise<boolean>} toRun should return true if successful
   */
  async waitFor(attemptDelayMs, maxAttempts, toRun) {
    /** @param {number} ms */
    const delay = ms => new Promise(res => setTimeout(res, ms))
    for (let loopNo = 0; loopNo < maxAttempts; loopNo += 1) {
      /* eslint-disable no-await-in-loop */
      if (await toRun())
        return

      // Do the delay every time but the last loop
      if (loopNo < maxAttempts - 1)
        await delay(attemptDelayMs)
      /* eslint-enable no-await-in-loop */
    }
    throw new Error("Timeout waiting for result")
  }
}
