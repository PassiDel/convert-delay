import { PrismaClient } from '@prisma/client';
import { DataType, PoolMessage } from './pool.js';
import { resolve } from 'path';
import decompress from 'decompress';
import {
  FeedMessage,
  hasArrival,
  hasDeparture,
  isStopTimeEventDelay,
  ScheduleRelationship,
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

const routeList = new Map<number, Date>();

parentPort.on('close', async () => await prisma.$disconnect());

function loadFile(file: Buffer) {
  const { Entity: entries, Header }: FeedMessage = JSON.parse(file.toString());
  return { entries, Header };
}

async function preloadRouteList() {
  console.log('preload');
  const allowedRoutes = await prisma.route.findMany({
    select: {
      route_id: true,
      date: true
    },
    where: {
      agency_id: {
        in: workerData.agencyFilter
      }
    }
  });

  console.log('preloaded', allowedRoutes.length);
  allowedRoutes.forEach(({ route_id, date }) => routeList.set(route_id, date));
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
  const startTime = Date.now();
  // await prisma.$connect();

  console.log('cc', folder);

  if (routeList.size <= 0) {
    await preloadRouteList();
  }
  const allFiles = await decompress(resolve(workerData.dataDir, folder));

  const files = allFiles.filter((f) => f.type === 'file');
  let totalCount = 0;

  console.log('files', files.length);

  for (const file of files) {
    const { entries, Header } = loadFile(file.data);
    const timestamp = new Date(Header.Timestamp * 1000);
    console.log(file.path, timestamp.toLocaleString());

    const trips = entries.filter((e) =>
      routeList.has(parseInt(e.TripUpdate.Trip.RouteId) || 0)
    );

    const data = trips.flatMap((t) => {
      // const updates: StopDelayCreateManyInput[] = [];
      const trip_id = parseInt(t.TripUpdate.Trip.TripId) || 0;
      const route_id = parseInt(t.TripUpdate.Trip.RouteId) || 0;
      if (trip_id === 0 || route_id === 0) return [];

      const start = parseDate(t.TripUpdate.Trip);
      const date = routeList.get(route_id)!!;

      return t.TripUpdate.StopTimeUpdate.map((u) =>
        u.ScheduleRelationship === ScheduleRelationship.SCHEDULED
          ? {
              date,
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
    totalCount += count;
    // console.log(timestamp.toLocaleString(), count);
  }

  parentPort.postMessage(
    `${threadId} result(${folder}): entries: ${
      files.length
    } created: ${totalCount} ${Date.now() - startTime}ms`
  );
});
