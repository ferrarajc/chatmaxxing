import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from './theme';
import { TopNavV2 } from './components-v2/layout/TopNavV2';
import { ChatWidget } from './components-v2/chat/ChatWidget';
import { AccessGate } from './components-v2/AccessGate';
import { HomePage } from './components-v2/pages/home/HomePage';
import { PortfolioPage } from './components-v2/pages/portfolio/PortfolioPage';
import { ResearchPage } from './components-v2/pages/research/ResearchPage';
import { AccountPage } from './components-v2/pages/account/AccountPage';
import { AccountDetailPage } from './components-v2/pages/account/AccountDetailPage';
import { BeneficiariesPage } from './components-v2/pages/account/BeneficiariesPage';
import { AutoInvestPage } from './components-v2/pages/account/AutoInvestPage';
import { RmdPage } from './components-v2/pages/account/RmdPage';
import { TaxDocumentsPage } from './components-v2/pages/account/TaxDocumentsPage';
import { OpenAccountPage } from './components-v2/pages/OpenAccountPage';
import { IraContributionLimitsPage } from './components-v2/pages/resources/IraContributionLimitsPage';
import { RothIraPage } from './components-v2/pages/resources/RothIraPage';
import { SepIraPage } from './components-v2/pages/resources/SepIraPage';
import { SepIraVsSoloPage } from './components-v2/pages/resources/SepIraVsSoloPage';
import { TaxEfficientInvestingPage } from './components-v2/pages/resources/TaxEfficientInvestingPage';
import { EstatePlanningPage } from './components-v2/pages/resources/EstatePlanningPage';
import { SelfEmployedRetirementPage } from './components-v2/pages/resources/SelfEmployedRetirementPage';
import { TaxDeductionsPage } from './components-v2/pages/resources/TaxDeductionsPage';
import { RolloverPage } from './components-v2/pages/resources/RolloverPage';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..900&family=Inter:wght@400;500;600;700&display=swap';

export default function AppV2() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  return (
    <AccessGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div style={{ minHeight: '100vh', background: theme.color.bg, fontFamily: theme.font.sans, textAlign: 'left' }}>
          <TopNavV2 />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/detail/:accountId" element={<AccountDetailPage />} />
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
          <ChatWidget />
        </div>
      </BrowserRouter>
    </AccessGate>
  );
}
