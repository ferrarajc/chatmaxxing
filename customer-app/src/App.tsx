import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { ChatWidget } from './components/chat/ChatWidget';
import { HomePage } from './components/pages/home/HomePage';
import { PortfolioPage } from './components/pages/portfolio/PortfolioPage';
import { ResearchPage } from './components/pages/research/ResearchPage';
import { AccountPage } from './components/pages/account/AccountPage';
import { BeneficiariesPage } from './components/pages/account/BeneficiariesPage';
import { AutoInvestPage } from './components/pages/account/AutoInvestPage';
import { RmdPage } from './components/pages/account/RmdPage';
import { TaxDocumentsPage } from './components/pages/account/TaxDocumentsPage';
import { OpenAccountPage } from './components/pages/OpenAccountPage';
import { IraContributionLimitsPage } from './components/pages/resources/IraContributionLimitsPage';
import { RothIraPage } from './components/pages/resources/RothIraPage';
import { SepIraPage } from './components/pages/resources/SepIraPage';
import { SepIraVsSoloPage } from './components/pages/resources/SepIraVsSoloPage';
import { TaxEfficientInvestingPage } from './components/pages/resources/TaxEfficientInvestingPage';
import { EstatePlanningPage } from './components/pages/resources/EstatePlanningPage';
import { SelfEmployedRetirementPage } from './components/pages/resources/SelfEmployedRetirementPage';
import { TaxDeductionsPage } from './components/pages/resources/TaxDeductionsPage';
import { RolloverPage } from './components/pages/resources/RolloverPage';
import { AccessGate } from './components/AccessGate';

export default function App() {
  return (
    <AccessGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <TopNav />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/beneficiaries" element={<BeneficiariesPage />} />
              <Route path="/account/auto-invest" element={<AutoInvestPage />} />
              <Route path="/account/rmd" element={<RmdPage />} />
              <Route path="/account/tax-documents" element={<TaxDocumentsPage />} />
              <Route path="/open-account" element={<OpenAccountPage />} />
              <Route path="/resources/ira-contribution-limits" element={<IraContributionLimitsPage />} />
              <Route path="/resources/roth-ira" element={<RothIraPage />} />
              <Route path="/resources/sep-ira" element={<SepIraPage />} />
              <Route path="/resources/sep-ira-vs-solo" element={<SepIraVsSoloPage />} />
              <Route path="/resources/tax-efficient-investing" element={<TaxEfficientInvestingPage />} />
              <Route path="/resources/estate-planning" element={<EstatePlanningPage />} />
              <Route path="/resources/self-employed-retirement" element={<SelfEmployedRetirementPage />} />
              <Route path="/resources/tax-deductions" element={<TaxDeductionsPage />} />
              <Route path="/resources/rollover" element={<RolloverPage />} />
            </Routes>
          </main>
          {/* ChatWidget mounts once at root — persists across page navigation */}
          <ChatWidget />
        </div>
      </BrowserRouter>
    </AccessGate>
  );
}
