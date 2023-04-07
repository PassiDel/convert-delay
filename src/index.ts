import { main as main0 } from './0-static';
import { main as main1 } from './1-import';
import { main as main2 } from './2-group';

async function main() {
  console.warn('\nstatic\n\n');
  await main0();

  // console.warn('\nimport\n\n');
  // await main1();

  // console.warn('\n\ngroup\n\n');
  // await main2();
}

main();
