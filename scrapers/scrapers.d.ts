// TODO: bring in @types/node and other types

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
  scraperMain(page: any, searchQuery: SearchQuery): Promise<{searchResults: Array<SearchResult>}>
}

// TODO: fix the below by importing proper definitions and remove no-tscheck
declare class AWSContext {
  succeed(response: any): any
}
declare type Puppeteer = any
declare type ChromeAwsLambda = any
declare type ProxyChain = any
declare type ProxyServer = any

// TODO: consider importing the United schema lol
// TODO: turn off suppressImplicitAnyIndexErrors
// TODO: really look at all uses of "page" after fixing puppeteer
// TODO: look over all these files for explicit "any"s
// TODO: look for all ts-ignores