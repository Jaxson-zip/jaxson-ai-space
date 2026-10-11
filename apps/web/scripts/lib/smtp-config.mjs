export function getSmtpOptions(env = process.env) {
  const host = env.SMTP_HOST?.trim()
  const from = env.SMTP_FROM_ADDRESS?.trim()
  if (!host && !from && !env.SMTP_USER && !env.SMTP_PASSWORD) return undefined
  if (!host) throw new Error('SMTP_HOST is required when configuring email')
  if (!from || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw new Error('A valid SMTP_FROM_ADDRESS is required')
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) throw new Error('Set both SMTP_USER and SMTP_PASSWORD')
  const port = Number(env.SMTP_PORT || 465)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP_PORT')
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE must be true or false')
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465
  const name = env.SMTP_FROM_NAME || 'Jaxson'
  if (/[\r\n]/.test(host + name)) throw new Error('Invalid SMTP host or sender name')
  return {
    defaultFromAddress: from, defaultFromName: name, skipVerify: true,
    transportOptions: {
      host, port, secure, requireTLS: !secure,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
    },
  }
}
