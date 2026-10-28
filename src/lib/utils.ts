import { twMerge } from "tailwind-merge";

export type ClassValue =
  | ClassValue[]
  | Record<string, boolean | null | undefined>
  | string
  | number
  | boolean
  | null
  | undefined;

function flattenClassValues(input: ClassValue): string {
  if (!input) return "";
  if (typeof input === "string" || typeof input === "number") {
    return String(input);
  }
  if (Array.isArray(input)) {
    return input.map(flattenClassValues).filter(Boolean).join(" ");
  }
  if (typeof input === "object") {
    return Object.entries(input)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key)
      .join(" ");
  }
  return "";
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(flattenClassValues(inputs));
}

