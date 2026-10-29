export interface MessengerSendRequest {
  pageAccessToken: string;
  recipientId: string; // page-scoped id of the customer (sender_id of the trigger)
  text: string;
}

export interface MessengerClient {
  sendText(request: MessengerSendRequest): Promise<{ messageId: string }>;
}

export class MessengerApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
