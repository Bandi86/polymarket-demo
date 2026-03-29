// Rate Limiting Middleware
// Simple in-memory rate limiter for API protection

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests per window
  keyGenerator?: (request: Request) => string;  // Custom key generator
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;      // Don't count failed requests
  message?: string;        // Custom error message
}

// Default configurations for different endpoint types
export const rateLimitPresets = {
  // For read-heavy endpoints (GET requests)
  read: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 100,       // 100 requests per minute
  },

  // For write endpoints (POST/PUT/DELETE)
  write: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 30,        // 30 requests per minute
  },

  // For trading operations (more restrictive)
  trading: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 10,        // 10 trades per minute
  },

  // For authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,             // 5 attempts per 15 minutes
  },

  // For SSE connections
  sse: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 5,         // 5 connection attempts per minute
  },
};

/**
 * In-memory rate limiter class
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get client identifier from request
   */
  private getClientKey(request: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default: Use IP address or fallback
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    return ip;
  }

  /**
   * Check if request should be rate limited
   */
  check(request: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getClientKey(request);
    const now = Date.now();

    let entry = this.store.get(key);

    // Create new entry if doesn't exist or window expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        blocked: false,
      };
      this.store.set(key, entry);
    }

    // Check if blocked
    if (entry.blocked && entry.resetTime > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.config.maxRequests) {
      entry.blocked = true;
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a client
   */
  reset(request: Request): void {
    const key = this.getClientKey(request);
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current stats
   */
  getStats(): { totalEntries: number; blockedEntries: number } {
    let blocked = 0;
    for (const entry of this.store.values()) {
      if (entry.blocked) blocked++;
    }
    return {
      totalEntries: this.store.size,
      blockedEntries: blocked,
    };
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  read: new RateLimiter(rateLimitPresets.read),
  write: new RateLimiter(rateLimitPresets.write),
  trading: new RateLimiter(rateLimitPresets.trading),
  auth: new RateLimiter(rateLimitPresets.auth),
  sse: new RateLimiter(rateLimitPresets.sse),
};

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  handler: (request: Request) => Promise<NextResponse>,
  limiter: RateLimiter = rateLimiters.read
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    const result = limiter.check(request);

    // Set rate limit headers
    const headers = {
      "X-RateLimit-Limit": String(limiter["config"].maxRequests),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
    };

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: limiter["config"].message || "Too many requests, please try again later",
            retryAfter,
          },
        },
        { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } }
      );
    }

    const response = await handler(request);

    // Add rate limit headers to response
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

/**
 * HOF to wrap API route handlers with rate limiting
 */
export function rateLimited(
  limiterType: keyof typeof rateLimiters = "read"
): <T extends (request: Request) => Promise<NextResponse>>(handler: T) => T {
  const limiter = rateLimiters[limiterType];
  return <T extends (request: Request) => Promise<NextResponse>>(handler: T): T => {
    return (async (request: Request) => {
      const result = limiter.check(request);

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests, please try again later",
              retryAfter,
            },
          },
          { status: 429, headers: { "Retry-After": String(retryAfter) } }
        );
      }

      const response = await handler(request);

      // Add rate limit headers
      response.headers.set("X-RateLimit-Limit", String(limiter["config"].maxRequests));
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetTime / 1000)));

      return response;
    }) as T;
  };
}