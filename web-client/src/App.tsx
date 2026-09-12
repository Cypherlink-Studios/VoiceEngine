import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrandProvider } from './components/layout/BrandProvider.js';
import { PlayerRoute } from './routes/PlayerRoute.js';
import { AdminRoute } from './routes/AdminRoute.js';

export default function App() {
  return (
    <BrandProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayerRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BrandProvider>
  );
}
