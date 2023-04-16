import { PrismaClient } from '@prisma/client';
import cliProgress, { SingleBar } from 'cli-progress';
import { RouteType } from '../models/gtfs';

const prisma = new PrismaClient();

function fixed(
  percentage: number | null,
  digits: number = 2,
  unit: string = '%'
) {
  return `${(percentage || 0).toFixed(digits)} ${unit}`;
}

async function calculateDelayPerDay(
  dates: { start_date: Date }[],
  detail: SingleBar
) {
  detail.start(dates.length, 0);
  return (
    await Promise.all(
      dates.map(async ({ start_date }) => {
        const histogram = await prisma.stopDelay.groupBy({
          by: ['departure_delay'],
          _count: {
            _all: true
          },
          where: {
            start_date
          },
          orderBy: {
            departure_delay: 'asc'
          },
          having: {
            departure_delay: {
              not: null
            }
          }
        });

        const avg = await prisma.stopDelay.aggregate({
          _sum: {
            departure_delay: true
          },
          _avg: {
            departure_delay: true
          },
          where: {
            start_date
          }
        });

        detail.increment();
        return { histogram, start_date, avg };
      })
    )
  ).map(({ start_date, histogram, avg }) => {
    let [total, delayed, exact] = [0, 0, 0];

    histogram.forEach(({ departure_delay, _count }) => {
      if (departure_delay === null) return;
      total += _count._all;
      if (departure_delay > 5 * 60) delayed += _count._all;
      else if (departure_delay > -60 && departure_delay < 60)
        exact += _count._all;
    });

    return {
      date: start_date.toLocaleDateString(),
      total,
      delayed,
      onTimePerc: fixed((100 * (total - delayed)) / total),
      delayedPerc: fixed((100 * delayed) / total),
      exact,
      exactPerc: fixed((100 * exact) / total),
      avg: fixed((avg._avg.departure_delay || 0) / 60, 2, 'min'),
      sum: fixed((avg._sum.departure_delay || 0) / 60, 2, 'min')
    };
  });
}

function getTypeFromRoute(route?: { route_type: number } | null) {
  return route
    ? route.route_type === RouteType.BUS
      ? 'Bus'
      : route.route_type === RouteType.TRAM
      ? 'Tram'
      : 'Other'
    : 'Other';
}

async function calculateDelayPerRoute(detail: SingleBar) {
  detail.start(3, 0);
  const routes = await prisma.route.findMany({
    distinct: ['route_id'],
    orderBy: {
      date: 'asc'
    },
    select: {
      route_id: true,
      route_type: true,
      route_short_name: true
    }
  });
  detail.increment();

  const delays = await prisma.stopDelay.groupBy({
    by: ['route_id'],
    _count: {
      _all: true,
      trip_id: true
    },
    _avg: {
      departure_delay: true
    },
    _sum: {
      departure_delay: true
    }
  });
  detail.increment();

  const delay = routes
    .map((r) => {
      const d = delays.find((d) => d.route_id == r.route_id);
      return {
        route: r.route_short_name,
        type: getTypeFromRoute(r),
        avg: d?._avg.departure_delay || null,
        count: d?._count.trip_id || 0,
        sum: d?._sum.departure_delay || 0
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type) || b.count - a.count);
  detail.increment();
  return delay;
}

async function calculateDelayPerStop() {
  const uniqueStops = await prisma.stopDelay.findMany({
    select: {
      stop_id: true,
      date: true
    },
    where: {
      stop_id: {
        not: null
      }
    },
    distinct: ['stop_id', 'date']
  });

  const stops = await prisma.stop.findMany({
    where: {
      OR: uniqueStops.map(({ stop_id, date }) => ({
        stop_id: stop_id!!,
        date
      }))
    },
    select: {
      stop_id: true,
      stop_name: true
    }
  });

  const delays = await prisma.stopDelay.groupBy({
    by: ['stop_id', 'date'],
    _avg: {
      arrival_delay: true,
      departure_delay: true
    },
    _count: true
  });

  return delays
    .map((d) => {
      const stop = stops.find((s) => s.stop_id === d.stop_id);
      const arrival = d._avg.arrival_delay || 0;
      const departure = d._avg.departure_delay || 0;
      return {
        name: stop?.stop_name || '',
        arrival,
        departure,
        relative: departure - arrival,
        count: d._count
      };
    })
    .sort((a, b) => b.relative - a.relative);
}

export async function main() {
  const startTime = Date.now();

  const bar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  const dates = await prisma.stopDelay.groupBy({ by: ['start_date'] });
  const master = bar.create(
    3,
    0,
    { task: '' },
    {
      format: ' {bar} | ETA: {eta}s | {value}/{total} | {task}',
      forceRedraw: true
    }
  );
  const detail = bar.create(1, 0);

  master.update({ task: 'calculateDelayPerDay' });
  // const delays = await calculateDelayPerDay(dates, detail);
  master.increment();

  master.update({ task: 'calculateDelayPerRoute' });
  // const routes = await calculateDelayPerRoute(detail);
  master.increment();

  master.update({ task: 'calculateDelayPerRoute' });
  const stops = await calculateDelayPerStop();
  master.increment();

  master.update({ task: 'done' });
  bar.stop();
  // console.table(delays);
  // console.table(routes);
  console.table(stops);
  await prisma.$disconnect();
  console.log(`total: ${(Date.now() - startTime) / 1000}s`);
}
