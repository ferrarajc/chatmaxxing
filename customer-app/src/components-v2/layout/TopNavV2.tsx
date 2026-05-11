import React, { useRef, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PERSONAS } from '../../data/personas';
import { useClientStore } from '../../store/clientStore';
import { useDesignStore } from '../../store/designStore';
import { theme } from '../../theme';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/research', label: 'Research' },
  { to: '/account', label: 'Account' },
];

export function TopNavV2() {
  const { activePersona, setActivePersona } = useClientStore();
  const { design, setDesign } = useDesignStore();
  const [open, setOpen] = useState(false);
  const [designMenuOpen, setDesignMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!designMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (bRef.current && !bRef.current.contains(e.target as Node)) {
        setDesignMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [designMenuOpen]);

  const initials = activePersona.name.split(' ').map(n => n[0]).join('');

  return (
    <nav style={{
      background: theme.color.primary, color: theme.color.textOnPrimary, padding: '0 32px',
      display: 'flex', alignItems: 'center', height: 68, gap: 32,
      position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `1px solid ${theme.color.primaryDeep}`,
      fontFamily: theme.font.sans,
    }}>
      {/* Logo + hidden design toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 12 }}>
        <div ref={bRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setDesignMenuOpen(o => !o)}
            style={{
              width: 36, height: 36, borderRadius: 6, background: theme.color.bg,
              color: theme.color.primary, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 20, fontWeight: 700,
              fontFamily: theme.font.serif, letterSpacing: '-0.02em',
              cursor: 'pointer',
            }}
          >B</div>
          {designMenuOpen && (
            <div style={{
              position: 'absolute', left: 0, top: 48, background: theme.color.surface,
              color: theme.color.text,
              borderRadius: theme.radius.lg, boxShadow: theme.shadow.lg, minWidth: 200,
              overflow: 'hidden', zIndex: 300, border: `1px solid ${theme.color.border}`,
            }}>
              <div style={{
                padding: '10px 14px 8px', fontSize: 10, fontWeight: 700,
                color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Switch design
              </div>
              {(['original', 'upgraded'] as const).map(d => (
                <div
                  key={d}
                  onClick={() => { setDesign(d); setDesignMenuOpen(false); }}
                  style={{
                    padding: '10px 14px',
                    background: design === d ? theme.color.primarySoft : 'transparent',
                    cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: `1px solid ${theme.color.border}`,
                    fontSize: 13, fontWeight: design === d ? 600 : 500,
                    color: design === d ? theme.color.primary : theme.color.text,
                  }}
                  onMouseEnter={e => { if (design !== d) (e.currentTarget as HTMLElement).style.background = theme.color.surfaceMuted; }}
                  onMouseLeave={e => { if (design !== d) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {d === 'original' ? 'Original design' : 'Upgraded design'}
                  {design === d && <span style={{ fontSize: 14, color: theme.color.primary }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: theme.font.serif, fontWeight: 600, fontSize: 18,
          letterSpacing: '-0.01em',
        }}>Bob's Mutual Funds</span>
      </div>

      {/* Nav links */}
      {NAV_LINKS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={({ isActive }) => ({
            color: isActive ? theme.color.textOnPrimary : 'rgba(251,249,244,0.72)',
            textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 500,
            borderBottom: isActive ? `2px solid ${theme.color.accent}` : '2px solid transparent',
            paddingBottom: 4, letterSpacing: '0.01em',
            transition: 'color .15s, border-color .15s',
          })}
        >
          {label}
        </NavLink>
      ))}

      {/* Spacer + user */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{activePersona.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
            Total: ${activePersona.totalBalance.toLocaleString()}
          </div>
        </div>

        {/* Avatar with persona switcher dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setOpen(o => !o)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: theme.color.accent, color: theme.color.textOnPrimary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              outline: open ? `2px solid ${theme.color.accentSoft}` : 'none',
              outlineOffset: 2, letterSpacing: '0.04em',
            }}
          >
            {initials}
          </div>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 48, background: theme.color.surface,
              color: theme.color.text,
              borderRadius: theme.radius.lg, boxShadow: theme.shadow.lg, minWidth: 220,
              overflow: 'hidden', zIndex: 200,
              border: `1px solid ${theme.color.border}`,
            }}>
              <div style={{
                padding: '10px 14px 8px', fontSize: 10, fontWeight: 700,
                color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
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
                      background: isActive ? theme.color.primarySoft : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderTop: `1px solid ${theme.color.border}`,
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = theme.color.surfaceMuted; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isActive ? theme.color.primary : theme.color.surfaceMuted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      color: isActive ? theme.color.textOnPrimary : theme.color.textMuted,
                      flexShrink: 0, letterSpacing: '0.04em',
                    }}>
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? theme.color.primary : theme.color.text }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: theme.color.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        ${p.totalBalance.toLocaleString()}
                      </div>
                    </div>
                    {isActive && <div style={{ marginLeft: 'auto', color: theme.color.primary, fontSize: 14 }}>✓</div>}
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
