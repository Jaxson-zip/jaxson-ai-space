import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

// A durable admission record prevents retries after an ambiguous remote write.
// It is deliberately not a transaction spanning SQLite and the remote Todo API.
export class ReceiptStore {
  constructor(path) {
    if (!path || !isAbsolute(path)) throw new Error('Receipt path must be absolute')
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(path)
    try {
      chmodSync(path, 0o600)
      this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
          status TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL
        );`)
      // Pending/uncertain records remain until explicit operator review. Only
      // completed replies expire, bounding how much private reply text is kept.
      this.db.prepare("DELETE FROM receipts WHERE status = 'completed' AND created_at < ?")
        .run(Date.now() - 30 * 24 * 60 * 60 * 1000)
    } catch (error) { this.db.close(); throw error }
  }
  claim(id, fingerprint) {
    const inserted = this.db.prepare("INSERT OR IGNORE INTO receipts VALUES (?, ?, 'pending', NULL, ?)")
      .run(id, fingerprint, Date.now())
    if (inserted.changes === 1) return { status: 'claimed' }
    const row = this.db.prepare('SELECT fingerprint, status, result FROM receipts WHERE id = ?').get(id)
    if (!row || row.fingerprint !== fingerprint) return { status: 'conflict' }
    return row.status === 'completed'
      ? { status: 'completed', result: JSON.parse(row.result) }
      : { status: 'uncertain' }
  }
  finish(id, fingerprint, result) {
    const updated = this.db.prepare("UPDATE receipts SET status='completed', result=? WHERE id=? AND fingerprint=? AND status='pending'")
      .run(JSON.stringify(result), id, fingerprint)
    if (updated.changes !== 1) throw new Error('Receipt ownership lost')
  }
  uncertain(id, fingerprint) {
    this.db.prepare("UPDATE receipts SET status='uncertain' WHERE id=? AND fingerprint=? AND status='pending'").run(id, fingerprint)
  }
  close() { this.db.close() }
}
