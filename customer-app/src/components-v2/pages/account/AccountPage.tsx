import React from 'react';
import { useClientStore } from '../../../store/clientStore';
import { theme } from '../../../theme';

export function AccountPage() {
  const { activePersona } = useClientStore();

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ margin: '0 0 28px', fontSize: 32, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.02em', lineHeight: 1.1 }}>My Account</h1>

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
          background: theme.color.surface, borderRadius: theme.radius.lg, padding: '26px',
          boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
        }}>
          <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>{section.title}</h2>
          {section.fields.map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${theme.color.border}`, fontSize: 14 }}>
              <span style={{ color: theme.color.textMuted }}>{f.label}</span>
              <span style={{ fontWeight: 500, color: theme.color.text }}>{f.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
