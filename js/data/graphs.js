/* graphs.js: the drawings, as data for graph-view.js. Each drawing is a new version of a
   diagram in the notes. x, y is the centre of a node; the positions are set by hand.
   `steps` (optional) is the reading sequence that the stepper shows. */
(function (GE) {
  'use strict';
  var G = GE.data.graphs = {};

  /* GE 00, "The full system". Also the capstone of chapter 8. */
  G.system = {
    w: 780, h: 400, label: 'The full system: an execution graph below, the intelligence plane above.',
    groups: [
      { x: 20, y: 20, w: 740, h: 140, label: 'Intelligence plane: what the system knows' },
      { x: 20, y: 225, w: 740, h: 150, label: 'Execution graph: the path of the work' }
    ],
    nodes: [
      { id: 'MEM', x: 150, y: 105, label: 'Memory and traces\nwhat occurred before' },
      { id: 'KG', x: 400, y: 105, label: 'Knowledge graph\nfacts that obey the ontology' },
      { id: 'ONT', x: 650, y: 105, label: 'Ontology\ntypes, relations, rules' },
      { id: 'A', x: 85, y: 300, label: 'Fixed step\ncode', type: 'code' },
      { id: 'B', x: 235, y: 300, label: 'Model step\none model call', type: 'model' },
      { id: 'C', x: 400, y: 300, label: 'Agent step\nloop with tools', type: 'agent' },
      { id: 'D', x: 562, y: 300, label: 'Gate\na check', type: 'code', shape: 'gate' },
      { id: 'E', x: 706, y: 300, label: 'Result', shape: 'pill', w: 80 }
    ],
    edges: [
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' },
      { from: 'D', to: 'E', label: 'PASS' },
      { from: 'D', to: 'C', label: 'FAIL', fromSide: 'b', toSide: 'b', via: [[562, 354], [400, 354]] },
      { from: 'ONT', to: 'KG' },
      { from: 'KG', to: 'C', label: 'facts', lx: 428, ly: 200 },
      { from: 'ONT', to: 'D', label: 'rules for the gate', fromSide: 'b', toSide: 't', via: [[650, 196], [562, 196]], lx: 606, ly: 186 },
      { from: 'C', to: 'MEM', label: 'trace', fromSide: 't', toSide: 'b', fo: -45, via: [[355, 190], [150, 190]] },
      { from: 'MEM', to: 'ONT', label: 'lessons', fromSide: 't', toSide: 't', via: [[150, 52], [650, 52]], lx: 520, ly: 43 }
    ],
    steps: [
      { text: 'The execution graph sets the path of the work. This is control 1.', nodes: ['A', 'B', 'C', 'D', 'E'], edges: ['A>B', 'B>C', 'C>D', 'D>E', 'D>C'] },
      { text: 'The agent step gets its facts from the knowledge graph.', nodes: ['KG', 'C'], edges: ['KG>C'] },
      { text: 'The ontology gives the permitted results. This is control 2.', nodes: ['ONT', 'KG'], edges: ['ONT>KG'] },
      { text: 'The gate uses the rules of the ontology to accept or reject a result. This is control 3.', nodes: ['ONT', 'D', 'E', 'C'], edges: ['ONT>D', 'D>E', 'D>C'] },
      { text: 'Each run writes a trace. The traces make the ontology and the knowledge graph better.', nodes: ['C', 'MEM', 'ONT', 'KG'], edges: ['C>MEM', 'MEM>ONT', 'ONT>KG'] }
    ]
  };

  /* GE 02, section 3: an example graph. */
  G.example = {
    w: 870, h: 660, label: 'An example execution graph for a change request.',
    nodes: [
      { id: 'S', x: 430, y: 28, label: 'Start', shape: 'pill', w: 84 },
      { id: 'CL', x: 430, y: 92, label: 'Classify the request', type: 'model' },
      { id: 'RT', x: 430, y: 160, label: 'Which type?', type: 'code', shape: 'gate' },
      { id: 'LK', x: 120, y: 240, label: 'Get the answer', type: 'code' },
      { id: 'PL', x: 430, y: 240, label: 'Make a plan', type: 'agent' },
      { id: 'AP', x: 430, y: 320, label: 'A person\ngives approval?', type: 'person', shape: 'gate' },
      { id: 'WR', x: 430, y: 402, label: 'Write the change', type: 'agent' },
      { id: 'VF', x: 430, y: 482, label: 'Verifier\nare the tests satisfactory?', type: 'code', shape: 'gate' },
      { id: 'HM', x: 730, y: 562, label: 'Escalate to a person', type: 'person' },
      { id: 'SM', x: 430, y: 562, label: 'Write the summary', type: 'model' },
      { id: 'E', x: 430, y: 630, label: 'End', shape: 'pill', w: 84 }
    ],
    edges: [
      { from: 'S', to: 'CL' }, { from: 'CL', to: 'RT' },
      { from: 'RT', to: 'LK', label: 'question', fromSide: 'l', toSide: 't' },
      { from: 'RT', to: 'PL', label: 'change', lx: 462, ly: 200 },
      { from: 'PL', to: 'AP' },
      { from: 'AP', to: 'E', label: 'no', fromSide: 'r', toSide: 'r', via: [[845, 320], [845, 630]], lx: 700, ly: 311 },
      { from: 'AP', to: 'WR', label: 'yes', lx: 452, ly: 363 },
      { from: 'WR', to: 'VF' },
      { from: 'VF', to: 'WR', label: 'no, try again', fromSide: 'l', toSide: 'l', via: [[248, 482], [248, 402]], lx: 196, ly: 444 },
      { from: 'VF', to: 'HM', label: 'no, maximum reached', fromSide: 'r', toSide: 't' },
      { from: 'VF', to: 'SM', label: 'yes', lx: 452, ly: 526 },
      { from: 'LK', to: 'SM', fromSide: 'b', toSide: 'l' },
      { from: 'SM', to: 'E' },
      { from: 'HM', to: 'E', fromSide: 'b', toSide: 'r' }
    ]
  };

  /* GE 08, section 4: a decision in one diagram. */
  G.decision = {
    w: 780, h: 500, label: 'A decision diagram: script, loop, harness, or graph.',
    nodes: [
      { id: 'Q0', x: 220, y: 40, label: 'Are all the steps code?', shape: 'gate' },
      { id: 'S', x: 620, y: 40, label: 'Write a script' },
      { id: 'Q1', x: 220, y: 130, label: 'Can one instruction\ngive the full task?', shape: 'gate' },
      { id: 'L', x: 620, y: 130, label: 'Use one loop\nwith a verifier' },
      { id: 'Q2', x: 220, y: 225, label: 'Do you know the steps\nbefore the run?', shape: 'gate' },
      { id: 'H', x: 620, y: 225, label: 'Use an agent harness\nwith open planning' },
      { id: 'G', x: 220, y: 320, label: 'Make a graph with a verifier\nnode and maximum values' },
      { id: 'Q4', x: 220, y: 415, label: 'Do the nodes read or\nchange business data?', shape: 'gate' },
      { id: 'O', x: 620, y: 368, label: 'Add an ontology\nand the two gates' },
      { id: 'D', x: 620, y: 462, label: 'The graph is sufficient' }
    ],
    edges: [
      { from: 'Q0', to: 'S', label: 'yes' }, { from: 'Q0', to: 'Q1', label: 'no', lx: 240, ly: 84 },
      { from: 'Q1', to: 'L', label: 'yes' }, { from: 'Q1', to: 'Q2', label: 'no', lx: 240, ly: 178 },
      { from: 'Q2', to: 'H', label: 'no' }, { from: 'Q2', to: 'G', label: 'yes', lx: 242, ly: 273 },
      { from: 'G', to: 'Q4' },
      { from: 'Q4', to: 'O', label: 'yes', fromSide: 'r', toSide: 'l', lx: 480, ly: 358 },
      { from: 'Q4', to: 'D', label: 'no', fromSide: 'r', toSide: 'l', lx: 480, ly: 452 }
    ]
  };

  /* GE 03, section 2: how the four types connect. */
  G.cycle = {
    w: 760, h: 300, label: 'How the four types of graph connect, as a cycle.',
    nodes: [
      { id: 'PG', x: 130, y: 60, label: 'Procedural graph\nthe permitted paths' },
      { id: 'EG', x: 440, y: 60, label: 'Execution graph\nthe run' },
      { id: 'KG', x: 660, y: 235, label: 'Knowledge graph\nthe domain' },
      { id: 'CG', x: 250, y: 235, label: 'Context graph\nwhat occurred' }
    ],
    edges: [
      { from: 'PG', to: 'EG', label: 'is loaded as a skill' },
      { from: 'EG', to: 'KG', label: 'sends queries to', fromSide: 'r', toSide: 't' },
      { from: 'EG', to: 'CG', label: 'writes a trace', fromSide: 'b', toSide: 't' },
      { from: 'CG', to: 'KG', label: 'connects each step to records' },
      { from: 'CG', to: 'PG', label: 'good runs become a procedure', fromSide: 'l', toSide: 'b', lx: 130, ly: 150 }
    ],
    steps: [
      { text: 'The run obeys a procedure.', nodes: ['PG', 'EG'], edges: ['PG>EG'] },
      { text: 'The run reads facts from the knowledge graph.', nodes: ['EG', 'KG'], edges: ['EG>KG'] },
      { text: 'The run writes its steps to the context graph. The context graph connects each step to the records that the step used.', nodes: ['EG', 'CG', 'KG'], edges: ['EG>CG', 'CG>KG'] },
      { text: 'Good runs become a better procedure.', nodes: ['CG', 'PG'], edges: ['CG>PG'] }
    ]
  };

  /* GE 03, section 5: the loan procedure. The maximum on the report cycle is an addition by the notes. */
  G.loan = {
    w: 830, h: 580, label: 'The loan procedure as a procedural graph.',
    nodes: [
      { id: 'A', x: 410, y: 28, label: 'Application', shape: 'pill' },
      { id: 'H', x: 410, y: 102, label: 'Policy rules\nscripts', type: 'code', shape: 'gate' },
      { id: 'AP', x: 130, y: 205, label: 'Automatic approval', type: 'code' },
      { id: 'DN', x: 735, y: 205, label: 'Automatic refusal', type: 'code' },
      { id: 'DM', x: 410, y: 215, label: 'Decision model\nrisk tier, exposure, give or refuse', type: 'model' },
      { id: 'R', x: 410, y: 305, label: 'Router\nis a person necessary?', type: 'code', shape: 'gate' },
      { id: 'HU', x: 620, y: 388, label: 'Review by a person', type: 'person' },
      { id: 'RP', x: 410, y: 388, label: 'The agent writes the report', type: 'agent' },
      { id: 'LN', x: 410, y: 468, label: 'Check and lint', type: 'code', shape: 'gate' },
      { id: 'E', x: 410, y: 548, label: 'End', shape: 'pill', w: 84 }
    ],
    edges: [
      { from: 'A', to: 'H' },
      { from: 'H', to: 'AP', label: 'a rule gives the loan', fromSide: 'l', toSide: 't' },
      { from: 'H', to: 'DN', label: 'a rule refuses the loan', fromSide: 'r', toSide: 't' },
      { from: 'H', to: 'DM', label: 'the rules give no decision', lx: 410, ly: 160 },
      { from: 'DM', to: 'R' },
      { from: 'R', to: 'HU', label: 'yes', fromSide: 'r', toSide: 't' },
      { from: 'R', to: 'RP', label: 'no', lx: 428, ly: 348 },
      { from: 'RP', to: 'LN' },
      { from: 'LN', to: 'RP', label: 'FAIL, try again', fromSide: 'l', toSide: 'l', via: [[258, 468], [258, 388]], lx: 200, ly: 432 },
      { from: 'LN', to: 'HU', label: 'FAIL, maximum reached', fromSide: 'r', toSide: 'b', to_: -32, lx: 548, ly: 459 },
      { from: 'LN', to: 'E', label: 'PASS', lx: 436, ly: 512 },
      { from: 'AP', to: 'E', fromSide: 'b', toSide: 'l' },
      { from: 'DN', to: 'E', fromSide: 'b', toSide: 'r' },
      { from: 'HU', to: 'E', fromSide: 'b', toSide: 'r', fo: 36 }
    ]
  };

  /* GE 04, section 1: the ontology and the knowledge graph. */
  G.ontoKg = {
    w: 720, h: 340, label: 'An ontology gives the types and rules. A knowledge graph holds the facts that obey it.',
    groups: [
      { x: 20, y: 16, w: 680, h: 150, label: 'Ontology: the types and the rules' },
      { x: 20, y: 228, w: 680, h: 96, label: 'Knowledge graph: the facts' }
    ],
    nodes: [
      { id: 'RF', x: 350, y: 62, label: 'Refund' }, { id: 'C', x: 120, y: 128, label: 'Customer' },
      { id: 'OR', x: 350, y: 128, label: 'Order' }, { id: 'P', x: 580, y: 128, label: 'Product' },
      { id: 'c1', x: 120, y: 284, label: 'Thandi', shape: 'pill' }, { id: 'o1', x: 350, y: 284, label: 'Order 1042', shape: 'pill' },
      { id: 'p1', x: 580, y: 284, label: 'Game: Star Harbour', shape: 'pill' }
    ],
    edges: [
      { from: 'C', to: 'OR', label: 'places' }, { from: 'OR', to: 'P', label: 'contains' },
      { from: 'RF', to: 'OR', label: 'refunds', lx: 388, ly: 96 },
      { from: 'c1', to: 'o1', label: 'places' }, { from: 'o1', to: 'p1', label: 'contains' },
      { from: 'c1', to: 'C', label: 'is a', kind: 'ref', lx: 140, ly: 200 }, { from: 'o1', to: 'OR', label: 'is a', kind: 'ref', lx: 370, ly: 200 },
      { from: 'p1', to: 'P', label: 'is a', kind: 'ref', lx: 600, ly: 200 }
    ]
  };

  /* GE 04, section 5: the two gates around one tool call. */
  G.twoGates = {
    w: 860, h: 176, label: 'A tool call goes through Gate 1, the tool, and Gate 2 before the commit.',
    nodes: [
      { id: 'M', x: 90, y: 58, label: 'Model\nsuggests a call', type: 'model' },
      { id: 'G1', x: 270, y: 58, label: 'Gate 1\nthe shape', type: 'code', shape: 'gate' },
      { id: 'T', x: 440, y: 58, label: 'Tool\nno side effect', type: 'code' },
      { id: 'G2', x: 615, y: 58, label: 'Gate 2\nthe sense', type: 'code', shape: 'gate' },
      { id: 'DB', x: 785, y: 58, label: 'Database\ncommit', type: 'code' }
    ],
    edges: [
      { from: 'M', to: 'G1' }, { from: 'G1', to: 'T', label: 'PASS' }, { from: 'T', to: 'G2' }, { from: 'G2', to: 'DB', label: 'PASS' },
      { from: 'G1', to: 'M', label: 'reject, with the cause', fromSide: 'b', toSide: 'b', to_: 24, via: [[270, 118], [114, 118]], lx: 192, ly: 109 },
      { from: 'G2', to: 'M', label: 'reject, with the cause', fromSide: 'b', toSide: 'b', to_: -24, via: [[615, 152], [66, 152]], lx: 420, ly: 143 }
    ]
  };

  /* GE 06, section 3: the permitted transitions of the status of an order (rule R7). */
  G.transitions = {
    w: 640, h: 250, label: 'The permitted transitions of the status of an order.',
    nodes: [
      { id: 'CART', x: 90, y: 60, label: 'CART' }, { id: 'PAID', x: 290, y: 60, label: 'PAID' },
      { id: 'FULFILLED', x: 530, y: 60, label: 'FULFILLED' },
      { id: 'CANCELLED', x: 90, y: 195, label: 'CANCELLED' }, { id: 'REFUNDED', x: 400, y: 195, label: 'REFUNDED' }
    ],
    edges: [
      { from: 'CART', to: 'PAID', label: 'payment accepted' },
      { from: 'CART', to: 'CANCELLED', label: 'customer cancels', lx: 150, ly: 130 },
      { from: 'PAID', to: 'FULFILLED', label: 'game key delivered' },
      { from: 'PAID', to: 'REFUNDED', label: 'refund accepted', fromSide: 'b', toSide: 't', to_: -22, lx: 310, ly: 118 },
      { from: 'FULFILLED', to: 'REFUNDED', label: 'refund accepted', fromSide: 'b', toSide: 't', to_: 22, lx: 505, ly: 118 }
    ]
  };

  /* GE 06, section 5: the execution graph of the factory. Short edge labels:
     "try again" is "no, try again"; "maximum reached" is "no, maximum reached". */
  G.factory = {
    w: 780, h: 890, label: 'The execution graph of the game store software factory: twelve numbered nodes.',
    nodes: [
      { id: 'IN', x: 330, y: 36, label: '1 Intake\nclassify the request', type: 'model' },
      { id: 'RET', x: 330, y: 112, label: '2 Retrieve\nsend a query to the graph', type: 'code' },
      { id: 'ANS', x: 62, y: 112, label: 'Answer\nfrom graph', type: 'model' },
      { id: 'PLAN', x: 330, y: 190, label: '3 Plan\na typed plan', type: 'agent' },
      { id: 'G1', x: 330, y: 266, label: '4 Plan gate\nobeys the ontology?', type: 'code', shape: 'gate' },
      { id: 'HUM', x: 330, y: 342, label: '5 Approval\na person gives approval?', type: 'person', shape: 'gate' },
      { id: 'IMP', x: 330, y: 418, label: '6 Implement\nan agent writes the code', type: 'agent' },
      { id: 'TEST', x: 330, y: 492, label: '7 Tests\ngive a test report', type: 'code' },
      { id: 'G2', x: 330, y: 564, label: '8 Rule gate\nis each rule test PASS?', type: 'code', shape: 'gate' },
      { id: 'REV', x: 330, y: 640, label: '9 Review\na different agent', type: 'agent', shape: 'gate' },
      { id: 'PR', x: 330, y: 712, label: '10 Pull request', type: 'code' },
      { id: 'REC', x: 330, y: 780, label: '11 Record\nwrite the trace', type: 'code' },
      { id: 'UPD', x: 330, y: 852, label: '12 Update\nadd the lessons', type: 'code' },
      { id: 'ESC', x: 650, y: 452, label: 'Escalate\nto a person', type: 'person' }
    ],
    edges: [
      { from: 'IN', to: 'RET' },
      { from: 'RET', to: 'ANS', label: 'question' },
      { from: 'RET', to: 'PLAN', label: 'defect or feature', lx: 400, ly: 151 },
      { from: 'PLAN', to: 'G1' },
      { from: 'G1', to: 'PLAN', label: 'try again', fromSide: 'l', toSide: 'l', via: [[200, 266], [200, 190]], lx: 163, ly: 228 },
      { from: 'G1', to: 'ESC', label: 'maximum reached', fromSide: 'r', toSide: 't', to_: 30, lx: 560, ly: 257 },
      { from: 'G1', to: 'HUM', label: 'yes', lx: 350, ly: 304 },
      { from: 'HUM', to: 'PLAN', label: 'try again', fromSide: 'l', toSide: 'l', to_: -12, via: [[172, 342], [172, 178]], lx: 134, ly: 318 },
      { from: 'HUM', to: 'ESC', label: 'maximum reached', fromSide: 'r', toSide: 't', to_: -30, lx: 536, ly: 333 },
      { from: 'HUM', to: 'IMP', label: 'yes', lx: 350, ly: 380 },
      { from: 'IMP', to: 'TEST' }, { from: 'TEST', to: 'G2' },
      { from: 'G2', to: 'IMP', label: 'try again', fromSide: 'l', toSide: 'l', via: [[196, 564], [196, 418]], lx: 158, ly: 528 },
      { from: 'G2', to: 'ESC', label: 'maximum reached', fromSide: 'r', toSide: 'b', to_: -30, lx: 536, ly: 555 },
      { from: 'G2', to: 'REV', label: 'yes', lx: 350, ly: 602 },
      { from: 'REV', to: 'IMP', label: 'try again', fromSide: 'l', toSide: 'l', to_: -12, via: [[166, 640], [166, 406]], lx: 128, ly: 616 },
      { from: 'REV', to: 'ESC', label: 'maximum reached', fromSide: 'r', toSide: 'b', to_: 30, lx: 566, ly: 631 },
      { from: 'REV', to: 'PR', label: 'accept', lx: 358, ly: 677 },
      { from: 'PR', to: 'REC' }, { from: 'REC', to: 'UPD' },
      { from: 'ANS', to: 'REC', fromSide: 'b', toSide: 'l' },
      { from: 'ESC', to: 'REC', fromSide: 'r', toSide: 'r', via: [[745, 452], [745, 780]] }
    ]
  };

  /* GE 06, section 5: how the rule gate finds the tests. */
  G.ruleGate = {
    w: 520, h: 420, label: 'The rule gate goes from a changed file to the rule and to its test.',
    nodes: [
      { id: 'F', x: 260, y: 36, label: 'Changed file\nRefundService' }, { id: 'R', x: 260, y: 132, label: 'Rule R2' },
      { id: 'T', x: 260, y: 222, label: 'Test: the service rejects\na second refund' },
      { id: 'REP', x: 260, y: 316, label: 'Test report' }, { id: 'P', x: 260, y: 394, label: 'PASS', shape: 'pill', w: 84 }
    ],
    edges: [
      { from: 'F', to: 'R', label: 'implemented_by, in the opposite direction', lx: 260, ly: 88 },
      { from: 'R', to: 'T', label: 'validated_by', lx: 260, ly: 176 },
      { from: 'T', to: 'REP', label: 'must be in', lx: 260, ly: 272 },
      { from: 'REP', to: 'P', label: 'with the result', lx: 260, ly: 358 }
    ],
    steps: [
      { text: 'The rule gate starts at the changed files. Here the agent changed RefundService.', nodes: ['F'], edges: [] },
      { text: 'The knowledge graph says that RefundService implements rule R2. The gate goes along implemented_by in the opposite direction.', nodes: ['F', 'R'], edges: ['F>R'] },
      { text: 'Rule R2 has a test. The relation validated_by points to it.', nodes: ['R', 'T'], edges: ['R>T'] },
      { text: 'That test must be in the test report, with the result PASS. If the test is absent, the rule gate gives FAIL.', nodes: ['T', 'REP', 'P'], edges: ['T>REP', 'REP>P'] }
    ]
  };

  /* GE 05, section 8: three paths from a trace to a better system. */
  G.improve = {
    w: 900, h: 320, label: 'A trace can make the system better on three paths.',
    nodes: [
      { id: 'RUN', x: 80, y: 170, label: 'Agent run', type: 'agent' },
      { id: 'ST', x: 250, y: 170, label: 'Trace storage', type: 'code' },
      { id: 'CTX', x: 560, y: 80, label: 'Memory that goes\ninto the next prompt' },
      { id: 'FT', x: 560, y: 170, label: 'Examples to fine-tune\na small model' },
      { id: 'SM', x: 795, y: 170, label: 'Small decision model\nfor one narrow decision', type: 'model' },
      { id: 'HI', x: 560, y: 266, label: 'Changes to prompts,\ntools and verifiers' }
    ],
    edges: [
      { from: 'RUN', to: 'ST', label: 'trace' },
      { from: 'ST', to: 'CTX', label: 'path 1: token space', fromSide: 't', toSide: 'l' },
      { from: 'ST', to: 'FT', label: 'path 2: weight space' },
      { from: 'ST', to: 'HI', label: 'path 3: harness', fromSide: 'b', toSide: 'l' },
      { from: 'CTX', to: 'RUN', fromSide: 't', toSide: 't', to_: 14, via: [[560, 36], [94, 36]] },
      { from: 'FT', to: 'SM' },
      { from: 'SM', to: 'RUN', fromSide: 't', toSide: 't', to_: -14, via: [[795, 16], [66, 16]] },
      { from: 'HI', to: 'RUN', fromSide: 'b', toSide: 'b', via: [[560, 306], [80, 306]] }
    ],
    steps: [
      { text: 'Each run writes a trace.', nodes: ['RUN', 'ST'], edges: ['RUN>ST'] },
      { text: 'Path 1, token space. The input of the model changes: a lesson from an old run goes into the context.', nodes: ['ST', 'CTX', 'RUN'], edges: ['ST>CTX', 'CTX>RUN'] },
      { text: 'Path 2, weight space. The model changes: a small model learns one narrow decision, for example where to put a new memory.', nodes: ['ST', 'FT', 'SM', 'RUN'], edges: ['ST>FT', 'FT>SM', 'SM>RUN'] },
      { text: 'Path 3, harness. The prompts, the tools and the verifiers change: an analysis of traces adds a new check. The talk gives paths 1 and 2. The LangChain article gives this cycle the name “hill climbing loop”. Its first target is the harness. The article says that the same loop can also change memory, skills and model weights.', nodes: ['ST', 'HI', 'RUN'], edges: ['ST>HI', 'HI>RUN'] }
    ]
  };

  /* GE 07, section 5: the agent session loop. */
  G.session = {
    w: 790, h: 156, label: 'The agent session loop of five steps.',
    nodes: [
      { id: 'A', x: 75, y: 50, label: '1 Start\nquick checks', type: 'code' }, { id: 'B', x: 222, y: 50, label: '2 Select\na skill', type: 'person' },
      { id: 'C', x: 375, y: 50, label: '3 Retrieve\nnote, then code', type: 'agent' }, { id: 'D', x: 540, y: 50, label: '4 Work\nand verify', type: 'agent' },
      { id: 'E', x: 700, y: 50, label: '5 Closeout\nupdate the graph', type: 'agent' }
    ],
    edges: [
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'E' },
      { from: 'E', to: 'A', label: 'next agent session', kind: 'ref', fromSide: 'b', toSide: 'b', via: [[700, 126], [75, 126]] }
    ],
    steps: [
      { text: '1 Start. A script does the quick checks. Why: the agent session starts from a known condition.', nodes: ['A'], edges: [] },
      { text: '2 Select a skill. The developer selects the procedure for the task. Why: the agent does not make its own procedure.', nodes: ['B'], edges: ['A>B'] },
      { text: '3 Retrieve. The agent reads the graph note first, then the code that the note points to. Why: the agent reads less code and starts from a verified claim.', nodes: ['C'], edges: ['B>C'] },
      { text: '4 Work and verify. The agent does the work. The build, the lints and a review agent examine the work. Why: the agent does not give approval to its own work.', nodes: ['D'], edges: ['C>D'] },
      { text: '5 Closeout. The agent updates the memory, the registers and the graph. Why: the next agent session starts with what this agent session learned.', nodes: ['E', 'A'], edges: ['D>E', 'E>A'] }
    ]
  };

  /* GE 07, section 4: three notes for rule R2. */
  G.notes = {
    w: 620, h: 230, label: 'Three knowledge notes for rule R2 and the relations between them.',
    nodes: [
      { id: 'BR-R2', x: 110, y: 115, label: 'BR-R2', sub: 'business rule' },
      { id: 'REQ-Refunds', x: 470, y: 38, label: 'REQ-Refunds', sub: 'requirement' },
      { id: 'CODE-RefundService', x: 470, y: 115, label: 'CODE-RefundService', sub: 'code unit' },
      { id: 'TEST-second-refund', x: 470, y: 192, label: 'TEST-second-refund', sub: 'test' }
    ],
    edges: [
      { from: 'BR-R2', to: 'REQ-Refunds', label: 'specified_by', fromSide: 'r', toSide: 'l', lx: 318, ly: 29 },
      { from: 'BR-R2', to: 'CODE-RefundService', label: 'implemented_by', lx: 300, ly: 106 },
      { from: 'BR-R2', to: 'TEST-second-refund', label: 'validated_by', fromSide: 'r', toSide: 'l', lx: 318, ly: 183 }
    ]
  };
})(window.GE);
