// AWS Lambda provider for AwardWiz
//
// - Create an ARN using the default lambda template

/* global AWS */

import {CloudProvider} from "./cloud-provider.js"

export default class AWSProvider extends CloudProvider {
  constructor(config) {
    super(config)
    this.config.region = this.config.regionZone ? this.config.regionZone.slice(0, -1) : ""

    AWS.config.update({
      accessKeyId: this.config.accessKey,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region
    })

    this.lambda = new AWS.Lambda()
  }

  async stepValidateEnvironment() {
    // TODO: Create the IAM role if necessary
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

  async stepCreateFunction(zipFile, filesHash) {
    return this.lambda.createFunction({
      ...this.commonFunctionConfig(filesHash),
      Publish: true,
      Code: {
        ZipFile: zipFile
      }
    }).promise()
  }

  async stepUpdateFunction(zipFile, filesHash) {
    await this.lambda.updateFunctionCode({
      FunctionName: this.config.functionName,
      ZipFile: zipFile,
      Publish: true
    }).promise()
    await this.lambda.updateFunctionConfiguration({
      ...this.commonFunctionConfig(filesHash),
      FunctionName: this.config.functionName,
      Description: filesHash
    })
  }

  async run(params) {
  }

  // private

  /** @param {string} hash */
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
