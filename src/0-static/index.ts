import { dataDir, pool } from './pool.js';
import { PrismaClient } from '@prisma/client';

import cliProgress from 'cli-progress';
import { readdirSync } from 'fs';

const prisma = new PrismaClient();

export async function main() {
  const startTime = Date.now();

  const bar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  bar.log(`${new Date().toLocaleString()}\ttruncate\n`);
  await prisma.$queryRaw`TRUNCATE TABLE "Agency" CASCADE;`;
  await prisma.$queryRaw`TRUNCATE TABLE "Stop" CASCADE;`;

  const dateFolders = readdirSync(dataDir);
  const jobs: Promise<string>[] = dateFolders.map((folder) =>
    pool.exec({ folder })
  );
  const bar1 = bar.create(jobs.length, 0);

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
