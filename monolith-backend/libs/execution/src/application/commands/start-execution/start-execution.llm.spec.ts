import {
  ExecutionStatus,
  NodeKeys,
} from '../../../domain/constants/execution.constants';
import { LlmProviderError } from '../../ports/llm-provider.port';
import {
  aggregateNode,
  build,
  chain,
  decode,
  filterNode,
  gmailNode,
  jsonOf,
  llmNode,
  llmText,
  LLM_API_KEY,
  logOf,
  sheetNode,
  trigger,
} from './start-execution.test-support';

const NAME = NodeKeys.AI_LLM_GENERATE;

describe('StartExecutionHandler with an LLM node', () => {
  describe('workflows built from the node', () => {
    it('(a) writes something different for every row and sends it to the right person', async () => {
      const { run, send, llm } = build(
        chain([
          trigger,
          sheetNode,
          filterNode(),
          llmNode({
            prompt:
              'Write a reminder for {{$json.name}} (status {{$json.status}})',
          }),
          gmailNode({
            to: '{{$node["Read Customers"].json.email}}',
            subject: 'Reminder',
            body: '{{$json.text}}',
          }),
        ]),
        { llmReplies: [llmText('Dear Kiet, ...'), llmText('Dear Minh, ...')] },
      );
      const result = await run();

      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests.map((r) => r.prompt)).toEqual([
        'Write a reminder for Kiet (status new)',
        'Write a reminder for Minh (status new)',
      ]);
      expect(llm.requests[0].apiKey).toBe(LLM_API_KEY);
      expect(send).toHaveBeenCalledTimes(2);
      expect(decode(send, 0)).toContain('To: kiet@gmail.com');
      expect(decode(send, 0)).toContain('Dear Kiet, ...');
      expect(decode(send, 1)).toContain('To: minh@gmail.com');
      expect(decode(send, 1)).toContain('Dear Minh, ...');
    });

    it('(a) keeps the answer, model and token usage in the node log', async () => {
      const { run } = build(
        chain([
          trigger,
          sheetNode,
          filterNode(),
          llmNode({ prompt: 'Hi {{name}}' }),
        ]),
        { llmReplies: [llmText('one'), llmText('two')] },
      );
      const output = logOf((await run()).nodeLogs, NAME)?.output;

      expect(output).toEqual([
        {
          json: {
            text: 'one',
            model: 'test-model',
            usage: { input_tokens: 10, output_tokens: 4 },
          },
          pairedItem: 0,
        },
        {
          json: {
            text: 'two',
            model: 'test-model',
            usage: { input_tokens: 10, output_tokens: 4 },
          },
          pairedItem: 1,
        },
      ]);
    });

    it('(b) classifies rows as JSON and lets a Filter keep only one label', async () => {
      const urgentOnly = {
        id: 'filter2',
        data: {
          key: NodeKeys.LOGIC_FILTER,
          name: 'Only urgent',
          config: { field: 'data.label', operator: 'equals', value: 'urgent' },
        },
      };
      const { run, send, llm } = build(
        chain([
          trigger,
          sheetNode,
          llmNode({
            prompt: 'Classify {{$json.name}}',
            output_format: 'json',
          }),
          urgentOnly,
          gmailNode({
            to: '{{$node["Read Customers"].json.email}}',
            subject: 'Urgent',
            body: 'Label {{$json.data.label}}',
          }),
        ]),
        {
          llmReplies: [
            llmText('{"label":"urgent"}'),
            llmText('{"label":"spam"}'),
            llmText('{"label":"urgent"}'),
          ],
        },
      );
      const result = await run();

      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests).toHaveLength(3);
      expect(llm.requests[0].outputFormat).toBe('json');
      const kept = logOf(result.nodeLogs, NodeKeys.LOGIC_FILTER)?.output;
      expect(
        jsonOf(kept).map((j) => (j.data as { label: string }).label),
      ).toEqual(['urgent', 'urgent']);
      expect(send).toHaveBeenCalledTimes(2);
      expect(decode(send, 0)).toContain('To: kiet@gmail.com');
      expect(decode(send, 1)).toContain('To: minh@gmail.com');
      expect(decode(send, 1)).toContain('Label urgent');
    });

    it('(c) summarises the whole list with a single call after an Aggregate', async () => {
      const { run, send, llm } = build(
        chain([
          trigger,
          sheetNode,
          aggregateNode,
          llmNode({ prompt: 'Summarise: {{$json.items}}' }),
          gmailNode({
            to: 'boss@x.com',
            subject: 'Summary',
            body: '{{$json.text}}',
          }),
        ]),
        { llmReplies: [llmText('Three customers, two new.')] },
      );
      const result = await run();

      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests).toHaveLength(1);
      expect(llm.requests[0].prompt).toContain('"name":"Kiet"');
      expect(llm.requests[0].prompt).toContain('"name":"An"');
      expect(llm.requests[0].prompt).toContain('"name":"Minh"');
      expect(send).toHaveBeenCalledTimes(1);
      expect(decode(send, 0)).toContain('Three customers, two new.');
    });

    it('(d) runs straight after the trigger without any input data', async () => {
      const { run, send, llm } = build(
        chain([
          trigger,
          llmNode({ prompt: 'Write a good morning line.' }),
          gmailNode({
            to: 'team@x.com',
            subject: 'Morning',
            body: '{{$json.text}}',
          }),
        ]),
        { llmReplies: [llmText('Rise and shine!')] },
      );
      const result = await run();

      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests).toHaveLength(1);
      expect(decode(send, 0)).toContain('Rise and shine!');
    });

    it('applies the schema defaults for output format, max tokens and max items', async () => {
      const { run, llm } = build(chain([trigger, llmNode({ prompt: 'Hi' })]));
      await run();
      expect(llm.requests[0]).toMatchObject({
        outputFormat: 'text',
        maxTokens: 1024,
      });
    });

    it('runs no call when the previous node produced no items', async () => {
      const { run, llm } = build(
        chain([
          trigger,
          sheetNode,
          filterNode('nobody'),
          llmNode({ prompt: 'Hi' }),
        ]),
      );
      const result = await run();
      expect(result.status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests).toHaveLength(0);
      expect(logOf(result.nodeLogs, NAME)?.output).toEqual([]);
    });
  });

  describe('limits', () => {
    it("fails before any call when the items exceed the node's max_items", async () => {
      const { run, llm } = build(
        chain([trigger, sheetNode, llmNode({ prompt: 'Hi', max_items: 2 })]),
      );
      const result = await run();
      const log = logOf(result.nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toContain('3 items');
      expect(log?.errorMessage).toContain("the node's max_items (2)");
      expect(llm.requests).toHaveLength(0);
      expect(result.status).toBe(ExecutionStatus.FAILED);
    });

    it('fails before any call when max_items is above the platform ceiling', async () => {
      const { run, llm } = build(
        chain([trigger, sheetNode, llmNode({ prompt: 'Hi', max_items: 100 })]),
        { llmCeiling: 2 },
      );
      const log = logOf((await run()).nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toContain('LLM_MAX_ITEMS (2)');
      expect(llm.requests).toHaveLength(0);
    });

    it('accepts exactly max_items items', async () => {
      const { run, llm } = build(
        chain([trigger, sheetNode, llmNode({ prompt: 'Hi', max_items: 3 })]),
      );
      expect((await run()).status).toBe(ExecutionStatus.SUCCESS);
      expect(llm.requests).toHaveLength(3);
    });
  });

  describe('failures', () => {
    it('rejects a credential that belongs to another provider before calling anything', async () => {
      const { run, llm } = build(chain([trigger, llmNode({ prompt: 'Hi' })]), {
        llmConnectorKey: 'anthropic',
      });
      const log = logOf((await run()).nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toContain('"openai" connector');
      expect(llm.requests).toHaveLength(0);
    });

    it('stops at the item the provider failed on and reports progress', async () => {
      const { run, llm } = build(
        chain([trigger, sheetNode, llmNode({ prompt: 'Hi {{name}}' })]),
        {
          llmReplies: [
            llmText('fine'),
            new LlmProviderError('invalid_api_key', false),
          ],
        },
      );
      const result = await run();
      const log = logOf(result.nodeLogs, NAME);

      expect(llm.requests).toHaveLength(2);
      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toBe('invalid_api_key');
      expect(log?.output).toEqual({
        total_items: 3,
        processed: 1,
        failed_at_index: 1,
      });
      expect(result.status).toBe(ExecutionStatus.FAILED);
    });

    it('never writes the API key to the logs, even when the provider echoes it', async () => {
      const { run } = build(chain([trigger, llmNode({ prompt: 'Hi' })]), {
        llmReplies: [
          new LlmProviderError(
            `Incorrect API key provided: ${LLM_API_KEY}`,
            false,
          ),
        ],
      });
      const result = await run();

      expect(JSON.stringify(result.nodeLogs)).not.toContain(LLM_API_KEY);
      expect(logOf(result.nodeLogs, NAME)?.errorMessage).toContain(
        '[REDACTED]',
      );
    });

    it('fails the item whose answer is not valid JSON', async () => {
      const { run } = build(
        chain([
          trigger,
          sheetNode,
          llmNode({ prompt: 'Hi', output_format: 'json' }),
        ]),
        { llmReplies: [llmText('{"ok":true}'), llmText('not json at all')] },
      );
      const log = logOf((await run()).nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toBe('LLM returned invalid JSON');
      expect(log?.output).toMatchObject({ failed_at_index: 1 });
    });

    it('names the prompt field when its expression points at a missing node', async () => {
      const { run, llm } = build(
        chain([trigger, llmNode({ prompt: 'About {{$node["Nope"].json.x}}' })]),
      );
      const log = logOf((await run()).nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toContain('Config "prompt"');
      expect(llm.requests).toHaveLength(0);
    });

    it('fails when a required setting is missing', async () => {
      const { run, llm } = build(
        chain([trigger, llmNode({ prompt: 'Hi', model: '' })]),
      );
      const log = logOf((await run()).nodeLogs, NAME);

      expect(log?.status).toBe(ExecutionStatus.FAILED);
      expect(log?.errorMessage).toContain('model');
      expect(llm.requests).toHaveLength(0);
    });
  });
});
