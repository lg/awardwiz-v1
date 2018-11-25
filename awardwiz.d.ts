interface AwardWizConfig {
  [key: string]: string

  awsAccessKey: string
  awsSecretAccessKey: string
  awsRegionZone: string
  awsLambdaRoleArn: string

  functionName: string
  proxyUrl: string
  aeroplanUsername: string
  aeroplanPassword: string
  origin: string
  destination: string
  date: string
}

interface CloudProviderConfig {
  files: Array<string>
  filesDir: string
  functionName: string
}

interface AWSProviderConfig extends CloudProviderConfig {
  accessKey: string
  secretAccessKey: string
  regionZone: string
  lambdaRoleArn: string
}

// TODO: replace with proper imports
declare class SparkMD5 {
  static hash(text: string): string
}
declare class JSZip {
  file(filename: string, contents: string, options?: {unixPermissions?: number}): void
  generateAsync(options?: {type?: string, platform?: string}): Promise<ArrayBuffer>
}
declare namespace AWS {
  const config: any
  class Lambda {
    constructor()
    getFunction(options: any): AWSPromisableFunction
    createFunction(options: any): AWSPromisableFunction
    updateFunctionCode(options: any): AWSPromisableFunction
    updateFunctionConfiguration(options: any): AWSPromisableFunction
    invoke(options: any): AWSPromisableFunction
  }
  interface AWSPromisableFunction {
    promise(): Promise<any>
  }
}

// TODO: remove the "key: string" thing for module hotloading, that's cheating.
// perhaps figure out how to monkeypatch. do same for gridOptionsWithApi.
interface Window {
  [key: string]: any
  agGrid: typeof import("AgGrid")
}

// TODO: fix the this.config = this.config problem in aws-provider.js
// TODO: find out if there's a way to inherit JSDoc (see stepCreateFunction
// TODO: figure out if @abstract works)
// TODO: look at this Object<string, string> thing