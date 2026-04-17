import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { ChatWidget } from './components/chat/ChatWidget';
import { HomePage } from './components/pages/home/HomePage';
import { PortfolioPage } from './components/pages/portfolio/PortfolioPage';
import { ResearchPage } from './components/pages/research/ResearchPage';
import { AccountPage } from './components/pages/account/AccountPage';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <TopNav />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Routes>
        </main>
        {/* ChatWidget mounts once at root — persists across page navigation */}
        <ChatWidget />
      </div>
    </BrowserRouter>
  );
}
