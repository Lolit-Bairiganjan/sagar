import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import "leaflet/dist/leaflet.css";

export default function MapView() {
  const [spills, setSpills] = useState(null);

  useEffect(() => {
    api.get("/api/spills").then(res => setSpills(res.data));
  }, []);

  return (
    <MapContainer center={[21.6, 88.3]} zoom={6} style={{ height: "100vh" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {spills && <GeoJSON data={spills} />}
    </MapContainer>
  );
}