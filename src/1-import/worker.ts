import { PrismaClient } from '@prisma/client';
import { DataType, PoolMessage } from './pool.js';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import {
  FeedEntity,
  FeedMessage,
  hasArrival,
  hasDeparture,
  isStopTimeEventDelay,
  ScheduleRelationship,
  StopTimeUpdateTypeModified,
  TripDescriptor
} from '../models/gtfsrt.js';

// noinspection ES6ConvertRequireIntoImport
const {
  parentPort,
  workerData,
  threadId
}: {
  parentPort: PoolMessage;
  workerData: DataType;
  threadId: number;
} = require('worker_threads');

const prisma = new PrismaClient();

const tripCache = new Map<
  number,
  {
    agency: number;
    stops: { stop_id: string; stop_sequence: number }[];
  }
>();

const routeList = new Set<number>();

parentPort.on('close', async () => await prisma.$disconnect());

async function loadFile(folder: string) {
  const file = resolve(workerData.dataDir, folder, 'gtfsr_connect.json');

  const { Entity: entries, Header }: FeedMessage = JSON.parse(
    await fs.readFile(file, { encoding: 'utf8' })
  );
  return { entries, Header };
}

async function preloadTripsToCache(entries: FeedEntity[]) {
  // find new trip ids
  const tripIds = new Set<number>();
  entries
    .filter((e) => routeList.has(parseInt(e.TripUpdate.Trip.RouteId) | 0))
    .map((e) => parseInt(e.TripUpdate.Trip.TripId) || 0)
    .forEach((id) => {
      if (!tripCache.has(id)) tripIds.add(id);
    });

  // const chunkSize = 100;
  // const chunks = [...Array(Math.ceil(tripIds.length / chunkSize))].map((_) =>
  //   tripIds.splice(0, chunkSize)
  // );

  // console.log(chunks);

  // fetch uncached stops
  const trips = await prisma.trip.findMany({
    where: {
      trip_id: {
        in: Array.from(tripIds)
      }
    },
    select: {
      trip_id: true,
      route: {
        select: {
          agency_id: true
        }
      },
      stop_times: {
        select: {
          stop_id: true,
          stop_sequence: true
        }
      }
    }
  });
  const newIds = new Set<number>();
  trips.forEach(({ trip_id, route, stop_times }) => {
    if (!tripCache.has(trip_id)) {
      tripCache.set(trip_id, {
        stops: [],
        agency: route.agency_id
      });
    }
    const cachedTrip = tripCache.get(trip_id)!!;
    stop_times.forEach((stop) => {
      newIds.add(trip_id);

      cachedTrip.stops.push(stop);
    });
  });
  return { tripIds, newIds };
}

function mapToGtfsIds(
  entity: FeedEntity,
  trip: { agency: number; stops: { stop_id: string; stop_sequence: number }[] }
): StopTimeUpdateTypeModified[] {
  return entity.TripUpdate.StopTimeUpdate.map((stopUpdate) => {
    return {
      ...stopUpdate,
      gtfsId:
        trip?.stops.find(
          ({ stop_sequence }) =>
            stop_sequence === (stopUpdate.StopSequence || 0)
        )?.stop_id ?? undefined
    };
  });
}

async function preloadRouteList() {
  const allowedRoutes = await prisma.route.findMany({
    select: {
      route_id: true
    },
    where: {
      agency_id: {
        in: workerData.agencyFilter
      }
    }
  });

  allowedRoutes.forEach(({ route_id }) => routeList.add(route_id));
}

function parseDate(t: TripDescriptor) {
  const [year, month, day] = [
    t.StartDate.slice(0, 4),
    t.StartDate.slice(4, 6),
    t.StartDate.slice(6, 8)
  ];
  return new Date(`${year}-${month}-${day}T${t.StartTime}.000`);
}

parentPort.on('message', async ({ folder }) => {
  // 1. unpack {day}.tar.bz2 to /tmp/{day}
  // 2. for each folder
  // 2.1 load gtfsr_connect.json as GTFS-RT
  // 2.2 for each .Entity with .TripUpdate.StopTimeUpdate.length > 1
  // 2.2.1 for i=1 to .TripUpdate.StopTimeUpdate.length
  // 2.2.1.1 calculate strip delay between i and i-1
  // 2.2.1.2 calculate stop day for i
  // delete /tmp/{day}

  const startTime = Date.now();
  // await prisma.$connect();

  if (routeList.size <= 0) {
    await preloadRouteList();
  }

  const { entries, Header } = await loadFile(folder);
  const timestamp = new Date(Header.Timestamp * 1000);

  // const { tripIds, newIds } = await preloadTripsToCache(entries);

  const trips = entries.filter((e) =>
    routeList.has(parseInt(e.TripUpdate.Trip.RouteId) || 0)
  );

  // console.log(
  //   trips.map((t) => `${t.TripUpdate.Trip.RouteId}-${t.TripUpdate.Trip.TripId}`)
  // );

  const data = trips.flatMap((t) => {
    // const updates: StopDelayCreateManyInput[] = [];
    const trip_id = parseInt(t.TripUpdate.Trip.TripId) || 0;
    const route_id = parseInt(t.TripUpdate.Trip.RouteId) || 0;
    if (trip_id === 0 || route_id === 0) return [];

    const start = parseDate(t.TripUpdate.Trip);

    return t.TripUpdate.StopTimeUpdate.map((u) =>
      u.ScheduleRelationship === ScheduleRelationship.SCHEDULED
        ? {
            date: new Date(),
            timestamp,
            arrival_delay:
              hasArrival(u) && isStopTimeEventDelay(u.Arrival)
                ? u.Arrival.Delay
                : null,
            departure_delay:
              hasDeparture(u) && isStopTimeEventDelay(u.Departure)
                ? u.Departure.Delay
                : null,
            route_id,
            stop_id: u.StopId,
            stopSequence: u.StopSequence || 0,
            trip_id,
            start_date: start,
            start_time: start
          }
        : null
    ).filter((x): x is NonNullable<typeof x> => Boolean(x));
  });

  const { count } = await prisma.stopDelay.createMany({
    data
  });

  parentPort.postMessage(
    `${threadId} result(${timestamp.toLocaleString()}): entries: ${
      entries.length
    } processed: ${trips.length} created: ${count} ${Date.now() - startTime}ms`
  );
});
