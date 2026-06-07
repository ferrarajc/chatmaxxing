import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';

/* ============================================================================
   Open a New Account — multi-step application wizard
   ----------------------------------------------------------------------------
   8 progressive steps that mirror a real brokerage onboarding flow:
     1. Account type
     2. Personal information
     3. Contact & address
     4. Regulatory disclosures (FINRA 4512 / SEC)
     5. Account setup (beneficiaries / business info / joint owner — varies)
     6. Funding & initial investment
     7. Free dollar-cost-averaging opt-in
     8. Review, agreements & e-signature
   Then a confirmation screen with a "what happens next" timeline.

   This is a front-end demo: no network calls are made on submit.
   All form primitives are defined at module scope so they keep a stable
   identity across renders (avoids input remount / focus loss).
============================================================================ */

// ── Shared style atoms ──────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: theme.color.surface,
  borderRadius: theme.radius.lg,
  padding: 24,
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.color.border}`,
  marginBottom: 20,
};

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

const inputBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 11px',
  border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: theme.radius.md,
  fontSize: 14,
  fontFamily: theme.font.sans,
  color: theme.color.text,
  background: theme.color.surface,
  boxSizing: 'border-box',
};

const labelText: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: theme.color.text,
  letterSpacing: '0.01em',
  display: 'block',
};

const hintText: React.CSSProperties = {
  display: 'block',
  marginTop: 5,
  fontSize: 11.5,
  color: theme.color.textMuted,
  lineHeight: 1.45,
  fontWeight: 400,
};

const req = (...vals: any[]) => vals.every(v => v !== undefined && v !== null && String(v).trim() !== '');

function applyMask(value: string, mask: 'ssn' | 'phone' | 'ein'): string {
  const digits = value.replace(/\D/g, '');
  if (mask === 'ssn') {
    const d = digits.slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  }
  if (mask === 'ein') {
    const d = digits.slice(0, 9);
    return d.length <= 2 ? d : `${d.slice(0, 2)}-${d.slice(2)}`;
  }
  // phone: (XXX) XXX-XXXX
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const maskPlaceholder = { ssn: 'XXX-XX-XXXX', phone: '(XXX) XXX-XXXX', ein: 'XX-XXXXXXX' };
const maskMaxLen    = { ssn: 11, phone: 14, ein: 10 };

// ── Option helpers ──────────────────────────────────────────────────────────

type Opt = string | { value: string; label: string };
const normOpts = (opts: Opt[]) =>
  opts.map(o => (typeof o === 'string' ? { value: o, label: o } : o));

// ── Field primitives ────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span style={labelText}>
      {label}
      {required && <span style={{ color: theme.color.danger, marginLeft: 2 }}>*</span>}
    </span>
  );
}

function TextField(props: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
  full?: boolean; prefix?: string; maxLength?: number; inputMode?: any;
  mask?: 'ssn' | 'phone' | 'ein';
}) {
  const [focus, setFocus] = useState(false);
  const ctrl: React.CSSProperties = {
    ...inputBase,
    marginTop: 6,
    paddingLeft: props.prefix ? 26 : 11,
    borderColor: focus ? theme.color.primary : theme.color.borderStrong,
    boxShadow: focus ? `0 0 0 3px ${theme.color.primarySoft}` : 'none',
    transition: 'border-color .12s, box-shadow .12s',
  };
  return (
    <label style={{ gridColumn: props.full ? '1 / -1' : undefined, minWidth: 0 }}>
      <FieldLabel label={props.label} required={props.required} />
      <div style={{ position: 'relative' }}>
        {props.prefix && (
          <span style={{ position: 'absolute', left: 11, top: 'calc(50% + 3px)', transform: 'translateY(-50%)', fontSize: 14, color: theme.color.textMuted, pointerEvents: 'none' }}>{props.prefix}</span>
        )}
        <input
          type={props.mask ? 'text' : (props.type || 'text')}
          value={props.value}
          placeholder={props.mask ? maskPlaceholder[props.mask] : props.placeholder}
          maxLength={props.mask ? maskMaxLen[props.mask] : props.maxLength}
          inputMode={props.mask ? 'numeric' : props.inputMode}
          onChange={e => props.onChange(props.mask ? applyMask(e.target.value, props.mask) : e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={ctrl}
        />
      </div>
      {props.hint && <span style={hintText}>{props.hint}</span>}
    </label>
  );
}

function SelectField(props: {
  label: string; value: string; onChange: (v: string) => void;
  options: Opt[]; required?: boolean; placeholder?: string; full?: boolean; hint?: string;
}) {
  const [focus, setFocus] = useState(false);
  const opts = normOpts(props.options);
  const ctrl: React.CSSProperties = {
    ...inputBase,
    marginTop: 6,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236B645A' d='M6 8 0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 30,
    cursor: 'pointer',
    color: theme.color.text,
    borderColor: focus ? theme.color.primary : theme.color.borderStrong,
    boxShadow: focus ? `0 0 0 3px ${theme.color.primarySoft}` : 'none',
    transition: 'border-color .12s, box-shadow .12s',
  };
  return (
    <label style={{ gridColumn: props.full ? '1 / -1' : undefined, minWidth: 0 }}>
      <FieldLabel label={props.label} required={props.required} />
      <select
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={ctrl}
      >
        <option value="" disabled>{props.placeholder || 'Select…'}</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {props.hint && <span style={hintText}>{props.hint}</span>}
    </label>
  );
}

function RadioField(props: {
  label?: string; value: string; onChange: (v: string) => void;
  options: Opt[]; required?: boolean; hint?: string; full?: boolean;
}) {
  const opts = normOpts(props.options);
  return (
    <div style={{ gridColumn: props.full ? '1 / -1' : undefined }}>
      {props.label && <FieldLabel label={props.label} required={props.required} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: props.label ? 8 : 0 }}>
        {opts.map(o => {
          const active = props.value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => props.onChange(o.value)}
              style={{
                padding: '8px 16px',
                borderRadius: theme.radius.pill,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${active ? theme.color.primary : theme.color.borderStrong}`,
                background: active ? theme.color.primary : theme.color.surface,
                color: active ? theme.color.textOnPrimary : theme.color.text,
                transition: 'all .12s',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {props.hint && <span style={hintText}>{props.hint}</span>}
    </div>
  );
}

function CheckboxRow(props: { checked: boolean; onChange: (b: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 13, color: theme.color.text, cursor: 'pointer', lineHeight: 1.5 }}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={e => props.onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: theme.color.primary, cursor: 'pointer' }}
      />
      <span>{props.children}</span>
    </label>
  );
}

function InfoCallout({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'success' }) {
  const map = {
    info: { bg: theme.color.primarySoft, bd: theme.color.primarySoftBorder, badge: theme.color.primary },
    warn: { bg: theme.color.warningSoft, bd: theme.color.warningBorder, badge: theme.color.warning },
    success: { bg: theme.color.successSoft, bd: theme.color.successBorder, badge: theme.color.success },
  }[tone];
  return (
    <div style={{ display: 'flex', gap: 10, background: map.bg, border: `1px solid ${map.bd}`, borderRadius: theme.radius.md, padding: '12px 14px', fontSize: 12.5, color: theme.color.text, lineHeight: 1.55 }}>
      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: map.badge, color: theme.color.textOnPrimary, fontSize: 12, fontWeight: 700, fontStyle: 'italic', fontFamily: theme.font.serif, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>i</span>
      <div>{children}</div>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, fontFamily: theme.font.serif, color: theme.color.text, letterSpacing: '-0.01em' }}>{children}</h2>
      {sub && <p style={{ margin: '6px 0 0', fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.color.textMuted, margin: '4px 0 12px' }}>{children}</div>;
}

// ── Static data ─────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  {
    id: 'roth-ira', name: 'Roth IRA',
    desc: 'After-tax contributions; tax-free growth and withdrawals in retirement. No RMDs.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: younger investors, those expecting higher future taxes',
    color: theme.color.primarySoft, border: theme.color.primarySoftBorder,
  },
  {
    id: 'traditional-ira', name: 'Traditional IRA',
    desc: 'Pre-tax (deductible) contributions; tax-deferred growth; taxed on withdrawal.',
    limit: '$7,000/year ($8,000 if 50+)',
    best: 'Best for: high earners today expecting lower taxes in retirement',
    color: theme.color.successSoft, border: theme.color.successBorder,
  },
  {
    id: 'sep-ira', name: 'SEP-IRA',
    desc: 'For self-employed individuals. Very high contribution limits; fully deductible.',
    limit: 'Up to $70,000/year (25% of compensation)',
    best: 'Best for: sole proprietors, freelancers, small business owners',
    color: theme.color.warningSoft, border: theme.color.warningBorder,
  },
  {
    id: 'taxable', name: 'Taxable Account',
    desc: 'No contribution limits or withdrawal restrictions. Taxed on dividends and gains.',
    limit: 'No limit',
    best: 'Best for: investing beyond IRA limits, flexible goals',
    color: theme.color.surfaceMuted, border: theme.color.border,
  },
];

const STEP_LABELS = [
  'Account type', 'Personal information', 'Contact & address', 'Disclosures',
  'Account setup', 'Funding', 'Automatic investing', 'Review & sign',
];

const RANGES = ['Under $25,000', '$25,000 – $50,000', '$50,000 – $100,000', '$100,000 – $250,000', '$250,000 – $500,000', '$500,000 – $1M', 'Over $1M'];
const SUFFIXES = ['None', 'Jr.', 'Sr.', 'II', 'III', 'IV'];
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'India', 'China', 'Mexico', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'Other'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic partnership'];
const EMPLOYMENT = ['Employed', 'Self-employed', 'Retired', 'Student', 'Homemaker', 'Unemployed'];
const OBJECTIVES = ['Capital preservation', 'Income', 'Growth & income', 'Growth', 'Speculation'];
const RISK = ['Conservative', 'Moderate', 'Aggressive'];
const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild', 'Trust', 'Estate', 'Other'];
const BUSINESS_TYPES = ['Sole Proprietor', 'Partnership', 'LLC', 'S-Corporation', 'C-Corporation'];

const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const FUNDS: { value: string; label: string }[] = [
  { value: 'BF500', label: 'BobsFunds 500 Index (BF500) — 0.03% expense ratio' },
  { value: 'BFGR', label: 'BobsFunds Growth (BFGR) — 0.25% expense ratio' },
  { value: 'BFBI', label: 'BobsFunds Bond Income (BFBI) — 0.10% expense ratio' },
  { value: 'BFESG', label: 'BobsFunds ESG Leaders (BFESG) — 0.18% expense ratio' },
  { value: 'BFIN', label: 'BobsFunds International (BFIN) — 0.20% expense ratio' },
  { value: 'BFST', label: 'BobsFunds Short-Term Treasury (BFST) — 0.08% expense ratio' },
];
const fundLabel = (v: string) => FUNDS.find(f => f.value === v)?.label ?? '—';

interface Beneficiary {
  id: string; tier: 'primary' | 'contingent';
  name: string; relationship: string; dob: string; ssn: string; allocation: string;
}
const uid = () => Math.random().toString(36).slice(2, 9);
const newBenef = (tier: 'primary' | 'contingent', allocation = ''): Beneficiary =>
  ({ id: uid(), tier, name: '', relationship: '', dob: '', ssn: '', allocation });

// ── Main component ──────────────────────────────────────────────────────────

export function OpenAccountPage() {
  const [searchParams] = useSearchParams();
  const preselectedType = searchParams.get('accountType');

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);

  const [selected, setSelected] = useState<string | null>(
    ACCOUNT_TYPES.find(t => t.id === preselectedType) ? preselectedType : null,
  );
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [appRef, setAppRef] = useState('');

  const [benefs, setBenefs] = useState<Beneficiary[]>([newBenef('primary', '100')]);

  const [form, setForm] = useState<Record<string, any>>({
    fname: '', mi: '', lname: '', suffix: 'None', dob: '', ssn: '',
    citizen: 'yes', countryOfCitizenship: '', countryOfBirth: 'United States',
    maritalStatus: '', employmentStatus: '', employerName: '', occupation: '', employerAddress: '',
    annualIncome: '', netWorth: '', liquidNetWorth: '', investmentObjective: '', riskTolerance: '',
    email: '', mobilePhone: '', altPhone: '', street: '', city: '', state: '', zip: '',
    sameAddress: true, permStreet: '', permCity: '', permState: '', permZip: '',
    controlPerson: 'no', controlCompany: '', controlTicker: '',
    finraAffiliation: 'no', finraFirm: '', finraRelationship: '',
    pep: 'no', pepDetails: '',
    trustedName: '', trustedRelationship: '', trustedPhone: '', trustedEmail: '',
    businessName: '', ein: '', businessType: '', businessYear: '', businessEmployees: '',
    joint: 'no', jointFname: '', jointLname: '', jointDob: '', jointSsn: '',
    todName: '', todRelationship: '', todAllocation: '',
    fundingMethod: '', bankName: '', routingNumber: '', accountNumber: '', bankAccountType: 'checking',
    rolloverInstitution: '', rolloverAccountType: '', rolloverAmount: '', rolloverType: 'direct',
    investmentAmount: '', investmentFund: '',
    dcaOptIn: '', dcaAmount: '', dcaFrequency: 'Monthly', dcaDayOfMonth: '1', dcaWeekday: 'Monday',
    dcaStartDate: defaultStart, dcaFund: '',
    agCustomer: false, agIra: false, agSep: false, agElectronic: false, agW9: false, agPrivacy: false,
    signature: '',
  });

  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const isTaxable = selected === 'taxable';
  const isIRA = !!selected && !isTaxable;
  const isSEP = selected === 'sep-ira';
  const isRoth = selected === 'roth-ira';
  const accountName = ACCOUNT_TYPES.find(t => t.id === selected)?.name ?? '';

  // Beneficiary helpers
  const updBenef = (id: string, key: keyof Beneficiary, val: string) =>
    setBenefs(b => b.map(x => (x.id === id ? { ...x, [key]: val } : x)));
  const addBenef = (tier: 'primary' | 'contingent') => setBenefs(b => [...b, newBenef(tier)]);
  const removeBenef = (id: string) => setBenefs(b => b.filter(x => x.id !== id));
  const primaries = benefs.filter(b => b.tier === 'primary');
  const contingents = benefs.filter(b => b.tier === 'contingent');
  const primaryTotal = primaries.reduce((s, b) => s + (parseFloat(b.allocation) || 0), 0);
  const contingentTotal = contingents.reduce((s, b) => s + (parseFloat(b.allocation) || 0), 0);

  // ── Validation per step ───────────────────────────────────────────────────
  const validStep = (s: number): boolean => {
    switch (s) {
      case 1:
        return !!selected;
      case 2: {
        const base = req(form.fname, form.lname, form.dob, form.ssn, form.countryOfBirth,
          form.maritalStatus, form.employmentStatus, form.annualIncome, form.netWorth,
          form.liquidNetWorth, form.investmentObjective, form.riskTolerance);
        const cit = form.citizen === 'no' ? req(form.countryOfCitizenship) : true;
        const emp = ['Employed', 'Self-employed'].includes(form.employmentStatus)
          ? req(form.employerName, form.occupation) : true;
        return base && cit && emp;
      }
      case 3: {
        const base = req(form.email, form.mobilePhone, form.street, form.city, form.state, form.zip);
        const perm = form.sameAddress ? true : req(form.permStreet, form.permCity, form.permState, form.permZip);
        return base && perm;
      }
      case 4: {
        const a = form.controlPerson === 'yes' ? req(form.controlCompany) : true;
        const b = form.finraAffiliation === 'yes' ? req(form.finraFirm, form.finraRelationship) : true;
        const c = form.pep === 'yes' ? req(form.pepDetails) : true;
        return a && b && c; // trusted contact is optional (client may decline)
      }
      case 5: {
        if (isTaxable) {
          return form.joint === 'yes'
            ? req(form.jointFname, form.jointLname, form.jointDob, form.jointSsn) : true;
        }
        const allPrimaryFilled = primaries.every(b => req(b.name, b.relationship, b.allocation));
        const contFilled = contingents.every(b => req(b.name, b.relationship, b.allocation));
        const sepOk = isSEP ? req(form.businessName, form.ein, form.businessType) : true;
        return primaries.length > 0 && allPrimaryFilled && Math.round(primaryTotal) === 100 && contFilled && sepOk;
      }
      case 6: {
        const m = form.fundingMethod;
        if (!m) return false;
        let mok = true;
        if (m === 'ach') mok = req(form.bankName, form.routingNumber, form.accountNumber);
        if (m === 'rollover-ira' || m === 'rollover-401k') mok = req(form.rolloverInstitution, form.rolloverAmount);
        return mok && req(form.investmentAmount, form.investmentFund);
      }
      case 7: {
        if (!form.dcaOptIn) return false;
        if (form.dcaOptIn === 'no') return true;
        const dayOk = form.dcaFrequency === 'Monthly' ? req(form.dcaDayOfMonth) : req(form.dcaWeekday);
        return req(form.dcaAmount, form.dcaStartDate, (form.dcaFund || form.investmentFund)) && dayOk;
      }
      default:
        return true;
    }
  };

  const agreementsOk = form.agCustomer && form.agElectronic && form.agW9 && form.agPrivacy
    && (isIRA ? form.agIra : true) && (isSEP ? form.agSep : true);
  const canSubmit = agreementsOk && req(form.signature);

  const goTo = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = () => { if (validStep(step)) goTo(step + 1); };
  const back = () => goTo(Math.max(1, step - 1));

  const handleSubmit = () => {
    if (!canSubmit) return;
    setAppRef('BMF-' + Math.floor(10000000 + Math.random() * 90000000));
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (submitted) {
    const dcaOn = form.dcaOptIn === 'yes';
    const fmtDate = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const timeline = [
      { icon: '✉️', title: 'Email confirmation', body: 'Check your inbox for a confirmation email within a few minutes.' },
      { icon: '🔍', title: 'Identity verification', body: 'We verify your identity using the information you provided — typically within 1 business day.' },
      { icon: '🔓', title: 'Account opened', body: 'Once verified, your account number is emailed to you (1–3 business days).' },
      { icon: '📈', title: 'First investment', body: 'Your initial funding is applied and your first investment placed once the account is active.' },
    ];
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px', fontFamily: theme.font.sans }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: theme.color.successSoft, border: `1px solid ${theme.color.successBorder}`, color: theme.color.success, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>✓</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>Application Submitted</h1>
          <p style={{ fontSize: 15, color: theme.color.textMuted, margin: 0 }}>
            Your {accountName} application is being processed.
          </p>
          <div style={{ display: 'inline-block', marginTop: 16, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill, padding: '7px 18px', fontSize: 13, fontWeight: 600, color: theme.color.text, fontFamily: theme.font.mono }}>
            Reference: {appRef}
          </div>
        </div>

        <div style={card}>
          <SubHeading>What happens next</SubHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {timeline.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: i < timeline.length - 1 ? 20 : 0 }}>
                {i < timeline.length - 1 && <div style={{ position: 'absolute', left: 17, top: 36, bottom: 0, width: 2, background: theme.color.border }} />}
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: theme.color.primarySoft, border: `1px solid ${theme.color.primarySoftBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, zIndex: 1 }}>{t.icon}</div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: theme.color.textMuted, lineHeight: 1.5, marginTop: 2 }}>{t.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {dcaOn && (
          <div style={{ marginBottom: 20 }}>
            <InfoCallout tone="success">
              Your automatic investing schedule is set: <strong>${Number(form.dcaAmount).toLocaleString()} {form.dcaFrequency.toLowerCase()}</strong> into {fundLabel(form.dcaFund || form.investmentFund).split(' — ')[0]}, beginning <strong>{fmtDate(form.dcaStartDate)}</strong>.
            </InfoCallout>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/portfolio" style={{ background: theme.color.primary, color: theme.color.textOnPrimary, borderRadius: theme.radius.pill, padding: '11px 26px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Return to Portfolio</Link>
          <Link to="/help/open-account" style={{ background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.pill, padding: '11px 26px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Account opening FAQ</Link>
        </div>
      </div>
    );
  }

  // ── Wizard shell ──────────────────────────────────────────────────────────
  const wide = step === 8;
  return (
    <div style={{ maxWidth: wide ? 940 : 760, margin: '0 auto', padding: '36px 24px 64px', fontFamily: theme.font.sans }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700, fontFamily: theme.font.serif, letterSpacing: '-0.01em' }}>Open a New Account</h1>
        <p style={{ margin: 0, color: theme.color.textMuted, fontSize: 14 }}>
          About 10–15 minutes. Have your SSN, a government-issued ID, and bank or transfer details ready.
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.color.accent }}>Step {step} of 8</span>
          <span style={{ fontSize: 13, color: theme.color.textMuted, fontWeight: 600 }}>{STEP_LABELS[step - 1]}</span>
        </div>
        <div style={{ height: 6, background: theme.color.surfaceMuted, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${(step / 8) * 100}%`, height: '100%', background: theme.color.primary, borderRadius: 999, transition: 'width .3s ease' }} />
        </div>
      </div>

      {/* ── STEP 1 — Account type ─────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <SectionTitle sub="Choose the account that fits your goals. You can open additional accounts later.">Choose your account type</SectionTitle>
          <div style={{ ...grid2, marginBottom: 28 }}>
            {ACCOUNT_TYPES.map(t => {
              const active = selected === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  style={{
                    ...card, marginBottom: 0, cursor: 'pointer',
                    border: `2px solid ${active ? theme.color.primary : t.border}`,
                    background: active ? theme.color.primarySoft : t.color,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, fontFamily: theme.font.serif }}>{t.name}</h3>
                    <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: `1px solid ${active ? theme.color.primary : theme.color.borderStrong}`, background: active ? theme.color.primary : 'transparent', color: theme.color.textOnPrimary, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{active ? '✓' : ''}</span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: theme.color.text, lineHeight: 1.5 }}>{t.desc}</p>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.color.primary, marginBottom: 4 }}>Limit: {t.limit}</div>
                  <div style={{ fontSize: 12, color: theme.color.textMuted }}>{t.best}</div>
                </div>
              );
            })}
          </div>
          <InfoCallout>
            Not sure which is right? <Link to="/resources/roth-ira" style={{ color: theme.color.primary, fontWeight: 600 }}>Compare IRA options</Link> or ask in chat — the assistant on this page can help you decide.
          </InfoCallout>
        </>
      )}

      {/* ── STEP 2 — Personal information ─────────────────────────────────── */}
      {step === 2 && (
        <>
          <SectionTitle sub="We're required to collect this to verify your identity and assess suitability.">Personal information</SectionTitle>
          <div style={card}>
            <SubHeading>Legal name & identity</SubHeading>
            <div style={{ ...grid2, marginBottom: 16 }}>
              <TextField label="First name" value={form.fname} onChange={set('fname')} required />
              <TextField label="Last name" value={form.lname} onChange={set('lname')} required />
              <TextField label="Middle initial" value={form.mi} onChange={set('mi')} maxLength={1} />
              <SelectField label="Suffix" value={form.suffix} onChange={set('suffix')} options={SUFFIXES} />
              <TextField label="Date of birth" value={form.dob} onChange={set('dob')} type="date" required />
              <TextField label="Social Security Number" value={form.ssn} onChange={set('ssn')} mask="ssn" required hint="Required by federal law to open an account." />
            </div>
            <SubHeading>Citizenship</SubHeading>
            <div style={{ ...grid2, marginBottom: 16 }}>
              <RadioField label="U.S. citizen?" value={form.citizen} onChange={set('citizen')} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} required />
              <SelectField label="Country of birth" value={form.countryOfBirth} onChange={set('countryOfBirth')} options={COUNTRIES} required />
              {form.citizen === 'no' && (
                <SelectField label="Country of citizenship" value={form.countryOfCitizenship} onChange={set('countryOfCitizenship')} options={COUNTRIES} required full />
              )}
            </div>
            <SubHeading>Employment & finances</SubHeading>
            <div style={grid2}>
              <SelectField label="Marital status" value={form.maritalStatus} onChange={set('maritalStatus')} options={MARITAL} required />
              <SelectField label="Employment status" value={form.employmentStatus} onChange={set('employmentStatus')} options={EMPLOYMENT} required />
              {['Employed', 'Self-employed'].includes(form.employmentStatus) && (
                <>
                  <TextField label="Employer name" value={form.employerName} onChange={set('employerName')} required />
                  <TextField label="Occupation / job title" value={form.occupation} onChange={set('occupation')} required />
                  {form.employmentStatus === 'Employed' && (
                    <TextField label="Employer address" value={form.employerAddress} onChange={set('employerAddress')} full />
                  )}
                </>
              )}
              <SelectField label="Annual income" value={form.annualIncome} onChange={set('annualIncome')} options={RANGES} required />
              <SelectField label="Estimated net worth" value={form.netWorth} onChange={set('netWorth')} options={RANGES} required />
              <SelectField label="Estimated liquid net worth" value={form.liquidNetWorth} onChange={set('liquidNetWorth')} options={RANGES} required hint="Assets you could convert to cash quickly." />
              <SelectField label="Investment objective" value={form.investmentObjective} onChange={set('investmentObjective')} options={OBJECTIVES} required />
              <SelectField label="Risk tolerance" value={form.riskTolerance} onChange={set('riskTolerance')} options={RISK} required hint="Helps us flag if a chosen fund seems inconsistent with your stated tolerance." />
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3 — Contact & address ───────────────────────────────────── */}
      {step === 3 && (
        <>
          <SectionTitle sub="Where we'll send statements, tax forms, and account communications.">Contact & address</SectionTitle>
          <div style={card}>
            <SubHeading>Contact</SubHeading>
            <div style={{ ...grid2, marginBottom: 16 }}>
              <TextField label="Email address" value={form.email} onChange={set('email')} type="email" required full />
              <TextField label="Mobile phone" value={form.mobilePhone} onChange={set('mobilePhone')} mask="phone" required />
              <TextField label="Home / alternate phone" value={form.altPhone} onChange={set('altPhone')} mask="phone" />
            </div>
            <SubHeading>Mailing address</SubHeading>
            <div style={grid2}>
              <TextField label="Street address" value={form.street} onChange={set('street')} required full />
              <TextField label="City" value={form.city} onChange={set('city')} required />
              <div style={grid2}>
                <SelectField label="State" value={form.state} onChange={set('state')} options={STATES} required />
                <TextField label="ZIP code" value={form.zip} onChange={set('zip')} required maxLength={10} inputMode="numeric" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <CheckboxRow checked={form.sameAddress} onChange={set('sameAddress')}>
                My permanent residence is the same as my mailing address
              </CheckboxRow>
            </div>
            {!form.sameAddress && (
              <div style={{ marginTop: 16 }}>
                <SubHeading>Permanent residence</SubHeading>
                <div style={grid2}>
                  <TextField label="Street address" value={form.permStreet} onChange={set('permStreet')} required full />
                  <TextField label="City" value={form.permCity} onChange={set('permCity')} required />
                  <div style={grid2}>
                    <SelectField label="State" value={form.permState} onChange={set('permState')} options={STATES} required />
                    <TextField label="ZIP code" value={form.permZip} onChange={set('permZip')} required maxLength={10} inputMode="numeric" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── STEP 4 — Regulatory disclosures ──────────────────────────────── */}
      {step === 4 && (
        <>
          <SectionTitle sub="Required by FINRA and SEC regulations. Most applicants answer “No” to the first three.">Regulatory disclosures</SectionTitle>

          <div style={card}>
            <RadioField label="Are you, or an immediate family member, a control person — a director, officer, or 10%+ shareholder — of a publicly traded company?" value={form.controlPerson} onChange={set('controlPerson')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} required full />
            {form.controlPerson === 'yes' && (
              <div style={{ ...grid2, marginTop: 16 }}>
                <TextField label="Company name" value={form.controlCompany} onChange={set('controlCompany')} required />
                <TextField label="Ticker symbol" value={form.controlTicker} onChange={set('controlTicker')} />
              </div>
            )}
          </div>

          <div style={card}>
            <RadioField label="Are you, or anyone in your household, employed by or associated with a FINRA member firm, a securities exchange, or a municipal securities dealer?" value={form.finraAffiliation} onChange={set('finraAffiliation')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} required full />
            {form.finraAffiliation === 'yes' && (
              <div style={{ ...grid2, marginTop: 16 }}>
                <TextField label="Firm name" value={form.finraFirm} onChange={set('finraFirm')} required />
                <TextField label="Your relationship to the firm" value={form.finraRelationship} onChange={set('finraRelationship')} required />
              </div>
            )}
          </div>

          <div style={card}>
            <RadioField label="Are you, or an immediate family member, a current or former senior political figure of a non-U.S. government, political party, or international organization?" value={form.pep} onChange={set('pep')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} required full />
            {form.pep === 'yes' && (
              <div style={{ marginTop: 16 }}>
                <TextField label="Please provide details (name, office held, country)" value={form.pepDetails} onChange={set('pepDetails')} required full />
              </div>
            )}
          </div>

          <div style={card}>
            <SubHeading>Trusted contact person (optional)</SubHeading>
            <div style={{ marginBottom: 16 }}>
              <InfoCallout>
                FINRA requires us to ask. A trusted contact can be reached if we're unable to reach you and have a concern about your account — for example, possible financial exploitation. They have no authority over your account. You may leave this blank.
              </InfoCallout>
            </div>
            <div style={grid2}>
              <TextField label="Full name" value={form.trustedName} onChange={set('trustedName')} />
              <SelectField label="Relationship" value={form.trustedRelationship} onChange={set('trustedRelationship')} options={RELATIONSHIPS} />
              <TextField label="Phone" value={form.trustedPhone} onChange={set('trustedPhone')} mask="phone" />
              <TextField label="Email" value={form.trustedEmail} onChange={set('trustedEmail')} type="email" />
            </div>
          </div>
        </>
      )}

      {/* ── STEP 5 — Account setup (varies by type) ──────────────────────── */}
      {step === 5 && (
        <>
          {isIRA && (
            <>
              <SectionTitle sub="Designate who inherits this account. You can update beneficiaries any time after opening.">Beneficiary designation</SectionTitle>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <SubHeading>Primary beneficiaries</SubHeading>
                  <span style={{ fontSize: 12, fontWeight: 700, color: Math.round(primaryTotal) === 100 ? theme.color.success : theme.color.danger }}>
                    {Math.round(primaryTotal)}% allocated{Math.round(primaryTotal) === 100 ? ' ✓' : ' — must equal 100%'}
                  </span>
                </div>
                {primaries.map((b, i) => (
                  <BeneficiaryRow key={b.id} b={b} index={i} canRemove={primaries.length > 1} onChange={updBenef} onRemove={removeBenef} />
                ))}
                <button type="button" onClick={() => addBenef('primary')} style={addBtnStyle}>+ Add primary beneficiary</button>

                <div style={{ height: 1, background: theme.color.border, margin: '20px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <SubHeading>Contingent beneficiaries (optional)</SubHeading>
                  {contingents.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: Math.round(contingentTotal) === 100 ? theme.color.success : theme.color.textMuted }}>
                      {Math.round(contingentTotal)}% allocated
                    </span>
                  )}
                </div>
                {contingents.map((b, i) => (
                  <BeneficiaryRow key={b.id} b={b} index={i} canRemove onChange={updBenef} onRemove={removeBenef} />
                ))}
                <button type="button" onClick={() => addBenef('contingent')} style={addBtnStyle}>+ Add contingent beneficiary</button>

                <div style={{ marginTop: 16 }}>
                  <InfoCallout>
                    If you name multiple primary beneficiaries, allocations must total 100%. Contingent beneficiaries inherit only if no primary beneficiary survives you.
                  </InfoCallout>
                </div>
              </div>
            </>
          )}

          {isSEP && (
            <>
              <SectionTitle sub="A SEP-IRA is funded by your business. We need its details to establish the plan.">Business information</SectionTitle>
              <div style={card}>
                <div style={grid2}>
                  <TextField label="Business / employer name" value={form.businessName} onChange={set('businessName')} required full />
                  <TextField label="Employer Identification Number (EIN)" value={form.ein} onChange={set('ein')} mask="ein" required />
                  <SelectField label="Business type" value={form.businessType} onChange={set('businessType')} options={BUSINESS_TYPES} required />
                  <TextField label="Year business established" value={form.businessYear} onChange={set('businessYear')} placeholder="YYYY" maxLength={4} inputMode="numeric" />
                  <TextField label="Number of eligible employees" value={form.businessEmployees} onChange={set('businessEmployees')} inputMode="numeric" />
                </div>
                <div style={{ marginTop: 16 }}>
                  <InfoCallout tone="warn">
                    A SEP plan must cover all eligible employees — generally those age 21+ who worked for you in 3 of the last 5 years and earned at least $750. If you have eligible employees, you must establish a SEP for each of them at the same contribution rate.
                  </InfoCallout>
                </div>
              </div>
            </>
          )}

          {isTaxable && (
            <>
              <SectionTitle sub="Set ownership and an optional transfer-on-death designation.">Ownership & beneficiary</SectionTitle>
              <div style={card}>
                <RadioField label="Is this a joint account?" value={form.joint} onChange={set('joint')} options={[{ value: 'no', label: 'No — individual account' }, { value: 'yes', label: 'Yes — joint account' }]} required full />
                {form.joint === 'yes' && (
                  <div style={{ marginTop: 16 }}>
                    <SubHeading>Joint owner</SubHeading>
                    <div style={grid2}>
                      <TextField label="First name" value={form.jointFname} onChange={set('jointFname')} required />
                      <TextField label="Last name" value={form.jointLname} onChange={set('jointLname')} required />
                      <TextField label="Date of birth" value={form.jointDob} onChange={set('jointDob')} type="date" required />
                      <TextField label="Social Security Number" value={form.jointSsn} onChange={set('jointSsn')} mask="ssn" required />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <InfoCallout>Joint accounts are opened as Joint Tenants with Right of Survivorship (JTWROS) — if one owner passes away, the survivor retains full ownership.</InfoCallout>
                    </div>
                  </div>
                )}
              </div>
              <div style={card}>
                <SubHeading>Transfer on death (optional)</SubHeading>
                <div style={{ marginBottom: 16 }}>
                  <InfoCallout>A Transfer-on-Death (TOD) designation lets your account pass directly to a named beneficiary outside of probate. You can add or change this any time.</InfoCallout>
                </div>
                <div style={grid2}>
                  <TextField label="Beneficiary full name" value={form.todName} onChange={set('todName')} />
                  <SelectField label="Relationship" value={form.todRelationship} onChange={set('todRelationship')} options={RELATIONSHIPS} />
                  <TextField label="Allocation %" value={form.todAllocation} onChange={set('todAllocation')} placeholder="100" inputMode="numeric" />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── STEP 6 — Funding & initial investment ────────────────────────── */}
      {step === 6 && (
        <>
          <SectionTitle sub="Choose how you'll fund the account and what to invest in first.">Fund your account</SectionTitle>

          <div style={card}>
            <SubHeading>Funding method</SubHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FUNDING_METHODS.filter(m => isIRA || !m.iraOnly).map(m => {
                const active = form.fundingMethod === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => set('fundingMethod')(m.id)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
                      border: `2px solid ${active ? theme.color.primary : theme.color.border}`,
                      background: active ? theme.color.primarySoft : theme.color.surface,
                      borderRadius: theme.radius.md, padding: '14px 16px', transition: 'all .12s',
                    }}
                  >
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, marginTop: 1, border: `2px solid ${active ? theme.color.primary : theme.color.borderStrong}`, background: theme.color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active && <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.color.primary }} />}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>{m.title}</div>
                      <div style={{ fontSize: 12.5, color: theme.color.textMuted, lineHeight: 1.5, marginTop: 2 }}>{m.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Method-specific detail */}
            {form.fundingMethod === 'ach' && (
              <div style={{ marginTop: 18 }}>
                <SubHeading>Bank account</SubHeading>
                <div style={grid2}>
                  <TextField label="Bank name" value={form.bankName} onChange={set('bankName')} required full />
                  <TextField label="Routing number" value={form.routingNumber} onChange={set('routingNumber')} required maxLength={9} inputMode="numeric" />
                  <TextField label="Account number" value={form.accountNumber} onChange={set('accountNumber')} required inputMode="numeric" />
                  <RadioField label="Account type" value={form.bankAccountType} onChange={set('bankAccountType')} options={[{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }]} full />
                </div>
                <div style={{ marginTop: 12 }}><InfoCallout>Your bank information is encrypted and used only to fund this account.</InfoCallout></div>
              </div>
            )}
            {form.fundingMethod === 'wire' && (
              <div style={{ marginTop: 18 }}>
                <InfoCallout>
                  Wire to: <strong>Bob's Mutual Funds</strong> · ABA/Routing <strong>021000021</strong> · For credit to <strong>4812-XXXXX</strong> · Memo: your name + last 4 of SSN. You'll receive your unique account number by email once approved.
                </InfoCallout>
              </div>
            )}
            {form.fundingMethod === 'check' && (
              <div style={{ marginTop: 18 }}>
                <InfoCallout>
                  Mail your check to: <strong>Bob's Mutual Funds, PO Box 12345, Denver, CO 80201</strong>. Make it payable to <strong>“Bob's Mutual Funds FBO {form.fname || '[your name]'} {form.lname}”</strong>. Allow 5–7 business days to post.
                </InfoCallout>
              </div>
            )}
            {(form.fundingMethod === 'rollover-ira' || form.fundingMethod === 'rollover-401k') && (
              <div style={{ marginTop: 18 }}>
                <SubHeading>Rollover details</SubHeading>
                <div style={grid2}>
                  <TextField label="Current institution" value={form.rolloverInstitution} onChange={set('rolloverInstitution')} required />
                  <TextField label="Account type at that institution" value={form.rolloverAccountType} onChange={set('rolloverAccountType')} placeholder={form.fundingMethod === 'rollover-401k' ? '401(k), 403(b)…' : 'Traditional IRA, Roth IRA…'} />
                  <TextField label="Estimated transfer amount" value={form.rolloverAmount} onChange={set('rolloverAmount')} prefix="$" required inputMode="numeric" />
                  <RadioField label="Transfer type" value={form.rolloverType} onChange={set('rolloverType')} options={[{ value: 'direct', label: 'Direct rollover' }, { value: 'indirect', label: '60-day indirect' }]} />
                </div>
                <div style={{ marginTop: 12 }}><InfoCallout>We'll email transfer authorization paperwork. Direct rollovers avoid the mandatory 20% withholding that applies to indirect rollovers.</InfoCallout></div>
              </div>
            )}
          </div>

          <div style={card}>
            <SubHeading>Initial investment</SubHeading>
            <div style={grid2}>
              <TextField label="Investment amount" value={form.investmentAmount} onChange={set('investmentAmount')} prefix="$" required inputMode="numeric" hint="Most BobsFunds funds have a $1,000 minimum initial investment." />
              <SelectField label="Fund" value={form.investmentFund} onChange={set('investmentFund')} options={FUNDS} required placeholder="Choose a fund…" />
            </div>
          </div>
        </>
      )}

      {/* ── STEP 7 — Free DCA opt-in ─────────────────────────────────────── */}
      {step === 7 && (
        <>
          <SectionTitle sub="Invest a fixed amount on a regular schedule — automatically, with no extra fees.">Free dollar cost averaging service</SectionTitle>

          <div style={{ marginBottom: 20 }}>
            <InfoCallout tone="success">
              <strong>Dollar cost averaging (DCA)</strong> means investing a consistent amount at regular intervals, regardless of market conditions. Over time it smooths out your average cost per share and removes the temptation to time the market. Bob's offers this as a free service on any account.
            </InfoCallout>
          </div>

          <div style={card}>
            <RadioField label="Would you like to set up automatic investing now?" value={form.dcaOptIn} onChange={set('dcaOptIn')} options={[{ value: 'yes', label: 'Yes — set up automatic investing' }, { value: 'no', label: 'No thanks, I\'ll invest manually' }]} required full />

            {form.dcaOptIn === 'yes' && (
              <div style={{ marginTop: 18 }}>
                <SubHeading>Your schedule</SubHeading>
                <div style={grid2}>
                  <TextField label="Automatic investment amount" value={form.dcaAmount} onChange={set('dcaAmount')} prefix="$" required inputMode="numeric" />
                  <RadioField label="Frequency" value={form.dcaFrequency} onChange={set('dcaFrequency')} options={['Monthly', 'Biweekly', 'Weekly']} />
                  {form.dcaFrequency === 'Monthly' ? (
                    <SelectField label="Day of month" value={form.dcaDayOfMonth} onChange={set('dcaDayOfMonth')} options={Array.from({ length: 28 }, (_, i) => String(i + 1))} />
                  ) : (
                    <SelectField label="Day of week" value={form.dcaWeekday} onChange={set('dcaWeekday')} options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']} />
                  )}
                  <TextField label="Start date" value={form.dcaStartDate} onChange={set('dcaStartDate')} type="date" required />
                  <SelectField label="Fund for automatic investments" value={form.dcaFund || form.investmentFund} onChange={set('dcaFund')} options={FUNDS} required full hint="Defaults to your initial investment fund — you can choose a different one." />
                </div>
                <div style={{ marginTop: 14 }}>
                  <InfoCallout>You can pause, change, or cancel your automatic investing schedule any time from your account page — no fees, no penalties.</InfoCallout>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── STEP 8 — Review & sign ───────────────────────────────────────── */}
      {step === 8 && (
        <>
          <SectionTitle sub="Review your application, accept the agreements, and sign.">Review & sign</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 24, alignItems: 'start' }}>
            {/* Summary */}
            <div>
              <SummarySection title="Account type" onEdit={() => goTo(1)} rows={[['Type', accountName]]} />
              <SummarySection title="Personal information" onEdit={() => goTo(2)} rows={[
                ['Name', [form.fname, form.mi, form.lname, form.suffix !== 'None' ? form.suffix : ''].filter(Boolean).join(' ')],
                ['Date of birth', form.dob],
                ['SSN', form.ssn ? '•••-••-' + form.ssn.slice(-4) : '—'],
                ['Citizenship', form.citizen === 'yes' ? 'U.S. citizen' : form.countryOfCitizenship],
                ['Employment', form.employmentStatus + (form.occupation ? ` — ${form.occupation}` : '')],
                ['Objective / risk', [form.investmentObjective, form.riskTolerance].filter(Boolean).join(' · ')],
              ]} />
              <SummarySection title="Contact & address" onEdit={() => goTo(3)} rows={[
                ['Email', form.email],
                ['Phone', form.mobilePhone],
                ['Address', [form.street, form.city, form.state, form.zip].filter(Boolean).join(', ')],
              ]} />
              <SummarySection title="Disclosures" onEdit={() => goTo(4)} rows={[
                ['Control person', form.controlPerson === 'yes' ? `Yes — ${form.controlCompany}` : 'No'],
                ['FINRA affiliation', form.finraAffiliation === 'yes' ? `Yes — ${form.finraFirm}` : 'No'],
                ['Political figure', form.pep === 'yes' ? 'Yes' : 'No'],
                ['Trusted contact', form.trustedName || 'Declined'],
              ]} />
              <SummarySection title="Account setup" onEdit={() => goTo(5)} rows={
                isTaxable
                  ? [
                      ['Ownership', form.joint === 'yes' ? `Joint with ${form.jointFname} ${form.jointLname}` : 'Individual'],
                      ['TOD beneficiary', form.todName || 'None'],
                    ]
                  : [
                      ...(isSEP ? [['Business', `${form.businessName || '—'} (${form.businessType || '—'})`] as [string, string]] : []),
                      ['Primary beneficiaries', primaries.filter(b => b.name).map(b => `${b.name} ${b.allocation}%`).join(', ') || '—'],
                      ...(contingents.some(b => b.name) ? [['Contingent', contingents.filter(b => b.name).map(b => `${b.name} ${b.allocation}%`).join(', ')] as [string, string]] : []),
                    ]
              } />
              <SummarySection title="Funding & investment" onEdit={() => goTo(6)} rows={[
                ['Method', FUNDING_METHODS.find(m => m.id === form.fundingMethod)?.title ?? '—'],
                ['Initial amount', form.investmentAmount ? '$' + Number(form.investmentAmount).toLocaleString() : '—'],
                ['Fund', fundLabel(form.investmentFund).split(' — ')[0]],
              ]} />
              <SummarySection title="Automatic investing" onEdit={() => goTo(7)} rows={
                form.dcaOptIn === 'yes'
                  ? [
                      ['Status', 'On'],
                      ['Schedule', `$${Number(form.dcaAmount || 0).toLocaleString()} ${form.dcaFrequency.toLowerCase()}`],
                      ['Fund', fundLabel(form.dcaFund || form.investmentFund).split(' — ')[0]],
                    ]
                  : [['Status', form.dcaOptIn === 'no' ? 'Off — investing manually' : 'Not selected']]
              } />
            </div>

            {/* Agreements */}
            <div style={card}>
              <SubHeading>Agreements & disclosures</SubHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CheckboxRow checked={form.agCustomer} onChange={set('agCustomer')}>
                  I have read and agree to the <AgLink>Bob's Mutual Funds Customer Agreement</AgLink>, which governs the terms of my account.
                </CheckboxRow>
                {isIRA && (
                  <CheckboxRow checked={form.agIra} onChange={set('agIra')}>
                    I have received and agree to the <AgLink>IRA Custodial Agreement &amp; Disclosure Statement</AgLink>, including the fee schedule and distribution rules.
                  </CheckboxRow>
                )}
                {isSEP && (
                  <CheckboxRow checked={form.agSep} onChange={set('agSep')}>
                    I have read the <AgLink>SEP Plan Adoption Agreement</AgLink> and certify the plan is established for all eligible employees.
                  </CheckboxRow>
                )}
                <CheckboxRow checked={form.agElectronic} onChange={set('agElectronic')}>
                  I consent to receive statements, tax forms, regulatory notices, and other communications electronically.
                </CheckboxRow>
                <CheckboxRow checked={form.agW9} onChange={set('agW9')}>
                  Under penalties of perjury, I certify that my SSN is correct, I am not subject to backup withholding, and I am a U.S. person (W-9 certification).
                </CheckboxRow>
                <CheckboxRow checked={form.agPrivacy} onChange={set('agPrivacy')}>
                  I have read and acknowledge the <AgLink>Privacy Policy</AgLink>.
                </CheckboxRow>
              </div>

              <div style={{ height: 1, background: theme.color.border, margin: '20px 0' }} />

              <SubHeading>Electronic signature</SubHeading>
              <TextField label="Type your full legal name to sign" value={form.signature} onChange={set('signature')} placeholder={`${form.fname} ${form.lname}`.trim()} required full />
              <p style={{ fontSize: 11.5, color: theme.color.textMuted, lineHeight: 1.5, margin: '8px 0 0' }}>
                By typing your name, you sign this application electronically. Your electronic signature carries the same legal effect as a handwritten one. Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              </p>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  marginTop: 20, width: '100%', border: 'none', borderRadius: theme.radius.md,
                  padding: '13px 24px', fontSize: 15, fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  background: canSubmit ? theme.color.primary : theme.color.border,
                  color: canSubmit ? theme.color.textOnPrimary : theme.color.textMuted,
                  transition: 'background .15s',
                }}
              >
                Submit Application
              </button>
              {!canSubmit && (
                <p style={{ fontSize: 11.5, color: theme.color.textMuted, textAlign: 'center', margin: '8px 0 0' }}>
                  Accept all agreements and sign to submit.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Footer navigation ────────────────────────────────────────────── */}
      {step < 8 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          {step > 1 ? (
            <button type="button" onClick={back} style={ghostBtnStyle}>← Back</button>
          ) : <span />}
          <button
            type="button"
            onClick={next}
            disabled={!validStep(step)}
            style={{
              ...primaryBtnStyle,
              background: validStep(step) ? theme.color.primary : theme.color.border,
              color: validStep(step) ? theme.color.textOnPrimary : theme.color.textMuted,
              cursor: validStep(step) ? 'pointer' : 'not-allowed',
            }}
          >
            Continue →
          </button>
        </div>
      )}
      {step === 8 && (
        <div style={{ marginTop: 20 }}>
          <button type="button" onClick={back} style={ghostBtnStyle}>← Back</button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components & module-scope data ──────────────────────────────────────

const FUNDING_METHODS: { id: string; title: string; desc: string; iraOnly?: boolean }[] = [
  { id: 'ach', title: 'ACH Bank Transfer', desc: 'Link a checking or savings account. Funds settle in 1–3 business days. No fee.' },
  { id: 'wire', title: 'Wire Transfer', desc: 'Wire from your bank. Funds typically post the same day. Your bank may charge a wire fee.' },
  { id: 'check', title: 'Check', desc: "Mail a personal check. We'll provide the deposit address. Allow 5–7 business days." },
  { id: 'rollover-ira', title: 'Rollover — IRA / Roth', desc: 'Direct trustee-to-trustee transfer from an IRA at another institution. No taxes or penalties.', iraOnly: true },
  { id: 'rollover-401k', title: 'Rollover — 401(k) / 403(b)', desc: "Roll over an employer plan. We'll send transfer instructions to your plan sponsor.", iraOnly: true },
];

const addBtnStyle: React.CSSProperties = {
  marginTop: 10, background: 'none', border: `1px dashed ${theme.color.borderStrong}`,
  borderRadius: theme.radius.md, padding: '9px 14px', fontSize: 13, fontWeight: 600,
  color: theme.color.primary, cursor: 'pointer', fontFamily: theme.font.sans,
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'none', border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: theme.radius.pill, padding: '10px 22px', fontSize: 14, fontWeight: 600,
  color: theme.color.text, cursor: 'pointer', fontFamily: theme.font.sans,
};

const primaryBtnStyle: React.CSSProperties = {
  border: 'none', borderRadius: theme.radius.pill, padding: '10px 26px',
  fontSize: 14, fontWeight: 700, fontFamily: theme.font.sans, transition: 'background .15s',
};

function AgLink({ children }: { children: React.ReactNode }) {
  return (
    <a href="#" onClick={e => e.preventDefault()} style={{ color: theme.color.primary, fontWeight: 600, textDecoration: 'underline' }}>{children}</a>
  );
}

function BeneficiaryRow(props: {
  b: Beneficiary; index: number; canRemove: boolean;
  onChange: (id: string, key: keyof Beneficiary, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const { b, index, canRemove, onChange, onRemove } = props;
  return (
    <div style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 16, marginBottom: 12, background: theme.color.surfaceWell }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.color.textMuted }}>
          {b.tier === 'primary' ? 'Primary' : 'Contingent'} #{index + 1}
        </span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(b.id)} style={{ background: 'none', border: 'none', color: theme.color.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
        )}
      </div>
      <div style={grid2}>
        <TextField label="Full name" value={b.name} onChange={v => onChange(b.id, 'name', v)} required />
        <SelectField label="Relationship" value={b.relationship} onChange={v => onChange(b.id, 'relationship', v)} options={RELATIONSHIPS} required />
        <TextField label="Date of birth" value={b.dob} onChange={v => onChange(b.id, 'dob', v)} type="date" />
        <TextField label="SSN (optional)" value={b.ssn} onChange={v => onChange(b.id, 'ssn', v)} mask="ssn" />
        <TextField label="Allocation %" value={b.allocation} onChange={v => onChange(b.id, 'allocation', v)} placeholder="100" inputMode="numeric" required />
      </div>
    </div>
  );
}

function SummarySection(props: { title: string; onEdit: () => void; rows: [string, string][] }) {
  return (
    <details open style={{ ...card, marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', listStyle: 'none', cursor: 'pointer', padding: '14px 18px', fontSize: 14, fontWeight: 700, color: theme.color.text, fontFamily: theme.font.serif }}>
        <span>{props.title}</span>
        <span
          role="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); props.onEdit(); }}
          style={{ fontSize: 12, fontWeight: 600, color: theme.color.primary, fontFamily: theme.font.sans }}
        >
          Edit
        </span>
      </summary>
      <div style={{ padding: '0 18px 16px' }}>
        {props.rows.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', fontSize: 13, borderTop: i === 0 ? `1px solid ${theme.color.border}` : 'none' }}>
            <span style={{ color: theme.color.textMuted, flexShrink: 0 }}>{k}</span>
            <span style={{ color: theme.color.text, fontWeight: 500, textAlign: 'right' }}>{v || '—'}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
