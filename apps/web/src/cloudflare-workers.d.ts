declare module 'cloudflare:workers' {
  export const env: { API: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } };
}
type Fetcher = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };
