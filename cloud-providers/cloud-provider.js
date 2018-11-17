// Abstract class for cloud providers for AwardWiz

/* global SparkMD5, JSZip */

export class CloudProvider {
  constructor(config) {
    this.config = config
    if (!config.functionName)
      throw new Error("Missing CloudProvider required config params")
  }

  async initOnPage() {
    [
      {obj: "JSZip", url: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"},
      {obj: "SparkMD5", url: "https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.0/spark-md5.min.js"}
    ].forEach(({obj, url}) => {
      if (!window[obj]) {
        const scriptTag = document.createElement("script")
        scriptTag.src = url
        document.head.appendChild(scriptTag)
      }
    })
  }

  async stepValidateEnvironment() {
  }

  /** @param {string} zipFile
    * @param {string} filesHash */
  async stepCreateFunction(zipFile, filesHash) {
    throw new Error("Unimplemented!")
  }

  /** @param {string} zipFile
    * @param {string} filesHash */
  async stepUpdateFunction(zipFile, filesHash) {
    throw new Error("Unimplemented!")
  }

  /** @returns {Promise<boolean>} */
  async stepGetExistingFunctionHash(filesHash) {
    throw new Error("Unimplemented!")
  }

  async run(params) {
    throw new Error("Unimplemented!")
  }

  /////

  async prep() {
    console.log("Validating environment...")
    await this.stepValidateEnvironment()

    console.log("Prepping package...")
    const {filesHash, zipFile} = await this.prepPackage()

    console.log("Getting if cloud has up to date function...")
    const existingFunctionHash = await this.stepGetExistingFunctionHash(filesHash)
    if (existingFunctionHash === filesHash) {
      console.log("Up to date!")
    } else if (existingFunctionHash === null) {
      console.log("Doesn't exist, creating it...")
      await this.stepCreateFunction(zipFile, filesHash)
    } else {
      console.log("Exists, but outdated, updating it...")
      await this.stepUpdateFunction(zipFile, filesHash)
    }
  }

  ///// private

  async prepPackage() {
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
    const zipFile = await zip.generateAsync({type: "arraybuffer"})       ////// NOTE WAS CHANGED

    return {filesHash, zipFile}
  }


}
