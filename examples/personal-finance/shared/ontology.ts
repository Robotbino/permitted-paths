// The ontology of the application, as data: the classes, the relations, the permitted values
// and the rules. It has the same form as the ontology of the game store in the course.
// Level 1 already obeyed these rules, in code. Level 2 writes them in one location, with a number,
// thus a gate, a test, a trace and a person can all point to the same rule.

export const CLASSES = {
  Expense: { implemented: true, text: 'Money that went out, on one date, to one merchant, in one category.' },
  Category: { implemented: true, text: 'A group of expenses. Active or not active.' },
  Budget: { implemented: true, text: 'The limit of one category for one month.' },
  Merchant: { implemented: true, text: 'The receiver of an expense. At level 1 and 2 it is text on the expense. Level 3 gives it a memory.' },
  Person: { implemented: false, text: 'The owner of the data. The application has one person, thus it has no table for persons.' },
  Account: { implemented: false, text: 'Where the money is. Not necessary for the slice.' },
  Income: { implemented: false, text: 'Money that came in. Not in the slice.' },
  RecurringExpense: { implemented: false, text: 'A rule that makes an expense each month. Not in the slice.' },
  SavingsGoal: { implemented: false, text: 'A target amount and a date. Not in the slice.' },
} as const;

/** subject, relation, object. A relation connects two classes of the ontology; it is not an edge of the execution graph. */
export const RELATIONS = [
  ['Expense', 'is in', 'Category'],
  ['Expense', 'is paid to', 'Merchant'],
  ['Merchant', 'is usually in', 'Category'], // level 3: the merchant memory
  ['Budget', 'limits', 'Category'],
  ['Budget', 'covers', 'Month'],
  ['Person', 'owns', 'Account'],
  ['Expense', 'is paid from', 'Account'],
  ['RecurringExpense', 'makes', 'Expense'],
  ['SavingsGoal', 'is funded from', 'Account'],
] as const;

export const VALUES = {
  currency: ['ZAR'],
  category_kind: ['EXPENSE'],
  budget_state: ['NO_BUDGET', 'WITHIN', 'NEAR', 'OVER'],
  run_result: ['PASS', 'FAIL', 'ESCALATED'],
} as const;

export type RuleKind = 'shape' | 'value' | 'enumeration' | 'typed relation' | 'cardinality' | 'derived value';
export type RuleCheck = 'gate1' | 'gate2' | 'dedupe' | 'schema' | 'verifier' | 'function' | 'suggestion gate' | 'structure';

/** The rules. `checked_by` is the part of the application that enforces the rule. */
export const RULES: Record<string, { text: string; kind: RuleKind; checked_by: RuleCheck[] }> = {
  R1: { text: 'The amount is an integer number of cents, more than 0 and not more than 100 000 000.', kind: 'value', checked_by: ['gate1', 'schema'] },
  R2: { text: 'The currency is ZAR.', kind: 'enumeration', checked_by: ['gate1', 'schema'] },
  R3: { text: 'The date is a real calendar date in the form YYYY-MM-DD.', kind: 'shape', checked_by: ['gate1'] },
  R4: { text: 'The merchant name has 1 to 80 characters, and the request has no field that the contract does not name.', kind: 'shape', checked_by: ['gate1'] },
  R5: { text: 'The date of an expense is not after today.', kind: 'value', checked_by: ['gate2'] },
  R6: { text: 'The category of an expense is one active category of the store.', kind: 'typed relation', checked_by: ['gate2', 'schema'] },
  R7: { text: 'A second expense with the same date, amount and merchant needs a confirmation of the person.', kind: 'cardinality', checked_by: ['gate2'] },
  R8: { text: 'One request key records one expense at most.', kind: 'cardinality', checked_by: ['dedupe', 'schema', 'verifier'] },
  R9: { text: 'A category has one budget at most for a month, and the limit is more than 0.', kind: 'cardinality', checked_by: ['schema'] },
  R10: { text: 'The spent amount of a budget is the sum of its expenses in its month. No table stores it.', kind: 'derived value', checked_by: ['verifier'] },
  R11: { text: 'Over budget is a state of the budget. It is not a FAIL: the expense is recorded.', kind: 'enumeration', checked_by: ['function'] },
  // Level 3.
  R12: { text: 'A suggestion names one active category of the store, or it says UNKNOWN.', kind: 'enumeration', checked_by: ['suggestion gate'] },
  R13: { text: 'Only an expense that the person records changes the ledger and the merchant memory. A suggestion changes nothing.', kind: 'cardinality', checked_by: ['structure'] },
};

export const isRule = (id: string): boolean => id in RULES;
