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

interface ScraperResult {
  consoleLog: Array<{date: string, text: string, type: string}>
  screenshot: string
  scraperResult?: {
    searchResults: Array<SearchResult>
  }
  error?: Error
}

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
  miles?: number
  cash?: number
}

interface SearchResultWithService extends SearchResult {
  service: string
}

interface ScraperParams {
  scraper: string
  proxy?: string
  params: UnitedSearchQuery | AeroplanSearchQuery
}

interface RegularSearchQuery {
  from: string
  to: string
  date: string
  maxConnections: number
}

interface UnitedSearchQuery extends RegularSearchQuery {}
interface AeroplanSearchQuery extends RegularSearchQuery {
  aeroplanUsername: string
  aeroplanPassword: string
}