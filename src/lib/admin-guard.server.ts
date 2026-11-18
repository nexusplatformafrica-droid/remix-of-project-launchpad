/**
 * Server-only check that the caller is the site's main admin (fixed identity)
 * or an account with an assigned "admin" role. Staff never pass: this guards
 * actions that move money.
 */
export async function requireAdmin(idToken: string): Promise<{ uid: string; email?: string | undefined }> {
  const { verifyUploader } = await import("./r2-upload.server");
  const { isAdminEmail } = await import("./admin-identity");
  const who = await verifyUploader(
    new Request("https://local/", { headers: { authorization: `Bearer ${idToken}` } }),
  );
  if (!who) throw new Error("Please sign in again.");
  if (isAdminEmail(who.email)) return who;
  let assigned = false;
  try {
    const { fsWhere } = await import("./developer-api");
    assigned = (await fsWhere("user_roles", "user_id", who.uid)).some((r) => r["role"] === "admin");
  } catch {
    throw new Error("Your admin role can't be checked right now. Try again later or use the main admin account.");
  }
  if (!assigned) throw new Error("Only the site admin can do this.");
  return who;
}
