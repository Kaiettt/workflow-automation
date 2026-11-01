import {
  ExecutionStatus,
  NodeKeys,
} from '@app/execution/domain/constants/execution.constants';
import {
  build,
  jsonOf,
  trigger,
} from '@test/support/execution/start-execution.test-support';

const node = (id: string, key: string, name: string, config: unknown) => ({
  id,
  data: { key, name, config },
});
const edge = (source: string, target: string, handle?: string) => ({
  source,
  target,
  sourceHandle: handle ? `out:${handle}` : undefined,
});

const customer = (text: string) =>
  node('msg', NodeKeys.DATA_SET, 'Customer message', {
    fields: [{ name: 'text', value: text }],
  });

const rule = (id: string, label: string, word: string) => ({
  id,
  label,
  conditions: [
    { value1: '{{$json.text}}', operator: 'contains', value2: word },
  ],
});

// message -> Switch (price / human / fallback) -> one Edit Fields per branch.
function chatbot(text: string) {
  return {
    nodes: [
      trigger,
      customer(text),
      node('route', NodeKeys.LOGIC_SWITCH, 'Route', {
        rules: [rule('p', 'Price', 'giá'), rule('h', 'Human', 'nhân viên')],
      }),
      node('price', NodeKeys.DATA_SET, 'Price reply', {
        fields: [{ name: 'reply', value: 'Bảng giá ở đây ạ' }],
      }),
      node('human', NodeKeys.DATA_SET, 'Human reply', {
        fields: [{ name: 'reply', value: 'Mình chuyển cho nhân viên nhé' }],
      }),
      node('other', NodeKeys.DATA_SET, 'Other reply', {
        fields: [
          {
            name: 'reply',
            // Reads the message through the branch that was taken.
            value: 'Bạn nói: {{$node["Customer message"].json.text}}',
          },
        ],
      }),
    ],
    edges: [
      edge('trigger', 'msg'),
      edge('msg', 'route'),
      edge('route', 'price', 'rule_p'),
      edge('route', 'human', 'rule_h'),
      edge('route', 'other', 'fallback'),
    ],
  };
}

describe('chatbot flow with Switch and Edit Fields', () => {
  it.each([
    ['Cho xin BẢNG GIÁ', 'price', 'Bảng giá ở đây ạ'],
    ['Cho gặp NHÂN VIÊN', 'human', 'Mình chuyển cho nhân viên nhé'],
  ])('answers "%s" on the %s branch only', async (text, branch, reply) => {
    const { run } = build(chatbot(text));
    const result = await run();

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    const log = (id: string) => result.nodeLogs.find((l) => l.nodeId === id)!;
    expect(jsonOf(log(branch).output)).toEqual([{ text, reply }]);
    for (const other of ['price', 'human', 'other'].filter(
      (b) => b !== branch,
    )) {
      expect(log(other).status).toBe('SKIPPED');
    }
  });

  it('sends everything else to the fallback and reads earlier nodes through the branch', async () => {
    const { run } = build(chatbot('xin chào'));
    const result = await run();

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    const other = result.nodeLogs.find((l) => l.nodeId === 'other')!;
    expect(jsonOf(other.output)).toEqual([
      { text: 'xin chào', reply: 'Bạn nói: xin chào' },
    ]);
    expect(result.nodeLogs.find((l) => l.nodeId === 'price')!.status).toBe(
      'SKIPPED',
    );
  });

  it('fails the Switch with the reason when an expression is wrong', async () => {
    const definition = chatbot('hi');
    (definition.nodes[2].data.config as { rules: unknown[] }).rules = [
      rule('p', 'Price', '{{$node["Nope"].json.x}}'),
    ];
    const { run } = build(definition);
    const result = await run();

    expect(result.status).toBe(ExecutionStatus.FAILED);
    const route = result.nodeLogs.find((l) => l.nodeId === 'route')!;
    expect(route.errorMessage).toContain('rules[0].conditions[0].value2');
  });

  it('runs an IF on the true and false branches', async () => {
    const definition = {
      nodes: [
        trigger,
        customer('hi'),
        node('check', NodeKeys.LOGIC_IF, 'Is greeting', {
          conditions: [
            { value1: '{{$json.text}}', operator: 'equals', value2: 'HI' },
          ],
        }),
        node('yes', NodeKeys.DATA_SET, 'Yes', {
          fields: [{ name: 'answer', value: 'greeting' }],
        }),
        node('no', NodeKeys.DATA_SET, 'No', {
          fields: [{ name: 'answer', value: 'other' }],
        }),
      ],
      edges: [
        edge('trigger', 'msg'),
        edge('msg', 'check'),
        edge('check', 'yes', 'true'),
        edge('check', 'no', 'false'),
      ],
    };
    const result = await build(definition).run();

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    const log = (id: string) => result.nodeLogs.find((l) => l.nodeId === id)!;
    expect(jsonOf(log('yes').output)).toEqual([
      { text: 'hi', answer: 'greeting' },
    ]);
    expect(log('no').status).toBe('SKIPPED');
  });
});
