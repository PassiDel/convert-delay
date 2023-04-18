import { PrismaClient, StopDelay } from '@prisma/client';
import { DataType, PoolMessage } from './pool.js';

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

parentPort.on('close', async () => await prisma.$disconnect());

function groupByKey<A>(array: A[], key: keyof A) {
  return array.reduce(
    (entryMap, e) => entryMap.set(e[key], [...(entryMap.get(e[key]) || []), e]),
    new Map<A[keyof A], A[]>()
  );
}

parentPort.on('message', async ({ start_date }) => {
  const startTime = Date.now();
  // await prisma.$connect();
  const trip_ids = await prisma.stopDelay.findMany({
    where: { start_date },
    select: { trip_id: true },
    distinct: ['trip_id']
  });

  const stopTimes = await prisma.stopTime.findMany({
    select: {
      trip_id: true,
      arrival_time: true,
      departure_time: true,
      stop_sequence: true,
      stop_id: true
    },
    where: {
      trip_id: {
        in: trip_ids.map((t) => t.trip_id)
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  const tripTime = groupByKey(stopTimes, 'trip_id') as Map<
    number,
    typeof stopTimes
  >;
  const notFoundTrips: number[] = [];
  let totalCount = 0;
  const finalStops: StopDelay[] = [];
  await Promise.all(
    trip_ids.map(async ({ trip_id }) => {
      const updates = await prisma.stopDelay.findMany({
        where: {
          start_date,
          trip_id
        }
      });
      if (!tripTime.has(trip_id) || updates.length <= 0) {
        notFoundTrips.push(trip_id);
        const { count } = await prisma.stopDelay.deleteMany({
          where: {
            AND: [{ start_date }, { trip_id }]
          }
        });
        totalCount += count;
        return;
      }

      const times = tripTime.get(trip_id)!!;
      const stops = groupByKey(updates, 'stop_id') as Map<
        string,
        typeof updates
      >;

      const startDate = updates[0].start_date;
      const startTime = updates[0].start_time;
      const start = new Date(startDate.getTime() + startTime.getTime());

      const final: StopDelay[] = [];
      stops.forEach((s, stop_id) => {
        const time = times.find((t) => t.stop_id === stop_id);
        if (!time) return;

        const departureTime = time.departure_time;
        const lastTime = new Date(
          startDate.getTime() + departureTime.getTime()
        );
        if (lastTime < start) {
          lastTime.setDate(lastTime.getDate() + 1);
        }
        const last = s.find((s) => s.timestamp >= lastTime) || s[0];
        final.push(last);
      });

      const { count } = await prisma.stopDelay.deleteMany({
        where: {
          AND: [
            { start_date },
            { trip_id },
            {
              id: {
                notIn: final.map((f) => f.id)
              }
            }
          ]
        }
      });
      finalStops.push(...final);
      totalCount += count;
    })
  );

  parentPort.postMessage(
    `${threadId} result(${start_date.toLocaleDateString()}): trips: ${
      trip_ids.length
    } final: ${
      finalStops.length
    } removed: ${totalCount} missing: ${notFoundTrips.join(', ')} ${
      Date.now() - startTime
    }ms`
  );
});
