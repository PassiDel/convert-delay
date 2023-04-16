export interface Agency {
  agency_id: number;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string;
  agency_phone: string;
}

export const RouteType = {
  TRAM: 0,
  SUBWAY: 1,
  RAIL: 2,
  BUS: 3,
  FERRY: 4,
  CABLE_TRAM: 5,
  AERIAL_LIFT: 6,
  FUNICULAR: 7,
  TROLLYBUS: 11,
  MONORAIL: 12
} as const;

export type RouteTypeType = (typeof RouteType)[keyof typeof RouteType];

export interface Route {
  route_id: number;
  agency_id: number;
  route_short_name: string;
  route_long_name: string;
  route_type: RouteTypeType;
  route_color: string;
  route_text_color: string;
  route_desc: string;
}

export interface Stop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc: string;
  stop_lat: string;
  stop_lon: string;
  location_type: number;
  parent_station: string;
  wheelchair_boarding: number;
  platform_code: string;
  zone_id: string;
}

export interface StopTime {
  trip_id: number;
  arrival_time: Date;
  departure_time: Date;
  stop_id: string;
  stop_sequence: number;
  pickup_type: number;
  drop_off_type: number;
  stop_headsign: string;
}

export interface Trip {
  route_id: number;
  service_id: number;
  trip_id: number;
  trip_headsign: string;
  trip_short_name: string;
  direction_id: number;
  block_id: number;
  shape_id: number;
  wheelchair_accessible: number;
  bikes_allowed: number;
}
