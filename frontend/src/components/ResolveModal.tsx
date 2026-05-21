import { useState, useEffect } from "react";
import RidePathMap from "./RidePathMap";
import { getPath, type StoredPath } from "../lib/api";
import { formatAddress, formatUSD } from "../lib/format";

interface Props {
  escrowId: string;
  owner: string;
  worker: string;
  amount: bigint;
  onClose: () => void;
  onResolve: (refund: boolean) => void;
  resolving: boolean;
}

export default function ResolveModal({
  escrowId,
  owner,
  worker,
  amount,
  onClose,
  onResolve,
  resolving,
}: Props) {
  const [path, setPath] = useState<StoredPath | null>(null);
  const [loadingPath, setLoadingPath] = useState(true);

  useEffect(() => {
    getPath(escrowId)
      .then(setPath)
      .catch(() => {})
      .finally(() => setLoadingPath(false));
  }, [escrowId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Resolve Dispute</span>
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="info-row">
          <span className="label">Escrow ID</span>
          <span className="value">{escrowId.slice(0, 16)}...</span>
        </div>
        <div className="info-row">
          <span className="label">Customer</span>
          <span className="value">{formatAddress(owner)}</span>
        </div>
        <div className="info-row">
          <span className="label">Worker</span>
          <span className="value">{formatAddress(worker)}</span>
        </div>
        <div className="info-row">
          <span className="label">Amount</span>
          <span className="value">{formatUSD(amount)}</span>
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Ride Path Evidence
          </span>
        </div>
        {loadingPath ? (
          <div className="loading" style={{ padding: "1rem" }}>
            Loading path...
          </div>
        ) : (
          <RidePathMap recordedPath={path?.path} />
        )}

        <div className="modal-actions">
          <button
            className="btn btn-danger"
            onClick={() => onResolve(true)}
            disabled={resolving}
          >
            {resolving ? "..." : `Refund ${formatUSD(amount)} to Customer`}
          </button>
          <button
            className="btn btn-success"
            onClick={() => onResolve(false)}
            disabled={resolving}
          >
            {resolving ? "..." : `Pay ${formatUSD(amount)} to Worker`}
          </button>
        </div>
      </div>
    </div>
  );
}
