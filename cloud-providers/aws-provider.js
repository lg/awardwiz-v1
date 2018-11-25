// AWS Lambda provider for AwardWiz

/* global AWS */

import {CloudProvider} from "./cloud-provider.js"

export default class AWSProvider extends CloudProvider {

  /** @param {AWSProviderConfig} config */
  constructor(config) {
    super(config)

    /** TODO: fix this to not be this way
     * @type {AWSProviderConfig} */
    this.config = this.config

    this.region = this.config.regionZone ? this.config.regionZone.slice(0, -1) : ""

    AWS.config.update({
      accessKeyId: this.config.accessKey,
      secretAccessKey: this.config.secretAccessKey,
      region: this.region
    })

    this.lambda = new AWS.Lambda()
  }

  async stepGetExistingFunctionHash() {
    let functionExists = true
    const func = await this.lambda.getFunction({
      FunctionName: this.config.functionName
    }).promise().catch(err => {
      if (err.code === "ResourceNotFoundException") {
        functionExists = false
      } else {
        throw err
      }
    })

    if (!functionExists)
      return null
    return func.Configuration.Description
  }

  /** @param {ArrayBuffer} zipFile
    * @param {string} filesHash */
  async stepCreateFunction(zipFile, filesHash) {
    return this.lambda.createFunction({
      ...this.commonFunctionConfig(filesHash),
      Publish: true,
      Code: {
        ZipFile: zipFile
      }
    }).promise()
  }

  /** @param {ArrayBuffer} zipFile
    * @param {string} filesHash */
  async stepUpdateFunction(zipFile, filesHash) {
    await this.lambda.updateFunctionCode({
      FunctionName: this.config.functionName,
      ZipFile: zipFile,
      Publish: true
    }).promise()
    await this.lambda.updateFunctionConfiguration(this.commonFunctionConfig(filesHash)).promise()
  }

  /**
   * @param {ScraperParams} params
   * @returns {Promise<ScraperResult>}
   */
  async run(params) {
    const response = await this.lambda.invoke({
      FunctionName: this.config.functionName,
      Payload: JSON.stringify(params)
    }).promise()

    return JSON.parse(response.Payload)
  }

  /** @private
   * @param {string} hash */
  commonFunctionConfig(hash) {
    return {
      FunctionName: this.config.functionName,
      Description: hash,
      Role: this.config.lambdaRoleArn,
      Handler: "index.awsEntry",
      Runtime: "nodejs8.10",
      MemorySize: 2048,
      Timeout: 180
    }
  }
}
