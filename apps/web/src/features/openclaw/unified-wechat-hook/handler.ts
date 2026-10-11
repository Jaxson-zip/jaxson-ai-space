/** Retired: message:received is observation-only and cannot deliver replies. */
export default async function retiredWechatHook(): Promise<void> {
  throw new Error('Disable unified-wechat-hook and install integrations/openclaw/jaxson-inbox (before_dispatch).')
}
export const onMessageReceived = retiredWechatHook
