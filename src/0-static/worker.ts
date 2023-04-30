import { PrismaClient } from '@prisma/client';
import { dataDir } from './pool.js';
import { resolve } from 'path';
import csv from 'csv-parser';
import { Agency, Route, Stop, StopTime, Trip } from '../models/gtfs';
import { existsSync } from 'fs';
import { SingleBar } from 'cli-progress';
import * as fs from 'fs';
const unzipper = require('unzipper');

const filesOfInterest = [
  'agency.txt',
  'stops.txt',
  'trips.txt',
  'stop_times.txt',
  'routes.txt'
];

function parseCsv<T extends Record<string, any>, A>(
  path: string,
  primary: keyof T,
  options: csv.Options = {},
  numbers: (keyof T)[] | undefined = undefined,
  filter: (value: T) => boolean = () => true
) {
  if (numbers) {
    Object.assign(options, {
      mapValues: ({ header, value }: { header: string; value: string }) =>
        numbers.includes(header) ? parseInt(value) || 0 : value
    });
  }
  return new Promise<{ result: T[]; set: Set<A> }>((resolve) => {
    const result: T[] = [];
    const set = new Set<A>();

    const pipe = fs.createReadStream(path).pipe(csv(options));
    pipe
      .on('data', (data: T) => {
        if (!filter(data)) {
          return;
        }
        result.push(data);
        set.add(data[primary]);
      })
      .on('end', () => {
        pipe.destroy();
        resolve({ result, set });
      });
  });
}

function chunk<T>(array: T[], size: number): T[][] {
  return array.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / size);

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // start a new chunk
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, [] as T[][]);
}

export async function work(
  folder: string,
  agencyFilter: string,
  progress: SingleBar,
  timeProgress: SingleBar,
  log: (arg: string) => void
) {
  const startTime = Date.now();
  progress.start(10, 0);
  const prisma = new PrismaClient();
  await prisma.$connect();

  const zipFile = resolve(dataDir, folder, 'toplevel.zip');
  if (!existsSync(zipFile)) {
    log(`folder: ${folder} not found! ${Date.now() - startTime}ms`);
    progress.stop();
    return;
  }

  const zip = fs
    .createReadStream(zipFile)
    .pipe(unzipper.Parse({ forceStream: true }));

  try {
    for await (const entry of zip) {
      const fileName = entry.path;
      if (filesOfInterest.includes(fileName)) {
        entry.pipe(fs.createWriteStream(resolve(dataDir, folder, fileName)));
      } else {
        entry.autodrain();
      }
    }
  } catch (e) {}
  log('created');

  const date = new Date(folder);
  const { result: agencies, set: agency_ids } = await parseCsv<Agency, number>(
    resolve(dataDir, folder, 'agency.txt'),
    'agency_id',
    undefined,
    ['agency_id'],
    (value) => value.agency_name === agencyFilter
  );
  progress.increment();

  const { count: agency_count } = await prisma.agency.createMany({
    data: agencies.map((a) => ({ ...a, date }))
  });
  progress.increment();
  log(`agency ${agency_count}`);

  const { result: routes, set: route_ids } = await parseCsv<Route, number>(
    resolve(dataDir, folder, 'routes.txt'),
    'route_id',
    undefined,
    ['agency_id', 'route_id', 'route_type'],
    (route) => agency_ids.has(route.agency_id)
  );
  progress.increment();

  const { count: route_count } = await prisma.route.createMany({
    data: routes.map((a) => ({ ...a, date }))
  });
  progress.increment();
  log(`route ${route_count}`);

  const { result: trips, set: trip_ids } = await parseCsv<Trip, number>(
    resolve(dataDir, folder, 'trips.txt'),
    'trip_id',
    undefined,
    [
      'route_id',
      'service_id',
      'trip_id',
      'direction_id',
      'block_id',
      'shape_id',
      'wheelchair_accessible',
      'bikes_allowed'
    ],
    (trip) => route_ids.has(trip.route_id)
  );
  progress.increment();

  const trip_count = await Promise.all(
    chunk(trips, 500).map((t) =>
      prisma.trip.createMany({
        data: t.map((a) => ({ ...a, date }))
      })
    )
  );

  progress.increment();
  log(`trip ${trip_count.map((c) => c.count).reduce((a, c) => a + c, 0)}`);

  const { result: stopTimes, set: stopTimes_ids } = await parseCsv<
    StopTime,
    string
  >(
    resolve(dataDir, folder, 'stop_times.txt'),
    'stop_id',
    {
      mapValues: ({ header, value }) =>
        ['stop_sequence', 'pickup_type', 'drop_off_type', 'trip_id'].includes(
          header
        )
          ? parseInt(value)
          : ['arrival_time', 'departure_time'].includes(header)
          ? parseTime(value)
          : value
    },
    undefined,
    (stopTime) => trip_ids.has(stopTime.trip_id)
  );
  progress.increment();
  log('st parse');

  const { result: stops } = await parseCsv<Stop, string>(
    resolve(dataDir, folder, 'stops.txt'),
    'stop_id',
    undefined,
    ['location_type', 'wheelchair_boarding'],
    (stop) => stopTimes_ids.has(stop.stop_id)
  );
  progress.increment();
  log('s parse');

  const { count: stop_count } = await prisma.stop.createMany({
    data: stops.map((a) => ({ ...a, date }))
  });
  progress.increment();
  log(`stop ${stop_count}`);

  const stopTimeChunk = chunk(stopTimes, 500);
  timeProgress.start(stopTimeChunk.length, 0);
  const stopTime_count = await Promise.all(
    stopTimeChunk.map((s) =>
      prisma.stopTime
        .createMany({
          data: s.map((a) => ({ ...a, date }))
        })
        .then((r) => {
          timeProgress.increment();
          return r;
        })
    )
  );
  progress.increment();
  log(
    `stopTime ${stopTime_count.map((c) => c.count).reduce((a, c) => a + c, 0)}`
  );
  await prisma.$disconnect();

  log(`date: ${date} agency: ${agency_count} ${Date.now() - startTime}ms`);

  filesOfInterest.forEach((file) =>
    fs.unlinkSync(resolve(dataDir, folder, file))
  );
  log('removed');
}
function parseTime(value: string): Date {
  const [hour, minute, second] = value.split(':').map((a) => parseInt(a));

  return new Date(1970, 0, 1, hour, minute, second, 0);
}
