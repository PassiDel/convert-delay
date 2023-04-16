import { dataDir, pool } from './pool.js';
import { readdirSync } from 'fs';
import { PrismaClient } from '@prisma/client';

import cliProgress from 'cli-progress';

export async function main() {
  const bar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  // add job for each folder (gtfs-rt datapoint) in data dir
  const jobs: Promise<string>[] = readdirSync(dataDir).map((folder) =>
    pool.exec({ folder })
  );
  // jobs.push(...folders.slice(40, 90).map((folder) => pool.exec({ folder })));
  const bar1 = bar.create(jobs.length, 0);

  const prisma = new PrismaClient();
  const startTime = Date.now();
  bar.log(`${new Date().toLocaleString()}\ttruncate\n`);
  await prisma.$queryRaw`TRUNCATE TABLE "StopDelay";`;
  await prisma.$queryRaw`ALTER SEQUENCE "StopDelay_id_seq" RESTART WITH 1;`;

  // execute job queue
  bar.log(`${new Date().toLocaleString()}\tstart\n`);
  await Promise.allSettled(
    jobs.map(async (p) => {
      try {
        const result = await p;
        bar.log(`${new Date().toLocaleString()}\t${result}\n`);
      } catch (e) {
        let message = 'Unknown Error';
        if (e instanceof Error) message = e.message;
        bar.log(`${new Date().toLocaleString()}\t${String(e)}: ${message}\n`);
      }
      bar1.increment();
    })
  );
  bar.log(`${new Date().toLocaleString()}\tdestroy\n`);
  await pool.destroy();
  bar.log(`${new Date().toLocaleString()}\tstop\n`);
  bar.stop();
  console.log(`${new Date().toLocaleString()}\tdisconnect\n`);
  await prisma.$disconnect();
  console.log(`total: ${(Date.now() - startTime) / 1000}s`);
}

// main();
