export type UserRole = "customer" | "driver";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  location?: {
    latitude: number;
    longitude: number;
  };
  displayName?: string;
  phoneNumber?: string;
  createdAt?: Date;
}
