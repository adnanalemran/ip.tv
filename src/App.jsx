import "./App.css";
import IpTv from "./components/IpTv";
import RemotePage from "./pages/RemotePage";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<IpTv />} />
      <Route path="/remote" element={<RemotePage />} />
      <Route path="/remote/:sessionId" element={<RemotePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
