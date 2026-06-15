import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface EvidenceFile {
  path: string;
  kind: string;
  size_bytes: number;
}

export class Reporter {
  private testDir: string;

  constructor(
    private testId: string,
    private baseDir: string
  ) {
    this.testDir = join(baseDir, testId);
    mkdirSync(this.testDir, { recursive: true });
  }

  async captureScreenshot(label: string): Promise<EvidenceFile> {
    return {
      path: join(this.testDir, `${label}.png`),
      kind: 'screenshot',
      size_bytes: 0,
    };
  }

  recordScreenshot(path: string): EvidenceFile {
    const size = this.fileSize(path);
    return {
      path,
      kind: 'screenshot',
      size_bytes: size,
    };
  }

  async captureTrace(testId: string): Promise<EvidenceFile> {
    return {
      path: join(this.testDir, `trace_${testId}.zip`),
      kind: 'trace',
      size_bytes: 0,
    };
  }

  async captureVideo(testId: string): Promise<EvidenceFile> {
    return {
      path: join(this.testDir, `video_${testId}.webm`),
      kind: 'video',
      size_bytes: 0,
    };
  }

  saveConsoleLog(log: string): EvidenceFile {
    const path = join(this.testDir, 'console_log.txt');
    writeFileSync(path, log, 'utf-8');
    return {
      path,
      kind: 'console_log',
      size_bytes: Buffer.byteLength(log, 'utf-8'),
    };
  }

  saveDomSnapshot(html: string, step: number): EvidenceFile {
    const path = join(this.testDir, `dom_step${step}.html`);
    writeFileSync(path, html, 'utf-8');
    return {
      path,
      kind: 'dom_snapshot',
      size_bytes: Buffer.byteLength(html, 'utf-8'),
    };
  }

  async finalize(): Promise<EvidenceFile[]> {
    const files: EvidenceFile[] = [];
    try {
      const entries = readFileSync(this.testDir, { encoding: 'utf-8' }) as any;
    } catch {
    }
    return files;
  }

  private fileSize(path: string): number {
    try {
      return statSync(path).size;
    } catch {
      return 0;
    }
  }
}
