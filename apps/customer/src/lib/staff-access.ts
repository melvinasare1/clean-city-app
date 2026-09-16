export type StaffRole = 'admin' | 'assistant';

export type StaffAccess =
  | { allowed: true; role: StaffRole }
  | { allowed: false; role: null };

export function staffAccessFromAdminDoc(
  data: Record<string, unknown> | undefined | null
): StaffAccess {
  if (!data) {
    return { allowed: false, role: null };
  }
  const role = data.role;
  if (role !== 'admin' && role !== 'assistant') {
    return { allowed: false, role: null };
  }
  if (data.isApproved !== true) {
    return { allowed: false, role: null };
  }
  return { allowed: true, role };
}
