import { theme } from './theme';
import { UpcomingCallsBoard } from './components/UpcomingCallsBoard';
import { DossierView } from './components/DossierView';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { LiveCallConsole } from './components/LiveCallConsole';
import { Avatar } from './components/ui';

export default function App() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: theme.color.bg }}>
      <header style={{ height: 60, flexShrink: 0, background: theme.color.primary, color: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fff', color: theme.color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: theme.font.serif }}>B</div>
        <div style={{ fontFamily: theme.font.serif, fontSize: 17, fontWeight: 700 }}>Bob's — Callback Console</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Phone agent</span>
          <Avatar initials="PA" size={32} />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(360px, 460px) 1fr' }}>
        <div style={{ padding: 20, borderRight: `1px solid ${theme.color.border}`, minHeight: 0 }}>
          <UpcomingCallsBoard />
        </div>
        <div style={{ padding: '20px 24px', minHeight: 0 }}>
          <DossierView />
        </div>
      </div>

      <IncomingCallOverlay />
      <LiveCallConsole />
    </div>
  );
}
