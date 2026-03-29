// API Request Validation Utilities
// Lightweight validation without external dependencies

import { AppError } from "./error-handler";

// Type for validation schema
export type Validator = (value: unknown, field: string) => void;

export interface FieldSchema {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "object" | "array";
  validators?: Validator[];
  defaultValue?: unknown;
  sanitize?: (value: unknown) => unknown;
}

export interface RequestSchema {
  [key: string]: FieldSchema;
}

// Built-in validators
export const validators = {
  string: (minLen = 0, maxLen = 1000): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    if (value.length < minLen || value.length > maxLen) {
      throw AppError.validationError(
        `${field} must be between ${minLen} and ${maxLen} characters`,
        { field, minLen, maxLen, actual: value.length }
      );
    }
  },

  number: (min = -Infinity, max = Infinity): Validator => (value, field) => {
    if (typeof value !== "number" || isNaN(value)) {
      throw AppError.validationError(`${field} must be a valid number`, { field });
    }
    if (value < min || value > max) {
      throw AppError.validationError(
        `${field} must be between ${min} and ${max}`,
        { field, min, max, actual: value }
      );
    }
  },

  positiveNumber: (): Validator => (value, field) => {
    if (typeof value !== "number" || isNaN(value) || value <= 0) {
      throw AppError.validationError(`${field} must be a positive number`, { field });
    }
  },

  integer: (min?: number, max?: number): Validator => (value, field) => {
    const numValue = Number(value);
    if (!Number.isInteger(numValue)) {
      throw AppError.validationError(`${field} must be an integer`, { field });
    }
    if (min !== undefined && numValue < min) {
      throw AppError.validationError(`${field} must be at least ${min}`, { field, min });
    }
    if (max !== undefined && numValue > max) {
      throw AppError.validationError(`${field} must be at most ${max}`, { field, max });
    }
  },

  uuid: (): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw AppError.validationError(`${field} must be a valid UUID`, { field });
    }
  },

  email: (): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw AppError.validationError(`${field} must be a valid email`, { field });
    }
  },

  enum: <T extends string>(allowed: T[]): Validator => (value, field) => {
    if (!allowed.includes(value as T)) {
      throw AppError.validationError(
        `${field} must be one of: ${allowed.join(", ")}`,
        { field, allowed, actual: value }
      );
    }
  },

  regex: (pattern: RegExp, message: string): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    if (!pattern.test(value)) {
      throw AppError.validationError(`${field} ${message}`, { field, pattern: pattern.source });
    }
  },

  array: (itemValidator?: Validator, minLen = 0, maxLen = 100): Validator => (value, field) => {
    if (!Array.isArray(value)) {
      throw AppError.validationError(`${field} must be an array`, { field });
    }
    if (value.length < minLen || value.length > maxLen) {
      throw AppError.validationError(
        `${field} must have between ${minLen} and ${maxLen} items`,
        { field, minLen, maxLen, actual: value.length }
      );
    }
    if (itemValidator) {
      value.forEach((item, index) => itemValidator(item, `${field}[${index}]`));
    }
  },

  objectId: (): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    // Matches common ID formats (UUID, ObjectId, short IDs)
    const idRegex = /^[a-zA-Z0-9_-]{8,36}$/;
    if (!idRegex.test(value)) {
      throw AppError.validationError(`${field} must be a valid ID`, { field });
    }
  },

  address: (): Validator => (value, field) => {
    if (typeof value !== "string") {
      throw AppError.validationError(`${field} must be a string`, { field });
    }
    // Ethereum address
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethRegex.test(value)) {
      throw AppError.validationError(`${field} must be a valid Ethereum address`, { field });
    }
  },

  outcome: (): Validator => validators.enum(["YES", "NO"]),

  tradingMode: (): Validator => validators.enum(["demo", "live"]),
};

// Sanitizers
export const sanitizers = {
  trim: (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    return String(value);
  },

  toLowerCase: (value: unknown): string => {
    return String(value).toLowerCase();
  },

  toUpperCase: (value: unknown): string => {
    return String(value).toUpperCase();
  },

  toNumber: (value: unknown): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },

  clamp: (min: number, max: number) => (value: unknown): number => {
    const num = Number(value);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, num));
  },
};

/**
 * Validate a request body against a schema
 */
export function validateRequest<T>(
  body: unknown,
  schema: RequestSchema
): T {
  if (!body || typeof body !== "object") {
    throw AppError.badRequest("Request body must be an object");
  }

  const data = body as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [field, fieldSchema] of Object.entries(schema)) {
    let value = data[field];

    // Check required fields
    if (value === undefined || value === null) {
      if (fieldSchema.required) {
        throw AppError.validationError(`Missing required field: ${field}`, { field });
      }
      if (fieldSchema.defaultValue !== undefined) {
        result[field] = fieldSchema.defaultValue;
      }
      continue;
    }

    // Type check
    if (fieldSchema.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== fieldSchema.type) {
        throw AppError.validationError(
          `${field} must be of type ${fieldSchema.type}`,
          { field, expected: fieldSchema.type, actual: actualType }
        );
      }
    }

    // Sanitize
    if (fieldSchema.sanitize) {
      value = fieldSchema.sanitize(value);
    }

    // Run validators
    if (fieldSchema.validators) {
      for (const validator of fieldSchema.validators) {
        validator(value, field);
      }
    }

    result[field] = value;
  }

  return result as T;
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  query: Record<string, string | string[] | undefined>,
  schema: RequestSchema
): T {
  const result: Record<string, unknown> = {};

  for (const [field, fieldSchema] of Object.entries(schema)) {
    let rawValue = query[field];

    // Handle array values from query
    if (Array.isArray(rawValue)) {
      rawValue = rawValue[0]; // Take first value
    }

    // Check required fields
    if (rawValue === undefined || rawValue === "") {
      if (fieldSchema.required) {
        throw AppError.validationError(`Missing required query parameter: ${field}`, { field });
      }
      if (fieldSchema.defaultValue !== undefined) {
        result[field] = fieldSchema.defaultValue;
      }
      continue;
    }

    // Type conversion for query params (all strings)
    let convertedValue: unknown = rawValue;
    if (fieldSchema.type === "number") {
      const num = Number(rawValue);
      if (isNaN(num)) {
        throw AppError.validationError(`${field} must be a valid number`, { field });
      }
      convertedValue = num;
    } else if (fieldSchema.type === "boolean") {
      convertedValue = rawValue === "true" || rawValue === "1";
    }

    // Run validators
    if (fieldSchema.validators) {
      for (const validator of fieldSchema.validators) {
        validator(convertedValue, field);
      }
    }

    result[field] = convertedValue;
  }

  return result as T;
}

// Pre-built schemas for common requests
export const commonSchemas = {
  trade: {
    marketId: { required: true, type: "string" as const, validators: [validators.objectId()] },
    outcome: { required: true, type: "string" as const, validators: [validators.outcome()] },
    amount: {
      required: true,
      type: "number" as const,
      validators: [validators.positiveNumber(), validators.number(0.01, 10000)],
    },
  },

  botToggle: {
    botId: { required: true, type: "string" as const, validators: [validators.objectId()] },
  },

  competition: {
    minTrades: { type: "number" as const, validators: [validators.integer(1, 1000)], defaultValue: 50 },
    startBalance: { type: "number" as const, validators: [validators.number(1, 10000)], defaultValue: 10 },
    durationMinutes: { type: "number" as const, validators: [validators.integer(1, 1440)] },
  },

  liveMode: {
    action: { required: true, type: "string" as const, validators: [validators.enum(["enable", "disable"])] },
  },

  botSettings: {
    maxBankrollPercent: { type: "number" as const, validators: [validators.number(0.01, 1)] },
    riskLevel: { type: "string" as const, validators: [validators.enum(["low", "medium", "high"])] },
    autoStopLoss: { type: "number" as const, validators: [validators.number(0, 0.5)] },
    cooldownAfterLoss: { type: "number" as const, validators: [validators.integer(0, 3600)] },
  },
};