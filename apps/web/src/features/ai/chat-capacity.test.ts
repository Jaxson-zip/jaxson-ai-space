import { expect, it } from 'vitest'
import { acquireChatSlot, trackChatStream, MAX_ACTIVE_CHATS } from './chat-capacity'

it('caps concurrent generations and releases slots exactly once on completion and cancellation', async () => {
  const releases = Array.from({ length: MAX_ACTIVE_CHATS }, () => acquireChatSlot()!)
  expect(releases.every(Boolean)).toBe(true)
  expect(acquireChatSlot()).toBeUndefined()
  releases[0](); releases[0]()
  const release = acquireChatSlot()!
  expect(release).toBeTypeOf('function')
  expect(acquireChatSlot()).toBeUndefined()
  const controller = new AbortController()
  const stream = trackChatStream(new ReadableStream({ start() {} }), release, controller.signal)
  controller.abort()
  await stream.cancel()
  const replacement = acquireChatSlot()
  expect(replacement).toBeTypeOf('function')
  expect(acquireChatSlot()).toBeUndefined()
  replacement!()
  releases.slice(1).forEach(done => done())
  const finished = trackChatStream(new Response('complete').body!, acquireChatSlot()!, new AbortController().signal)
  expect(await new Response(finished).text()).toBe('complete')
  const available = Array.from({ length: MAX_ACTIVE_CHATS }, () => acquireChatSlot())
  expect(available.every(Boolean)).toBe(true)
  available.forEach(done => done?.())
})
