import React from 'react';
import { useClientStore } from '../../../store/clientStore';

export function AccountPage() {
  const { activePersona } = useClientStore();

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800 }}>My Account</h1>

      {[
        {
          title: 'Personal Information',
          fields: [
            { label: 'Name',    value: activePersona.name },
            { label: 'Email',   value: activePersona.email },
            { label: 'Phone',   value: activePersona.displayPhone },
            { label: 'Address', value: activePersona.address },
          ],
        },
        {
          title: 'Security',
          fields: [
            { label: 'Two-factor authentication', value: 'Enabled (SMS)' },
            { label: 'Last login',                value: 'Today, 9:14 AM ET' },
            { label: 'Password',                  value: '••••••••••' },
          ],
        },
        {
          title: 'Preferences',
          fields: [
            { label: 'Statements',    value: 'Paperless' },
            { label: 'Tax documents', value: 'Online delivery' },
            { label: 'Language',      value: 'English' },
          ],
        },
      ].map(section => (
        <div key={section.title} style={{
          background: '#fff', borderRadius: 14, padding: '24px',
          boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb', marginBottom: 20,
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{section.title}</h2>
          {section.fields.map(f => (
            <div key={f.label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14,
            }}>
              <span style={{ color: '#6b7280' }}>{f.label}</span>
              <span style={{ fontWeight: 500 }}>{f.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
