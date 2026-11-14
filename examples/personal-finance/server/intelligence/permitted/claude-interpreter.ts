// The real model that reads a request: one call to the Claude API through the official SDK.
// It runs only on the server. The key comes in through the settings; this file does not read the environment.
//
// The harness around the call, in this file:
//   - a structured output: one flat object (flat-answer.ts); the action gate does all the real checks
//   - a short time limit and no automatic second try
//   - a small limit of output tokens
//   - a request that is too long is not cut and not sent: the person hears that it was not read
//   - only an answer that ended in the normal way is used
//   - each failure becomes a value; this function does not throw
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { shortText } from './audit.ts';
import { DATE_FORMATS } from './capabilities.ts';
import { FlatAnswer, toInterpreterOutput } from './flat-answer.ts';
import type { IntentInterpreter, InterpreterInput, InterpreterOutput } from './interpreter.ts';

export { FlatAnswer, toInterpreterOutput } from './flat-answer.ts';

const PROMPT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'prompts', 'interpret-intent.md');

export type ClaudeInterpreterSettings = { apiKey: string; model: string; timeoutMs: number };

/** The small part of the SDK client that this file uses. A test gives a stand-in with the same shape. */
export type MessagesClient = { messages: { parse: Anthropic['messages']['parse'] } };

/** The longest text of the person that goes to the model. It is cost control. A longer text is not sent. */
export const MAX_TEXT = 500;
/** The longest category name and id that go into the system prompt. */
export const MAX_CATEGORY_TEXT = 60;

const TOO_LONG = 'Your request has more than ' + MAX_TEXT + ' characters, thus the application did not read it. Write it in a shorter way.';

/** One line of the system prompt from text that the application did not write: no line end, no control character, a fixed largest size. */
const oneLine = (value: unknown, max: number): string => shortText(typeof value === 'string' ? value : '', max).trim();

/**
 * The system prompt: the text of the prompt file with the capabilities, the date formats and the
 * categories in it. A category name is text of the person: it stays on its own line, and it is put
 * in as plain text ("$&" in a name has no special meaning, and "{{...}}" in a name is not read again).
 */
export function buildInterpreterPrompt(template: string, input: Pick<InterpreterInput, 'capabilities' | 'categories'>): string {
  const parts: Record<string, string> = {
    capabilities: input.capabilities.map((c) => '- ' + oneLine(c.name, 40) + ': ' + oneLine(c.purpose, 200)).join('\n'),
    categories: input.categories.map((c) => '- ' + oneLine(c.id, 40) + ' (' + oneLine(c.name, MAX_CATEGORY_TEXT) + ')').join('\n'),
    date_formats: DATE_FORMATS.join(', '),
  };
  return template.replace(/\r\n/g, '\n').replace(/\{\{(capabilities|categories|date_formats)\}\}/g, (_all, key: string) => parts[key] ?? '');
}

/** Each error class becomes a value. The most specific class first. The detail goes to the trace; it never contains the key. */
function errorValue(error: unknown, timeoutMs: number): InterpreterOutput {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { status: 'TIMEOUT', detail: 'No answer in ' + timeoutMs + ' ms.' };
  if (error instanceof Anthropic.APIUserAbortError) return { status: 'ERROR', detail: 'The call was stopped before an answer.' };
  if (error instanceof Anthropic.APIConnectionError) return { status: 'ERROR', detail: 'The application could not connect to the API.' };
  if (error instanceof Anthropic.AuthenticationError) return { status: 'ERROR', detail: 'The API key is not accepted.' };
  if (error instanceof Anthropic.RateLimitError) return { status: 'ERROR', detail: 'The rate limit or the spend limit of the workspace is reached.' };
  if (error instanceof Anthropic.APIError && typeof error.status === 'number') return { status: 'ERROR', detail: 'The API gave the status ' + error.status + '.' };
  return { status: 'ERROR', detail: 'The call failed before an answer.' };
}

export function claudeInterpreter(settings: ClaudeInterpreterSettings, client: MessagesClient = new Anthropic({ apiKey: settings.apiKey })): IntentInterpreter {
  const template = readFileSync(PROMPT_FILE, 'utf8');
  return {
    model: settings.model,
    async interpret(input): Promise<InterpreterOutput> {
      try {
        if (typeof input.text !== 'string') return { status: 'ERROR', detail: 'The request had no text.' };
        // A cut text can lose its most important words ("... do NOT lower it"). No call, and the person hears why.
        if (input.text.length > MAX_TEXT) return { status: 'DECLINE', reason: TOO_LONG };
        const message = await client.messages.parse(
          {
            model: settings.model,
            // Thinking tokens count in max_tokens, thus the limit is not as small as the answer.
            max_tokens: 1024,
            system: buildInterpreterPrompt(template, input),
            // Only the text of the person goes into the user message. No amount, no ledger, no history.
            messages: [{ role: 'user', content: 'Request of the person: ' + input.text }],
            output_config: { effort: 'low', format: zodOutputFormat(FlatAnswer) },
          },
          { timeout: settings.timeoutMs, maxRetries: 0 },
        );
        const stop = shortText(String(message.stop_reason), 40);
        if (message.stop_reason === 'refusal') return { status: 'REFUSED', detail: 'The model declined the request.' };
        if (!message.parsed_output) return { status: 'ERROR', detail: 'The answer was not the structure that was asked for (stop reason: ' + stop + ').' };
        // An answer that was cut (max_tokens) can have the correct structure and the wrong content.
        if (message.stop_reason !== 'end_turn') return { status: 'ERROR', detail: 'The answer did not end in the normal way (stop reason: ' + stop + ').' };
        return toInterpreterOutput(message.parsed_output);
      } catch (error) {
        return errorValue(error, settings.timeoutMs);
      }
    },
  };
}
