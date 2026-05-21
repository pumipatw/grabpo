import {
  createPublicClient,
  createWalletClient,
  createClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  publicActions,
  walletActions,
  type PublicClient,
  type WalletClient,
} from "viem";
import { tempoModerato } from "viem/chains";
import { tempoActions } from "viem/tempo";
import { GRABPO_ABI } from "./abi";
import { type Role } from "./accounts";

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PATH_USD_ADDRESS =
  "0x20C0000000000000000000000000000000000000" as `0x${string}`;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

let _publicClient: any = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: tempoModerato as any,
      transport: http(),
    }) as any;
  }
  return _publicClient;
}

export function getWalletClient(
  account: ReturnType<typeof import("./accounts").createViemAccount>
): WalletClient {
  return createWalletClient({
    chain: tempoModerato as any,
    transport: http(),
    account,
  }) as any;
}

export function getRoleContractAddress(_role: Role): `0x${string}` {
  return CONTRACT_ADDRESS;
}

export function getTempoWalletClient(
  account: ReturnType<typeof import("./accounts").createViemAccount>
) {
  return createClient({
    chain: tempoModerato as any,
    transport: http(),
    account,
  })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions()) as any;
}

export type TempoWc = any;

export function computeBidId(
  customer: `0x${string}`,
  blockNumber: bigint,
  index: bigint,
  distanceD6: bigint,
  tipD6: bigint
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint128" },
        { type: "uint128" },
      ],
      [customer, blockNumber, index, distanceD6, tipD6]
    )
  );
}

export function extractBidAddedId(
  receipt: { logs: { address: `0x${string}`; topics: `0x${string}`[]; data: `0x${string}` }[] }
): `0x${string}` | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
    // BidAdded: event BidAdded(uint256 indexed index, bytes32 indexed id, address indexed customer, uint128 distanceD6, uint128 tipD6)
    // keccak256("BidAdded(uint256,bytes32,address,uint128,uint128)") = 0xa8c5e964037a3d4b6410bc096a90561dc0a309c1cb5537bf7655e436ce242ba6
    if (log.topics[0] === "0xa8c5e964037a3d4b6410bc096a90561dc0a309c1cb5537bf7655e436ce242ba6") {
      return log.topics[2]; // indexed bytes32 id is topic[2]
    }
  }
  return null;
}

export async function sendBatchedApproveAndBid(
  client: any,
  index: bigint,
  distanceD6: bigint,
  tipD6: bigint
) {
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [
      CONTRACT_ADDRESS,
      BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
    ],
  });

  const addBidData = encodeFunctionData({
    abi: GRABPO_ABI,
    functionName: "addBid",
    args: [index, distanceD6, tipD6],
  });

  return client.sendTransaction({
    calls: [
      { to: PATH_USD_ADDRESS, data: approveData, value: 0n },
      { to: CONTRACT_ADDRESS, data: addBidData, value: 0n },
    ],
    chain: tempoModerato,
    account: client.account,
  }) as Promise<`0x${string}`>;
}

export async function fetchActiveBids(client: PublicClient) {
  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: GRABPO_ABI,
    functionName: "getActiveIndicesCount",
  });

  const bids: {
    index: bigint;
    id: `0x${string}`;
    distanceD6: bigint;
    tipD6: bigint;
    customer: `0x${string}`;
  }[] = [];

  for (let i = 0n; i < count; i++) {
    const index = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: GRABPO_ABI,
      functionName: "getActiveIndexAt",
      args: [i],
    });
    const orderCount = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: GRABPO_ABI,
      functionName: "getOrderCount",
      args: [index],
    });
    for (let j = 0n; j < orderCount; j++) {
      const orderId = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "getOrderAt",
        args: [index, j],
      });
      const orderResult = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "orderbook",
        args: [index, orderId],
      });
      const [distanceD6, tipD6, customer] = orderResult as unknown as [bigint, bigint, `0x${string}`];
      bids.push({ index, id: orderId, distanceD6, tipD6, customer });
    }
  }
  return bids;
}

export async function fetchAllEscrows(client: PublicClient) {
  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: GRABPO_ABI,
    functionName: "getEscrowCount",
  });

  const escrows: {
    id: `0x${string}`;
    owner: `0x${string}`;
    worker: `0x${string}`;
    amount: bigint;
  }[] = [];

  for (let i = 0n; i < count; i++) {
    const escrowId = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: GRABPO_ABI,
      functionName: "getEscrowAt",
      args: [i],
    });
    const escrowResult = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: GRABPO_ABI,
      functionName: "escrow",
      args: [escrowId],
    });
    const [owner, worker, amount] = escrowResult as unknown as [`0x${string}`, `0x${string}`, bigint];
    escrows.push({ id: escrowId, owner, worker, amount });
  }
  return escrows;
}
