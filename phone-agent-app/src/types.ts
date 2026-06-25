// Mirrors the dossier written by lambda/prep-callback and served by lambda/agent-callbacks.

export interface Finding { point: string; detail: string; source?: string }
export interface OpenItem { question: string; why: string }

export interface Dossier {
  topic: string;
  research: {
    summary: string;
    findings: Finding[];
    answeredFully: boolean;
    openItems: OpenItem[];
  };
  coaching: string[];
  script: { opening: string; talkingPoints: string[] };
  resources: { id: string; title: string; url: string }[];
  clientSnapshot: {
    name: string;
    totalBalance: number;
    accountsSummary: string;
    riskProfile?: string;
    memberSince?: string;
  };
  generatedAt: string;
}

/** Light row from the `list` action (board cards). */
export interface CallbackListItem {
  callbackId: string;
  clientId: string;
  clientName: string;
  intentSummary: string;
  scheduledTime: string;
  phoneNumber: string;
  dossierStatus: string;          // 'researching' | 'ready'
  answeredFully: boolean | null;
}

/** Full record from the `get` action (incl. dossier). */
export interface CallbackFull extends CallbackListItem {
  dossier?: Dossier;
}
