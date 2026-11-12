/* reference.js: the data of the reference shelf. All of it comes from GE 08, GE 01 section 6 and GE 00. */
(function (GE) {
  'use strict';
  var R = GE.data.reference = {};

  /* [term, meaning, chapter where the term is taught] */
  R.glossary = [
    ['Agent', 'A model that uses tools in a loop until a task is complete', '1'],
    ['Agent step', 'A node that contains a full agent', '2'],
    ['Cardinality', 'The number of items that a relation can have: one, or many', '4'],
    ['Checkpoint', 'A recorded copy of the state at the end of a node', '2'],
    ['Closeout', 'The last step of an agent session. It updates the memory and the registers.', '7'],
    ['Conditional edge', 'An edge where a function or a model selects the next node', '2'],
    ['Constraint', 'A rule that a value or a relation must obey', '4'],
    ['Context graph', 'A graph of what occurred in one run: steps, tool calls, records. It is not the context window.', '3'],
    ['Control plane', 'The layer that manages identity, tool permissions, policies and the audit trail', '5'],
    ['Data plane', 'The agent runtime: the model calls and the tool calls', '5'],
    ['Edge', 'A connection that selects the next node in an execution graph', '2'],
    ['Execution graph', 'The permanent design of nodes and edges in which a system operates', '2'],
    ['Fan-out and fan-in', 'One node starts two or more nodes at the same time. The branches connect again at one node.', '2'],
    ['Fixed step', 'A node that contains only code', '2'],
    ['Gate', 'The point where a check accepts or rejects a result before the next step', '4'],
    ['GraphRAG', 'Retrieval that uses a knowledge graph. It is about data, not about control.', '3'],
    ['Harness', 'The code around a model: the tools, the memory, the skills and the files', '1'],
    ['Intelligence plane', 'The layer that keeps what the system knows, and that makes the system better', '5'],
    ['Knowledge graph', 'The facts about a domain. The graph keeps them as entities and relations.', '3'],
    ['Loop', 'A cycle that continues until a stop condition is correct', '2'],
    ['Model step', 'A node that contains one model call with no tools', '2'],
    ['Neurosymbolic AI', 'AI that combines a neural model with symbolic rules', '4'],
    ['Node', 'One unit of work in an execution graph. In a knowledge graph, one entity.', '2'],
    ['Ontology', 'A formal, shared specification of the types, relations and rules of a domain', '4'],
    ['Procedural graph', 'The permitted paths of a task. A harness loads it as data.', '3'],
    ['Reasoner', 'A program that infers new facts from the rules of an ontology', '4'],
    ['Register', 'A list of items of one type, for example decisions or lessons', '7'],
    ['Semantic layer', 'The exact definitions of the business terms and metrics', '5'],
    ['Skill', 'A text file with instructions for one type of task', '3'],
    ['Software factory', 'A workflow, with agents, that you can do again and again to make software', '6'],
    ['State', 'The data that moves from node to node', '2'],
    ['System intelligence', 'What a system of agents can do when it has explicit structure', '1'],
    ['Trace', 'The record of one run', '3'],
    ['Validator', 'The function that a gate uses to examine a result', '4'],
    ['Verifier', 'A node that examines the work of a different node. Other names in the sources: grader, evaluator, reviewer.', '2']
  ];

  /* [incorrect idea, correct idea] from GE 08, section 2 */
  R.ideas = [
    ['Graph Engineering makes the model deterministic.', 'The model stays probabilistic. The permitted paths, the values and the checks become fixed.'],
    ['Temperature zero is sufficient.', 'A hosted model can give a different output with temperature zero. One different token changes each step that comes after it.'],
    ['Structured output is sufficient.', 'A schema controls the shape and the list of values. It does not know the current facts, for example a refund that is in the database.'],
    ['This is only a workflow engine.', 'The structure is the same. The difference is that some nodes contain a model or an agent.'],
    ['Graph Engineering is GraphRAG.', 'GraphRAG is about data. An execution graph is about control.'],
    ['More agents give a better result.', 'More agents give more cost and more points of failure. Add a node only for a specific cause.'],
    ['A graph replaces the loop.', 'A loop is one shape of a graph. A loop is frequently one node in a larger graph.'],
    ['An ontology is a large academic project.', 'A first ontology is two or three enumerations and three rules in code.'],
    ['A good prompt is sufficient for a business rule.', 'A prompt is a suggestion. A gate is a constraint.'],
    ['If the search finds the record, the answer is correct.', 'Retrieval and interpretation are different. Do one test for each.']
  ];

  R.checklist = [
    ['Before you make a graph', [
      'One loop with a strict verifier is not sufficient. You can say why.',
      'Each node has one responsibility. You can write it in one sentence with no “and”.',
      'Each node has a cause: specialization, parallel work, or independent verification.']],
    ['Nodes and edges', [
      'Each step that code can do is code.',
      'Each rule about approval, cost or safety is a node or an edge, not a sentence in a prompt.',
      'The node that examines the work did not write the work.',
      'Each cycle has a maximum number of attempts.',
      'Each conditional edge records its decision.']],
    ['State', [
      'Each field has a type.', 'Each field has one owner.',
      'Each field that parallel branches write has a merge rule.',
      'The run records a checkpoint at the end of each node.',
      'Each node with a side effect is safe to do two times.']],
    ['Ontology', [
      'Each field with a fixed list of values is an enumeration.',
      'Each relation has a direction and a list of permitted target types.',
      'Each of the three errors with the highest cost has a rule.',
      'Gate 1 examines the shape of each tool call.',
      'Gate 2 examines the sense of each result before a change to data.',
      'The agent changes only an isolated copy during the loop, for example a branch. Code commits the result after the gate.']],
    ['Intelligence plane', [
      'The domain terms have written definitions.',
      'Each claim has a source and a confidence value.',
      'The agent has only the permissions that are necessary for the task, and not more than the user has.',
      'Each run writes a trace.',
      'A person examines the traces at a fixed interval.']]
  ];

  /* GE 01, section 6. [level, method, analogy in the paper, what you control, if the level is absent] */
  R.ladder = [
    [1, 'Foundation model', 'An examination with no book', 'What the model knows', null],
    [2, 'Prompt Engineering', 'Better instructions', 'The words of the request', 'The model answers a question that you did not ask'],
    [3, 'Context Engineering', 'An examination with a book', 'The information that the model gets', 'The model reasons correctly about the incorrect material'],
    [4, 'Harness Engineering', 'You can use tools', 'Tools, memory, skills, external knowledge', 'The model cannot change anything outside the chat window'],
    [5, 'Loop Engineering', 'Send, get feedback, try again', 'The cycle that continues until the task is complete', 'The agent stops too soon, or it does not stop'],
    [6, 'Graph Engineering', 'A team does the examination', 'The structure of the tasks, the agents and the runtime state', 'One agent tries to do the work of four agents'],
    [7, 'Ontology Engineering', 'One handbook for the team', 'The shared meaning of terms and rules', null]
  ];

  /* GE 00, Sources. [title, url, author and publisher, what it gives] */
  R.sources = [
    ['Everyone Has the Same AI Models. Here’s What Sets Agents Apart', 'https://youtu.be/1_lX0m64-aI', 'Richmond Alake, Oracle (AI Engineer talk)', 'The intelligence plane, memory, the governed agent demonstration', 'alake'],
    ['Make Your AI Agents Predictable With Graph Engineering', 'https://youtu.be/g_NgCLTibiM', 'Zachary Blumenfeld, Neo4j (AI Engineer talk)', 'Three types of graph, skills with the shape of a graph, the loan example', 'blumenfeld'],
    ['Graph Engineering in the Era of LLM Agents: From Individual Intelligence to System Intelligence', 'https://arxiv.org/abs/2608.21156', 'Feng, Xiang, Yang and 32 others, arXiv 2608.21156, 2026', 'The engineering ladder, the three views, Ontology Engineering', 'feng'],
    ['Why Agentic Systems Need Ontologies', 'https://www.youtube.com/watch?v=Sir59K8ZDPU', 'Frank Coyle, UC Berkeley (AI Engineer World’s Fair)', 'Ontology basics, RDFS and OWL, the two gates', 'coyle'],
    ['3 Years of Graph Engineering with LangGraph', 'https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph', 'Runkle and Chase, LangChain, 2026', 'Nodes and edges, when not to use a graph', 'langgraph'],
    ['The Art of Loop Engineering', 'https://www.langchain.com/blog/the-art-of-loop-engineering', 'Runkle, LangChain, 2026', 'The four loops', 'loops'],
    ['What Is Graph Engineering? Definition and Patterns', 'https://www.puppygraph.com/learn/graph-engineering', 'Sa Wang, PuppyGraph, 2026', 'Shapes, failure modes, the enforced ontology', 'puppygraph'],
    ['What is Graph Engineering? A Hands-On Guide to Multi-Agent Orchestration With LangGraph', 'https://www.datacamp.com/tutorial/graph-engineering-guide', 'Josep Ferrer, DataCamp, 2026', 'The loop or graph decision table, the ladder, LangGraph code', 'datacamp'],
    ['Vectors and graphs: Better together', 'https://neo4j.com/blog/developer/vectors-graphs-better-together/', 'Roie Schwaber-Cohen (Pinecone), Neo4j Developer Blog, 2024', 'Vector search with a graph, ontology from metadata', 'neo4j-pinecone'],,
    /* Added by the evidence pass (2026-11-13): primary sources for claims that the notes cite second-hand,
       and the research behind the design of the instruments. Each DOI and URL was checked on 2026-11-13; EVIDENCE.md gives the status of each. */
    ['Code Generation with AlphaCodium: From Prompt Engineering to Flow Engineering', 'https://arxiv.org/abs/2401.08500', 'Ridnik, Kredo and Friedman, arXiv:2401.08500, 2024', 'Primary source: GPT-4, 19% to 44%, pass@5 on the CodeContests validation set', 'alphacodium'],
    ['How we built our multi-agent research system', 'https://www.anthropic.com/engineering/multi-agent-research-system', 'Hadfield et al., Anthropic Engineering, 13 June 2025', 'Primary source: 90.2% better on an internal research evaluation; about 15 times the tokens of a chat', 'anthropic-multi'],
    ['Defeating Nondeterminism in LLM Inference', 'https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/', 'Horace He, Thinking Machines Lab, 10 September 2025', 'Why a server can give different outputs at temperature zero: batch size changes with load', 'he-nondeterminism'],
    ['An Empirical Study of the Non-determinism of ChatGPT in Code Generation', 'https://doi.org/10.1145/3697010', 'Ouyang, Zhang, Harman and Wang, ACM TOSEM 34(2), 2025', 'Measurement: temperature zero did not make the code output deterministic', 'ouyang-nondeterminism'],
    ['The Battle of Midway', 'https://media.defense.gov/2021/Jul/13/2002761541/-1/-1/0/BATTLE-MIDWAY.PDF', 'NSA Center for Cryptologic History', 'The “AF is short of water” message that confirmed AF meant Midway', 'nsa-midway'],
    ['The software factory: a historical interpretation', 'https://doi.org/10.1109/MS.1989.1430446', 'Michael A. Cusumano, IEEE Software 6(2), 1989', 'Bemer at GE proposed a “software factory” in 1968; it was a proposal, not a factory that GE built', 'cusumano'],
    ['RDF Schema 1.1', 'https://www.w3.org/TR/rdf-schema/', 'W3C Recommendation, 25 February 2014', 'Classes, properties, domain and range', 'w3c-rdfs'],
    ['OWL 2 Web Ontology Language Document Overview (Second Edition)', 'https://www.w3.org/TR/owl2-overview/', 'W3C Recommendation, 11 December 2012', 'OWL and its open-world reading', 'w3c-owl'],
    ['Shapes Constraint Language (SHACL)', 'https://www.w3.org/TR/shacl/', 'W3C Recommendation, 20 July 2017', 'Validation of a graph against shapes: closed checks', 'w3c-shacl'],
    ['The use of worked examples as a substitute for problem solving in learning algebra', 'https://doi.org/10.1207/s1532690xci0201_3', 'Sweller and Cooper, Cognition and Instruction 2(1), 59–89, 1985', 'Design of this course: worked examples before problems', 'sweller-cooper'],
    ['Structuring the transition from example study to problem solving in cognitive skill acquisition', 'https://doi.org/10.1207/S15326985EP3801_3', 'Renkl and Atkinson, Educational Psychologist 38(1), 15–22, 2003', 'Design of this course: fewer hints as you continue (fading)', 'renkl-atkinson'],
    ['The expertise reversal effect', 'https://doi.org/10.1207/S15326985EP3801_4', 'Kalyuga, Ayres, Chandler and Sweller, Educational Psychologist 38(1), 23–31, 2003', 'Design of this course: help that is good for a beginner can slow an expert, so hints are optional', 'kalyuga'],
    ['Test-enhanced learning: Taking memory tests improves long-term retention', 'https://doi.org/10.1111/j.1467-9280.2006.01693.x', 'Roediger and Karpicke, Psychological Science 17(3), 249–255, 2006', 'Design of this course: the gates and the recall questions', 'roediger-karpicke'],
    ['The pretesting effect: Do unsuccessful retrieval attempts enhance learning?', 'https://doi.org/10.1037/a0016496', 'Richland, Kornell and Kao, J. Exp. Psychology: Applied 15(3), 243–257, 2009', 'Design of this course: an estimate before the explanation, even if it is wrong', 'richland'],
    ['Self-explanations: How students study and use examples in learning to solve problems', 'https://doi.org/10.1207/s15516709cog1302_1', 'Chi, Bassok, Lewis, Reimann and Glaser, Cognitive Science 13(2), 1989', 'Design of this course: “Can you say why?” after a correct answer', 'chi']
  ];

  /* GE 08, section 7 and section 9 */
  R.giveBack = [
    ['Why does a graph make a run more predictable?', 'Code selects the path. The model makes a smaller number of decisions. Each decision is a point where the result can change.'],
    ['Why does an ontology decrease the variation?', 'It gives the permitted types, values and rules. A gate rejects a result that is not permitted.'],
    ['Why are two gates necessary?', 'Gate 1 reads only the call. Gate 2 reads the result and the current facts. Some rules must have the current facts.'],
    ['What is the intelligence plane?', 'The layer that keeps what the system knows. It supplies the rules and the facts for the three controls.']
  ];
  R.sixSentences = [
    'A model gives a probability, and an agent makes many decisions.',
    'In a graph, code selects the path. The model reasons only in a node.',
    'The word “graph” has four meanings in these notes: execution, knowledge, context and procedure.',
    'An ontology gives the permitted types, values and rules.',
    'A gate rejects an incorrect result before it causes a change.',
    'The intelligence plane keeps what the system knows and uses each run to make the system better.'
  ];
})(window.GE);
