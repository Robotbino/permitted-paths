// All settings come from the environment, in this one file. No other file reads process.env.

export type Config = {
  host: string;
  port: number;
  dbFile: string;
};

export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    // 127.0.0.1: only this computer can connect. The application has no sign-in,
    // thus it must not listen on the network. Read the chapter before you change this.
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 8787),
    dbFile: env.DB_FILE ?? 'data/finance.sqlite',
  };
}
