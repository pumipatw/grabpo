import { useAccount } from "../context/AccountContext";
import { formatDistance, formatUSD, formatRate } from "../lib/format";

export interface BidRow {
  index: bigint;
  id: `0x${string}`;
  distanceD6: bigint;
  tipD6: bigint;
  customer: `0x${string}`;
}

interface Props {
  bids: BidRow[];
  loading: boolean;
  onAccept?: (index: bigint, id: `0x${string}`) => void;
  onCancel?: (index: bigint, id: `0x${string}`) => void;
  acceptingBid?: string | null;
  viewingBidId?: string | null;
  onViewMap?: (id: `0x${string}`) => void;
}

export default function BidTable({
  bids,
  loading,
  onAccept,
  onCancel,
  acceptingBid,
  viewingBidId,
  onViewMap,
}: Props) {
  const { isRider, isCustomer, address } = useAccount();

  if (loading) {
    return <div className="loading">Loading bids...</div>;
  }

  if (bids.length === 0) {
    return <div className="empty">No open bids right now.</div>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Rate</th>
          <th>Distance</th>
          <th>Tip</th>
          <th>Total</th>
          <th>Customer</th>
          <th style={{ textAlign: "right" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {bids.map((b) => {
          const bidKey = `${b.index.toString()}-${b.id}`;
          const isAccepting = acceptingBid === bidKey;
          const total =
            (b.index * b.distanceD6) / 100n + b.tipD6;

          return (
            <tr key={bidKey}>
              <td className="mono">{formatRate(b.index)}</td>
              <td>{formatDistance(b.distanceD6)}</td>
              <td>{formatUSD(b.tipD6)}</td>
              <td className="mono">{formatUSD(total)}</td>
              <td className="mono-small" title={b.customer}>
                {b.customer.slice(0, 6)}...{b.customer.slice(-4)}
              </td>
              <td style={{ textAlign: "right" }}>
                {isRider && onViewMap && (
                  <button
                    className="btn btn-sm"
                    onClick={() => onViewMap(b.id)}
                    style={{ marginRight: "0.35rem" }}
                  >
                    {viewingBidId === b.id ? "Hide" : "Map"}
                  </button>
                )}
                {isRider && onAccept && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onAccept(b.index, b.id)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? "..." : "Accept"}
                  </button>
                )}
                {isCustomer &&
                  onCancel &&
                  b.customer.toLowerCase() === address.toLowerCase() && (
                    <button
                      className="btn btn-sm"
                      onClick={() => onCancel(b.index, b.id)}
                      disabled={isAccepting}
                    >
                      Cancel
                    </button>
                  )}
                {isCustomer &&
                  b.customer.toLowerCase() !== address.toLowerCase() && (
                    <span className="badge badge-purple">Not yours</span>
                  )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
