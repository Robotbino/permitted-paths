/* gates.js: the questions of the gate at the end of each part.
   Most questions give a new case, so the learner must use the idea and not only know the sentence.
   The cases are examples by this edition. Each answer and each cause comes from the notes:
   `source` gives the note and the section, `at` is the heading in the course with the answer.
   `hint` shows after the first FAIL. It does not give the answer.
   `recall` marks a question about an earlier part (spaced retrieval). */
(function (GE) {
  'use strict';
  var Q = GE.data.gates = {};

  Q['1'] = { title: 'Gate of part 1: the cause of the variation', questions: [
    { kind: 'choice', source: 'GE 01 §3', at: 'p1-the-effect-of-small-errors-increases',
      prompt: 'An agent task has 20 model decisions in sequence. Each decision is correct 95% of the time, and the decisions are independent. You move 10 of the decisions into code. Which estimate is correct?',
      hint: 'Each decision must be correct for the task to be correct. Use only the decisions that the model still makes.',
      options: [
        { text: 'The task is correct in approximately 36% of the runs before the change, and 60% after it', correct: true, why: '0.95 to the power of 20 is 0.36. With 10 model decisions, 0.95 to the power of 10 is 0.60.' },
        { text: 'The task is correct in approximately 90% of the runs before the change, and 95% after it', why: 'The rates multiply. 0.95 to the power of 20 is 0.36, not 0.90.' },
        { text: 'The task is correct in approximately 36% of the runs before the change, and 41% after it', why: 'The first number is correct. But 10 model decisions give 0.95 to the power of 10, which is 0.60.' },
        { text: 'The task is correct in approximately 60% of the runs before the change, and 60% after it', why: 'The model is the same, but the number of its decisions is not. Before: 0.36. After: 0.60.' }
      ] },
    { kind: 'choice', source: 'GE 01 §5', at: 'p1-what-deterministic-means-here',
      prompt: 'A team says: “Our agent system is deterministic now.” Which evidence agrees with the meaning of that word in these notes?',
      hint: 'The notes use the word for the system, not for the model. Which things become fixed?',
      options: [
        { text: 'Ten runs gave only permitted paths, and only permitted values in each typed field', correct: true, why: 'The permitted paths, the permitted values and the checks are the same on each run. The words can change.' },
        { text: 'Ten runs of one task gave the same words in each result, with no difference in the text', why: 'The words of a result stay probabilistic. The notes do not ask for the same words.' },
        { text: 'The temperature of the model is zero, and the prompt has no random part', why: 'A low temperature decreases the variation. It does not remove the variation from a full system.' },
        { text: 'Ten runs of one task used the same tools in the same sequence one time', why: 'One equal sequence is not the definition. The definition is about the permitted paths, values and checks on each run.' }
      ] },
    { kind: 'choice', source: 'GE 01 §1', at: 'p1-a-model-gives-a-probability',
      prompt: 'You set the temperature to zero. You do one agent task two times, and the two results are different. Which statement is NOT one of the causes that the notes give?',
      hint: 'The notes give three answers to the question “Why not set the temperature to zero?”. Find the statement that is not one of them.',
      options: [
        { text: 'A temperature of zero makes the model select a token at random', correct: true, why: 'The notes do not say this. A low temperature decreases the variation; it does not add it.' },
        { text: 'The supplier of the hosted model changed the model between the two runs', why: 'This is one of the three answers of the notes.' },
        { text: 'One different token at the start of the loop changed each step after it', why: 'This is one of the three answers of the notes.' },
        { text: 'A file that a tool reads changed between the two runs', why: 'This is one of the three answers of the notes: the tool results change between two runs.' }
      ] }
  ] };

  Q['2'] = { title: 'Gate of part 2: suggestion or constraint', questions: [
    { kind: 'assign', source: 'GE 08 exercise 2 · GE 02 §2, §7', at: 'p2-how-a-graph-makes-a-system-predictable',
      prompt: 'These six rules are sentences in a system prompt. Select the correct location for each rule. (The six sentences are examples by this edition.)',
      hint: 'A step that must occur is a node. A rule about the sequence or the stop is on an edge. A check of a result before the next step is a gate.',
      bins: ['Node', 'Edge', 'Gate', 'Prompt'],
      why: 'A rule about approval, cost or safety is structure, not a sentence in a prompt. Only the rule about the voice of the text stays in the prompt.',
      items: [
        { text: '“Get approval from a person before you write code.”', bin: 'Node', why: 'Approval is a node. The run cannot go around it.' },
        { text: '“Do not try more than two times.”', bin: 'Edge', why: 'Put the stop rules on the edges. The maximum number of attempts is a decision about the path.' },
        { text: '“A status value that is not permitted must not go to the next step.”', bin: 'Gate', why: 'A gate examines the result and rejects a value that is not permitted.' },
        { text: '“A separate step that did not write the change must examine the change.”', bin: 'Node', why: 'An independent verifier is a node that did not write the work.' },
        { text: '“Write the summary in a friendly voice.”', bin: 'Prompt', why: 'The words of a result stay with the model. This is content, not policy.' },
        { text: '“A refund goes only to the customer of the order.”', bin: 'Gate', why: 'This rule must have the current facts. A gate examines the result before the change.' }
      ] },
    { kind: 'choice', source: 'GE 02 §8', at: 'p2-when-to-use-a-graph',
      prompt: 'A colleague wants to divide one code review between four parallel agents. Each agent must have the findings of the other three before it can complete its part. What do the notes say?',
      hint: 'Read “When not to use a graph”. Two of its items are about parallel agents.',
      options: [
        { text: 'Do not divide the work: each subtask must have the results of the other subtasks', correct: true, why: 'This is advice from Anthropic for systems with many agents. The PuppyGraph guide gives it.' },
        { text: 'Divide the work, because parallel work is one of the three good causes for a new node', why: 'Parallel work is a good cause only if the branches are independent. These branches are not.' },
        { text: 'Divide the work, and add a fifth agent that connects the four results at the end', why: 'A merge at the end does not help: each agent must have the other findings during its work.' },
        { text: 'Divide the work, and write a merge rule for each field that two branches write', why: 'A merge rule prevents lost data. It does not make dependent subtasks independent.' }
      ] },
    { kind: 'choice', source: 'GE 02 §2.4', at: 'p2-the-four-parts',
      prompt: 'A run stops because of a failure. The run continues from the last checkpoint, and one node starts again from its first line. For which node is this the largest risk?',
      hint: 'Read “Control” in “The four parts”. Which type of node must be safe to do two times?',
      options: [
        { text: 'A node that opens a pull request or sends a payment', correct: true, why: 'Make each node safe to do two times. This is most important for a node with a side effect.' },
        { text: 'A node that classifies the request with one model call', why: 'A second classification costs one model call. It changes nothing outside the run.' },
        { text: 'A verifier node that does the tests of a change', why: 'To do the tests two times is safe. The tests change nothing outside the run.' },
        { text: 'A node that reads the related rules from a knowledge graph', why: 'A read has no side effect. To do it two times is safe.' }
      ] },
    { kind: 'choice', source: 'GE 01 §3', recall: 1, at: 'p1-the-effect-of-small-errors-increases',
      prompt: 'A task has 12 model decisions. You move 8 of them to code, and the task becomes more reliable. What is the cause?',
      hint: 'What is each decision of the model, for the result?',
      options: [
        { text: 'Each model decision is a point where the result can change: now 4 points, not 12', correct: true, why: 'A smaller number of model decisions gives a smaller number of points where the result can change.' },
        { text: 'The model makes each of the 4 decisions with a higher correct rate than before', why: 'The correct rate of one decision does not change. The number of decisions changes.' },
        { text: 'Code makes the 8 decisions faster, and a faster run has fewer errors', why: 'Speed is not the cause in the notes. The cause is the number of points where the result can change.' },
        { text: 'The 8 decisions were the difficult decisions, and the 4 easy decisions stay with the model', why: 'The notes say the opposite: the model keeps the decisions for which judgment is necessary.' }
      ] }
  ] };

  Q['3'] = { title: 'Gate of part 3: which graph?', questions: [
    { kind: 'assign', source: 'GE 03 §1', at: 'p3-the-four-types',
      prompt: 'Each statement is about one of the four types of graph. Select the type.',
      hint: 'Two types are about control, and two are about data. One of each pair is about one run.',
      bins: ['Execution', 'Knowledge', 'Context', 'Procedural'],
      items: [
        { text: 'Its nodes are entities, for example a customer or a file.', bin: 'Knowledge', why: 'A knowledge graph answers: what is in the domain?' },
        { text: 'Each run adds a trace to it.', bin: 'Context', why: 'A context graph answers: what occurred in this run?' },
        { text: 'A harness loads it as data.', bin: 'Procedural', why: 'A procedural graph is data that a harness loads.' },
        { text: 'The runtime enforces it as code.', bin: 'Execution', why: 'An execution graph is code that the runtime enforces.' },
        { text: 'It shows the cause of a decision, but only after the run.', bin: 'Context', why: 'A trace does not control the next run.' },
        { text: 'GraphRAG uses it for retrieval.', bin: 'Knowledge', why: 'GraphRAG and knowledge graphs are about data.' }
      ] },
    { kind: 'choice', source: 'GE 03 §4', at: 'p3-the-four-types',
      prompt: 'A reviewer wants to know why the agent refused one loan last Tuesday. Which graph has the answer, and what is the limit of that graph?',
      hint: 'Which graph keeps what occurred in one run? Can that graph change the next run?',
      options: [
        { text: 'The context graph. It shows the cause only after the run, and it does not control the next run.', correct: true, why: 'A trace shows the cause of a decision only after the run. For control, a procedural graph is necessary.' },
        { text: 'The procedural graph. It holds the permitted paths, and it also records the path of each run.', why: 'The procedural graph holds the permitted paths. The context graph holds what occurred.' },
        { text: 'The knowledge graph. It holds the entities of the domain, and it also records each decision.', why: 'The knowledge graph holds the domain. The context graph connects each step to the records in it.' },
        { text: 'The execution graph. It is the design of the system, and it also stores the trace of each run.', why: 'The design is permanent, and each run is one pass through it. The run writes its trace to the context graph.' }
      ] },
    { kind: 'choice', source: 'GE 03 §5', at: 'p3-a-skill-with-the-shape-of-a-graph',
      prompt: 'In the first version of the loan agent, an instruction said: escalate when you are not sure. Why did this instruction not make the agent predictable?',
      hint: 'Who made the decision to escalate, and with which information?',
      options: [
        { text: 'The instruction gave the decision to the model, which had no calibrated confidence values', correct: true, why: 'In the second version, scripts and a router make this decision.' },
        { text: 'The instruction was in the data graph, and the agent did not read the data graph in each run', why: 'The notes do not say this. The first version had the data graph and written instructions.' },
        { text: 'The policy rules gave a different result in each run, so the agent was not sure each time', why: 'The policy rules are scripts. The model made the decision to escalate.' },
        { text: 'The trace of each run was absent, so no person saw when the agent was not sure', why: 'The trace showed the cause of the difference, but only after the run.' }
      ] },
    { kind: 'choice', source: 'GE 02 §2.2', recall: 2, at: 'p2-the-four-parts',
      prompt: 'A rule says: “Stop after two attempts.” Where do you put this rule in an execution graph?',
      hint: 'Is the number of attempts a decision about the content, or about the path?',
      options: [
        { text: 'On an edge: a node counts the attempts, and the edge reads the count', correct: true, why: 'Put the stop rules on the edges. The maximum number of attempts is a decision about the path.' },
        { text: 'In the prompt of the agent step: the agent counts its attempts and stops', why: 'That is a suggestion. The agent can continue with no end.' },
        { text: 'In the verifier node: it gives PASS on the second attempt, so the run stops', why: 'A verifier examines the work. It must not give PASS for work that is not satisfactory.' },
        { text: 'In the state: a field holds the number two, and each node reads it', why: 'A field holds the count. But the decision to stop is on the edge.' }
      ] }
  ] };

  Q['4'] = { title: 'Gate of part 4: what stops an incorrect result?', questions: [
    { kind: 'choice', source: 'GE 04 §5', at: 'p4-the-two-gates',
      prompt: 'A refund tool gets this call: order 1042, amount 40000, payee 7, new status REFUNDED. Each field has the correct type. Order 1042 has one refund already. What stops the call?',
      hint: 'Which gate reads only the call? Which gate reads the current facts?',
      options: [
        { text: 'Gate 2: it reads the current facts, and the facts show that the order has a refund', correct: true, why: 'The shape of the call is correct. Only the current facts show the problem.' },
        { text: 'Gate 1: it reads the call, and it sees that this call came before', why: 'Gate 1 reads only the call. It has no memory of earlier calls and no access to the facts.' },
        { text: 'Gate 1: it reads the call, and REFUNDED is not a permitted status for a refund', why: 'REFUNDED is in the list. And the shape of the call is correct.' },
        { text: 'Nothing: the shape is correct and the status is permitted, so the tool commits the refund', why: 'That is the result with one gate only. Gate 2 examines the result against the rules and the current facts.' }
      ] },
    { kind: 'assign', source: 'GE 04 §7', at: 'p4-where-an-ontology-decreases-the-variation',
      prompt: 'An ontology can act at three points. For each point: is it help for the model, or is it a constraint?',
      hint: 'A constraint is something that the model cannot go around.',
      bins: ['Help for the model', 'Constraint'],
      why: 'Only the second and the third points are constraints.',
      items: [
        { text: 'Before the model call: the model sees the permitted values in its context.', bin: 'Help for the model', why: 'The model does not always obey what it sees.' },
        { text: 'During the model call: a schema sets the output.', bin: 'Constraint', why: 'The model can give only a value from the list.' },
        { text: 'After the model call: a gate examines the result.', bin: 'Constraint', why: 'An incorrect value does not go to the next step.' }
      ] },
    { kind: 'choice', source: 'GE 04 §9', at: 'p4-limits',
      prompt: 'A validator gives PASS for the status REFUNDED on order 1042. But the correct status of the order is PAID. What does this show?',
      hint: 'What does an ontology give: a correct fact, or a consistent meaning? Open “Limits”.',
      options: [
        { text: 'An ontology gives consistent meaning. It does not make a fact correct.', correct: true, why: 'PASS says that the value is permitted. It does not say that the value is correct. Connect each fact to a source.' },
        { text: 'The validator has a defect: a validator must reject each value that is not correct', why: 'The validator did its work: REFUNDED is a permitted value. It cannot know the correct value.' },
        { text: 'The enumeration is too large: with fewer values, the validator rejects the incorrect value', why: 'REFUNDED is a real status of an order. To remove it stops valid work.' },
        { text: 'Gate 1 must examine the status, because Gate 2 examines it too late', why: 'The time of the check is not the problem. No check of permitted values knows the correct value.' }
      ] },
    { kind: 'choice', source: 'GE 03 §1', recall: 3, at: 'p3-the-four-types',
      prompt: 'Which two of the four types of graph are about control, not about data?',
      hint: 'Which graphs select what comes next, or which paths are permitted?',
      options: [
        { text: 'The execution graph and the procedural graph', correct: true, why: 'The knowledge graph and the context graph are about data.' },
        { text: 'The knowledge graph and the context graph', why: 'These two are about data.' },
        { text: 'The execution graph and the context graph', why: 'The context graph is a graph of traces. It is about data.' },
        { text: 'The procedural graph and the knowledge graph', why: 'The knowledge graph holds the facts of the domain. It is about data.' }
      ] }
  ] };

  Q['5'] = { title: 'Gate of part 5: limits or influence?', questions: [
    { kind: 'assign', source: 'GE 05 §2', at: 'p5-the-planes',
      prompt: 'Each statement is about the control plane or the intelligence plane. Select the plane.',
      hint: 'One plane sets limits. The other plane influences the decision in those limits.',
      bins: ['Control plane', 'Intelligence plane'],
      items: [
        { text: 'It operates the gate.', bin: 'Control plane', why: 'The control plane operates the gate. The intelligence plane supplies the rules.' },
        { text: 'It supplies the rules that the gate uses.', bin: 'Intelligence plane', why: 'The ontology is in the intelligence plane.' },
        { text: 'It sets what the agent can know for this user.', bin: 'Intelligence plane', why: 'Access to data is in the intelligence plane, because it sets what the agent can know.' },
        { text: 'It gives or refuses the permission to use a tool.', bin: 'Control plane', why: 'Tool permissions are in the control plane.' },
        { text: 'It keeps the audit trail.', bin: 'Control plane', why: 'The data plane sends audit events to the control plane.' },
        { text: 'It keeps the traces, and it uses them to make the system better.', bin: 'Intelligence plane', why: 'The data plane sends traces to the intelligence plane.' }
      ] },
    { kind: 'choice', source: 'GE 05 §6', at: 'p5-ontology-and-semantic-layer',
      prompt: 'An agent finds the correct record with a search. Its answer about the record is incorrect. You want a test that finds this type of problem. Which test?',
      hint: 'The agent did two things: it found the record, and it gave the record a meaning.',
      options: [
        { text: 'A test for interpretation, different from the test for retrieval', correct: true, why: 'Do one test for retrieval and a different test for interpretation. A search result is not an answer.' },
        { text: 'A test for retrieval with more search terms and more records', why: 'Retrieval was correct in this case. More retrieval does not find the problem.' },
        { text: 'A test of the access rules for the user of the agent', why: 'Access sets which data the agent can see. The agent saw the correct record.' },
        { text: 'A test of the number of tokens that the agent uses for one answer', why: 'The number of tokens is a cost. It does not show if the meaning is correct.' }
      ] },
    { kind: 'choice', source: 'GE 05 §7', at: 'p5-the-planes',
      prompt: 'An agent acts for a user. The agent has permission to use the database tool. The user cannot see the salary rows. What must the design do?',
      hint: 'Permission to use a tool is one decision. Permission to read one row is a different decision.',
      options: [
        { text: 'Send the identity of the user to the data layer, so the database gives only the permitted rows', correct: true, why: 'Give the agent only the permissions that are necessary. Never give more than the person has.' },
        { text: 'Give the agent all the rows, because it has permission to use the database tool', why: 'Permission to use a tool is not permission to read each row.' },
        { text: 'Write in the prompt that the agent must not read the salary rows, and give the rule again at the end', why: 'An instruction in a prompt is a suggestion. Put the access rules in the data layer.' },
        { text: 'Remove the database tool from the agent, so it cannot read a row', why: 'Then the agent cannot do its task. The rule is: only the rows that the user can see.' }
      ] },
    { kind: 'choice', source: 'GE 04 §4', recall: 4, at: 'p4-inference-and-constraints',
      prompt: 'The data says that one order has two refunds. One refund is the maximum. Which tool gives a strict check and rejects the data?',
      hint: 'One standard infers. One standard uses the open-world assumption. One standard validates.',
      options: [
        { text: 'SHACL, or code', correct: true, why: 'SHACL or code gives a strict check of data.' },
        { text: 'OWL, with a reasoner', why: 'OWL uses the open-world assumption. A reasoner infers that the two refunds are the same thing. It gives no error.' },
        { text: 'RDFS, with a reasoner', why: 'RDFS infers new facts from the domain and the range of a relation. It does not reject data.' },
        { text: 'A taxonomy of refund types', why: 'A taxonomy is a tree of types. It has only the relation “is a type of”.' }
      ] }
  ] };

  Q['6'] = { title: 'Gate of part 6: the factory', questions: [
    { kind: 'choice', source: 'GE 06, Try it', at: 'p6-layer-3-the-execution-graph',
      prompt: 'You give the factory the request “Add the status ON_HOLD”. Which node stops the request?',
      hint: 'Which node reads the status values of the plan and compares them with the ontology?',
      options: [
        { text: 'Node 4, the plan gate', correct: true, why: 'The plan gate rejects a plan that uses a value that is not in the ontology.' },
        { text: 'Node 1, Intake', why: 'Intake gives the request a type. It does not read the ontology.' },
        { text: 'Node 8, the rule gate', why: 'The rule gate examines the test report. The plan does not get that far.' },
        { text: 'Node 9, Review', why: 'The plan gate stops the request before the agent writes code.' }
      ] },
    { kind: 'choice', source: 'GE 06 §5', at: 'p6-layer-3-the-execution-graph',
      prompt: 'After that run, a reviewer wants to read the cause. Which field of the state holds it, and which node wrote it?',
      hint: 'Each field has one owner. Open the state contract.',
      options: [
        { text: 'plan_problems, written by node 4', correct: true, why: 'The owner of plan_problems is node 4, the plan gate.' },
        { text: 'plan, written by node 3', why: 'The plan holds the status ON_HOLD. It does not hold the cause of the rejection.' },
        { text: 'rule_problems, written by node 8', why: 'The owner of rule_problems is the rule gate. The run did not get to node 8.' },
        { text: 'review, written by node 9', why: 'The run did not get to node 9.' }
      ] },
    { kind: 'choice', source: 'GE 06 §5', at: 'p6-layer-3-the-execution-graph',
      prompt: 'The agent of node 6 wants a rule test to give PASS. It changes the test in its branch. What stops this?',
      hint: 'Where does node 7 get the rule tests, and who is the owner of the test report?',
      options: [
        { text: 'Node 7 gets the rule tests from the protected main branch', correct: true, why: 'The agent also cannot write the test report: its owner is node 7. And the rule gate gives FAIL if a rule test is absent.' },
        { text: 'The prompt of node 6 says that the agent must not change a test', why: 'An instruction in a prompt is a suggestion.' },
        { text: 'Node 9, the review agent, examines each test file and rejects the change', why: 'The review agent is a model. The structure does this check before the review.' },
        { text: 'Node 4, the plan gate, reads the test files and rejects the plan', why: 'The plan gate reads the typed fields of the plan. It does not read test files.' }
      ] },
    { kind: 'choice', source: 'GE 06 §6', at: 'p6-the-gates-in-operation',
      prompt: 'Two runs of one request give code with different text. The entities, the status values and the tests are the same in the two runs. Is this a failure of the factory?',
      hint: 'What is the aim of the notes: the same text, or the same parts that must not change?',
      options: [
        { text: 'No. The parts that must not change stay the same', correct: true, why: 'This is scenario C. The model stays probabilistic, and the parts that must not change stay the same.' },
        { text: 'Yes. The factory must give code with the same text in each run', why: 'The text of the code stays with the model. The notes do not ask for the same text.' },
        { text: 'Yes. The plan gate must reject the second run, because a first run exists', why: 'The plan gate compares the plan with the ontology. It does not compare two runs.' },
        { text: 'No, but only because a person gave approval for the two plans', why: 'The approval is one node. The cause is the structure: the gates and the ontology.' }
      ] },
    { kind: 'choice', source: 'GE 05 §2', recall: 5, at: 'p5-the-planes',
      prompt: 'In which plane is the execution graph of the factory?',
      hint: 'Does the execution graph do the work, set limits, or keep knowledge?',
      options: [
        { text: 'The control plane', correct: true, why: 'The execution graph, the maximum values, approval and tool permissions are in the control plane.' },
        { text: 'The data plane', why: 'The agent step, the model call and the tool call are in the data plane.' },
        { text: 'The intelligence plane', why: 'The ontology, the knowledge graph, memory and traces are in the intelligence plane.' }
      ] }
  ] };

  Q['7'] = { title: 'Gate of part 7: the small version', questions: [
    { kind: 'choice', source: 'GE 07 §7', at: 'p7-the-pattern-and-the-theory',
      prompt: 'A skill file says: “Do not read the notes in the protected list.” In one agent session, the agent reads a protected note. What is the correct improvement?',
      hint: 'In the table of the pattern, which rows have “an instruction”? What do the notes say about them?',
      options: [
        { text: 'A deny rule in the harness that prevents the read of each protected note', correct: true, why: 'Move each row with “an instruction” to code.' },
        { text: 'The same instruction two times: at the start and at the end of the skill file', why: 'Two instructions are two suggestions.' },
        { text: 'A new node type for protected notes, with the status superseded', why: 'A type and a status say what a note is. They do not prevent a read.' },
        { text: 'A review agent that examines the list of files after each agent session', why: 'That finds the read after it occurred. A deny rule prevents it.' }
      ] },
    { kind: 'choice', source: 'GE 07 §5, §8', at: 'p7-the-agent-session-loop',
      prompt: 'The agent gets the question: “Is rule R2 in the code?” With the note graph, what does the agent do first?',
      hint: 'Look at step 3 of the agent session loop.',
      options: [
        { text: 'It reads the rule note BR-R2, then goes along implemented_by', correct: true, why: 'The agent reads less code and starts from a claim that has a confidence value and a source.' },
        { text: 'It does a search of the full repository for the word “refund”', why: 'That is the agent with no structure. It reads too much code to find one rule.' },
        { text: 'It reads the code of RefundService, then it writes a new rule note', why: 'The agent reads the graph note first, then the code that the note points to.' },
        { text: 'It reads the test report of the last run and gives the result of the test', why: 'A test result is evidence for the rule. But the agent starts at the rule note.' }
      ] },
    { kind: 'choice', source: 'GE 07 §6', at: 'p7-the-checks',
      prompt: 'A check finds an old problem. A person examined it last month and accepted it as known. What is the result of the check for this finding?',
      hint: 'What does the baseline of known findings do?',
      options: [
        { text: 'KNOWN: the finding does not cause a FAIL result', correct: true, why: 'Only a new finding causes a FAIL result. With a baseline, the checks show only what changed.' },
        { text: 'FAIL: each finding causes a FAIL result until it is corrected', why: 'Then an old code base always gives FAIL, and the checks are not useful.' },
        { text: 'NEW: the check does not keep a list of findings', why: 'The check has a list of known findings: the baseline.' },
        { text: 'No result: the check does not report a known finding', why: 'The finding gets the result KNOWN. You can see it.' }
      ] },
    { kind: 'choice', source: 'GE 07 §3.3', at: 'p7-the-ontology-of-the-notes',
      prompt: 'A rule note has knowledge_class LEARNED and confidence Inferred. How must the agent use the claim of this note?',
      hint: 'Open the table of the status vocabularies. What do the two values mean?',
      options: [
        { text: 'As a claim from experience that is not verified', correct: true, why: 'LEARNED: no business owner gave approval for the claim. The agent reads the confidence and the status. It does not make a claim with no evidence.' },
        { text: 'As a verified fact, because each note in the graph passed the validator', why: 'The validator examines types, relations and targets. It does not verify a claim.' },
        { text: 'As a claim from an authoritative document, with strong evidence', why: 'That is knowledge_class AUTH and confidence Strong evidence.' },
        { text: 'As a note that the agent must not read', why: 'The values do not prevent a read. They say how sure the claim is.' }
      ] },
    { kind: 'choice', source: 'GE 06 §8', recall: 6, at: 'p6-what-stays-probabilistic',
      prompt: 'In the factory, which decisions stay with the model?',
      hint: 'The model can write and reason. The model cannot change the rules.',
      options: [
        { text: 'The text of the plan, the text of the code and the words of the review', correct: true, why: 'The model can write and reason. The model cannot change the rules.' },
        { text: 'The sequence of the steps and the maximum number of attempts', why: 'The structure makes these decisions.' },
        { text: 'Which values and types are valid, and what “complete” means', why: 'The ontology and the structure make these decisions.' },
        { text: 'If a person must give approval, and if the test results must be satisfactory', why: 'The structure makes these decisions.' }
      ] }
  ] };

  /* Part 8: four failures. Each story is an example by this edition; each cause comes from the notes. */
  var PARTS = [
    { key: 'c1', text: 'Control 1: the path is not in an execution graph' },
    { key: 'c2', text: 'Control 2: no ontology gives the permitted values and the shared meaning' },
    { key: 'c3', text: 'Control 3: no gate examines the result before the change' },
    { key: 'ip', text: 'The intelligence plane: the system does not keep what it learned' }
  ];
  function story(prompt, key, why, source, at) {
    return { kind: 'choice', fixed: true, prompt: prompt, source: source, at: at,
      hint: 'Ask three questions. Did the model select a path that code can select? Did a value or a meaning have no specification? Did a result cause a change with no check?',
      options: PARTS.map(function (p) { return { text: p.text, correct: p.key === key, why: p.key === key ? why : 'Read the story again: ' + why }; }) };
  }
  Q['8s'] = { title: 'Four failures: which part was absent?', questions: [
    story('The ontology has the rule “an order has one refund at most”. The refund tool has a schema, and each call has a correct shape. A second click makes a second refund on one order.', 'c3', 'The rule exists, but nothing examines the result against the rule and the current facts before the commit. That is Gate 2.', 'GE 04 §5', 'p4-the-two-gates'),
    story('The prompt says: “Get approval before you write code.” In three of ten runs, the agent writes the code with no approval.', 'c1', 'Approval is a sentence in a prompt. In a graph, approval is a node, and the run cannot go around it.', 'GE 02 §7', 'p2-how-a-graph-makes-a-system-predictable'),
    story('Two agents each make a report about “active customers”. The two numbers are different, because each agent uses its own definition of the term.', 'c2', 'Shared meaning: with one specification, all agents use the same definition of a term.', 'GE 04 §7 · GE 01 §2', 'p4-where-an-ontology-decreases-the-variation'),
    story('Each Monday, the agent finds the same defect pattern again and corrects it with much work. At the end of each agent session, it loses what it learned.', 'ip', 'The intelligence plane keeps what the system knows. A closeout step writes the knowledge to the graph for the next agent session.', 'GE 07 §1, §8', 'p7-what-the-structure-changes')
  ] };
})(window.GE);
