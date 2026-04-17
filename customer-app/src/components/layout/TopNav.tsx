import React from 'react';
import { NavLink } from 'react-router-dom';
import { MOCK_CLIENT } from '../../data/mock-client';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/research', label: 'Research' },
  { to: '/account', label: 'Account' },
];

export function TopNav() {
  return (
    <nav style={{
      background: '#0f2d5e', color: '#fff', padding: '0 32px',
      display: 'flex', alignItems: 'center', height: 64, gap: 32,
      position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,.2)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>B</div>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.3px' }}>Bob's Mutual Funds</span>
      </div>

      {/* Nav links */}
      {NAV_LINKS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            color: isActive ? '#93c5fd' : 'rgba(255,255,255,.8)',
            textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 400,
            borderBottom: isActive ? '2px solid #93c5fd' : '2px solid transparent',
            paddingBottom: 2,
          })}
        >
          {label}
        </NavLink>
      ))}

      {/* Spacer + user */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{MOCK_CLIENT.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            Total: ${MOCK_CLIENT.totalBalance.toLocaleString()}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14,
        }}>
          {MOCK_CLIENT.name.split(' ').map(n => n[0]).join('')}
        </div>
      </div>
    </nav>
  );
}
