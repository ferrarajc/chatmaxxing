import React from 'react';

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#1a56db',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff',
      }}>🤖</div>
      <div style={{
        background: '#f3f4f6', borderRadius: '16px 16px 16px 4px',
        padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: '#999',
            display: 'inline-block',
            animation: `bounce 1.2s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
    </div>
  );
}
