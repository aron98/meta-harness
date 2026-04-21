import { readFile } from 'node:fs/promises';

type Output = Pick<typeof console, 'log'>;
type ReadTextFile = typeof readFile;

export function getOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

export function hasOptionValue(args: readonly string[], flag: string): boolean {
  const value = getOption(args, flag);

  return value !== undefined && !value.startsWith('--');
}

export function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

export async function readInputValue(
  args: readonly string[],
  options: {
    readTextFile?: ReadTextFile;
  } = {}
): Promise<string> {
  if (hasOptionValue(args, '--input')) {
    return getOption(args, '--input') as string;
  }

  if (hasOptionValue(args, '--input-file')) {
    const readTextFile = options.readTextFile ?? readFile;

    return readTextFile(getOption(args, '--input-file') as string, 'utf8');
  }

  throw new Error('missing required one of --input or --input-file');
}

export function formatWarning(message: string): string {
  return `warning: ${message}`;
}

export function formatCommandError(command: string, message: string): string {
  return `error: ${command} failed: ${message}`;
}

export function emitOutput(stdout: Output, payload: string): void {
  stdout.log(payload);
}

export function renderJsonOutput(args: readonly string[], payload: unknown, renderHuman: () => string): string {
  return hasFlag(args, '--json') ? JSON.stringify(payload) : renderHuman();
}
