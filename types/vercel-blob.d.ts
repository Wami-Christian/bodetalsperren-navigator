declare module "@vercel/blob" {
  export function put(pathname: string, body: unknown, options: Record<string, unknown>): Promise<unknown>;
  export function get(pathname: string, options: Record<string, unknown>): Promise<{ stream: ReadableStream } | null>;
  export function del(pathname: string, options?: Record<string, unknown>): Promise<void>;
}
