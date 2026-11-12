/* agent-run.js: the data of "Watch one run" (part 2). An invented run, added by this edition.
   It shows observable events only: tool calls, tool results, outputs, checks and decisions.
   It does not show (and no trace can show) the private reasoning of the model.

   graph: drawn by GE.graphView. Positions are set by hand, so the drawing is the same each time.
   steps: the run in sequence. Each step goes along one edge (none for the first) to one node.
   info / edgeInfo: the text of the inspector. */
(function (GE) {
  'use strict';

  GE.data.agentRun = {
    request: 'Employees who start after the 15th of a month get one day too many of leave. Find the cause and correct it.',
    graph: {
      w: 900, h: 880, label: 'An agent run: from a user request, through context, tools and tests, to a person and a final response.',
      nodes: [
        { id: 'U',  x: 450, y: 34,  label: 'User request', shape: 'pill', w: 150 },
        { id: 'IN', x: 450, y: 118, label: 'Interpret the task', sub: 'reasoning', type: 'model' },
        { id: 'RC', x: 165, y: 200, label: 'Search notes and docs', sub: 'retrieval', type: 'code' },
        { id: 'KG', x: 165, y: 292, label: 'Read the\nknowledge graph', sub: 'retrieval', type: 'code' },
        { id: 'PL', x: 450, y: 292, label: 'Make a plan', sub: 'reasoning', type: 'model' },
        { id: 'RT', x: 450, y: 384, label: 'Call a repository tool', sub: 'tool', type: 'code' },
        { id: 'IR', x: 450, y: 476, label: 'Read the tool result', sub: 'reasoning', type: 'model' },
        { id: 'ED', x: 450, y: 568, label: 'Propose a change', sub: 'reasoning', type: 'model' },
        { id: 'TS', x: 450, y: 660, label: 'Run the tests', sub: 'tool', type: 'code' },
        { id: 'EV', x: 450, y: 752, label: 'Tests pass?', sub: 'validation', type: 'code', shape: 'gate', w: 150 },
        { id: 'DG', x: 165, y: 660, label: 'Diagnose the failure', sub: 'reasoning', type: 'model' },
        { id: 'AP', x: 730, y: 752, label: 'Person approves?', sub: 'human', type: 'person', shape: 'gate', w: 170 },
        { id: 'RS', x: 730, y: 846, label: 'Final response', sub: 'output', shape: 'pill', w: 150 }
      ],
      edges: [
        { from: 'U', to: 'IN', label: 'request', lx: 492, ly: 74 },
        { from: 'IN', to: 'RC', label: 'search query', fromSide: 'l', toSide: 't', lx: 300, ly: 106 },
        { from: 'RC', to: 'KG', label: 'linked notes', lx: 222, ly: 244 },
        { from: 'KG', to: 'PL', label: 'context', lx: 330, ly: 282 },
        { from: 'PL', to: 'RT', label: 'tool call', lx: 492, ly: 336 },
        { from: 'RT', to: 'IR', label: 'tool result', fo: -40, to_: -40, lx: 362, ly: 430 },
        { from: 'IR', to: 'RT', label: 'next tool call', kind: 'model', fromSide: 'r', toSide: 'r', via: [[640, 476], [640, 384]], lx: 700, ly: 430 },
        { from: 'IR', to: 'ED', label: 'likely cause', kind: 'model', lx: 500, ly: 520 },
        { from: 'ED', to: 'TS', label: 'patch', lx: 484, ly: 612 },
        { from: 'TS', to: 'EV', label: 'test report', lx: 494, ly: 704 },
        { from: 'EV', to: 'DG', label: 'FAIL: details', fromSide: 'l', toSide: 'b', lx: 290, ly: 742 },
        { from: 'DG', to: 'ED', label: 'retry', fromSide: 't', toSide: 'l', lx: 280, ly: 558 },
        { from: 'EV', to: 'AP', label: 'PASS: approval', lx: 598, ly: 742 },
        { from: 'AP', to: 'RS', label: 'verified output', lx: 790, ly: 800 },
        { from: 'AP', to: 'PL', label: 'changes requested', fromSide: 'r', toSide: 'r', via: [[845, 752], [845, 292]], lx: 830, ly: 470 }
      ]
    },

    /* event: what an observer of the run can record. data: the payload, short. idea: a new idea, shown once. */
    steps: [
      { node: 'U', event: 'Request', data: '“Employees who start after the 15th get one day too many of leave.”',
        text: 'The run starts with a request from a user. A trace records each event of the run from here.',
        idea: 'A trace is the record of a run: which actions occurred, in which sequence, with which inputs and outputs. Read each arrow as “this output goes to that action”.' },
      { edge: 'U>IN', node: 'IN', event: 'Model call', data: 'output: { task: "defect", area: "leave balance", start rule: "after the 15th" }',
        text: 'One model call turns the free text into a structured task. The output is a few fields, not a conversation.' },
      { edge: 'IN>RC', node: 'RC', event: 'Search', data: 'search("leave accrual start date") → 3 notes',
        text: 'Code searches the project documentation and the Obsidian notes. The search finds three notes about leave.',
        idea: 'Retrieval: the agent does not know this project. The context comes from outside the model, from the notes and the documents.' },
      { edge: 'RC>KG', node: 'KG', event: 'Graph query', data: 'Rule LV-2 → implemented by → LeaveCalculator',
        text: 'The knowledge graph links the rule “leave starts in the month after the 15th” to the class that implements it.' },
      { edge: 'KG>PL', node: 'PL', event: 'Model call', data: 'plan: 1 find the code · 2 read it · 3 change it · 4 run the tests',
        text: 'The model gets the task and the context. Its output is a plan of four steps.' },
      { edge: 'PL>RT', node: 'RT', event: 'Tool call', data: 'search_code("accrualStart")',
        text: 'The agent calls a tool. The tool is code: it searches the repository and gives a result.',
        idea: 'A tool call is a request from the model to code. The model does not search the files. It asks a tool to search, and it waits for the result.' },
      { edge: 'RT>IR', node: 'IR', event: 'Tool result', data: '2 matches: LeaveCalculator.java:48, LeaveCalculatorTest.java:12',
        text: 'The result goes back to the model. The model reads it, and selects what to do next.' },
      { edge: 'IR>RT', node: 'RT', event: 'Tool call', data: 'read_file("LeaveCalculator.java", lines 40–60)',
        text: 'The model selects a second tool call: read the file. This arrow is dashed, because the model selected it.',
        idea: 'A dashed arrow is a choice of the model. A continuous arrow is fixed by the system. The model can select “read one more file” many times; a limit stops it.' },
      { edge: 'RT>IR', node: 'IR', event: 'Tool result', data: 'line 48: if (startDay > 15) month = month + 1;',
        text: 'The file shows the condition. The model reads the result again.' },
      { edge: 'IR>ED', node: 'ED', event: 'Model output', data: 'likely cause: “> 15” must be “>= 15” per rule LV-2',
        text: 'The model gives a likely cause. It is a hypothesis. The tests will check it.' },
      { edge: 'ED>TS', node: 'TS', event: 'Tool call', data: 'apply patch · run_tests("leave")',
        text: 'Code applies the patch and runs the tests. The model does not decide if the tests pass.' },
      { edge: 'TS>EV', node: 'EV', event: 'Check', data: 'FAIL: 41 of 42 · startOnThe15th_getsLeaveThisMonth', status: 'fail',
        text: 'One test fails. The gate reads the test report. The gate is code, so the same report always gives the same path.',
        idea: 'A decision makes a branch. The gate has two exits. Only one is used in each pass; the other stays dim.' },
      { edge: 'EV>DG', node: 'DG', event: 'Model call', data: 'input: failing test · output: “the rule says after the 15th: > 15 was correct”',
        text: 'The failure details go to a diagnosis step. The output: the original condition was correct; the defect is in a different place.' },
      { edge: 'DG>ED', node: 'ED', event: 'Model output', data: 'attempt 2 of 3: keep “> 15”; getMonth() counts from 0, so add 1 on line 52',
        text: 'The run goes back to the change step with the diagnosis. This is a retry. A counter limits the attempts.',
        idea: 'A feedback loop: the result of a check goes back to an earlier action. The loop has a maximum, so it cannot continue with no end.' },
      { edge: 'ED>TS', node: 'TS', event: 'Tool call', data: 'apply patch · run_tests("leave")',
        text: 'Code runs the same tests on the new patch.' },
      { edge: 'TS>EV', node: 'EV', event: 'Check', data: 'PASS: 42 of 42', status: 'pass',
        text: 'All tests pass. Now the gate uses its other exit.' },
      { edge: 'EV>AP', node: 'AP', event: 'Approval', data: 'diff (2 lines) + test report → reviewer: approved',
        text: 'A person reads the change and the test report, and gives approval.',
        idea: 'Human approval belongs before a change has an effect outside the run, here before the merge. If the person asks for changes, the run goes back to the plan.' },
      { edge: 'AP>RS', node: 'RS', event: 'Response', data: '“Fixed: month index in LeaveCalculator:52. Tests: 42 of 42. Approved.”',
        text: 'The run gives the result to the user, with the evidence: what changed, the tests, and the approval. The run is complete.' }
    ],

    info: {
      U:  { purpose: 'Starts the run.', receives: 'Text from a user.', produces: 'The request.', by: 'The user.', why: 'Each trace starts with the input. Without it, you cannot judge the output.' },
      IN: { purpose: 'Turn free text into a structured task.', receives: 'The request.', produces: 'Task fields: type, area, rule.', by: 'One model call, no tools.', why: 'Later steps read fields, not free text. An error here goes to each later step.' },
      RC: { purpose: 'Find the project knowledge that the model does not have.', receives: 'A search query.', produces: 'Matching notes and documents.', by: 'Code: a search over the documentation and the Obsidian vault.', why: 'Without context, the model guesses the rules of this project.' },
      KG: { purpose: 'Follow the links from a rule to the code that implements it.', receives: 'The notes found.', produces: 'Related rules, classes and tests.', by: 'Code: a query of the knowledge graph.', why: 'A link is more exact than a similar text. It gives the class to read.' },
      PL: { purpose: 'Decide the steps of the work.', receives: 'The task and the context.', produces: 'A short plan.', by: 'One model call.', why: 'The plan makes the later tool calls easier to check.' },
      RT: { purpose: 'Act on the repository: search or read files.', receives: 'A tool call with arguments.', produces: 'A tool result.', by: 'Code: the repository tool.', why: 'The model only produces text. A tool does the action, and its result is a fact the trace can record.' },
      IR: { purpose: 'Read a tool result and select the next action.', receives: 'The tool result.', produces: 'One more tool call, or a likely cause.', by: 'One model call.', why: 'This is where the agent loop is: call, result, decide. A limit on the number of calls stops it.' },
      ED: { purpose: 'Write a change for the likely cause.', receives: 'The likely cause, or a diagnosis after a failure.', produces: 'A patch.', by: 'One model call.', why: 'The patch is a hypothesis. It is not correct until the tests pass.' },
      TS: { purpose: 'Apply the patch and run the tests.', receives: 'A patch.', produces: 'A test report.', by: 'Code: the test runner.', why: 'An independent check. The model does not mark its own work.' },
      EV: { purpose: 'Select the path from the test report.', receives: 'The test report.', produces: 'PASS or FAIL.', by: 'Code: a gate.', why: 'A fixed rule decides. The same report always gives the same path.' },
      DG: { purpose: 'Explain a failure, so that the next attempt is different.', receives: 'The failing test and its message.', produces: 'A diagnosis.', by: 'One model call.', why: 'A retry with no new information often repeats the same error.' },
      AP: { purpose: 'A person accepts or rejects the change.', receives: 'The diff and the test report.', produces: 'Approved, or changes requested.', by: 'A person.', why: 'Tests show that the code obeys the tests. A person judges if that is the right change.' },
      RS: { purpose: 'Give the result to the user.', receives: 'The approved change.', produces: 'A response with evidence.', by: 'Code: a fixed template.', why: 'A response with evidence lets the user check the claim.' }
    },
    edgeInfo: {
      'U>IN': 'The text of the request.',
      'IN>RC': 'A search query made from the task fields.',
      'RC>KG': 'The notes that the search found. The graph query starts from them.',
      'KG>PL': 'The context: the rule, the class and the tests that the graph links to the task.',
      'PL>RT': 'A tool call: the name of the tool and its arguments.',
      'RT>IR': 'The tool result: matches, or the lines of a file.',
      'IR>RT': 'A model choice: one more tool call. Dashed, because the model selects it.',
      'IR>ED': 'A model choice: “I have a likely cause”. Dashed, because the model selects it.',
      'ED>TS': 'The patch.',
      'TS>EV': 'The test report: the number of tests, and which failed.',
      'EV>DG': 'Control: the FAIL exit of the gate, with the details of the failure.',
      'DG>ED': 'Control and data: go back, with the diagnosis. A counter of attempts goes too.',
      'EV>AP': 'Control: the PASS exit. The change waits for a person.',
      'AP>RS': 'The approved change and its evidence.',
      'AP>PL': 'Control: the person requests changes. Not used in this run.'
    }
  };
})(window.GE);
