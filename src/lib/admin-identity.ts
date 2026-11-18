/** Admin identity — checked before any database read so admin can always get in (browser + server safe). */
export const ADMIN_EMAIL = "mainplatform.nexus@gmail.com";
export const ADMIN_PHONE = "0760734679";

export const digitsOnly = (v: string) => (v ?? "").replace(/[^0-9]/g, "");
export const phoneToAuthEmail = (phone: string) => `p${digitsOnly(phone)}@luofilm.site`;

export function isAdminEmail(email?: string | null) {
  const e = (email ?? "").toLowerCase();
  return !!e && (e === ADMIN_EMAIL.toLowerCase() || e === phoneToAuthEmail(ADMIN_PHONE));
}
