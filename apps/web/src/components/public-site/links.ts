// Section links go back to the portfolio (jaxson.bond). This app's own `/` redirects to the admin login,
// so a public link must never point there.
export const portfolioOrigin = (process.env.NEXT_PUBLIC_PORTFOLIO_URL || 'https://jaxson.bond').replace(/\/+$/, '')
export const portfolioLink = (hash = '') => `${portfolioOrigin}/${hash}`
export const resumePdf = '/resume/zhang-jinpeng-ai-product-builder.pdf'
