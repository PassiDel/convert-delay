import { StaticPool } from 'node-worker-threads-pool';
import { resolve } from 'path';
import { cpus } from 'os';
import { MessagePort } from 'worker_threads';
import { existsSync } from 'fs';

const filePath = resolve(__dirname, './worker-js.js');
const workerTs = resolve(__dirname, './worker.ts');
const workerJs = resolve(__dirname, './worker.js');
export const dataDir = resolve(__dirname, '../../data/gtfsrt-zip');
export const pool = new StaticPool<(arg0: Input) => Output, DataType>({
  size: cpus().length / 2,
  // size: 1,
  task: filePath,
  workerData: {
    aliasModule: existsSync(workerTs) ? workerTs : workerJs,
    dataDir,
    agencyFilter: [326],
    maxDelay: 5 * 60
  }
});
export type Input = { folder: string };
export type Output = string;

export type DataType = {
  aliasModule: string;
  dataDir: string;
  agencyFilter: number[];
  maxDelay: number;
};

export interface PoolMessage extends Omit<MessagePort, 'on' | 'postMessage'> {
  on(event: 'message', listener: (value: Input) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'messageerror', listener: (error: Error) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  postMessage(value: Output): void;
}
