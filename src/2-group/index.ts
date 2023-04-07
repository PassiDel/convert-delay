import { dataDir, pool } from './pool.js';
import { PrismaClient } from '@prisma/client';

import cliProgress from 'cli-progress';

const prisma = new PrismaClient();

export async function main() {
  const startTime = Date.now();

  const bar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  const dates = await prisma.stopDelay.groupBy({ by: ['start_date'] });
  const jobs: Promise<string>[] = dates.map(({ start_date }) =>
    pool.exec({ start_date })
  );
  const bar1 = bar.create(jobs.length, 0);

  // execute job queue
  bar.log(`${new Date().toLocaleString()}\tstart\n`);
  bar1.increment();
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
