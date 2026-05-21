import { useState, useEffect, useCallback } from "react";
import BidTable from "../components/BidTable";
import RidePathMap from "../components/RidePathMap";
import { useAccount } from "../context/AccountContext";
import {
  getPublicClient,
  CONTRACT_ADDRESS,
  fetchActiveBids,
  sendBatchedApproveAndBid,
  extractBidAddedId,
} from "../lib/contract";
import { GRABPO_ABI } from "../lib/abi";
import { setPath, getPath, type Point, type StoredPath } from "../lib/api";
import type { BidRow } from "../components/BidTable";

export default function OrderbookPage() {
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [viewingBidId, setViewingBidId] = useState<string | null>(null);
  const [viewingBidPath, setViewingBidPath] = useState<StoredPath | null>(null);
  const { isCustomer, walletClient, account, tempoWalletClient } = useAccount();

  // Add bid form state
  const [showForm, setShowForm] = useState(false);
  const [formIndex, setFormIndex] = useState("1");
  const [formDistanceKm, setFormDistanceKm] = useState<number | null>(null);
  const [formPoints, setFormPoints] = useState<Point[]>([]);
  const [formTipUsd, setFormTipUsd] = useState("1.00");
  const [submitting, setSubmitting] = useState(false);

  const handleViewMap = useCallback(
    (id: `0x${string}`) => {
      if (viewingBidId === id) {
        setViewingBidId(null);
        setViewingBidPath(null);
      } else {
        setViewingBidId(id);
        getPath(id).then(setViewingBidPath).catch(() => setViewingBidPath(null));
      }
    },
    [viewingBidId]
  );

  const handleRouteCalculated = useCallback((distanceKm: number, points: Point[]) => {
    setFormDistanceKm(distanceKm);
    setFormPoints(points);
  }, []);

  const loadBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      const data = await fetchActiveBids(client);
      setBids(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch bids";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBids();
    const interval = setInterval(() => {
      const client = getPublicClient();
      fetchActiveBids(client).then(setBids).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAddBid = async () => {
    if (formDistanceKm == null) {
      setError("Pick pickup and dropoff locations on the map first");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const index = BigInt(formIndex);
      const distanceD6 = BigInt(Math.round(formDistanceKm * 1e6));
      const tipD6 = BigInt(Math.round(parseFloat(formTipUsd) * 1e6));
      // Batched Tempo transaction: approve PATH_USD + addBid in one tx
      const hash = await sendBatchedApproveAndBid(tempoWalletClient, index, distanceD6, tipD6);
      // Wait for receipt using tempo client (supports Tempo block format)
      const receipt = await tempoWalletClient.waitForTransactionReceipt({ hash });
      const bidId = extractBidAddedId(receipt);
      // Store route path to backend
      if (bidId && formPoints.length > 0) {
        setPath(bidId, formPoints).catch(() => {});
      }
      setSuccess("Bid created!");
      setShowForm(false);
      setFormDistanceKm(null);
      setFormPoints([]);
      setTimeout(() => setSuccess(null), 5000);
      await new Promise((r) => setTimeout(r, 2000));
      loadBids();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Add bid failed");
    } finally {
      setSubmitting(false);
    }
  };

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
      loadBids();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Accept failed";
      setError(msg);
    } finally {
      setAcceptingBid(null);
    }
  };

  const handleCancel = async (index: bigint, id: `0x${string}`) => {
    const key = `${index.toString()}-${id}`;
    setAcceptingBid(key);
    try {
      await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "cancelBid",
        args: [index, id],
        account,
        chain: walletClient.chain,
      } as never);
      await new Promise((r) => setTimeout(r, 2000));
      loadBids();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancel failed";
      setError(msg);
    } finally {
      setAcceptingBid(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Orderbook</h1>
        <p>All open ride bids on Tempo. Accept rides or create your own bids.</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="error" style={{ background: "rgba(63,185,80,0.1)", border: "1px solid var(--green)", color: "var(--green)" }}>{success}</div>}

      {isCustomer && (
        <div className="card">
          <div className="card-header">
            <span>Create a Bid</span>
            <button className="btn btn-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "New Bid"}
            </button>
          </div>

          {showForm && (
            <div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.25rem" }}>Rate ($0.01 incr)</label>
                  <input
                    type="number"
                    value={formIndex}
                    onChange={(e) => setFormIndex(e.target.value)}
                    min="1"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "0.4rem 0.6rem",
                      color: "var(--text)",
                      width: "80px",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.25rem" }}>Tip (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formTipUsd}
                    onChange={(e) => setFormTipUsd(e.target.value)}
                    min="0"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "0.4rem 0.6rem",
                      color: "var(--text)",
                      width: "100px",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <RidePathMap
                interactive
                height={350}
                onRouteCalculated={handleRouteCalculated}
              />

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                  Distance:{" "}
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    {formDistanceKm != null ? `${formDistanceKm.toFixed(2)} km` : "—"}
                  </span>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddBid}
                  disabled={submitting || formDistanceKm == null}
                >
                  {submitting ? "Sending..." : "Place Bid"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span>Open Bids ({bids.length})</span>
          <button className="btn btn-sm" onClick={loadBids} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
        <BidTable
          bids={bids}
          loading={loading}
          onAccept={handleAccept}
          onCancel={isCustomer ? handleCancel : undefined}
          acceptingBid={acceptingBid}
          viewingBidId={viewingBidId}
          onViewMap={handleViewMap}
        />
        {viewingBidId && (
          <div style={{ marginTop: "0.75rem" }}>
            <RidePathMap recordedPath={viewingBidPath?.path || null} height={250} />
          </div>
        )}
      </div>
    </div>
  );
}
