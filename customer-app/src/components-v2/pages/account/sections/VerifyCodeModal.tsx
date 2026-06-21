import React, { useEffect, useRef, useState } from 'react';
import { useClientStore } from '../../../../store/clientStore';
import { theme } from '../../../../theme';
import { PrimaryButton, GhostButton } from './ui';

// Real verification code entry. Sends a 6-digit code to the given email/phone via
// the /verify Lambda (Amazon SES for email, AWS End User Messaging SMS for text)
// and confirms it. Reuses the centered-overlay modal pattern from ChatPanel.

type Channel = 'email' | 'sms';
type Phase = 'sending' | 'entry' | 'verifying' | 'error';

export function VerifyCodeModal({ channel, target, displayTarget, onClose, onVerified }: {
  channel: Channel;
  target: string;                 // raw email or 10-digit phone
  displayTarget: string;          // human-friendly value for the copy
  onClose: () => void;
  onVerified: () => void;
}) {
  const sendVerifyCode = useClientStore(s => s.sendVerifyCode);
  const confirmVerifyCode = useClientStore(s => s.confirmVerifyCode);

  const [phase, setPhase] = useState<Phase>('sending');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const sentRef = useRef(false);

  const send = async () => {
    setPhase('sending');
    setMessage('');
    const res = await sendVerifyCode(channel, target);
    if (res.ok && res.sent) {
      setPhase('entry');
    } else {
      setPhase('error');
      setMessage(res.error ?? 'We could not send a code right now. Please try again later.');
    }
  };

  // Auto-send once on open (guard against StrictMode double-invoke).
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async () => {
    if (code.replace(/\D/g, '').length !== 6) return;
    setPhase('verifying');
    setMessage('');
    const res = await confirmVerifyCode(channel, target, code.replace(/\D/g, ''));
    if (res.verified) {
      onVerified();
      onClose();
    } else {
      setPhase('entry');
      setMessage(res.error ?? 'That code was incorrect or expired. Try again.');
    }
  };

  const noun = channel === 'email' ? 'email address' : 'phone number';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 35, 64, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: theme.color.surface, borderRadius: theme.radius.lg, boxShadow: theme.shadow.xl,
        padding: '24px 26px', width: '100%', maxWidth: 420, fontFamily: theme.font.sans,
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, fontFamily: theme.font.serif, color: theme.color.text, marginBottom: 8 }}>
          Verify your {noun}
        </div>

        {phase === 'sending' && (
          <p style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5, margin: 0 }}>
            Sending a 6-digit code to <strong style={{ color: theme.color.text }}>{displayTarget}</strong>…
          </p>
        )}

        {phase === 'error' && (
          <>
            <p style={{ fontSize: 14, color: theme.color.danger, lineHeight: 1.5, margin: '0 0 18px' }}>{message}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton onClick={send}>Try again</PrimaryButton>
              <GhostButton onClick={onClose}>Close</GhostButton>
            </div>
          </>
        )}

        {(phase === 'entry' || phase === 'verifying') && (
          <>
            <p style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5, margin: '0 0 16px' }}>
              Enter the 6-digit code we sent to <strong style={{ color: theme.color.text }}>{displayTarget}</strong>. It expires in 10 minutes.
            </p>
            <input
              autoFocus
              inputMode="numeric"
              value={code}
              maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && verify()}
              placeholder="• • • • • •"
              style={{
                width: '100%', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '0.4em',
                padding: '12px 14px', fontSize: 22, fontWeight: 700, fontFamily: theme.font.mono,
                border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.md,
                color: theme.color.text, marginBottom: 12,
              }}
            />
            {message && <p style={{ fontSize: 13, color: theme.color.danger, margin: '0 0 12px' }}>{message}</p>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <PrimaryButton onClick={verify} disabled={phase === 'verifying' || code.length !== 6}>
                {phase === 'verifying' ? 'Verifying…' : 'Verify'}
              </PrimaryButton>
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <button onClick={send} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: theme.color.primary, fontSize: 13, fontWeight: 600 }}>
                Resend code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
