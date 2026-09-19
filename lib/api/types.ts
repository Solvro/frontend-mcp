/** Kształty odpowiedzi backend-mcp (chat-service / auth-service). Daty: UTC bez strefy. */
export type ChatResponseDto = {
  session_id: string;
  message: string;
  timestamp: string;
  metadata: { message_count: number; source: string; trace_id: string };
};

export type ConversationDto = {
  session_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  metadata: { title?: unknown } & Record<string, unknown>;
  is_active: boolean;
  expires_at: string | null;
};

export type MessageDto = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type AuthSession = { authenticated: boolean; email: string | null };

/** Stan dziennego limitu pytań po ostatniej odpowiedzi. */
export type QuotaInfo = { remaining: number; resetSeconds: number };
