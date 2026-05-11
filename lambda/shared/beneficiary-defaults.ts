export interface BeneficiaryEntry {
  accountId: string;
  name: string;
  relationship: string;
  percentage: number;
  type: 'Primary' | 'Secondary';
}

// IRA account IDs per client (non-retirement accounts have no beneficiaries)
export const CLIENT_IRA_ACCOUNTS: Record<string, string[]> = {
  'demo-client-001': ['acc-001', 'acc-002'],
  'demo-client-002': ['acc-201'],
  'demo-client-003': ['acc-301'],
  'demo-client-004': ['acc-401', 'acc-402'],
};

// Default beneficiary state — varied scenarios for realistic demo data
export const DEFAULT_BENEFICIARIES: Record<string, BeneficiaryEntry[]> = {
  // Alex Johnson: acc-001 (Roth IRA), acc-002 (Traditional IRA)
  'demo-client-001': [
    { accountId: 'acc-001', name: 'Sarah Johnson',  relationship: 'Spouse',  percentage: 100, type: 'Primary'   },
    { accountId: 'acc-002', name: 'Sarah Johnson',  relationship: 'Spouse',  percentage: 60,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Tyler Johnson',  relationship: 'Child',   percentage: 20,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Emma Johnson',   relationship: 'Child',   percentage: 20,  type: 'Primary'   },
    { accountId: 'acc-002', name: 'Robert Johnson', relationship: 'Parent',  percentage: 100, type: 'Secondary' },
  ],

  // Maria Chen: acc-201 (Traditional IRA)
  'demo-client-002': [
    { accountId: 'acc-201', name: 'David Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
    { accountId: 'acc-201', name: 'Linda Chen', relationship: 'Child', percentage: 50, type: 'Primary' },
  ],

  // Jordan Williams: acc-301 (Roth IRA)
  'demo-client-003': [
    { accountId: 'acc-301', name: 'Casey Williams', relationship: 'Sibling', percentage: 100, type: 'Primary'   },
    { accountId: 'acc-301', name: 'Pat Williams',   relationship: 'Parent',  percentage: 100, type: 'Secondary' },
  ],

  // Robert Martinez: acc-401 (SEP-IRA), acc-402 (Roth IRA)
  'demo-client-004': [
    { accountId: 'acc-401', name: 'Elena Martinez', relationship: 'Spouse', percentage: 100, type: 'Primary' },
    { accountId: 'acc-402', name: 'Elena Martinez', relationship: 'Spouse', percentage: 60,  type: 'Primary' },
    { accountId: 'acc-402', name: 'Sofia Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
    { accountId: 'acc-402', name: 'Marco Martinez', relationship: 'Child',  percentage: 20,  type: 'Primary' },
  ],
};
