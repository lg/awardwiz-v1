interface SearchResult {
  fromDateTime: string
  toDateTime: string
  fromAirport: string
  toAirport: string
  flights: string
  costs: {
    economy: SearchResultMilesAndCash
    business: SearchResultMilesAndCash
    first: SearchResultMilesAndCash
  }
}

interface SearchResultMilesAndCash {
  miles: number | null
  cash: number | null
}

interface SearchResultWithService extends SearchResult {
  service: string
}

interface ScraperHashCheckParams {
  hashCheck: true
}

interface ScraperParams {
  scraper: string
  proxy?: string
  params: UnitedSearchQuery | AeroplanSearchQuery
  headless?: boolean
}

interface SearchQuery {
  from: string
  to: string
  date: string
  maxConnections: number
}

interface UnitedSearchQuery extends SearchQuery {}
interface AeroplanSearchQuery extends SearchQuery {
  aeroplanUsername: string
  aeroplanPassword: string
}

interface ScraperResult {
  consoleLog: Array<LogItem>
  screenshot: string
  scraperResult?: {
    searchResults: Array<SearchResult>
  }
  error?: Error
  hashCheck?: string
}

declare type ConsoleMethod = "error" | "log" | "info"

interface LogItem {
  type: ConsoleMethod
  date: string
  text: string
}

declare class Scraper {
  scraperMain(page: import("puppeteer").Page, searchQuery: SearchQuery): Promise<{searchResults: Array<SearchResult>}>
}

///////////

declare module "chrome-aws-lambda" {
  type ChromeAwsLambda = {
    puppeteer: typeof import("puppeteer")
    executablePath?: Promise<string>
    headless: boolean
    args: Array<string>
    defaultViewport: Object
  }

  export = ChromeAwsLambda;
}

declare module "proxy-chain" {
  class Server {
    constructor(options: {
      port: number
    })
    prepareRequestFunction: () => {
      upstreamProxyUrl: string | null,
      requestAuthentication: boolean
    }
    server: {
      listening: boolean
    }
    listen: () => Promise<void>
    close: (closeClients: boolean) => Promise<void>
  }
}

///////

// TODO: fix the below by importing proper definitions and remove no-tscheck
declare class AWSContext {
  succeed(response: any): any
}

// TODO: import aws stuff
