/* ontology.js: the game store ontology of GE 06, as data and as checks.
   This is the JavaScript version of the Python examples in GE 04 (sections 5 and 10).
   Each check gives a list of problems. An empty list is PASS. */
(function (GE) {
  'use strict';
  var O = GE.onto = {};

  O.STATUS = ['CART', 'PAID', 'FULFILLED', 'REFUNDED', 'CANCELLED']; // rule R1
  O.TRANSITIONS = {                                                   // rule R7
    CART: ['PAID', 'CANCELLED'], PAID: ['FULFILLED', 'REFUNDED'], FULFILLED: ['REFUNDED'], REFUNDED: [], CANCELLED: []
  };
  O.CLASSES = ['Customer', 'StaffMember', 'Order', 'OrderLine', 'Game', 'Payment', 'Refund'];
  O.DISJOINT = [['Customer', 'StaffMember']];                        // rule R4
  O.RULES = {
    R1: { text: 'The status of an order is one of five values', kind: 'Enumeration' },
    R2: { text: 'An order has one refund at most', kind: 'Cardinality' },
    R3: { text: 'A refund pays the customer who placed the order', kind: 'Typed relation' },
    R4: { text: 'A customer is not a staff member', kind: 'Disjoint classes' },
    R5: { text: 'The amount of a refund is not more than the amount of the payment', kind: 'Value constraint' },
    R6: { text: 'A price is not negative', kind: 'Value constraint' },
    R7: { text: 'The status changes only along a permitted transition', kind: 'State transition' },
    R8: { text: 'A refund is possible only for an order that has a payment', kind: 'Cardinality' }
  };
  /* Relations of the domain: name -> [type of the subject, type of the object]. */
  O.RELATIONS = {
    'places': ['Customer', 'Order'],
    'contains': ['Order', 'OrderLine'],
    'is for': ['OrderLine', 'Game'],
    'is refunded by': ['Order', 'Refund'],
    'pays': ['Refund', 'Customer']
  };

  function problem(rule, text) { return { rule: rule, text: text }; }
  O.problem = problem;

  /** GE 04, section 10: validate_status. */
  O.validateStatus = function (value) {
    var status = String(value).trim().toUpperCase().replace(/ /g, '_');
    if (O.STATUS.indexOf(status) >= 0) return { ok: true, status: status, line: 'PASS  ' + status };
    return { ok: false, status: null, line: 'FAIL  ' + JSON.stringify(String(value)) + ' is not in the ontology. Permitted: ' + O.STATUS.slice().sort().join(', ') };
  };

  /** Gate 1 (GE 04, section 5): the shape of the call. It reads only the call. */
  O.CALL_FIELDS = ['order_id', 'amount_cents', 'payee_id', 'new_status'];
  O.gate1 = function (call) {
    var problems = [];
    Object.keys(call).forEach(function (k) {
      if (O.CALL_FIELDS.indexOf(k) < 0) problems.push(problem('shape', k + ': extra fields are not permitted.'));
    });
    ['order_id', 'amount_cents', 'payee_id'].forEach(function (k) {
      var v = call[k];
      if (v === undefined || v === null || v === '') problems.push(problem('shape', k + ': the field is necessary.'));
      else if (typeof v !== 'number' || !Number.isInteger(v)) problems.push(problem('shape', k + ': the value must be an integer. The call has ' + JSON.stringify(v) + '.'));
      else if (v <= 0) problems.push(problem('shape', k + ': the value must be more than 0.'));
    });
    if (typeof call.new_status !== 'string' || !call.new_status) problems.push(problem('shape', 'new_status: the value must be text.'));
    return problems;
  };

  /** Gate 2: the sense of the result. It reads the call, the ontology and the current facts. */
  O.gate2 = function (world, call) {
    var problems = [];
    var order = world.orders[call.order_id];
    if (!order) return [problem('facts', 'Order ' + call.order_id + ' is not in the facts.')];
    var known = O.STATUS.indexOf(call.new_status) >= 0;
    if (!known) problems.push(problem('R1', 'Status ' + call.new_status + ' is not in the ontology.'));
    else if (call.new_status !== order.status && O.TRANSITIONS[order.status].indexOf(call.new_status) < 0) problems.push(problem('R7', 'The change from ' + order.status + ' to ' + call.new_status + ' is not a permitted transition.'));
    if (known && call.new_status !== 'REFUNDED') problems.push(problem('tool', 'This tool makes a refund. The new status of the order must be REFUNDED. (A check of this edition.)'));
    if (order.refund_count >= 1) problems.push(problem('R2', 'An order can have only one refund.'));
    if (!order.payment_cents) problems.push(problem('R8', 'The order has no payment. A refund is not possible.'));
    else if (call.amount_cents > order.payment_cents) problems.push(problem('R5', 'The amount is more than the payment of ' + order.payment_cents + ' cents.'));
    var payee = world.people[call.payee_id];
    if (!payee) problems.push(problem('facts', 'Person ' + call.payee_id + ' is not in the facts.'));
    else if (call.payee_id !== order.customer_id) problems.push(problem('R3', 'The payee must be the customer who placed the order. ' + payee.name + ' is a ' + (payee.cls === 'StaffMember' ? 'staff member' : 'different customer') + '.'));
    return problems;
  };

  /** The only step with a side effect. Call it only after gate 2 gives no problems. */
  O.commit = function (world, call) {
    var order = world.orders[call.order_id];
    order.status = call.new_status;
    order.refund_count += 1;
  };

  O.newWorld = function () {
    return {
      orders: {
        1042: { status: 'PAID', customer_id: 7, payment_cents: 40000, refund_count: 0 },
        1043: { status: 'CART', customer_id: 12, payment_cents: 0, refund_count: 0 }
      },
      people: { 7: { name: 'Thandi', cls: 'Customer' }, 12: { name: 'Lerato', cls: 'Customer' }, 31: { name: 'Sipho', cls: 'StaffMember' } }
    };
  };

  /** The plan gate of the factory (GE 06, node 4). It reads the typed fields of a plan. */
  O.planGate = function (plan) {
    var problems = [];
    (plan.entities || []).forEach(function (e) {
      if (O.CLASSES.indexOf(e) < 0) problems.push(problem('ontology', 'The entity ' + e + ' is not in the ontology.'));
    });
    (plan.statuses || []).forEach(function (st) {
      if (O.STATUS.indexOf(st) < 0) problems.push(problem('R1', 'The status ' + st + ' is not in rule R1.'));
    });
    return problems;
  };

  /* ---- The fact workbench (chapter 4): a small knowledge graph that obeys the ontology. ---- */
  O.newFacts = function () {
    return {
      types: { 'Thandi': 'Customer', 'Lerato': 'Customer', 'Sipho': 'StaffMember', 'Order 1042': 'Order', 'Order 1043': 'Order', 'Line 1': 'OrderLine', 'Star Harbour': 'Game', 'Refund A': 'Refund', 'Refund B': 'Refund' },
      status: { 'Order 1042': 'PAID', 'Order 1043': 'CART' },
      paid: { 'Order 1042': true, 'Order 1043': false },
      triples: [['Thandi', 'places', 'Order 1042'], ['Order 1042', 'contains', 'Line 1'], ['Line 1', 'is for', 'Star Harbour'], ['Lerato', 'places', 'Order 1043']]
    };
  };
  function has(facts, s, r, o) {
    return facts.triples.some(function (t) { return t[0] === s && t[1] === r && (o === undefined || t[2] === o); });
  }
  /** Try to add one fact. Gives {problems, note}. With no problems, the fact is added. */
  O.assertFact = function (facts, subject, relation, object) {
    var problems = [], note = '';
    var st = facts.types[subject];
    if (relation === 'is a') {
      O.DISJOINT.forEach(function (pair) {
        if ((pair[0] === st && pair[1] === object) || (pair[1] === st && pair[0] === object)) problems.push(problem('R4', subject + ' is a ' + st + '. A ' + pair[0] + ' is not a ' + pair[1] + '.'));
      });
      if (!problems.length && st !== object) problems.push(problem('type', subject + ' is a ' + st + '. The ontology gives no relation between ' + st + ' and ' + object + '.'));
      if (!problems.length) note = 'The graph has this fact already.';
      return { problems: problems, note: note };
    }
    if (relation === 'has status') {
      if (st !== 'Order') return { problems: [problem('type', 'Only an Order has a status. ' + subject + ' is a ' + st + '.')], note: '' };
      var checked = O.validateStatus(object);
      var current = facts.status[subject];
      if (!checked.ok) problems.push(problem('R1', 'The status "' + object + '" is not in the ontology.'));
      else if (checked.status === current) note = 'The graph has this fact already.';
      else if (O.TRANSITIONS[current].indexOf(checked.status) < 0) problems.push(problem('R7', 'The change from ' + current + ' to ' + checked.status + ' is not a permitted transition.'));
      else if (checked.status === 'REFUNDED' && !facts.paid[subject]) problems.push(problem('R8', 'The order has no payment.'));
      if (!problems.length && !note) { facts.status[subject] = checked.status; note = 'The status of ' + subject + ' is now ' + checked.status + '.'; }
      return { problems: problems, note: note };
    }
    var sig = O.RELATIONS[relation];
    var ot = facts.types[object];
    if (st !== sig[0]) problems.push(problem(relation === 'pays' ? 'R3' : 'type', 'The relation "' + relation + '" starts at a ' + sig[0] + '. ' + subject + ' is a ' + st + '.'));
    if (ot !== sig[1]) problems.push(problem(relation === 'pays' ? 'R3' : 'type', 'The relation "' + relation + '" goes to a ' + sig[1] + '. ' + object + ' is a ' + ot + '.'));
    if (problems.length) return { problems: problems, note: '' };
    if (has(facts, subject, relation, object)) return { problems: [], note: 'The graph has this fact already.' };
    if (relation === 'is refunded by') {
      if (has(facts, subject, relation)) problems.push(problem('R2', subject + ' has a refund already. One refund is the maximum.'));
      if (!facts.paid[subject]) problems.push(problem('R8', subject + ' has no payment.'));
    }
    if (relation === 'pays') {
      var order = facts.triples.filter(function (t) { return t[1] === 'is refunded by' && t[2] === subject; })[0];
      if (order && !has(facts, object, 'places', order[0])) problems.push(problem('R3', object + ' did not place ' + order[0] + '. The refund pays the customer who placed the order.'));
      if (has(facts, subject, 'pays')) problems.push(problem('cardinality', subject + ' pays one customer only.'));
    }
    if (relation === 'places' && facts.triples.some(function (t) { return t[1] === 'places' && t[2] === object; })) {
      problems.push(problem('cardinality', object + ' has a customer already. One customer places an order.'));
    }
    if (!problems.length) facts.triples.push([subject, relation, object]);
    return { problems: problems, note: '' };
  };

  /* ---- The note graph of the case study (GE 07): node types, relation types, status values. ---- */
  O.NOTE = {
    prefixes: { BR: 'business_rule', REQ: 'requirement', CODE: 'code', PAGE: 'page', TASK: 'task', TEST: 'test', DEC: 'decision', UQ: 'open_question', AUD: 'finding', DEF: 'defect', LES: 'lesson' },
    /* relation -> permitted target types (from the diagram in GE 07, section 3.2) */
    relations: {
      specified_by: ['requirement'], implemented_by: ['code'], rendered_in: ['page'], executed_by: ['task'],
      validated_by: ['test'], decided_by: ['decision'], evidenced_by: ['finding', 'defect'], concerns: ['page'],
      depends_on: ['open_question', 'finding', 'business_rule']
    },
    knowledge_class: ['AUTH', 'OBS', 'LEARNED'],
    confidence: ['Verified', 'Strong evidence', 'Inferred', 'Unresolved'],
    audit_status: ['verified', 'partial', 'unclear', 'conflicting', 'missing', 'superseded']
  };
  /** The graph validator: types, relations, targets. `known` is the list of node identifiers. */
  O.validateNote = function (note, known) {
    var problems = [], N = O.NOTE;
    if (N.knowledge_class.indexOf(note.knowledge_class) < 0) problems.push(problem('knowledge_class', '"' + note.knowledge_class + '" is not a permitted value. Permitted: ' + N.knowledge_class.join(', ') + '.'));
    if (N.confidence.indexOf(note.confidence) < 0) problems.push(problem('confidence', '"' + note.confidence + '" is not a permitted value. Permitted: ' + N.confidence.join(', ') + '.'));
    (note.relations || []).forEach(function (text) {
      var parts = String(text).split('|');
      if (parts.length !== 2 || !parts[0] || !parts[1]) { problems.push(problem('relation', '"' + text + '" does not have the two parts "relation_type|TARGET-ID".')); return; }
      var rel = parts[0].trim(), target = parts[1].trim();
      var targets = N.relations[rel];
      if (!targets) { problems.push(problem('relation', '"' + rel + '" is not one of the nine relation types.')); return; }
      var type = N.prefixes[target.split('-')[0]];
      if (!type) problems.push(problem('target', '"' + target + '" has no known prefix.'));
      else if (targets.indexOf(type) < 0) problems.push(problem('target', '"' + rel + '" cannot point to a ' + (type === 'code' ? 'code unit' : type.replace('_', ' ')) + '. Permitted target: ' + targets.join(', ').replace(/_/g, ' ') + '.'));
      else if (known && known.indexOf(target) < 0) problems.push(problem('target', 'The graph has no node "' + target + '".'));
    });
    return problems;
  };
})(window.GE);
