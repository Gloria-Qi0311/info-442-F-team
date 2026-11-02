import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DbCheck from './pages/DbCheck';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dev/db-check" element={<DbCheck />} />
      </Routes>
    </BrowserRouter>
  );
}
