# Grabpo — Decentralized Ride Hailing on Tempo

Grabpo is a decentralized ride-hailing dApp on the Tempo blockchain. It replaces a centralized platform (like Uber/Grab) with an on-chain orderbook, escrow, and dispute resolution system.

## How it works

**Customer** picks pickup and dropoff locations on a map. OSRM (free routing engine) calculates the driving distance. They set their price per km and a tip, then place a bid. A **Tempo batched transaction** approves PATH_USD and creates the bid in a single on-chain call — no two-step approval dance.

**Rider** sees the bid on the orderbook, clicks "Map" to preview the route, then hits **Accept**. Funds move from the contract into escrow — held until the ride completes.

**Customer** releases escrow to the rider when the trip is done. If there's a dispute, the **Admin (Judge)** opens the escrow, views the recorded GPS path as evidence, and resolves by refunding the customer or paying the rider.

## Why Tempo

The project leans on two Tempo-specific features:
- **Batched transactions** — the `calls` field in Tempo's `0x76` transaction type allows bundling `approve` + `addBid` into one atomic TX, saving gas and UX friction
- **PATH_USD** — Tempo's native stablecoin means no volatile gas tokens; fees are paid directly in the same currency as the ride

## Key pieces

| Piece | Tech |
|-------|------|
| Smart contract | Solidity + Foundry, 24 tests passing |
| Frontend | React + Vite + TypeScript + viem, 4 pages |
| Maps & routing | Leaflet + CartoDB tiles + OSRM API |
| Path storage | Express + SQLite backend |
| Demo UX | Hardcoded keys with role switcher, no wallet needed |
