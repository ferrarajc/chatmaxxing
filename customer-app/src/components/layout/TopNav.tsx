import React, { useRef, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PERSONAS } from '../../data/personas';
import { useClientStore } from '../../store/clientStore';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/research', label: 'Research' },
  { to: '/account', label: 'Account' },
];

export function TopNav() {
  const { activePersona, setActivePersona } = useClientStore();
  const [open, setOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initials = activePersona.name.split(' ').map(n => n[0]).join('');

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
          <div style={{ fontSize: 13, fontWeight: 600 }}>{activePersona.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            Total: ${activePersona.totalBalance.toLocaleString()}
          </div>
        </div>

        {/* Avatar with persona switcher dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setOpen(o => !o)}
            style={{
              width: 36, height: 36, borderRadius: '50%', background: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              outline: open ? '2px solid #93c5fd' : 'none',
            }}
          >
            {initials}
          </div>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 44, background: '#fff', color: '#111',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', minWidth: 200,
              overflow: 'hidden', zIndex: 200,
            }}>
              <div style={{ padding: '8px 14px 6px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                Switch Client
              </div>
              {PERSONAS.map(p => {
                const isActive = p.clientId === activePersona.clientId;
                return (
                  <div
                    key={p.clientId}
                    onClick={() => { setActivePersona(p.clientId); setOpen(false); }}
                    style={{
                      padding: '10px 14px',
                      background: isActive ? '#eff6ff' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderTop: '1px solid #f3f4f6',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isActive ? '#2563eb' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      color: isActive ? '#fff' : '#6b7280',
                      flexShrink: 0,
                    }}>
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#1a56db' : '#111' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        ${p.totalBalance.toLocaleString()}
                      </div>
                    </div>
                    {isActive && <div style={{ marginLeft: 'auto', color: '#2563eb', fontSize: 14 }}>✓</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
