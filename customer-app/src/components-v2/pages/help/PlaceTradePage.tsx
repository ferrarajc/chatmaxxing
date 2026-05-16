import React from 'react';
import { NavLink } from 'react-router-dom';
import { theme } from '../../../theme';

const card: React.CSSProperties = {
  background: theme.color.surface, borderRadius: theme.radius.lg, padding: '24px',
  boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`, marginBottom: 20,
};

export function PlaceTradePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: theme.font.sans }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, fontFamily: theme.font.serif }}>How to Place a Trade</h1>
      <p style={{ margin: '0 0 32px', color: theme.color.textMuted, fontSize: 14 }}>
        Buy, sell, or exchange BobsFunds mutual fund shares online in a few simple steps. Trades cannot be processed through chat — use your online account or call our brokerage desk.
      </p>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Place a Trade Online</h2>
        {[
          { step: '1', title: 'Log in to your account', body: 'Visit bobrsmutualfunds.com and sign in with your username and password.' },
          { step: '2', title: 'Go to Transactions', body: 'From the dashboard, select the account you\'d like to trade in, then click Transactions → Buy / Sell / Exchange.' },
          { step: '3', title: 'Choose your trade type', body: 'Select Buy (purchase shares), Sell / Redeem (sell shares), or Exchange (swap between BobsFunds funds).' },
          { step: '4', title: 'Enter the amount', body: 'Specify a dollar amount or number of shares. Market orders execute at that day\'s NAV if submitted before 4:00 PM ET.' },
          { step: '5', title: 'Review and confirm', body: 'Check all details, then click Confirm Order. You\'ll receive an email confirmation within minutes.' },
        ].map(item => (
          <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
              {item.step}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 14, color: theme.color.textMuted, lineHeight: 1.5 }}>{item.body}</div>
            </div>
          </div>
        ))}
        <div style={{ background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text, marginTop: 4 }}>
          <strong>Cut-off time:</strong> Orders submitted before <strong>4:00 PM Eastern Time</strong> on a business day receive that day's NAV. Orders after 4:00 PM receive the next business day's NAV.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Prefer to Trade by Phone?</h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          Our licensed brokerage desk is available Monday–Friday, 8:00 AM – 7:30 PM Eastern Time.
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li>Call <strong>1-800-BOB-FUND</strong> and say "place a trade"</li>
          <li>Have your account number and SSN/TIN ready</li>
          <li>A licensed broker will walk you through the transaction</li>
        </ul>
        <div style={{ background: theme.color.warningSoft, border: `1px solid ${theme.color.warningBorder}`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: theme.color.text }}>
          <strong>Chat agents cannot execute trades.</strong> For security and regulatory reasons, all buy, sell, and exchange orders must be placed online or by phone with a licensed broker.
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>Trade Types at a Glance</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: theme.color.text }}>
          <li><strong>Buy (Purchase):</strong> Add shares to your account using available cash or a linked bank account</li>
          <li><strong>Sell (Redeem):</strong> Convert shares to cash; proceeds deposited via ACH within 1–3 business days</li>
          <li><strong>Exchange:</strong> Swap from one BobsFunds fund to another in the same account — no tax event for IRAs</li>
          <li><strong>Systematic Investment Plan (SIP):</strong> Automate recurring purchases — see our <NavLink to="/help/sip" style={{ color: theme.color.primary, textDecoration: 'underline' }}>SIP guide</NavLink></li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <NavLink to="/portfolio" style={{ display: 'inline-block', padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to Your Portfolio →
        </NavLink>
      </div>
    </div>
  );
}
