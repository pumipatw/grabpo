import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import RidePathMap from "../components/RidePathMap";
import { useAccount } from "../context/AccountContext";
import { getPublicClient, CONTRACT_ADDRESS } from "../lib/contract";
import { GRABPO_ABI } from "../lib/abi";
import { getPath, type StoredPath } from "../lib/api";
import { formatAddress, formatUSD, formatDistance } from "../lib/format";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { walletClient, address, isCustomer, account } = useAccount();

  const [order, setOrder] = useState<{
    distanceD6: bigint;
    tipD6: bigint;
    customer: string;
  } | null>(null);
  const [path, setPath] = useState<StoredPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      (async () => {
        const client = getPublicClient();
        // Try to query both as orderbook and escrow
        const result = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: GRABPO_ABI,
          functionName: "escrow",
          args: [id as `0x${string}`],
        });
        return result;
      })(),
      getPath(id),
    ])
      .then(([escrowData, pathData]) => {
        if (escrowData) {
          setOrder({
            distanceD6: 0n,
            tipD6: 0n,
            customer: escrowData[0],
          });
        }
        setPath(pathData);
      })
      .catch((err) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRelease = async () => {
    if (!id) return;
    setActing(true);
    try {
      await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "release",
        args: [id as `0x${string}`],
        account,
        chain: walletClient.chain,
      } as never);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Release failed";
      setError(msg);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading order details...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Order Detail</h1>
        <p>Ride path and escrow information.</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">Order ID</div>
        <div style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
          {id}
        </div>
      </div>

      {order && (
        <div className="card">
          <div className="info-row">
            <span className="label">Customer</span>
            <span className="value">{formatAddress(order.customer)}</span>
          </div>
          {order.distanceD6 > 0n && (
            <div className="info-row">
              <span className="label">Distance</span>
              <span className="value">{formatDistance(order.distanceD6)}</span>
            </div>
          )}
          {order.tipD6 > 0n && (
            <div className="info-row">
              <span className="label">Tip</span>
              <span className="value">{formatUSD(order.tipD6)}</span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span>Ride Path</span>
          {path && <span className="badge badge-green">{path.path.length} points</span>}
        </div>
        <RidePathMap recordedPath={path?.path || null} />
      </div>

      {isCustomer && order && order.customer.toLowerCase() === address.toLowerCase() && (
        <div style={{ marginTop: "1rem" }}>
          <button
            className="btn btn-success"
            onClick={handleRelease}
            disabled={acting}
          >
            {acting ? "..." : "Release Escrow (Mark Ride Complete)"}
          </button>
        </div>
      )}
    </div>
  );
}
