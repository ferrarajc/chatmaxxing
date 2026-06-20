import React, { useRef, useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { PERSONAS } from '../../data/personas';
import { useClientStore } from '../../store/clientStore';
import { theme } from '../../theme';
import { useFeatureFlags, EXPERIMENTS } from '../../store/featureFlagsStore';
import { ToggleSwitch } from '../common/ToggleSwitch';

const RESET_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/reset-client-data?key=bobs-reset-2025`;

const NAV_LINKS = [
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/research', label: 'Research' },
  { to: '/account', label: 'Account' },
  { to: '/library', label: 'Library' },
];

export function TopNavV2() {
  const { activePersona, setActivePersona, refreshFromDb } = useClientStore();
  const flags = useFeatureFlags(s => s.flags);
  const setFlag = useFeatureFlags(s => s.setFlag);
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setResetting(true);
    setResetDone(false);
    try {
      await fetch(RESET_URL);
      await refreshFromDb();
      setResetDone(true);
      setTimeout(() => setResetDone(false), 2500);
    } catch {
      // non-critical; silently ignore
    } finally {
      setResetting(false);
    }
  };

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
      background: theme.color.primary, color: theme.color.textOnPrimary, padding: '0 32px',
      display: 'flex', alignItems: 'center', height: 68, gap: 32,
      position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `1px solid ${theme.color.primaryDeep}`,
      fontFamily: theme.font.sans,
    }}>
      {/* Logo — links to home */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 12, textDecoration: 'none', color: 'inherit' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, background: theme.color.bg,
          color: theme.color.primary, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, fontWeight: 700,
          fontFamily: theme.font.serif, letterSpacing: '-0.02em',
        }}>B</div>
        <span style={{
          fontFamily: theme.font.serif, fontWeight: 600, fontSize: 18,
          letterSpacing: '-0.01em',
        }}>Bob's Mutual Funds</span>
      </Link>

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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>Switch Client</span>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  title="Reset all clients to default demo data"
                  style={{
                    background: 'none', border: `1px solid ${theme.color.border}`,
                    borderRadius: theme.radius.md, padding: '2px 8px',
                    fontSize: 10, cursor: resetting ? 'default' : 'pointer',
                    color: resetDone ? theme.color.success : theme.color.textMuted,
                    fontWeight: 600, letterSpacing: '0.04em',
                    transition: 'color .2s, border-color .2s',
                    whiteSpace: 'nowrap',
                    textTransform: 'none',
                  }}
                >
                  {resetting ? '…' : resetDone ? '✓ Done' : '↺ Reset all'}
                </button>
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

              {/* ── Experimental features ── */}
              <div style={{ borderTop: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted }}>
                <div style={{
                  padding: '10px 14px 6px', fontSize: 10, fontWeight: 700,
                  color: theme.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Experimental features
                </div>
                {EXPERIMENTS.map(exp => (
                  <div key={exp.key} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.color.text }}>{exp.label}</span>
                    <ToggleSwitch
                      on={flags[exp.key] === true}
                      onChange={on => setFlag(exp.key, on)}
                      title={`Turn ${exp.label} ${flags[exp.key] ? 'off' : 'on'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
