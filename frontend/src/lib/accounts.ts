import { privateKeyToAccount } from "viem/accounts";

export type Role = "customer" | "rider" | "admin";

export interface DemoAccount {
  role: Role;
  label: string;
  address: `0x${string}`;
}

const KEYS: Record<Role, string> = {
  admin: import.meta.env.VITE_ADMIN_KEY,
  customer: import.meta.env.VITE_CUSTOMER_KEY,
  rider: import.meta.env.VITE_RIDER_KEY,
};

const ADDRESSES: Record<Role, `0x${string}`> = {
  admin: privateKeyToAccount(KEYS.admin as `0x${string}`).address,
  customer: privateKeyToAccount(KEYS.customer as `0x${string}`).address,
  rider: privateKeyToAccount(KEYS.rider as `0x${string}`).address,
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "admin", label: "Admin (Judge)", address: ADDRESSES.admin },
  { role: "customer", label: "Customer", address: ADDRESSES.customer },
  { role: "rider", label: "Rider (Worker)", address: ADDRESSES.rider },
];

export function getAccountByRole(role: Role) {
  return DEMO_ACCOUNTS.find((a) => a.role === role)!;
}

export function getAccountByAddress(address: string) {
  return DEMO_ACCOUNTS.find(
    (a) => a.address.toLowerCase() === address.toLowerCase()
  );
}

export function createViemAccount(role: Role) {
  return privateKeyToAccount(KEYS[role] as `0x${string}`);
}

export function getAccountPrivateKey(role: Role): `0x${string}` {
  return KEYS[role] as `0x${string}`;
}
