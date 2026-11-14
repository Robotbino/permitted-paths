// All settings come from the environment, in this one file. No other file reads process.env.

export type Config = {
  host: string;
  port: number;
  dbFile: string;
  /** Level 3. null: the AI is off. The application works the same; it only gives no suggestion from a model. */
  ai: { apiKey: string; model: string; timeoutMs: number; dailyCap: number } | null;
};

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    // 127.0.0.1: only this computer can connect. The application has no sign-in,
    // thus it must not listen on the network. Read the chapter before you change this.
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 8787),
    dbFile: env.DB_FILE ?? 'data/finance.sqlite',
    // The key is a secret of the server. It comes from the environment (the file .env, which git ignores).
    // No key: no AI. The small model is the default, because the task is one word of classification.
    ai: env.ANTHROPIC_API_KEY
      ? { apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL ?? 'claude-haiku-5-5', timeoutMs: Number(env.AI_TIMEOUT_MS ?? 4000), dailyCap: Number(env.AI_DAILY_CAP ?? 50) }
      : null,
  };
}
