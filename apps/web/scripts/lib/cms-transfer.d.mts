export interface CmsRecord { [key: string]: unknown; id?: string | number }
export interface CmsClient {
  list(collection: string): Promise<CmsRecord[]>
  media?(path: string): Promise<Uint8Array>
  write?(collection: string, doc: CmsRecord, id?: string | number): Promise<CmsRecord>
  upload?(asset: unknown): Promise<CmsRecord>
}
export interface ContentArchive {
  format: string; version: number; exportedAt: string
  records: Record<string, CmsRecord[]>
  media: unknown[]
}
export function createCmsClient(origin: string, email: string, password: string): Promise<CmsClient>
export function exportContent(client: CmsClient): Promise<ContentArchive>
export function importContent(client: CmsClient, archive: ContentArchive, options?: { apply?: boolean; updateExisting?: boolean }): Promise<{ dryRun: boolean; created: number; updated: number; skipped: number }>
