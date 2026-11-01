import { z } from 'zod';
import {
  ExecutionContext,
  IPerItemExecutor,
} from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';
import { ChatMemoryPort, ChatMessage } from '../ports/chat-memory.port';

// A session keeps at most this many messages (25 question-and-answer turns).
export const MAX_SESSION_MESSAGES = 50;
const MAX_TURNS_LOADED = MAX_SESSION_MESSAGES / 2;
const SECONDS_PER_DAY = 24 * 60 * 60;

// An expression can resolve to a number or an object; memory works on text.
const asText = (value: unknown): unknown => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const ConfigSchema = z.object({
  mode: z.enum(['load', 'save', 'clear']).default('load'),
  session_key: z.preprocess(
    asText,
    z.string().trim().min(1, 'Chat Memory needs a session key'),
  ),
  // load: how many question-and-answer turns to read back.
  window: z.coerce.number().int().min(1).max(MAX_TURNS_LOADED).default(10),
  // save: both are stored; a blank one is left out.
  user_message: z.preprocess(asText, z.string().default('')),
  assistant_message: z.preprocess(asText, z.string().default('')),
  ttl_days: z.coerce.number().int().min(1).max(90).default(7),
});

export type ChatMemoryConfig = z.infer<typeof ConfigSchema>;

const SPEAKER: Record<ChatMessage['role'], string> = {
  user: 'Khách',
  assistant: 'Bot',
};

// Reads and writes the recent messages of one conversation, so an LLM node can
// be given what was said before. The item passes through unchanged, except
// that "load" adds `history` and `history_text` to it.
export class ChatMemoryExecutor implements IPerItemExecutor<ChatMemoryConfig> {
  readonly key = NodeKeys.MEMORY_CHAT;
  readonly runMode = 'per_item' as const;

  constructor(private readonly memory: ChatMemoryPort) {}

  parseConfig(raw: unknown): ChatMemoryConfig {
    return ConfigSchema.parse(raw);
  }

  async executeItem(params: {
    config: ChatMemoryConfig;
    item: Item;
    credential: unknown;
    context?: ExecutionContext;
  }): Promise<ItemJson> {
    const { config, item, context } = params;
    if (!context) throw new Error('Chat Memory needs a workflow to run in');
    const { workflowId } = context;
    const session = config.session_key;

    if (config.mode === 'clear') {
      await this.memory.clear(workflowId, session);
      return item.json;
    }

    if (config.mode === 'save') {
      const messages: ChatMessage[] = [];
      if (config.user_message.trim()) {
        messages.push({ role: 'user', content: config.user_message });
      }
      if (config.assistant_message.trim()) {
        messages.push({ role: 'assistant', content: config.assistant_message });
      }
      await this.memory.append(workflowId, session, messages, {
        maxMessages: MAX_SESSION_MESSAGES,
        ttlSeconds: config.ttl_days * SECONDS_PER_DAY,
      });
      return item.json;
    }

    const history = await this.memory.load(
      workflowId,
      session,
      config.window * 2,
    );
    return {
      ...item.json,
      history,
      history_text: history
        .map((message) => `${SPEAKER[message.role]}: ${message.content}`)
        .join('\n'),
    };
  }
}
