import { dataDir } from './pool.js';
import { PrismaClient } from '@prisma/client';

import cliProgress from 'cli-progress';
import { readdirSync } from 'fs';
import { work } from './worker';

export async function main(prisma: PrismaClient) {
  const startTime = Date.now();

  const bar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  const log = (arg: string) => {
    bar.log(`${new Date().toLocaleString()}\t${arg}\n`);
    bar.update();
  };

  log('truncate');

  await prisma.$connect();

  await prisma.$queryRaw`TRUNCATE TABLE "Agency" CASCADE;`;
  await prisma.$queryRaw`TRUNCATE TABLE "Stop" CASCADE;`;
  await prisma.$queryRaw`TRUNCATE TABLE "Route" CASCADE;`;
  await prisma.$queryRaw`TRUNCATE TABLE "Trip" CASCADE;`;
  await prisma.$queryRaw`TRUNCATE TABLE "StopTime" CASCADE;`;

  await prisma.$disconnect();

  const dateFolders = readdirSync(dataDir);

  const bar1 = bar.create(dateFolders.length, 0);

  // execute job queue
  log('start');
  const timeProgress = bar.create(1, 0);
  const progress = bar.create(1, 0);

  for (const folder of dateFolders) {
    try {
      if (global.gc) global.gc();
      await work(folder, progress, timeProgress, log);
    } catch (e) {
      let message = 'Unknown Error';
      if (e instanceof Error) message = e.message;
      log(`${String(e)}: ${message}`);
    }
    bar1.increment();
  }
  log(`destroy`);
  log(`stop`);
  bar.stop();
  console.log(`${new Date().toLocaleString()}\tdisconnect`);
  console.log(`total: ${(Date.now() - startTime) / 1000}s`);
}

// main();
