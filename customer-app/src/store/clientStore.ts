import { create } from 'zustand';
import { PERSONAS, Persona, Beneficiary, AutoInvestSchedule, RmdData } from '../data/personas';

const STORAGE_KEY = 'bobs_active_client_id';

function loadActivePersona(): Persona {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY);
    return PERSONAS.find(p => p.clientId === savedId) ?? PERSONAS[0];
  } catch {
    return PERSONAS[0];
  }
}

interface ClientStore {
  activePersona: Persona;
  setActivePersona: (id: string) => void;
  updateBeneficiaries: (accountId: string, beneficiaries: Beneficiary[]) => void;
  addBeneficiary: (beneficiary: Beneficiary) => void;
  removeBeneficiary: (beneficiaryId: string) => void;
  setAutoInvestSchedules: (schedules: AutoInvestSchedule[]) => void;
  updateAutoInvestSchedule: (scheduleId: string, updates: Partial<AutoInvestSchedule>) => void;
  updateRmd: (updates: Partial<RmdData>) => void;
}

export const useClientStore = create<ClientStore>((set) => ({
  activePersona: loadActivePersona(),

  setActivePersona: (id: string) => {
    const persona = PERSONAS.find(p => p.clientId === id) ?? PERSONAS[0];
    try { localStorage.setItem(STORAGE_KEY, persona.clientId); } catch { /* ignore */ }
    set({ activePersona: persona });
  },

  updateBeneficiaries: (accountId: string, beneficiaries: Beneficiary[]) => {
    set(state => ({
      activePersona: {
        ...state.activePersona,
        beneficiaries: [
          ...state.activePersona.beneficiaries.filter(b => b.accountId !== accountId),
          ...beneficiaries,
        ],
      },
    }));
  },

  addBeneficiary: (beneficiary: Beneficiary) => {
    set(state => ({
      activePersona: {
        ...state.activePersona,
        beneficiaries: [...state.activePersona.beneficiaries, beneficiary],
      },
    }));
  },

  removeBeneficiary: (beneficiaryId: string) => {
    set(state => ({
      activePersona: {
        ...state.activePersona,
        beneficiaries: state.activePersona.beneficiaries.filter(b => b.id !== beneficiaryId),
      },
    }));
  },

  setAutoInvestSchedules: (schedules: AutoInvestSchedule[]) => {
    set(state => ({
      activePersona: { ...state.activePersona, autoInvest: schedules },
    }));
  },

  updateAutoInvestSchedule: (scheduleId: string, updates: Partial<AutoInvestSchedule>) => {
    set(state => ({
      activePersona: {
        ...state.activePersona,
        autoInvest: state.activePersona.autoInvest.map(s =>
          s.id === scheduleId ? { ...s, ...updates } : s,
        ),
      },
    }));
  },

  updateRmd: (updates: Partial<RmdData>) => {
    set(state => ({
      activePersona: {
        ...state.activePersona,
        rmd: { ...state.activePersona.rmd, ...updates },
      },
    }));
  },
}));
