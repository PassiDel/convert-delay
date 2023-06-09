import { main as main0 } from './0-static';
import { main as main1 } from './1-import';
import { main as main2 } from './2-group';
import { main as main3 } from './3-analyze';
import { PrismaClient } from '@prisma/client';

function stepIsEnabled(env?: string) {
  if (env === undefined || env === null) return false;

  return !!['true', '1', 'yes', 'on'].includes(env.toLowerCase().trim());
}
async function main() {
  const prisma = new PrismaClient();
  console.log(process.env);
  if (stepIsEnabled(process.env.STEP1)) {
    console.warn('\nstatic\n\n');
    await main0(prisma);
  }

  if (stepIsEnabled(process.env.STEP2)) {
    console.warn('\nimport\n\n');
    await main1(prisma);
  }

  if (stepIsEnabled(process.env.STEP3)) {
    console.warn('\n\ngroup\n\n');
    await main2(prisma);
  }

  if (stepIsEnabled(process.env.STEP4)) {
    console.warn('\n\nanalyze\n\n');
    await main3();
  }
  process.exit(0);
}

main();
