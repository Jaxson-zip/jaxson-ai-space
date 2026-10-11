import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

export async function studioTransaction<T>(payload: Payload, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) throw new Error('Studio writes require database transactions')
  try {
    const req = await createLocalReq({ req: { transactionID } }, payload)
    const result = await work(req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
