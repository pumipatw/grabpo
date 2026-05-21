export function formatDistance(d6: bigint): string {
  const km = Number(d6) / 1e6;
  return `${km.toFixed(2)} km`;
}

export function formatUSD(d6: bigint | number): string {
  const usd = Number(d6) / 1e6;
  return `$${usd.toFixed(2)}`;
}

export function formatRate(index: bigint): string {
  return `$${(Number(index) * 0.01).toFixed(2)}/unit`;
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
