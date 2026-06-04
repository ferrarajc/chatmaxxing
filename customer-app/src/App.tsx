import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import { theme } from './theme';
import { TopNavV2 } from './components-v2/layout/TopNavV2';
import { ChatWidget } from './components-v2/chat/ChatWidget';
import { AccessGate } from './components-v2/AccessGate';
import { HomePage } from './components-v2/pages/home/HomePage';
import { PortfolioPage } from './components-v2/pages/portfolio/PortfolioPage';
import { ResearchPage } from './components-v2/pages/research/ResearchPage';
import { FundProfilePage } from './components-v2/pages/research/FundProfilePage';
import { BuyPage } from './components-v2/pages/research/BuyPage';
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
import { RetirementCalculatorPage } from './components-v2/pages/resources/RetirementCalculatorPage';
import { LibraryPage } from './components-v2/pages/library/LibraryPage';
import { ArticlePage } from './components-v2/pages/library/ArticlePage';
import { BobPodPage } from './components-v2/pages/library/BobPodPage';
import { AccountAccessPage } from './components-v2/pages/help/AccountAccessPage';
import { AccountTransferPage } from './components-v2/pages/help/AccountTransferPage';
import { BeneficiaryPage } from './components-v2/pages/help/BeneficiaryPage';
import { ContactPage } from './components-v2/pages/help/ContactPage';
import { CostBasisPage } from './components-v2/pages/help/CostBasisPage';
import { DripPage } from './components-v2/pages/help/DripPage';
import { EstatePlanningHelpPage } from './components-v2/pages/help/EstatePlanningHelpPage';
import { FeesPage } from './components-v2/pages/help/FeesPage';
import { FundPerformancePage } from './components-v2/pages/help/FundPerformancePage';
import { InheritancePage } from './components-v2/pages/help/InheritancePage';
import { IraLimitsHelpPage } from './components-v2/pages/help/IraLimitsHelpPage';
import { OpenAccountHelpPage } from './components-v2/pages/help/OpenAccountHelpPage';
import { OwnershipFormPage } from './components-v2/pages/help/OwnershipFormPage';
import { PlaceTradePage } from './components-v2/pages/help/PlaceTradePage';
import { ProspectusPage } from './components-v2/pages/help/ProspectusPage';
import { RmdGuidePage } from './components-v2/pages/help/RmdGuidePage';
import { RolloverGuidePage } from './components-v2/pages/help/RolloverGuidePage';
import { SipPage } from './components-v2/pages/help/SipPage';
import { StatementsPage } from './components-v2/pages/help/StatementsPage';
import { TaxDocumentsHelpPage } from './components-v2/pages/help/TaxDocumentsHelpPage';
import { TradingPage } from './components-v2/pages/help/TradingPage';
import { WireTransferPage } from './components-v2/pages/help/WireTransferPage';
import { WithdrawalsPage } from './components-v2/pages/help/WithdrawalsPage';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..900&family=Inter:wght@400;500;600;700&display=swap';

export default function App() {
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
          <ScrollToTop />
          <TopNavV2 />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/research" element={<ResearchPage />} />
              <Route path="/research/fund/:ticker" element={<FundProfilePage />} />
              <Route path="/research/fund/:ticker/buy" element={<BuyPage />} />
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
              <Route path="/resources/retirement-calculator" element={<RetirementCalculatorPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/library/bob-pod" element={<BobPodPage />} />
              <Route path="/library/guide/:slug" element={<ArticlePage category="guide" />} />
              <Route path="/library/opinion/:slug" element={<ArticlePage category="opinion" />} />
              <Route path="/help/account-access" element={<AccountAccessPage />} />
              <Route path="/help/account-transfer" element={<AccountTransferPage />} />
              <Route path="/help/beneficiary" element={<BeneficiaryPage />} />
              <Route path="/help/contact" element={<ContactPage />} />
              <Route path="/help/cost-basis" element={<CostBasisPage />} />
              <Route path="/help/drip" element={<DripPage />} />
              <Route path="/help/estate-planning" element={<EstatePlanningHelpPage />} />
              <Route path="/help/fees" element={<FeesPage />} />
              <Route path="/help/fund-performance" element={<FundPerformancePage />} />
              <Route path="/help/inheritance" element={<InheritancePage />} />
              <Route path="/help/ira-limits" element={<IraLimitsHelpPage />} />
              <Route path="/help/open-account" element={<OpenAccountHelpPage />} />
              <Route path="/help/ownership-form" element={<OwnershipFormPage />} />
              <Route path="/help/place-trade" element={<PlaceTradePage />} />
              <Route path="/help/prospectus" element={<ProspectusPage />} />
              <Route path="/help/rmd-guide" element={<RmdGuidePage />} />
              <Route path="/help/rollover-guide" element={<RolloverGuidePage />} />
              <Route path="/help/sip" element={<SipPage />} />
              <Route path="/help/statements" element={<StatementsPage />} />
              <Route path="/help/tax-documents" element={<TaxDocumentsHelpPage />} />
              <Route path="/help/trading" element={<TradingPage />} />
              <Route path="/help/wire-transfer" element={<WireTransferPage />} />
              <Route path="/help/withdrawals" element={<WithdrawalsPage />} />
            </Routes>
          </main>
          <ChatWidget />
        </div>
      </BrowserRouter>
    </AccessGate>
  );
}
