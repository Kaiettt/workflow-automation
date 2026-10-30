import {
  ExecutionStatus,
  NodeKeys,
} from '@app/execution/domain/constants/execution.constants';
import { ChatMemoryExecutor } from '@app/execution/application/executors/chat-memory-executor';
import {
  build,
  chain,
  FakeChatMemory,
  llmNode,
  llmText,
  trigger,
} from '@test/support/execution/start-execution.test-support';

const WORKFLOW = 'workflow-1';
const context = { workflowId: WORKFLOW, executionId: 'execution-1' };

describe('ChatMemoryExecutor', () => {
  const setup = () => {
    const memory = new FakeChatMemory();
    const executor = new ChatMemoryExecutor(memory);
    const run = (config: Record<string, unknown>, json = { text: 'hi' }) =>
      executor.executeItem({
        config: executor.parseConfig({ session_key: 'cust-1', ...config }),
        item: { json },
        credential: null,
        context,
      });
    return { memory, run };
  };

  it('saves a turn and loads it back with the item data', async () => {
    const { run } = setup();
    await run({
      mode: 'save',
      user_message: 'Giá bao nhiêu?',
      assistant_message: 'Dạ 100k',
    });

    expect(await run({ mode: 'load' })).toEqual({
      text: 'hi',
      history: [
        { role: 'user', content: 'Giá bao nhiêu?' },
        { role: 'assistant', content: 'Dạ 100k' },
      ],
      history_text: 'Khách: Giá bao nhiêu?\nBot: Dạ 100k',
    });
  });

  it('loads only the last turns asked for, and an empty history when nothing was saved', async () => {
    const { run } = setup();
    expect(await run({ mode: 'load' })).toMatchObject({
      history: [],
      history_text: '',
    });
    for (const n of [1, 2, 3]) {
      await run({
        mode: 'save',
        user_message: `q${n}`,
        assistant_message: `a${n}`,
      });
    }
    const loaded = (await run({ mode: 'load', window: 2 })) as {
      history: Array<{ content: string }>;
    };
    expect(loaded.history.map((m) => m.content)).toEqual([
      'q2',
      'a2',
      'q3',
      'a3',
    ]);
  });

  it('keeps conversations of other sessions and workflows apart', async () => {
    const { memory, run } = setup();
    await run({ mode: 'save', user_message: 'mine', assistant_message: 'ok' });
    expect(await memory.load(WORKFLOW, 'cust-2', 10)).toEqual([]);
    expect(await memory.load('other-workflow', 'cust-1', 10)).toEqual([]);
  });

  it('forgets a conversation', async () => {
    const { run } = setup();
    await run({ mode: 'save', user_message: 'q', assistant_message: 'a' });
    await run({ mode: 'clear' });
    expect(await run({ mode: 'load' })).toMatchObject({ history: [] });
  });

  it('leaves out a blank message and does not store an empty turn', async () => {
    const { memory, run } = setup();
    await run({ mode: 'save', user_message: 'q', assistant_message: '  ' });
    expect(await memory.load(WORKFLOW, 'cust-1', 10)).toEqual([
      { role: 'user', content: 'q' },
    ]);
    await run({ mode: 'save', user_message: '', assistant_message: '' });
    expect(await memory.load(WORKFLOW, 'cust-1', 10)).toHaveLength(1);
  });

  it('keeps at most 50 messages and remembers for the configured days', async () => {
    const { memory, run } = setup();
    for (let n = 0; n < 30; n += 1) {
      await run({
        mode: 'save',
        user_message: `q${n}`,
        assistant_message: `a${n}`,
        ttl_days: 2,
      });
    }
    const kept = await memory.load(WORKFLOW, 'cust-1', 100);
    expect(kept).toHaveLength(50);
    expect(kept[0].content).toBe('q5');
    expect(memory.lastTtlSeconds).toBe(2 * 24 * 60 * 60);
  });

  it('turns a numeric session key into text and rejects a blank one', () => {
    const executor = new ChatMemoryExecutor(new FakeChatMemory());
    expect(executor.parseConfig({ session_key: 42 }).session_key).toBe('42');
    expect(() => executor.parseConfig({ session_key: '  ' })).toThrow(
      /needs a session key/,
    );
    expect(() => executor.parseConfig({})).toThrow();
  });

  it('refuses to run without a workflow', async () => {
    const executor = new ChatMemoryExecutor(new FakeChatMemory());
    await expect(
      executor.executeItem({
        config: executor.parseConfig({ session_key: 'x' }),
        item: { json: {} },
        credential: null,
      }),
    ).rejects.toThrow(/needs a workflow/);
  });
});

const named = (id: string, key: string, name: string, config: unknown) => ({
  id,
  data: { key, name, config },
});

// customer message -> load history -> LLM -> save the turn.
function botFlow(text: string, session = 'cust-1') {
  return chain([
    trigger,
    named('msg', NodeKeys.DATA_SET, 'Customer message', {
      fields: [{ name: 'text', value: text }],
    }),
    named('load', NodeKeys.MEMORY_CHAT, 'Load history', {
      mode: 'load',
      session_key: session,
    }),
    llmNode({
      prompt: '{{$json.text}}',
      history: '{{$json.history}}',
    }),
    named('save', NodeKeys.MEMORY_CHAT, 'Save turn', {
      mode: 'save',
      session_key: session,
      user_message: '{{$node["Customer message"].json.text}}',
      assistant_message: '{{$node["Ask AI"].json.text}}',
    }),
  ]);
}

describe('a bot that remembers the conversation', () => {
  it('gives the LLM what was said before in the next run', async () => {
    const memory = new FakeChatMemory();

    const first = build(botFlow('Giá bao nhiêu?'), {
      memory,
      llmReplies: [llmText('Dạ 100k')],
    });
    expect((await first.run()).status).toBe(ExecutionStatus.SUCCESS);
    expect(first.llm.requests[0].history).toEqual([]);

    const second = build(botFlow('Còn màu nào?'), {
      memory,
      llmReplies: [llmText('Đen và trắng')],
    });
    const result = await second.run();

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(second.llm.requests[0].prompt).toBe('Còn màu nào?');
    expect(second.llm.requests[0].history).toEqual([
      { role: 'user', content: 'Giá bao nhiêu?' },
      { role: 'assistant', content: 'Dạ 100k' },
    ]);
    expect(await memory.load('workflow-1', 'cust-1', 10)).toHaveLength(4);
  });

  it('does not show one customer the conversation of another', async () => {
    const memory = new FakeChatMemory();
    await build(botFlow('Giá bao nhiêu?', 'alice'), { memory }).run();

    const bob = build(botFlow('Xin chào', 'bob'), { memory });
    await bob.run();

    expect(bob.llm.requests[0].history).toEqual([]);
  });

  it('fails the LLM node when history is not a list of messages', async () => {
    const flow = botFlow('hi');
    (flow.nodes[3].data.config as Record<string, unknown>).history =
      '{{$json.text}}';
    const result = await build(flow, { memory: new FakeChatMemory() }).run();

    expect(result.status).toBe(ExecutionStatus.FAILED);
    const log = result.nodeLogs.find((l) => l.nodeId === 'llm')!;
    expect(log.status).toBe(ExecutionStatus.FAILED);
  });
});
