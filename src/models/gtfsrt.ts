export const Incrementality = {
  FULL_DATASET: 'FullDataset',
  DIFFERENTIAL: 'Differential'
} as const;

export type IncrementalityType =
  (typeof Incrementality)[keyof typeof Incrementality];

export const ScheduleRelationship = {
  SCHEDULED: 'Scheduled',
  SKIPPED: 'Skipped',
  NO_DATA: 'NoData'
} as const;

export type ScheduleRelationshipType =
  (typeof ScheduleRelationship)[keyof typeof ScheduleRelationship];

export const TripScheduleRelationship = {
  SCHEDULED: 'Scheduled',
  ADDED: 'Added',
  UNSCHEDULED: 'Unscheduled',
  CANCELED: 'Canceled'
} as const;

export type TripScheduleRelationshipType =
  (typeof TripScheduleRelationship)[keyof typeof TripScheduleRelationship];

export interface FeedHeader {
  GtfsRealtimeVersion: string;
  Incrementality: IncrementalityType;
  Timestamp: number;
}

export interface TripDescriptor {
  TripId: string;
  RouteId: string;
  StartTime: string;
  StartDate: string;
  ScheduleRelationship: TripScheduleRelationshipType;
}

export interface StopTimeEvent {
  Uncertainty?: number;
}

export interface StopTimeEventDelay extends StopTimeEvent {
  Delay: number;
}

export interface StopTimeEventTime extends StopTimeEvent {
  Time: number;
}

export type StopTime = StopTimeEventTime | StopTimeEventDelay;

export function isStopTimeEventDelay(
  stopTimeEvent: StopTime
): stopTimeEvent is StopTimeEventDelay {
  return (stopTimeEvent as StopTimeEventDelay).Delay !== undefined;
}

export function isStopTimeEventTime(
  stopTimeEvent: StopTime
): stopTimeEvent is StopTimeEventTime {
  return (stopTimeEvent as StopTimeEventTime).Time !== undefined;
}

export interface StopTimeUpdate {
  StopSequence?: number;
  StopId: string;
  Arrival?: StopTime;
  Departure?: StopTime;
  ScheduleRelationship: ScheduleRelationshipType;
}

export interface StopTimeUpdateScheduleArrival extends StopTimeUpdate {
  Arrival: StopTime;
  ScheduleRelationship: 'Scheduled';
}

export interface StopTimeUpdateScheduleDeparture extends StopTimeUpdate {
  Departure: StopTime;
  ScheduleRelationship: 'Scheduled';
}

export type StopTimeUpdateType =
  | StopTimeUpdateScheduleArrival
  | StopTimeUpdateScheduleDeparture
  | StopTimeUpdate;

export type StopTimeUpdateTypeModified = StopTimeUpdateType & {
  gtfsId: string | undefined;
};

export function hasArrival(
  stopTimeUpdate: StopTimeUpdateType
): stopTimeUpdate is StopTimeUpdateScheduleArrival {
  return (
    (stopTimeUpdate as StopTimeUpdateScheduleArrival).Arrival !== undefined
  );
}

export function hasDeparture(
  stopTimeUpdate: StopTimeUpdateType
): stopTimeUpdate is StopTimeUpdateScheduleDeparture {
  return (
    (stopTimeUpdate as StopTimeUpdateScheduleDeparture).Departure !== undefined
  );
}

export interface TripUpdate {
  Trip: TripDescriptor;
  StopTimeUpdate: StopTimeUpdateType[];
}

export interface FeedEntity {
  Id: string;
  IsDeleted: boolean;
  TripUpdate: TripUpdate;
}

export interface FeedMessage {
  Header: FeedHeader;
  Entity: FeedEntity[];
}
