export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Recent messages of conversations, kept per workflow and session (for example
// one Messenger customer), so a bot can answer with what was said before.
export abstract class ChatMemoryPort {
  // The last `limit` messages, oldest first.
  abstract load(
    workflowId: string,
    sessionKey: string,
    limit: number,
  ): Promise<ChatMessage[]>;

  // Adds messages at the end. Only the last `maxMessages` are kept and the
  // session is forgotten after `ttlSeconds` without a new message.
  abstract append(
    workflowId: string,
    sessionKey: string,
    messages: ChatMessage[],
    options: { maxMessages: number; ttlSeconds: number },
  ): Promise<void>;

  abstract clear(workflowId: string, sessionKey: string): Promise<void>;
}
