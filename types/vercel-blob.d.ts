declare module "@vercel/blob" {
  export function put(pathname: string, body: unknown, options: Record<string, unknown>): Promise<unknown>;
  export function get(pathname: string, options: Record<string, unknown>): Promise<{ stream: ReadableStream } | null>;
  export function del(pathname: string | string[], options?: Record<string, unknown>): Promise<void>;
  export function list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ blobs: Array<{ pathname: string }>; hasMore: boolean; cursor?: string }>;
}
