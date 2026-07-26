declare module 'cloudflare:workers' {
  export const env: { API: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } };
}
