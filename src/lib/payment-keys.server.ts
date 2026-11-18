/**
 * Payment keys kept in server-only code (owner's choice) so they survive remixes.
 * Fill the values below. An environment variable with the same name still wins if set.
 * Never import this file from browser code.
 */
const KEYS = {
  PAYPAL_CLIENT_SECRET: "ELxilLYIo3LwEHmBwlP4iywRwvWu8ga1wghgsmf32CVrGQrh3dnHqyGw7ViRrw8f0QfeARXNv5JTnHdx",
  WHOP_API_KEY: "apik_a7B96dbUuRBcx_C6537053_C_f926c25878435a800b9b0054db7e2d2b3bb9a51658fa185e4836940a06eb0b",
  WHOP_COMPANY_ID: "biz_k2ByTZwELx3wJk",
  PAWAPAY_API_TOKEN: "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjQ0NzIiLCJtYXYiOiIxIiwiZXhwIjoyMTA5MzA2MDg5LCJpYXQiOjE3OTM2ODY4ODksInBtIjoiREFGLFBBRiIsImp0aSI6IjI1Zjg3YWZhLWJlYWEtNDUzNC1hMGQ5LTA1NDdkNzQ5NmVmNCJ9.KlFWK5bfDWTgaN3cIuQve1fq9XW5ANCZjMIv9QMM-tkhnwO2ToO1EbMjJlG71Ry-p5ZX5L9XCUGF8PaLuBTH6Q",
} as const;

export type PaymentKey = keyof typeof KEYS;

export function paymentKey(name: PaymentKey): string | undefined {
  return process.env[name] || KEYS[name] || undefined;
}
