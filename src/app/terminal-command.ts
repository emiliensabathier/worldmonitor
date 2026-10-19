// Sabathier Terminal command line: function codes (any case, optional <GO>), FR/EN labels as aliases, HELP.
import { TERMINAL_FUNCTIONS, isFunctionCode, type FunctionCode } from '@/config/terminal-functions';

export type Command = { kind: 'open'; code: FunctionCode } | { kind: 'help' } | { kind: 'unknown'; input: string } | { kind: 'empty' };

export function normalizeToken(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/<go>/g, '').replace(/[^a-z0-9?]/g, '');
}

const ALIASES = new Map<string, FunctionCode>();
for (const fn of TERMINAL_FUNCTIONS) {
  for (const word of [fn.code, fn.label.en, fn.label.fr]) ALIASES.set(normalizeToken(word), fn.code);
}
const HELP = new Set(['help', 'aide', '?']);

export function parseCommand(input: string): Command {
  const token = normalizeToken(input);
  if (!token) return { kind: 'empty' };
  if (HELP.has(token)) return { kind: 'help' };
  const upper = token.toUpperCase();
  if (isFunctionCode(upper)) return { kind: 'open', code: upper };
  const alias = ALIASES.get(token);
  return alias ? { kind: 'open', code: alias } : { kind: 'unknown', input: upper };
}
