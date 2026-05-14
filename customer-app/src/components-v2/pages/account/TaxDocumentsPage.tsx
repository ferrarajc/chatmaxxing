import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClientStore } from '../../../store/clientStore';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: '20px 24px',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

interface TaxDoc {
  form: string;
  description: string;
  taxYear: number;
  account: string;
  available: boolean;
  date?: string;
}

function buildDocuments(accountTypes: string[]): TaxDoc[] {
  const docs: TaxDoc[] = [];
  const years = [2024, 2023, 2022];

  for (const year of years) {
    if (accountTypes.some(t => t !== 'Taxable Account')) {
      docs.push({
        form: '5498',
        description: 'IRA Contributions',
        taxYear: year,
        account: accountTypes.filter(t => t !== 'Taxable Account').join(', '),
        available: year < 2025,
        date: year === 2024 ? '2025-05-31' : `${year + 1}-05-31`,
      });
    }
    docs.push({
      form: '1099-DIV',
      description: 'Dividend Distributions',
      taxYear: year,
      account: 'All accounts',
      available: true,
      date: year === 2024 ? '2025-02-15' : `${year + 1}-02-15`,
    });
    if (accountTypes.includes('Taxable Account')) {
      docs.push({
        form: '1099-B',
        description: 'Sale Proceeds & Cost Basis',
        taxYear: year,
        account: 'Taxable Account',
        available: true,
        date: year === 2024 ? '2025-02-15' : `${year + 1}-02-15`,
      });
    }
    if (accountTypes.some(t => t === 'Traditional IRA' || t === 'SEP-IRA')) {
      docs.push({
        form: '1099-R',
        description: 'Retirement Distributions',
        taxYear: year,
        account: accountTypes.filter(t => t === 'Traditional IRA' || t === 'SEP-IRA').join(', '),
        available: year < 2025,
        date: year === 2024 ? '2025-01-31' : `${year + 1}-01-31`,
      });
    }
  }

  return docs;
}

export function TaxDocumentsPage() {
  const { activePersona } = useClientStore();
  const accountTypes = activePersona.accounts.map(a => a.type);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const allDocs = buildDocuments(accountTypes);
  const docs = selectedYear === 'all' ? allDocs : allDocs.filter(d => d.taxYear === selectedYear);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link to="/account" style={{ color: theme.color.textMuted, fontSize: 13, textDecoration: 'none' }}>← Account</Link>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>Tax Documents</h1>
      <p style={{ margin: '0 0 28px', color: theme.color.textMuted, fontSize: 14 }}>
        All tax forms for your accounts, going back 7 years. Available as PDFs.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', 2024, 2023, 2022] as const).map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: '1px solid',
              borderColor: selectedYear === y ? theme.color.primary : theme.color.borderStrong,
              background: selectedYear === y ? theme.color.primarySoft : theme.color.surface,
              color: selectedYear === y ? theme.color.primary : theme.color.text,
              cursor: 'pointer',
            }}
          >
            {y === 'all' ? 'All years' : y}
          </button>
        ))}
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.color.border}` }}>
              {['Form', 'Description'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 12px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
              <th style={{ textAlign: 'right', padding: '6px 8px 12px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>Tax Year</th>
              {['Account', 'Available'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 12px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
              <th style={{ textAlign: 'center', padding: '6px 8px 12px', color: theme.color.textMuted, fontWeight: 600, fontSize: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${theme.color.border}` }}>
                <td style={{ padding: '11px 8px', fontWeight: 700 }}>{d.form}</td>
                <td style={{ padding: '11px 8px' }}>{d.description}</td>
                <td style={{ padding: '11px 8px', textAlign: 'right' }}>{d.taxYear}</td>
                <td style={{ padding: '11px 8px', color: theme.color.textMuted, fontSize: 13 }}>{d.account}</td>
                <td style={{ padding: '11px 8px' }}>
                  {d.available ? (
                    <span style={{ color: theme.color.success, fontSize: 12, fontWeight: 600 }}>✓ Available</span>
                  ) : (
                    <span style={{ color: theme.color.textSubtle, fontSize: 12 }}>Available {d.date}</span>
                  )}
                </td>
                <td style={{ padding: '11px 8px', textAlign: 'center' }}>
                  {d.available && (
                    <button
                      onClick={() => alert(`Downloading ${d.form} for ${d.taxYear} (demo)`)}
                      style={{ background: 'none', border: `1px solid ${theme.color.borderStrong}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: theme.color.text }}
                    >
                      Download PDF
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.color.primary }}>
        Tax forms are emailed to {activePersona.email} when available. Consolidated 1099s are typically ready by February 15 for the prior year. Contact us if you need a corrected form.
      </div>
    </div>
  );
}
