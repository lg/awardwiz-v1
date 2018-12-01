// Genned by http://json2ts.com
//
// Manually changed Messages and Aircrafts to be valid
// Renamed "namespace" to RawAeroplanResult

export declare module RawAeroplanResult {

  export interface Warning {
      code: string;
      message: string;
      type: string;
      status: string;
  }

  export interface Messages {
      "019INTL.AIR": string;
      "004.AIR": string;
      "005.AIR": string;
      "006.AIR": string;
      "007.AIR": string;
  }

  export interface Direct {
      I: number;
      N: number;
      X: number;
  }

  export interface Connect {
  }

  export interface RewardQuote {
      Direct: Direct;
      Connect: Connect;
  }

  export interface RewardQuoteStar {
      X: number;
      N: number;
      I: number;
      O: number;
  }

  export interface CLPlusINTLQuote {
  }

  export interface CLPlusINTLRegular {
  }

  export interface Cabin {
      economy: string;
      business: string;
      first: string;
  }

  export interface Airports {
      SFO: string;
      YYZ: string;
      YOW: string;
      YYC: string;
      ORD: string;
      DCA: string;
      IAD: string;
      YVR: string;
      YEG: string;
      EWR: string;
      SEA: string;
      PHX: string;
  }

  export interface Airlines {
      AC: string;
      UA: string;
      ST: string;
  }

  export interface Aircrafts {
      "319": string;
      "320": string;
      "321": string;
      "738": string;
      "739": string;
      "752": string;
      "753": string;
      "763": string;
      "788": string;
      "789": string;
      "7M8": string;
      "E90": string;
      "E7W": string;
      "CR9": string;
      "CRJ": string;
      "CR7": string;
      "77W": string;
      "73G": string;
  }

  export interface Filters {
      cabin: Cabin[];
      airports: Airports;
      airlines: Airlines;
      aircrafts: Aircrafts;
  }

  export interface Segment {
      position: number;
      origin: string;
      sisterCities: boolean;
      destination: string;
      flightNo: string;
      airline: string;
      codeshareName: string;
      codeshareCode: string;
      codeshareFlight: string;
      fareCode: string;
      stop: string;
      nextConnection: string;
      meal: string;
      duration: string;
      departureDateTime: Date;
      arrivalDateTime: Date;
      lagDays: string;
      aircraft: string;
      product: string;
      group: string;
      bookClass: string;
      cabin: string;
  }

  export interface ODoption {
      position: number;
      optionLogo: string;
      optionAltLogo: string;
      isIKK: boolean;
      memberMustTravel: boolean;
      regularMileage: number;
      mileage: number;
      totalDuration: string;
      totalMinutes: number;
      totalLagDays: string;
      fareCode: string;
      totalStops: string;
      class: string;
      cabin: string;
      segment: Segment[];
      discountIcon: string;
      discountCPlusIconNoMatterCondition: string;
  }

  export interface TripComponent {
      position: number;
      ODoption: ODoption[];
  }

  export interface Product {
      name: string;
      tripComponent: TripComponent[];
  }

  export interface NormalResults {
      saveCookie: string;
      filters: Filters;
      product: Product[];
  }

  export interface RootObject {
      transactionIdentifier: string;
      classicWasSearched: boolean;
      classicPlusWasSearched: boolean;
      international: boolean;
      userAuthenticated: boolean;
      memberTier: string;
      memberDistinctionTier: string;
      memberIconDiscount: string;
      availableMiles: number;
      webBookingFee: number;
      topUpLimit: number;
      errors: any[];
      warnings: Warning[];
      messages: Messages;
      isDomestic: boolean;
      isSameDay: boolean;
      RewardQuote: RewardQuote;
      RewardQuoteStar: RewardQuoteStar;
      CLPlusINTLQuote: CLPlusINTLQuote;
      CLPlusINTLRegular: CLPlusINTLRegular;
      NormalResults: NormalResults;
  }
}
