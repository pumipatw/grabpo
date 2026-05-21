import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Account, WalletClient } from "viem";
import { createViemAccount, getAccountByRole, type Role } from "../lib/accounts";
import { getWalletClient, getTempoWalletClient } from "../lib/contract";

export type TempoWalletClient = any;

interface AccountState {
  role: Role;
  account: Account;
  walletClient: WalletClient;
  tempoWalletClient: TempoWalletClient;
  address: `0x${string}`;
}

interface AccountContextType {
  role: Role;
  setRole: (r: Role) => void;
  account: Account;
  walletClient: WalletClient;
  tempoWalletClient: TempoWalletClient;
  address: `0x${string}`;
  isAdmin: boolean;
  isRider: boolean;
  isCustomer: boolean;
}

const AccountContext = createContext<AccountContextType | null>(null);

const STORAGE_KEY = "grabpo_role";

function buildState(role: Role): AccountState {
  const account = createViemAccount(role);
  return {
    role,
    account,
    walletClient: getWalletClient(account),
    tempoWalletClient: getTempoWalletClient(account),
    address: account.address,
  };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const savedRole = (typeof window !== "undefined" &&
    localStorage.getItem(STORAGE_KEY)) as Role | null;
  const initialRole = savedRole || "rider";

  const [state, setState] = useState<AccountState>(() =>
    buildState(initialRole)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, state.role);
  }, [state.role]);

  const setRole = (role: Role) => setState(buildState(role));

  const accountInfo = getAccountByRole(state.role);

  return (
    <AccountContext.Provider
      value={{
        role: state.role,
        setRole,
        account: state.account,
        walletClient: state.walletClient,
        tempoWalletClient: state.tempoWalletClient,
        address: state.address,
        isAdmin: state.role === "admin",
        isRider: state.role === "rider",
        isCustomer: state.role === "customer",
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
