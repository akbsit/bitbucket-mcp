type LogFields = Readonly<
  Record<string, boolean | number | string | null | undefined>
>;

export interface Logger {
  warn(event: string, fields?: LogFields): void;

  error(event: string, fields?: LogFields): void;
}

function write(
  level: 'error' | 'warn',
  event: string,
  fields: LogFields = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const logger: Logger = Object.freeze({
  warn(event: string, fields?: LogFields) {
    write('warn', event, fields);
  },
  error(event: string, fields?: LogFields) {
    write('error', event, fields);
  },
});
