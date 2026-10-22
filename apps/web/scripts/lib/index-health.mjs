// Index worker failures used to be recorded silently. These helpers log every failed attempt and give the
// operator one command (run-index-worker.mjs --health) that says whether the public index is keeping up.

export const MAX_ATTEMPTS = 5
const STALE_PENDING_SECONDS = 600

export async function markTaskFailed(db, task, error, log = console.error) {
  const message = String(error instanceof Error ? error.message : error)
  await db.query(
    `UPDATE owner.outbox_events SET status = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END,
     available_at = NOW() + INTERVAL '30 seconds', last_error = $2 WHERE id = $1`,
    [task.id, message, MAX_ATTEMPTS],
  )
  log(`[index-worker] task ${task.id} (${task.entity_id}) failed, attempt ${task.attempts}/${MAX_ATTEMPTS}: ${message}`)
  if (Number(task.attempts) >= MAX_ATTEMPTS) {
    log(`[index-worker] gave up on task ${task.id} (${task.entity_id}); the public index is missing this change. Check with --health.`)
  }
}

export async function readIndexHealth(db) {
  const { rows: [row] } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'processing') AS processing,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed,
      COALESCE(EXTRACT(EPOCH FROM NOW() - MIN(created_at) FILTER (WHERE status = 'pending')), 0) AS oldest_pending_seconds,
      (SELECT last_error FROM owner.outbox_events WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1) AS last_error
    FROM owner.outbox_events
  `)
  const pending = Number(row.pending)
  const processing = Number(row.processing)
  const failed = Number(row.failed)
  const oldestPendingSeconds = Math.round(Number(row.oldest_pending_seconds))
  const problems = []
  if (failed > 0) problems.push(`${failed} 个索引任务已放弃（重试 ${MAX_ATTEMPTS} 次仍失败）`)
  if (oldestPendingSeconds > STALE_PENDING_SECONDS) problems.push(`最早的待处理任务已等待 ${oldestPendingSeconds} 秒`)
  return { ok: problems.length === 0, pending, processing, failed, oldestPendingSeconds, lastError: row.last_error ?? null, problems }
}
