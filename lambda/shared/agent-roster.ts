// Canonical agent roster for the Supervisor Dashboard.
//
// ~82 agents across 7 wealth-management-realistic divisions. The first block are the
// REAL registered Amazon Connect users on the bobs-mutual-funds instance (usernames
// must match Connect logins exactly so live transcript rows attribute to them); the
// rest are fictional. Seeded into the bobs-agents table by the reset-agents Lambda
// along with a deterministic performance history (see agent-history.ts). Fictional
// data lives ONLY in bobs-agents — never in bobs-transcripts.

export type Division =
  | 'Client Services'
  | 'Retirement & IRA Services'
  | 'Private Client Group'
  | 'Trading & Brokerage Services'
  | 'Advice & Planning'
  | 'Onboarding & Transfers'
  | 'Phone & Callback Desk';

export const DIVISIONS: Division[] = [
  'Client Services',
  'Retirement & IRA Services',
  'Private Client Group',
  'Trading & Brokerage Services',
  'Advice & Planning',
  'Onboarding & Transfers',
  'Phone & Callback Desk',
];

export interface AgentDef {
  agentUsername: string; // table PK; matches the Connect login for real agents
  name: string;
  division: Division;
  title: string;
  /** FINRA licenses / credentials. Empty = non-licensed service rep. */
  licenses: string[];
  hireDate: string; // YYYY-MM-DD
  location: string;
  status: 'active' | 'leave';
}

const a = (
  agentUsername: string, name: string, division: Division, title: string,
  licenses: string[], hireDate: string, location: string, status: 'active' | 'leave' = 'active',
): AgentDef => ({ agentUsername, name, division, title, licenses, hireDate, location, status });

// Locations weighted toward an East Coast home office.
const MALVERN = 'Malvern, PA';
const PHILLY = 'Philadelphia, PA';
const CHARLOTTE = 'Charlotte, NC';
const SCOTTSDALE = 'Scottsdale, AZ';
const DALLAS = 'Dallas, TX';
const REMOTE = 'Remote';

export const AGENT_ROSTER: AgentDef[] = [
  // ── Real registered Connect agents (usernames match Connect logins) ────────
  a('john-ferrara', 'John Ferrara', 'Client Services', 'Team Lead, Digital Service', ['SIE'], '2016-04-11', MALVERN),
  a('jessica-le', 'Jessica Le', 'Client Services', 'Senior Service Representative', [], '2019-08-05', MALVERN),
  a('leah-marchesani', 'Leah Marchesani', 'Client Services', 'Service Representative', [], '2022-02-14', PHILLY),
  a('andrew-clemens', 'Andrew Clemens', 'Retirement & IRA Services', 'Retirement Specialist', ['SIE', 'Series 63'], '2017-10-02', MALVERN),
  a('savannah-bower', 'Savannah Bower', 'Client Services', 'Service Representative', [], '2023-06-19', REMOTE),
  a('steve-dodson', 'Steve Dodson', 'Phone & Callback Desk', 'Senior Phone Representative', ['SIE'], '2014-03-24', CHARLOTTE),
  a('tyler-ryan', 'Tyler Ryan', 'Phone & Callback Desk', 'Phone Representative', [], '2021-09-13', CHARLOTTE),
  a('jen-collopy', 'Jen Collopy', 'Client Services', 'Senior Service Representative', ['SIE'], '2018-01-08', MALVERN),
  a('jason-lewin', 'Jason Lewin', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2015-07-20', PHILLY),

  // ── Client Services (chat-first; mostly non-licensed) ──────────────────────
  a('maya-okafor', 'Maya Okafor', 'Client Services', 'Service Representative', [], '2022-05-09', REMOTE),
  a('daniel-reyes', 'Daniel Reyes', 'Client Services', 'Service Representative', [], '2023-01-30', PHILLY),
  a('priya-natarajan', 'Priya Natarajan', 'Client Services', 'Senior Service Representative', [], '2019-03-18', MALVERN),
  a('kevin-osullivan', "Kevin O'Sullivan", 'Client Services', 'Service Representative', [], '2021-11-01', MALVERN),
  a('tamara-brooks', 'Tamara Brooks', 'Client Services', 'Senior Service Representative', ['SIE'], '2017-06-12', CHARLOTTE),
  a('luis-fuentes', 'Luis Fuentes', 'Client Services', 'Service Representative', [], '2024-02-05', REMOTE),
  a('hannah-kim', 'Hannah Kim', 'Client Services', 'Service Representative', [], '2022-09-26', PHILLY),
  a('marcus-whitfield', 'Marcus Whitfield', 'Client Services', 'Team Lead, Chat Operations', ['SIE'], '2013-08-19', MALVERN),
  a('alicia-romano', 'Alicia Romano', 'Client Services', 'Service Representative', [], '2023-04-17', MALVERN),
  a('grace-adeyemi', 'Grace Adeyemi', 'Client Services', 'Senior Service Representative', [], '2018-10-29', CHARLOTTE),
  a('peter-vandenberg', 'Peter Vandenberg', 'Client Services', 'Service Representative', [], '2024-06-03', REMOTE),
  a('nicole-tran', 'Nicole Tran', 'Client Services', 'Service Representative', [], '2021-07-06', PHILLY),
  a('derek-mccall', 'Derek McCall', 'Client Services', 'Service Representative', [], '2022-12-12', MALVERN, 'leave'),
  a('sofia-petrova', 'Sofia Petrova', 'Client Services', 'Senior Service Representative', [], '2016-09-06', MALVERN),
  a('jamal-carter', 'Jamal Carter', 'Client Services', 'Service Representative', [], '2023-08-21', REMOTE),
  a('emily-strand', 'Emily Strand', 'Client Services', 'Service Representative', [], '2024-09-16', PHILLY),
  a('oscar-villanueva', 'Oscar Villanueva', 'Client Services', 'Service Representative', [], '2025-01-13', MALVERN),

  // ── Retirement & IRA Services (RMD / rollover specialists) ─────────────────
  a('ruth-goldberg', 'Ruth Goldberg', 'Retirement & IRA Services', 'Senior Retirement Specialist', ['SIE', 'Series 63'], '2008-02-11', MALVERN),
  a('tom-brennan', 'Tom Brennan', 'Retirement & IRA Services', 'Retirement Specialist', ['SIE'], '2015-05-04', PHILLY),
  a('angela-marino', 'Angela Marino', 'Retirement & IRA Services', 'Retirement Specialist', ['SIE', 'Series 63'], '2018-07-23', MALVERN),
  a('wei-zhang', 'Wei Zhang', 'Retirement & IRA Services', 'Senior Retirement Specialist', ['SIE', 'Series 63'], '2012-04-16', CHARLOTTE),
  a('carla-mendez', 'Carla Mendez', 'Retirement & IRA Services', 'Retirement Specialist', [], '2020-10-05', REMOTE),
  a('frank-delucia', 'Frank DeLucia', 'Retirement & IRA Services', 'Team Lead, Retirement Services', ['SIE', 'Series 63', 'Series 65'], '2006-09-18', MALVERN),
  a('monica-hayes', 'Monica Hayes', 'Retirement & IRA Services', 'Retirement Specialist', ['SIE'], '2019-01-14', CHARLOTTE),
  a('raj-malhotra', 'Raj Malhotra', 'Retirement & IRA Services', 'Retirement Specialist', [], '2021-03-08', PHILLY),
  a('ellen-swanson', 'Ellen Swanson', 'Retirement & IRA Services', 'Senior Retirement Specialist', ['SIE', 'Series 63'], '2010-11-29', MALVERN),
  a('victor-osei', 'Victor Osei', 'Retirement & IRA Services', 'Retirement Specialist', ['SIE'], '2022-06-27', REMOTE),
  a('dana-kowalski', 'Dana Kowalski', 'Retirement & IRA Services', 'Retirement Specialist', [], '2023-02-20', DALLAS),

  // ── Private Client Group (HNW; licensed) ───────────────────────────────────
  a('charles-pemberton', 'Charles Pemberton III', 'Private Client Group', 'Senior Relationship Manager', ['SIE', 'Series 7', 'Series 66'], '2005-06-06', PHILLY),
  a('elaine-fitzgerald', 'Elaine Fitzgerald', 'Private Client Group', 'Relationship Manager', ['SIE', 'Series 7', 'Series 63'], '2014-09-15', MALVERN),
  a('samuel-adebayo', 'Samuel Adebayo', 'Private Client Group', 'Relationship Manager', ['SIE', 'Series 7', 'Series 66'], '2016-01-25', CHARLOTTE),
  a('vivian-chow', 'Vivian Chow', 'Private Client Group', 'Senior Relationship Manager', ['SIE', 'Series 7', 'Series 66', 'CFP'], '2009-03-02', PHILLY),
  a('gregory-stanton', 'Gregory Stanton', 'Private Client Group', 'Relationship Manager', ['SIE', 'Series 7', 'Series 63'], '2018-04-09', DALLAS),
  a('isabella-moretti', 'Isabella Moretti', 'Private Client Group', 'Associate Relationship Manager', ['SIE', 'Series 7'], '2021-08-16', MALVERN),
  a('harold-jenkins', 'Harold Jenkins', 'Private Client Group', 'Team Lead, Private Client', ['SIE', 'Series 7', 'Series 66', 'Series 24'], '2003-10-13', PHILLY),
  a('naomi-schwartz', 'Naomi Schwartz', 'Private Client Group', 'Relationship Manager', ['SIE', 'Series 7', 'Series 66'], '2017-12-04', REMOTE),

  // ── Trading & Brokerage Services (all licensed) ────────────────────────────
  a('mike-castellano', 'Mike Castellano', 'Trading & Brokerage Services', 'Senior Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2011-02-21', PHILLY),
  a('stephanie-wu', 'Stephanie Wu', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2018-06-11', MALVERN),
  a('brandon-holt', 'Brandon Holt', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2020-01-27', CHARLOTTE),
  a('rebecca-lindqvist', 'Rebecca Lindqvist', 'Trading & Brokerage Services', 'Senior Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2013-05-20', MALVERN),
  a('omar-haddad', 'Omar Haddad', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2019-09-09', DALLAS),
  a('kelly-donovan', 'Kelly Donovan', 'Trading & Brokerage Services', 'Team Lead, Brokerage Desk', ['SIE', 'Series 7', 'Series 63', 'Series 24'], '2007-07-30', PHILLY),
  a('anthony-ricci', 'Anthony Ricci', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2022-03-14', MALVERN),
  a('lauren-baptiste', 'Lauren Baptiste', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2021-05-24', REMOTE),
  a('scott-yamamoto', 'Scott Yamamoto', 'Trading & Brokerage Services', 'Registered Representative', ['SIE', 'Series 7', 'Series 63'], '2023-10-02', CHARLOTTE),

  // ── Advice & Planning (Series 65/66; some CFP) ─────────────────────────────
  a('patricia-langford', 'Patricia Langford', 'Advice & Planning', 'Senior Financial Consultant', ['SIE', 'Series 66', 'CFP'], '2004-08-23', MALVERN),
  a('david-nkemelu', 'David Nkemelu', 'Advice & Planning', 'Financial Consultant', ['SIE', 'Series 65'], '2016-11-07', PHILLY),
  a('susan-albright', 'Susan Albright', 'Advice & Planning', 'Financial Consultant', ['SIE', 'Series 66', 'CFP'], '2012-01-09', CHARLOTTE),
  a('miguel-santos', 'Miguel Santos', 'Advice & Planning', 'Financial Consultant', ['SIE', 'Series 65'], '2019-04-01', DALLAS),
  a('karen-oconnell', "Karen O'Connell", 'Advice & Planning', 'Senior Financial Consultant', ['SIE', 'Series 66'], '2009-10-19', MALVERN),
  a('jonathan-blake', 'Jonathan Blake', 'Advice & Planning', 'Team Lead, Advice Services', ['SIE', 'Series 66', 'CFP'], '2005-03-28', PHILLY),
  a('amara-diallo', 'Amara Diallo', 'Advice & Planning', 'Financial Consultant', ['SIE', 'Series 65'], '2020-07-13', REMOTE),
  a('richard-hsieh', 'Richard Hsieh', 'Advice & Planning', 'Financial Consultant', ['SIE', 'Series 66'], '2017-02-06', MALVERN),
  a('beth-caruso', 'Beth Caruso', 'Advice & Planning', 'Associate Financial Consultant', ['SIE', 'Series 65'], '2023-05-15', PHILLY),

  // ── Onboarding & Transfers (operations) ────────────────────────────────────
  a('carol-jablonski', 'Carol Jablonski', 'Onboarding & Transfers', 'Senior Operations Associate', [], '2011-06-13', MALVERN),
  a('trevor-mills', 'Trevor Mills', 'Onboarding & Transfers', 'Operations Associate', [], '2021-10-18', CHARLOTTE),
  a('fatima-alrashid', 'Fatima Al-Rashid', 'Onboarding & Transfers', 'Operations Associate', [], '2022-08-08', REMOTE),
  a('gene-pappas', 'Gene Pappas', 'Onboarding & Transfers', 'Team Lead, Account Transfers', ['SIE'], '2008-12-01', MALVERN),
  a('lindsay-thibodeaux', 'Lindsay Thibodeaux', 'Onboarding & Transfers', 'Senior Operations Associate', [], '2015-04-27', DALLAS),
  a('roger-quinn', 'Roger Quinn', 'Onboarding & Transfers', 'Operations Associate', [], '2023-09-11', PHILLY),
  a('mei-lin-huang', 'Mei-Lin Huang', 'Onboarding & Transfers', 'Operations Associate', [], '2020-02-24', MALVERN),
  a('curtis-abernathy', 'Curtis Abernathy', 'Onboarding & Transfers', 'Senior Operations Associate', ['SIE'], '2013-11-04', CHARLOTTE, 'leave'),
  a('yolanda-rivers', 'Yolanda Rivers', 'Onboarding & Transfers', 'Operations Associate', [], '2024-01-08', REMOTE),

  // ── Phone & Callback Desk (voice-first) ────────────────────────────────────
  a('gloria-santiago', 'Gloria Santiago', 'Phone & Callback Desk', 'Senior Phone Representative', ['SIE'], '2012-08-06', CHARLOTTE),
  a('walt-freeman', 'Walt Freeman', 'Phone & Callback Desk', 'Phone Representative', [], '2019-06-24', CHARLOTTE),
  a('irene-kaminsky', 'Irene Kaminsky', 'Phone & Callback Desk', 'Phone Representative', [], '2021-01-11', MALVERN),
  a('deshawn-porter', 'DeShawn Porter', 'Phone & Callback Desk', 'Phone Representative', [], '2022-04-04', REMOTE),
  a('linda-nguyen', 'Linda Nguyen', 'Phone & Callback Desk', 'Team Lead, Callback Desk', ['SIE'], '2010-05-17', CHARLOTTE),
  a('arthur-boone', 'Arthur Boone', 'Phone & Callback Desk', 'Senior Phone Representative', [], '2014-10-20', DALLAS),
  a('paula-esposito', 'Paula Esposito', 'Phone & Callback Desk', 'Phone Representative', [], '2023-03-27', PHILLY),
  a('henry-abara', 'Henry Abara', 'Phone & Callback Desk', 'Phone Representative', [], '2024-04-15', REMOTE),
  a('joyce-mbeki', 'Joyce Mbeki', 'Phone & Callback Desk', 'Phone Representative', [], '2020-11-30', CHARLOTTE),
  a('ralph-castellucci', 'Ralph Castellucci', 'Phone & Callback Desk', 'Senior Phone Representative', ['SIE'], '2016-06-27', PHILLY),
];

/** True when the agent holds any FINRA license/credential. */
export const isLicensed = (agent: AgentDef): boolean => agent.licenses.length > 0;
