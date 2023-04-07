import { PrismaClient } from '@prisma/client';
import { TripDescriptor } from './models/gtfsrt';

function parseDate(t: TripDescriptor) {
  const [year, month, day] = [
    t.StartDate.slice(0, 4),
    t.StartDate.slice(4, 6),
    t.StartDate.slice(6, 8)
  ];
  return new Date(`${year}-${month}-${day}T${t.StartTime}.000`);
}
const prisma = new PrismaClient();
async function main() {
  // console.log(new Date());
  // return;
  const StartDate = '20220110';
  const StartTime = '12:52:12';
  const start = parseDate({
    TripId: '',
    RouteId: '',
    StartTime,
    StartDate,
    ScheduleRelationship: 'Scheduled'
  });
  console.log(start);
  console.log(
    await prisma.stopDelay.create({
      data: {
        date: new Date(),
        stop_id: null,
        trip_id: 0,
        start_time: start,
        start_date: start,
        stopSequence: 1,
        timestamp: new Date(1641813901 * 1000),
        route_id: 35731
      }
    })
  );
  await prisma.$disconnect();
  return;
}

main();
