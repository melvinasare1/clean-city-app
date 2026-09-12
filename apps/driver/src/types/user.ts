export type UserRole = "customer" | "driver";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  location?: string;
  displayName?: string;
  phoneNumber?: string;
  createdAt?: Date;
}
