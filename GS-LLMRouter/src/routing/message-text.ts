import type { ChatRequest } from "./types.js";

export function messageText(body: ChatRequest): string {
  if (!Array.isArray(body.messages)) return "";
  return body.messages.map((message) => {
    if (typeof message !== "object" || message === null || !("content" in message)) return "";
    const content = message.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map((part) => {
      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") return part.text;
      return "";
    }).join(" ");
  }).join(" ");
}
