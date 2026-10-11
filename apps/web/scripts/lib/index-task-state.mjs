// Call within the index write transaction. Serialize writers for this entity,
// then discard superseded retries so a withdrawal cannot be overwritten.
export async function isLatestIndexTask(client, task) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [task.entity_id])
  const latest = await client.query(
    'SELECT id FROM owner.outbox_events WHERE entity_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [task.entity_id],
  )
  return latest.rows[0]?.id === task.id
}
