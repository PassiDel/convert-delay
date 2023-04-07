import { PrismaClient } from '@prisma/client';
import { dataDir, DataType, PoolMessage } from './pool.js';
import { resolve } from 'path';
import AdmZip from 'adm-zip';
// import neatCsv from 'neat-csv';
import csv from 'csv-parser';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { Agency, Route, Stop, StopTime, Trip } from '../models/gtfs';
import { existsSync } from 'fs';
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

function parseCsv<T extends Record<string, any>, A>(
  buffer: Buffer,
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

    Readable.from(buffer)
      .pipe(csv(options))
      .on('data', (data: T) => {
        if (!filter(data)) {
          return;
        }
        result.push(data);
        set.add(data[primary]);
      })
      .on('end', () => resolve({ result, set }));
  });
}

parentPort.on('message', async ({ folder }) => {
  const startTime = Date.now();

  const zipFile = resolve(dataDir, folder, 'toplevel.zip');
  if (!existsSync(zipFile)) {
    parentPort.postMessage(
      `${threadId} folder: ${folder} not found! ${Date.now() - startTime}ms`
    );
    return;
  }
  const zip = new AdmZip(zipFile);

  const date = new Date(folder);
  const { result: agencies, set: agency_ids } = await parseCsv<Agency, number>(
    zip.getEntry('agency.txt')?.getData()!!,
    'agency_id',
    undefined,
    ['agency_id'],
    (value) => value.agency_name === 'Bremer Straßenbahn AG'
  );
  const { count: agency_count } = await prisma.agency.createMany({
    data: agencies.map((a) => ({ ...a, date }))
  });
  console.log('agency', agency_count);

  const { result: routes, set: route_ids } = await parseCsv<Route, number>(
    zip.getEntry('routes.txt')?.getData()!!,
    'route_id',
    undefined,
    ['agency_id', 'route_id', 'route_type'],
    (route) => agency_ids.has(route.agency_id)
  );
  const { count: route_count } = await prisma.route.createMany({
    data: routes.map((a) => ({ ...a, date }))
  });
  console.log('route', route_count);

  const { result: trips, set: trip_ids } = await parseCsv<Trip, number>(
    zip.getEntry('trips.txt')?.getData()!!,
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

  const { count: trip_count } = await prisma.trip.createMany({
    data: trips.map((a) => ({ ...a, date }))
  });

  console.log('trip', trip_count);

  const { result: stopTimes, set: stopTimes_ids } = await parseCsv<
    StopTime,
    string
  >(
    zip.getEntry('stop_times.txt')?.getData()!!,
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
  const { result: stops, set: stop_ids } = await parseCsv<Stop, string>(
    zip.getEntry('stops.txt')?.getData()!!,
    'stop_id',
    undefined,
    ['location_type', 'wheelchair_boarding'],
    (stop) => stopTimes_ids.has(stop.stop_id)
  );
  const { count: stop_count } = await prisma.stop.createMany({
    data: stops.map((a) => ({ ...a, date }))
  });

  console.log('stop', stop_count);

  const { count: stopTime_count } = await prisma.stopTime.createMany({
    data: stopTimes.map((a) => ({ ...a, date }))
  });
  console.log('stopTime', stopTime_count);

  parentPort.postMessage(
    `${threadId} date: ${date} agency: ${agency_count} ${
      Date.now() - startTime
    }ms`
  );
});
function parseTime(value: string): Date {
  const [hour, minute, second] = value.split(':').map((a) => parseInt(a));

  return new Date(1970, 0, 1, hour, minute, second, 0);
}
