import type { Outcome, ParseOptions, TextDocument, TextFormat } from '../model.js';
import { failure } from '../diagnostics.js';
import { parseMiniMessage } from './minimessage.js';
export function parseText(input: string, format: TextFormat, options: ParseOptions = {}): Outcome<TextDocument> {
  if(typeof input !== 'string') return failure('invalid-text','','Expected a string');
  if(format === 'minimessage') return parseMiniMessage(input,options);
  return failure('unsupported-format','','Unsupported text format');
}
