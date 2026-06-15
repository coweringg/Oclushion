import { createInterface } from 'node:readline';
import { BrowserEngine } from './engine.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

interface IpcMessage {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface IpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}

const rl = createInterface({ input: process.stdin });
const engine = new BrowserEngine();

let shuttingDown = false;

function respond(msg: IpcResponse): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handleMessage(msg: IpcMessage): Promise<void> {
  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'ping': {
        respond({ id, result: { pong: true } });
        break;
      }

      case 'run_test': {
        if (!engine.isReady()) {
          await engine.initPlaywright();
        }
        const result = await engine.runTest(params as any);
        respond({ id, result });
        break;
      }

      case 'cancel_test': {
        const testId = params.test_id as string;
        engine.cancelTest(testId);
        respond({ id, result: { cancelled: true } });
        break;
      }

      case 'capture_screenshot': {
        if (!engine.isReady()) {
          await engine.initPlaywright();
        }
        const { url, viewport } = params as any;
        const screenshotPath = await engine.captureScreenshot(
          url as string,
          viewport as { width: number; height: number; label: string }
        );
        respond({ id, result: screenshotPath });
        break;
      }

      case 'get_status': {
        respond({
          id,
          result: {
            browserReady: engine.isReady(),
            activeTests: engine.activeTestCount(),
          },
        });
        break;
      }

      case 'shutdown': {
        shuttingDown = true;
        await engine.close();
        respond({ id, result: { shuttingDown: true } });
        process.exit(0);
        break;
      }

      default: {
        respond({ id, error: `Unknown method: ${method}` });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    respond({ id, error: message });
  }
}

rl.on('line', async (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || shuttingDown) return;

  try {
    const msg: IpcMessage = JSON.parse(trimmed);
    await handleMessage(msg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    respond({ id: '00000000-0000-0000-0000-000000000000', error: `Parse error: ${message}` });
  }
});

rl.on('close', () => {
  if (!shuttingDown) {
    engine.close().catch(() => {});
    process.exit(0);
  }
});

process.stdout.write('READY\n');
