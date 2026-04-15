/**
 * Output helpers — stdout is always JSON, stderr is human-readable errors.
 */

export function outputJson(data: unknown, pretty = false): void {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(json + "\n");
}

export function outputError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
