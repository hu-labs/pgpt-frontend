/* Shared data models returned by the authenticated PromptGPT API. */

export type Role = "user" | "assistant";

export interface Thread {
  threadId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  messageId: string;
  threadId: string;
  role: Role;
  content: string;
  createdAt: string;
}

export interface Preset {
  presetId: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}
