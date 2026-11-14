// The scenarios of the assist path and of the plan (level 3). No graph runs here: the recording
// keeps the HTTP exchanges. The world has the ledger of the worked example, and the model is a stand-in.
// Each assist scenario shows one end of the permitted path: the model recommends, the application
// validates, the person approves, the application executes.
import type { Scenario } from './scenarios.ts';
import { PLAN_TODAY, type WorldOptions } from './world.ts';

type Behaviour = NonNullable<WorldOptions['interpreter']>;
const world = (interpreter: Behaviour): WorldOptions => ({ today: PLAN_TODAY, ledger: 'worked_example', interpreter });

/** The expense rows of the worked example ledger. No scenario of this file adds a row. */
export const LEDGER_ROWS = 13;

const assist = (id: string, title: string, interpreter: Behaviour, text: string, answer: string): Scenario => ({
  id, level: 3, title, world: world(interpreter), endpoint: '/api/assist', before: [], request: { text }, expect: { status: 200, path: [], rows: LEDGER_ROWS, answer },
});
const decided = (id: string, title: string, approve: boolean, answer: string): Scenario => ({
  ...assist(id, title, 'answer', 'Raise my weekly allowance', answer),
  follow: (first) => ({ path: '/api/assist/' + first.proposal_id + '/decide', body: { approve } }),
  expect: { status: 200, path: [], rows: LEDGER_ROWS, answer, first: { status: 200, path: [], answer: 'NEEDS_APPROVAL' } },
});

export const ASSIST_SCENARIOS: Scenario[] = [
  assist('assist_clarify', 'A text that can mean more than one thing: the application asks, it does not guess', 'answer', 'I want more control over my money', 'CLARIFY'),
  assist('assist_analyse', 'A question about spending: the application reads its ledger and answers at once', 'answer', 'Where did my money go?', 'DONE'),
  decided('assist_allowance_approved', 'A higher weekly allowance: the consequences in cents, then the person approves', true, 'EXECUTED'),
  decided('assist_allowance_declined', 'A higher weekly allowance: the consequences in cents, then the person says no', false, 'DECLINED_BY_PERSON'),
  assist('assist_outside_allowlist', 'The model asks for "move_money_to_savings": the allowlist has no such capability', 'outside', 'Put R500 in my savings pocket', 'REJECTED'),
  assist('assist_invalid_answer', 'The model names a permitted capability, but the input has the wrong shape', 'invalid', 'Raise my weekly allowance', 'REJECTED'),
  assist('assist_model_down', 'The model does not answer in the permitted time', 'timeout', 'Where did my money go?', 'MODEL_UNAVAILABLE'),
  assist('assist_ai_off', 'The AI is off: the server has no API key', 'off', 'Where did my money go?', 'AI_OFF'),
  assist('assist_declined_request', 'The person asks the application to move money: it does not do that', 'answer', 'Move R500 to my savings account', 'DECLINED'),
  // The plan of the pay cycle. Each figure is calculated from the stored rows at the time of the request.
  { id: 'plan_worked_example', level: 3, title: 'The plan of the pay cycle 2026-01-25 to 2026-02-24, for Sam who is paid on day 25', world: { today: PLAN_TODAY, ledger: 'worked_example' },
    method: 'GET', endpoint: '/api/plan', before: [], request: null, expect: { status: 200, path: [], rows: LEDGER_ROWS } },
];
