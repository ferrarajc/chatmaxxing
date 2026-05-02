import React, { useState } from 'react';
import { useClientStore } from '../../../store/clientStore';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '20px 24px',
  boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <a href="/account" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Account</a>
      </div>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>Tax Documents</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14 }}>
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
              borderColor: selectedYear === y ? '#1a56db' : '#d1d5db',
              background: selectedYear === y ? '#eff6ff' : '#fff',
              color: selectedYear === y ? '#1a56db' : '#374151',
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
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Form', 'Description', 'Tax Year', 'Account', 'Available', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px 12px', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '11px 8px', fontWeight: 700 }}>{d.form}</td>
                <td style={{ padding: '11px 8px' }}>{d.description}</td>
                <td style={{ padding: '11px 8px' }}>{d.taxYear}</td>
                <td style={{ padding: '11px 8px', color: '#6b7280', fontSize: 13 }}>{d.account}</td>
                <td style={{ padding: '11px 8px' }}>
                  {d.available ? (
                    <span style={{ color: '#065f46', fontSize: 12, fontWeight: 600 }}>✓ Available</span>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>Available {d.date}</span>
                  )}
                </td>
                <td style={{ padding: '11px 8px' }}>
                  {d.available && (
                    <button
                      onClick={() => alert(`Downloading ${d.form} for ${d.taxYear} (demo)`)}
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}
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

      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#0c4a6e' }}>
        Tax forms are emailed to {activePersona.email} when available. Consolidated 1099s are typically ready by February 15 for the prior year. Contact us if you need a corrected form.
      </div>
    </div>
  );
}
