export function getSmtpOptions(env?: Record<string, string | undefined>): {
  defaultFromAddress: string
  defaultFromName: string
  skipVerify: true
  transportOptions: {
    host: string; port: number; secure: boolean; requireTLS: boolean
    connectionTimeout: number; greetingTimeout: number; socketTimeout: number
    auth?: { user: string; pass: string }
  }
} | undefined
