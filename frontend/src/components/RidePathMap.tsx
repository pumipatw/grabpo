import { useState, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Point } from "../lib/api";

interface Props {
  recordedPath?: Point[] | null;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  height?: number;
  interactive?: boolean;
  onRouteCalculated?: (distanceKm: number, points: Point[]) => void;
}

function RoutePolyline({
  start,
  end,
  recordedPath,
}: {
  start?: [number, number];
  end?: [number, number];
  recordedPath?: Point[] | null;
}) {
  const map = useMap();
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recordedPath && recordedPath.length > 0) {
      const coords = recordedPath.map((p) => [p.lat, p.lng] as [number, number]);
      setRouteCoords(coords);
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
      return;
    }

    if (!start || !end) return;

    setLoading(true);
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?geometries=geojson&overview=full`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const coords: [number, number][] =
            data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
          setRouteCoords(coords);
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [start, end, recordedPath, map]);

  if (loading) return null;

  return (
    <>
      {routeCoords.length > 0 && (
        <Polyline positions={routeCoords} color="#58a6ff" weight={4} />
      )}
      {start && <Marker position={start} />}
      {end && <Marker position={end} />}
    </>
  );
}

function InteractivePicker({
  onRouteCalculated,
}: {
  onRouteCalculated: (distanceKm: number, points: Point[]) => void;
}) {
  const [from, setFrom] = useState<L.LatLng | null>(null);
  const [to, setTo] = useState<L.LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [fetching, setFetching] = useState(false);

  const lookupRoute = useCallback(
    (f: L.LatLng, t: L.LatLng) => {
      setFetching(true);
      const url = `https://router.project-osrm.org/route/v1/driving/${f.lng},${f.lat};${t.lng},${t.lat}?geometries=geojson&overview=full`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const distanceKm = route.distance / 1000;
            const coords: [number, number][] = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
            setRouteCoords(coords);
            const points: Point[] = route.geometry.coordinates.map(
              (c: [number, number], i: number) => ({
                lat: c[1],
                lng: c[0],
                ts: Date.now() + i,
              })
            );
            onRouteCalculated(distanceKm, points);
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false));
    },
    [onRouteCalculated]
  );

  useMapEvents({
    click(e) {
      if (!from) {
        setFrom(e.latlng);
      } else {
        const newTo = e.latlng;
        setTo(newTo);
        lookupRoute(from, newTo);
      }
    },
  });

  const handleReset = () => {
    setFrom(null);
    setTo(null);
    setRouteCoords([]);
  };

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {!from && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            color: "#58a6ff",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: "0.8rem",
            pointerEvents: "none",
          }}
        >
          Click map to set pickup location
        </div>
      )}
      {from && !to && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            color: "#f85149",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: "0.8rem",
            pointerEvents: "none",
          }}
        >
          Click map to set dropoff location
        </div>
      )}
      {from && (
        <Marker
          position={from}
          icon={L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
          })}
        />
      )}
      {to && (
        <Marker
          position={to}
          icon={L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
          })}
        />
      )}
      {routeCoords.length > 0 && (
        <Polyline positions={routeCoords} color="#58a6ff" weight={4} />
      )}
      {fetching && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            color: "var(--text)",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: "0.8rem",
          }}
        >
          Calculating route...
        </div>
      )}
      {(from || to) && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 8,
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleReset}
            style={{
              background: "rgba(0,0,0,0.7)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: "0.7rem",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      )}
    </>
  );
}

export default function RidePathMap({
  recordedPath,
  startLat,
  startLng,
  endLat,
  endLng,
  height = 300,
  interactive,
  onRouteCalculated,
}: Props) {
  const hasPath = recordedPath && recordedPath.length > 0;
  const hasCoords =
    startLat != null && startLng != null && endLat != null && endLng != null;

  if (!interactive && !hasPath && !hasCoords) {
    return (
      <div className="empty" style={{ height }}>
        No route data available
      </div>
    );
  }

  let center: [number, number] = [13.7563, 100.5018]; // Bangkok
  let start: [number, number] | undefined;
  let end: [number, number] | undefined;

  if (hasPath) {
    const mid = Math.floor(recordedPath!.length / 2);
    center = [recordedPath![mid].lat, recordedPath![mid].lng];
  } else if (hasCoords) {
    start = [startLat!, startLng!] as [number, number];
    end = [endLat!, endLng!] as [number, number];
    center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  }

  return (
    <div className="path-map-container" style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={interactive}
      >
        {interactive && onRouteCalculated ? (
          <InteractivePicker onRouteCalculated={onRouteCalculated} />
        ) : (
          <>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <RoutePolyline
              start={start}
              end={end}
              recordedPath={recordedPath || null}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
