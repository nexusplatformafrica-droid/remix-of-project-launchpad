/** Only roles assigned to an account grant dashboard access. */
export function assignedAdminRole(role: unknown): boolean {
  return role === "admin" || role === "staff";
}