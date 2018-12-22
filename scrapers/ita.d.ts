export interface GeoSearchResponse {
  result: Result[];
}
export interface Result {
  1?: (Entity)[] | null;
}
export interface Entity {
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: number;
  7: number;
  10: string;
}

/*

{"result":{"1":[{"1":"San Francisco International, CA (SFO)","2":"airport","3":"SFO","4":"SFO","5":"San Francisco","6":-122.39167,"7":37.6188889,"10":"America/Los_Angeles"}]}}

*/