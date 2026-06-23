import { terminalCommands } from '../data/terminalCommands';
import type { TerminalCommandDefinition } from '../types/game';

export interface ParsedTerminalCommand {
  normalized: string;
  command?: TerminalCommandDefinition;
}

export function normalizeTerminalInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseTerminalCommand(input: string): ParsedTerminalCommand {
  const normalized = normalizeTerminalInput(input);
  const compact = normalized.replace(/\s+/g, '').replace(/\./g, '');
  const command = terminalCommands.find((entry) => {
    if (entry.command === normalized) return true;
    if (entry.aliases.some((alias) => alias.replace(/\s+/g, '').replace(/\./g, '') === compact)) return true;
    return isSubsequence(entry.command.replace(/\./g, ''), compact) || matchesNoisyCommand(entry.command, compact);
  });

  return { normalized, command };
}

function matchesNoisyCommand(command: string, compactInput: string): boolean {
  let cursor = 0;
  return command.split('.').every((part) => {
    const exactIndex = findSubsequenceIndex(part, compactInput, cursor);
    if (exactIndex >= 0) {
      cursor = exactIndex;
      return true;
    }
    const forgivingPart = part.length > 3 ? part.slice(0, -1) : part;
    const forgivingIndex = findSubsequenceIndex(forgivingPart, compactInput, cursor);
    if (forgivingIndex >= 0) {
      cursor = forgivingIndex;
      return true;
    }
    return false;
  });
}

function findSubsequenceIndex(needle: string, haystack: string, startAt: number): number {
  let index = 0;
  for (let cursor = startAt; cursor < haystack.length; cursor += 1) {
    if (haystack[cursor] === needle[index]) {
      index += 1;
      if (index === needle.length) return cursor + 1;
    }
  }
  return -1;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) {
      index += 1;
      if (index === needle.length) return true;
    }
  }
  return false;
}

export function tokensForCommand(commandText: string): string[] {
  return commandText.split('.').filter(Boolean);
}
