// The port of the model that reads a request of the person in plain words.
// The application knows an "intent interpreter"; it does not know Claude.
// Two implementations: claude-interpreter.ts (the real model) and fake-interpreter.ts (tests, recordings).
// The port gives the model very little: the text, the names of the permitted capabilities and the
// categories. It gives no amounts, no ledger, no history, and no way to write.

export type InterpreterInput = {
  text: string;
  capabilities: Array<{ name: string; purpose: string }>;
  categories: Array<{ id: string; name: string }>;
};

/**
 * What the model said.
 * ACTION: a request for the action gate. It is still not trusted.
 * CLARIFY: the text can mean more than one thing. The application asks; it does not guess.
 * DECLINE: the text asks for something that this application does not do.
 */
export type InterpreterOutput =
  | { status: 'ACTION'; request: unknown }
  | { status: 'CLARIFY'; question: string; options: string[] }
  | { status: 'DECLINE'; reason: string }
  | { status: 'TIMEOUT' | 'ERROR' | 'REFUSED'; detail: string };

export interface IntentInterpreter {
  /** The name of the model, for the trace. */
  readonly model: string;
  /** Must not throw. Each failure of the model is a value. */
  interpret(input: InterpreterInput): Promise<InterpreterOutput>;
}
