import { describe, expect, it } from 'vitest';
import { parseCommand } from '@/app/terminal-command';

describe('parseCommand', () => {
  it('opens codes whatever the case, with or without <GO>, spaces ignored', () => {
    expect(parseCommand('WEI')).toEqual({ kind: 'open', code: 'WEI' });
    expect(parseCommand(' govt <go> ')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('c m d t y')).toEqual({ kind: 'open', code: 'CMDTY' });
    expect(parseCommand('n<GO>')).toEqual({ kind: 'open', code: 'N' });
  });
  it('accepts the French and English labels as aliases, accents and punctuation dropped', () => {
    expect(parseCommand('taux')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('Rates')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('actualité')).toEqual({ kind: 'open', code: 'N' });
    expect(parseCommand('news')).toEqual({ kind: 'open', code: 'N' });
    expect(parseCommand("vue d'ensemble")).toEqual({ kind: 'open', code: 'TOP' });
    expect(parseCommand('matières premières')).toEqual({ kind: 'open', code: 'CMDTY' });
  });
  it('help words and unknown input', () => {
    for (const h of ['HELP', 'aide', '?', 'help <GO>']) expect(parseCommand(h)).toEqual({ kind: 'help' });
    expect(parseCommand('xyz')).toEqual({ kind: 'unknown', input: 'XYZ' });
    expect(parseCommand('   ')).toEqual({ kind: 'empty' });
    expect(parseCommand('<GO>')).toEqual({ kind: 'empty' });
  });
});
