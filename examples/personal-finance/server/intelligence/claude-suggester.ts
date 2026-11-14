// The real model: one call to the Claude API through the official SDK.
// This is the only file of the application that imports the SDK, and it runs only on the server.
// The key comes from server/config.ts (the environment). It is never in the web application.
//
// The harness around the call, in this file:
//   - a structured output: the answer must be one of the permitted ids, or UNKNOWN
//   - a short time limit and no automatic second try (a late suggestion has no value)
//   - a small limit of output tokens
//   - each failure becomes a value; this function does not throw
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { UNKNOWN, type CategorySuggester, type SuggesterInput, type SuggesterOutput } from './suggester.ts';

const PROMPT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'prompts', 'suggest-category.md');

export type ClaudeSettings = { apiKey: string; model: string; timeoutMs: number };

/** The small part of the SDK client that this file uses. A test gives a stand-in with the same shape. */
export type MessagesClient = { messages: { parse: Anthropic['messages']['parse'] } };

/** The system prompt: the text of the prompt file with the list of categories in it. */
export function buildSystemPrompt(template: string, categories: SuggesterInput['categories']): string {
  return template.replace(/\r\n/g, '\n').replace('{{categories}}', categories.map((c) => '- ' + c.id + ' (' + c.name + ')').join('\n'));
}

export function claudeSuggester(settings: ClaudeSettings, client: MessagesClient = new Anthropic({ apiKey: settings.apiKey })): CategorySuggester {
  const template = readFileSync(PROMPT_FILE, 'utf8');
  return {
    model: settings.model,
    async suggest(input): Promise<SuggesterOutput> {
      // The schema is made for this request: an enumeration of the ids that are permitted now.
      const Answer = z.object({ category_id: z.enum([UNKNOWN, ...input.categories.map((c) => c.id)]) });
      try {
        const message = await client.messages.parse(
          {
            model: settings.model,
            // Thinking tokens count in max_tokens, thus the limit is not as small as the answer.
            max_tokens: 1024,
            system: buildSystemPrompt(template, input.categories),
            // Only the merchant text goes to the model. No amount, no date, no history.
            messages: [{ role: 'user', content: 'Merchant: ' + input.merchant_name }],
            output_config: { effort: 'low', format: zodOutputFormat(Answer) },
          },
          { timeout: settings.timeoutMs, maxRetries: 0 },
        );
        if (message.stop_reason === 'refusal') return { status: 'REFUSED', detail: 'The model declined the request.' };
        if (!message.parsed_output) return { status: 'ERROR', detail: 'The answer was not the structure that was asked for (stop reason: ' + message.stop_reason + ').' };
        return { status: 'OK', category_id: message.parsed_output.category_id, input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens };
      } catch (error) {
        // The most specific class first. The detail goes to the trace; it never contains the key.
        if (error instanceof Anthropic.APIConnectionTimeoutError) return { status: 'TIMEOUT', detail: 'No answer in ' + settings.timeoutMs + ' ms.' };
        if (error instanceof Anthropic.AuthenticationError) return { status: 'ERROR', detail: 'The API key is not accepted.' };
        if (error instanceof Anthropic.RateLimitError) return { status: 'ERROR', detail: 'The rate limit or the spend limit of the workspace is reached.' };
        if (error instanceof Anthropic.APIError) return { status: 'ERROR', detail: 'The API gave the status ' + error.status + '.' };
        return { status: 'ERROR', detail: 'The call failed before an answer.' };
      }
    },
  };
}
