export function isLatestIndexTask(
  client: { query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id?: string }> }> },
  task: { id: string; entity_id: string },
): Promise<boolean>
