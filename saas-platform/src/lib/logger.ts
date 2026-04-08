export type TLogLevel = "info" | "warn" | "error";

export interface ILoggerPayload {
  level: TLogLevel;
  eventType: string;
  merchantId?: string;
  conversationId?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export function logger(payload: ILoggerPayload) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...payload });
  if (payload.level === "error") {
    console.error(line);
    return;
  }
  if (payload.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}
