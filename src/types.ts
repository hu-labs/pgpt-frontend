/*
    types.ts — data models
*/
// src/types.ts
export type Role = "user" | "assistant" | "system";

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
export interface Message {
  id: string;
  threadId: string;
  role: Role;
  content: string;
  createdAt: number;
}
export interface Preset {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}
