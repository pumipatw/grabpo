# Grabpo — Orderbook Ride Hailing on Tempo

A decentralized ride-hailing dApp on the [Tempo blockchain](https://tempo.xyz), with an on-chain orderbook, escrow system, map-based route planning, and dispute resolution.

## Architecture

```
grabpo/
├── src/Grabpo.sol            # Smart contract (orderbook + escrow)
├── script/Grabpo.s.sol       # Deploy script
├── test/Grabpo.t.sol         # Contract tests (24 passing)
├── backend/                  # Express + SQLite — ride path storage
└── frontend/                 # React + Vite + viem — web app
```

## Smart Contract (`Grabpo.sol`)

**Deployed on Tempo Testnet (Moderato, chain ID 42431)**

| Function | Caller | Description |
|----------|--------|-------------|
| `addBid(index, distance, tip)` | Customer | Create a ride bid. `index` is the price level in $0.01 increments. Funds held in contract. |
| `cancelBid(index, id)` | Customer | Cancel own bid, refund received. |
| `acceptBid(index, id)` | Rider | Accept a bid. Funds move to escrow. |
| `release(id)` | Customer | Release escrow to rider after ride complete. |
| `resolve(id, refund)` | Judge/Admin | Resolve dispute. `refund=true` → customer, `false` → rider. |

**Pricing formula:** `total = (index × $0.01) × distance + tip`

All payments use **PATH_USD** (`0x20C0…`) — Tempo's native stablecoin.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contract | Solidity 0.8.35, Foundry |
| Frontend | React 18, Vite, TypeScript, viem 2.x |
| Maps | Leaflet, react-leaflet, CartoDB tiles |
| Routing | OSRM (free) — `router.project-osrm.org` |
| Blockchain | Tempo batched transactions (`calls` field) |
| Backend | Express.js, better-sqlite3 |
| Network | Tempo Testnet (Moderato), chain ID 42431 |

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh) (Tempo fork)
- Node.js 18+
- Git

### 1. Install & Build

```bash
# Smart contract
forge build

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Fund Demo Wallets

```bash
# Fund all three demo accounts with test PATH_USD
cast rpc tempo_fundAddress 0x33AE728E20bFc28B36fAcE92a9Bb54D59F0d90D5 --rpc-url https://rpc.moderato.tempo.xyz
cast rpc tempo_fundAddress 0x45A6d6292719751425eD1aD29cADDF2A84aEB68A --rpc-url https://rpc.moderato.tempo.xyz
cast rpc tempo_fundAddress 0xFc90eBB9d3E06F7b3B56BdBeF0Faa96c682dbde0 --rpc-url https://rpc.moderato.tempo.xyz
```

### 3. Deploy Contract

```bash
# Set env vars
cp .env.example .env
source .env

# Deploy
forge script script/Grabpo.s.sol:GrabpoScript --rpc-url moderato --broadcast

# Copy the logged address into frontend/.env:
echo "VITE_CONTRACT_ADDRESS=0x..." > frontend/.env
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend && npm start        # → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev     # → http://localhost:5173
```

## Demo Accounts

Keys are set via `frontend/.env`:

| Role | Env Var | Address |
|------|---------|---------|
| Admin (Judge) | `VITE_ADMIN_KEY` | `0x33AE…90D5` |
| Customer | `VITE_CUSTOMER_KEY` | `0x45A6…B68A` |
| Rider | `VITE_RIDER_KEY` | `0xFc90…bde0` |

Use the **role switcher** in the top-right navbar to switch between accounts. No wallet connection needed — keys are configured directly.

## App Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Orderbook** | Browse open bids. Customers create bids via interactive map. Riders accept with one click. |
| `/rider` | **Rider / My Ride** | Rider: accept bids, view active escrows. Customer: view own rides, release escrow, see route map. |
| `/admin` | **Admin Panel** | View all escrows, resolve disputes. Click "Resolve" to see ride path evidence + refund or pay. |
| `/order/:id` | **Order Detail** | View order info + GPS path on map. |

## End-to-End Flow

1. **Customer** clicks "New Bid" → picks pickup & dropoff on the interactive map
2. OSRM calculates the driving route + distance automatically
3. "Place Bid" sends a **Tempo batched transaction** (approve PATH_USD + addBid in one `calls`)
4. Bid appears in the orderbook — `BidAdded` event decoded from receipt, route path stored to backend
5. **Rider** clicks "Map" to preview the route, then "Accept" to take the ride
6. Funds move to escrow — visible in rider's "My Active Rides" with route map
7. **Customer** clicks "Release" on their "My Ride" page → funds sent to rider
8. **Admin** can resolve disputes: view path evidence, refund customer or pay rider

## Backend API

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/paths/:orderId` | Store GPS route points |
| `PATCH` | `/api/paths/:orderId` | Append GPS points |
| `GET` | `/api/paths/:orderId` | Retrieve stored route |
| `GET` | `/api/health` | Health check |

## Testing

```bash
# Smart contract tests
forge test -vvv

# Frontend typecheck
cd frontend && npx tsc --noEmit

# Frontend build check
cd frontend && npx vite build
```

## Environment Variables

### Root `.env` (deploy)

```bash
GRABPO_DEPLOYER_KEY=0x...    # Deployer private key
GRABPO_JUDGE=0x...           # Judge/admin address
TEMPO_FEE_TOKEN=             # Optional, defaults to PATH_USD
```

### Frontend `.env`

```bash
VITE_CONTRACT_ADDRESS=0x...         # Grabpo contract address
VITE_ADMIN_KEY=0x...                # Admin private key
VITE_CUSTOMER_KEY=0x...             # Customer private key
VITE_RIDER_KEY=0x...                # Rider private key
VITE_RPC_URL=https://rpc.moderato.tempo.xyz
VITE_CHAIN_ID=42431
```

## License

AGPLv3.0
