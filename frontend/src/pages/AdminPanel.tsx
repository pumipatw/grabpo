import { useState, useEffect, useCallback } from "react";
import { useAccount } from "../context/AccountContext";
import {
  getPublicClient,
  CONTRACT_ADDRESS,
  fetchAllEscrows,
} from "../lib/contract";
import { GRABPO_ABI } from "../lib/abi";
import { formatAddress, formatUSD } from "../lib/format";
import ResolveModal from "../components/ResolveModal";

interface EscrowRow {
  id: `0x${string}`;
  owner: `0x${string}`;
  worker: `0x${string}`;
  amount: bigint;
}

export default function AdminPanel() {
  const [escrows, setEscrows] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EscrowRow | null>(null);
  const [resolving, setResolving] = useState(false);
  const { walletClient, account } = useAccount();

  const loadEscrows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      const data = await fetchAllEscrows(client);
      setEscrows(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load escrows";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscrows();
    const interval = setInterval(() => {
      const client = getPublicClient();
      fetchAllEscrows(client).then(setEscrows).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (refund: boolean) => {
    if (!selected) return;
    setResolving(true);
    try {
      await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: GRABPO_ABI,
        functionName: "resolve",
        args: [selected.id, refund],
        account,
        chain: walletClient.chain,
      } as never);
      await new Promise((r) => setTimeout(r, 2000));
      setSelected(null);
      loadEscrows();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Resolve failed";
      setError(msg);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Review escrows and resolve disputes by viewing ride path evidence.</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span>All Escrows ({escrows.length})</span>
          <button
            className="btn btn-sm"
            onClick={loadEscrows}
            disabled={loading}
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : escrows.length === 0 ? (
          <div className="empty">
            No active escrows. Escrows are created when a rider accepts a bid.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Escrow ID</th>
                <th>Customer</th>
                <th>Worker</th>
                <th>Amount</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {escrows.map((e) => (
                <tr
                  key={e.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(e)}
                >
                  <td className="mono-small" title={e.id}>
                    {e.id.slice(0, 16)}...
                  </td>
                  <td className="mono-small">{formatAddress(e.owner)}</td>
                  <td className="mono-small">{formatAddress(e.worker)}</td>
                  <td className="mono">{formatUSD(e.amount)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-sm"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelected(e);
                      }}
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ResolveModal
          escrowId={selected.id}
          owner={selected.owner}
          worker={selected.worker}
          amount={selected.amount}
          onClose={() => setSelected(null)}
          onResolve={handleResolve}
          resolving={resolving}
        />
      )}
    </div>
  );
}
