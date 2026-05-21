import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import OrderbookPage from "./pages/OrderbookPage";
import RiderDashboard from "./pages/RiderDashboard";
import AdminPanel from "./pages/AdminPanel";
import OrderDetailPage from "./pages/OrderDetailPage";

export default function App() {
  return (
    <div>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/" element={<OrderbookPage />} />
          <Route path="/rider" element={<RiderDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/order/:id" element={<OrderDetailPage />} />
        </Routes>
      </div>
    </div>
  );
}
