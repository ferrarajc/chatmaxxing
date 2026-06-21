import React from 'react';
import { theme } from '../../../theme';
import { ProfileHeader } from './sections/ProfileHeader';
import { ContactInfoSection } from './sections/ContactInfoSection';
import { PersonalDetailsSection } from './sections/PersonalDetailsSection';
import { SecuritySection } from './sections/SecuritySection';
import { AuthorizedAgentsSection } from './sections/AuthorizedAgentsSection';
import { CommunicationSection } from './sections/CommunicationSection';
import { BankingSection } from './sections/BankingSection';
import { TrustedContactSection } from './sections/TrustedContactSection';
import { InvestorProfileSection } from './sections/InvestorProfileSection';
import { WatchlistSection } from './sections/WatchlistSection';
import { AgreementsSection } from './sections/AgreementsSection';
import { AccountServicesGrid } from './sections/AccountServicesGrid';

export function AccountPage() {
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <ProfileHeader />
      <ContactInfoSection />
      <PersonalDetailsSection />
      <SecuritySection />
      <AuthorizedAgentsSection />
      <CommunicationSection />
      <BankingSection />
      <TrustedContactSection />
      <InvestorProfileSection />
      <WatchlistSection />
      <AgreementsSection />
      <AccountServicesGrid />
    </div>
  );
}
