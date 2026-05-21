import { useState, useEffect, useCallback } from "react";
import BidTable from "../components/BidTable";
import RidePathMap from "../components/RidePathMap";
import { useAccount } from "../context/AccountContext";
import {
  getPublicClient,
  CONTRACT_ADDRESS,
  fetchActiveBids,
  fetchAllEscrows,
} from "../lib/contract";
import { GRABPO_ABI } from "../lib/abi";
import { formatAddress, formatUSD } from "../lib/format";
import { getPath, type StoredPath } from "../lib/api";
import type { BidRow } from "../components/BidTable";

export default function RiderDashboard() {
  const [bids, setBids] = useState<BidRow[]>([]);
  const [myEscrows, setMyEscrows] = useState<
    { id: `0x${string}`; owner: `0x${string}`; worker: `0x${string}`; amount: bigint }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<string | null>(null);
  const [pathData, setPathData] = useState<StoredPath | null>(null);
  const [bidViewingId, setBidViewingId] = useState<string | null>(null);
  const [bidViewingPath, setBidViewingPath] = useState<StoredPath | null>(null);
  const { walletClient, address, account, isCustomer } = useAccount();

  const handleBidViewMap = useCallback(
    (id: `0x${string}`) => {
      if (bidViewingId === id) {
        setBidViewingId(null);
        setBidViewingPath(null);
      } else {
        setBidViewingId(id);
        getPath(id).then(setBidViewingPath).catch(() => setBidViewingPath(null));
      }
    },
    [bidViewingId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      const [bidsData, escrowsData] = await Promise.all([
        fetchActiveBids(client),
        fetchAllEscrows(client),
      ]);
      setBids(bidsData);
      setMyEscrows(
        escrowsData
          .filter((e) =>
            isCustomer
              ? e.owner.toLowerCase() === address.toLowerCase()
              : e.worker.toLowerCase() === address.toLowerCase()
          )
          .map((e) => ({ id: e.id, owner: e.owner, worker: e.worker, amount: e.amount }))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [address, isCustomer]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const client = getPublicClient();
      Promise.all([
        fetchActiveBids(client),
        fetchAllEscrows(client),
      ])
        .then(([bidsData, escrowsData]) => {
          setBids(bidsData);
          setMyEscrows(
            escrowsData
              .filter((e) =>
                isCustomer
                  ? e.owner.toLowerCase() === address.toLowerCase()
                  : e.worker.toLowerCase() === address.toLowerCase()
              )
              .map((e) => ({ id: e.id, owner: e.owner, worker: e.worker, amount: e.amount }))
          );
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [address]);

  const handleAccept = async (index: bigint, id: `0x${string}`) => {
    const key = `${index.toString()}-${id}`;
    setAcceptingBid(key);
    try {
      await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "acceptBid",
        args: [index, id],
        account,
        chain: walletClient.chain,
      } as never);
      await new Promise((r) => setTimeout(r, 2000));
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Accept failed";
      setError(msg);
    } finally {
      setAcceptingBid(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{isCustomer ? "My Rides" : "Rider Dashboard"}</h1>
        <p>
          {isCustomer
            ? "View your ride bids and release escrow when complete."
            : "Accept ride bids and manage your active escrows."}
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span>Open Bids ({bids.length})</span>
          <button className="btn btn-sm" onClick={loadData} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
        <BidTable
          bids={bids}
          loading={loading}
          onAccept={handleAccept}
          acceptingBid={acceptingBid}
          viewingBidId={bidViewingId}
          onViewMap={handleBidViewMap}
        />
        {bidViewingId && (
          <div style={{ marginTop: "0.75rem" }}>
            <RidePathMap recordedPath={bidViewingPath?.path || null} height={250} />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span>My Active Rides</span>
          <span className="badge badge-green">{myEscrows.length} ongoing</span>
        </div>

        {myEscrows.length === 0 ? (
          <div className="empty">
            {isCustomer
              ? "No active rides. Place a bid above to get started."
              : "No active rides. Accept a bid above to get started."}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Escrow ID</th>
                <th>{isCustomer ? "Worker" : "Customer"}</th>
                <th>Amount</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myEscrows.map((e) => (
                <tr key={e.id}>
                  <td className="mono-small" title={e.id}>
                    {e.id.slice(0, 16)}...
                  </td>
                  <td className="mono-small">
                    {formatAddress(isCustomer ? e.worker : e.owner)}
                  </td>
                  <td className="mono">{formatUSD(e.amount)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        if (viewingPath === e.id) {
                          setViewingPath(null);
                          setPathData(null);
                        } else {
                          setViewingPath(e.id);
                          getPath(e.id).then(setPathData).catch(() => setPathData(null));
                        }
                      }}
                      style={{ marginRight: "0.35rem" }}
                    >
                      {viewingPath === e.id ? "Hide" : "Map"}
                    </button>
                    {isCustomer && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={async () => {
                          try {
                            await walletClient.writeContract({
                              address: CONTRACT_ADDRESS,
                              abi: GRABPO_ABI,
                              functionName: "release",
                              args: [e.id],
                              account,
                              chain: walletClient.chain,
                            } as never);
                          } catch {}
                        }}
                      >
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {viewingPath && (
          <div style={{ marginTop: "0.75rem" }}>
            <RidePathMap recordedPath={pathData?.path || null} height={250} />
          </div>
        )}
      </div>
    </div>
  );
}
