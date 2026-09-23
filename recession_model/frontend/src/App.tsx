import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TerminalLayout } from './components/TerminalLayout';
import { AnalyzerPage } from './pages/AnalyzerPage';
import { ModelTrustPage } from './pages/ModelTrustPage';

export default function App() {
  return (
    <BrowserRouter>
      <TerminalLayout>
        <Routes>
          <Route path="/" element={<AnalyzerPage />} />
          <Route path="/model-trust" element={<ModelTrustPage />} />
        </Routes>
      </TerminalLayout>
    </BrowserRouter>
  );
}