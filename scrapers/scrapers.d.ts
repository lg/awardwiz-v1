interface SearchResult {
  /** When the flight departs, in the origin's time zone. Format is: YYYY-MM-DD HH:MM */
  departureDateTime: string

  /** When the flight arrives after all connections, in the destination's time zone. Format is: YYYY-MM-DD HH:MM */
  arrivalDateTime: string

  /** Origin airport code. */
  origin: string

  /** Destination airport code. */
  destination: string

  /** Miles and/or cash required. */
  costs: {
    economy: SearchResultMilesAndCash
    business: SearchResultMilesAndCash
    first: SearchResultMilesAndCash
  }

  /** Airline name. Examples: American, Air Canada */
  airline: string | null

  /** Flight number with airline code. Examples: AC 123, SQ 1 */
  flightNo: string | null

  /** Duration of the flight. Example: 5h 32m */
  duration: string | null

  /** The type of aircraft for the flight. Example: Airbus A320 */
  aircraft: string | null
}

interface SearchResultMilesAndCash {
  miles: number | null
  cash: number | null
}

interface SearchResultMilesAndCashWithScraper extends SearchResultMilesAndCash {
  scraper?: string
}

interface SearchResultRow extends SearchResult {
  scrapersUsed: {[scraper: string]: SearchResult}

  /** The cheapest result for each of the classes of service */
  costs: {
    economy: SearchResultMilesAndCashWithScraper
    business: SearchResultMilesAndCashWithScraper
    first: SearchResultMilesAndCashWithScraper
  }
}

interface ScraperHashCheckParams {
  hashCheck: true
}

interface ScraperParams {
  scraper: string
  proxy?: string
  params: SearchQuery
  headless?: boolean
}

interface SearchQuery {
  [extraParam: string]: string

  /** Origin airport code. */
  origin: string

  /** Destination airport code. */
  destination: string

  /** Date when the flight should depart. Format: YYYY-MM-DD */
  date: string
}

interface ScraperResult {
  consoleLog: Array<LogItem>
  screenshot: string
  scraperResult?: {
    searchResults: Array<SearchResult>
  }
  error?: Error
  hashCheck?: string
  awsLogURL?: string
}

declare type ConsoleMethod = "error" | "log" | "info"

interface LogItem {
  type: ConsoleMethod
  date: string
  text: string
}

/**
 * A scraper has the following attributes:
 * - cashOnly: if true, this scraper is used to find routes only
 *
 * Ideally a scraper can do the following:
 * - Region codes and airport codes used interchangeably when searching
 * - All results on one page
 * - No-navigate taxes and fees
 * - No-navigate # of connections
 * - No-navigate connection airports
 * - No-navigate flight numbers
 * - Ability to set number of maximum connections
 */
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

// TODO: import aws stuff
