export interface QueryEvents extends Record<string, unknown[]> {
  change: [key?: readonly unknown[]];
  success: [key: readonly unknown[], data: unknown];
  error: [key: readonly unknown[], error: Error];
}
