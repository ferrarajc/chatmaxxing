import { create } from 'zustand';
import { PERSONAS, Persona, Beneficiary, AutoInvestSchedule, RmdData } from '../data/personas';
import { post } from '../api/client';

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
  fetchAll: (clientId: string) => Promise<void>;
  refreshFromDb: () => Promise<void>;
  updateBeneficiaries: (accountId: string, beneficiaries: Beneficiary[]) => void;
  addBeneficiary: (beneficiary: Beneficiary) => void;
  removeBeneficiary: (beneficiaryId: string) => void;
  setAutoInvestSchedules: (schedules: AutoInvestSchedule[]) => void;
  updateAutoInvestSchedule: (scheduleId: string, updates: Partial<AutoInvestSchedule>) => void;
  updateRmd: (updates: Partial<RmdData>) => void;
  fetchRmd: () => Promise<void>;
  saveRmdPreferences: (updates: Partial<RmdData>) => Promise<void>;
}

export const useClientStore = create<ClientStore>((set, get) => {
  const store: ClientStore = {
    activePersona: loadActivePersona(),

    setActivePersona: (id: string) => {
      const persona = PERSONAS.find(p => p.clientId === id) ?? PERSONAS[0];
      try { localStorage.setItem(STORAGE_KEY, persona.clientId); } catch { /* ignore */ }
      set({ activePersona: persona });  // set static defaults immediately for snappy UI
      get().fetchAll(persona.clientId); // then hydrate from DB asynchronously
    },

    fetchAll: async (clientId: string) => {
      try {
        const data = await post<Record<string, unknown>>('/client-data', {
          action: 'get-all',
          clientId,
        });
        set(state => {
          // Only apply if this clientId is still the active one
          if (state.activePersona.clientId !== clientId) return state;
          const p = state.activePersona;
          return {
            activePersona: {
              ...p,
              // Scalar fields — use DB value if present, fall back to static persona
              name:         (data.name         as string)  ?? p.name,
              phone:        (data.phone        as string)  ?? p.phone,
              displayPhone: (data.displayPhone as string)  ?? p.displayPhone,
              email:        (data.email        as string)  ?? p.email,
              address:      (data.address      as string)  ?? p.address,
              totalBalance: (data.totalBalance as number)  ?? p.totalBalance,
              // Array fields — use DB array if non-empty, fall back to static
              accounts:     (data.accounts     as Persona['accounts'])     ?? p.accounts,
              holdings:     (data.holdings     as Persona['holdings'])     ?? p.holdings,
              transactions: (data.transactions as Persona['transactions']) ?? p.transactions,
              beneficiaries: (data.beneficiaries as Persona['beneficiaries'])?.length
                ? (data.beneficiaries as Persona['beneficiaries'])
                : p.beneficiaries,
              autoInvest: (data.autoInvest as AutoInvestSchedule[])?.length
                ? (data.autoInvest as AutoInvestSchedule[])
                : p.autoInvest,
              rmd: data.rmd ? { ...p.rmd, ...(data.rmd as RmdData) } : p.rmd,
            },
          };
        });
      } catch {
        // keep static data on error
      }
    },

    refreshFromDb: async () => {
      const { clientId } = get().activePersona;
      await get().fetchAll(clientId);
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

    fetchRmd: async () => {
      const { clientId, rmd } = get().activePersona;
      try {
        const result = await post<{ rmd: RmdData }>('/client-data', {
          action: 'get-rmd',
          clientId,
        });
        if (result.rmd) {
          set(state => ({
            activePersona: { ...state.activePersona, rmd: { ...rmd, ...result.rmd } },
          }));
        }
      } catch {
        // keep local data on error
      }
    },

    saveRmdPreferences: async (updates: Partial<RmdData>) => {
      const { clientId, rmd } = get().activePersona;
      const merged = { ...rmd, ...updates };
      set(state => ({ activePersona: { ...state.activePersona, rmd: merged } }));
      try {
        await post<{ ok: boolean }>('/client-data', {
          action: 'put-rmd',
          clientId,
          data: merged,
        });
      } catch {
        // optimistic update stays; non-critical
      }
    },
  };

  // Hydrate from DB on initial load (persona was loaded from localStorage or default)
  store.fetchAll(store.activePersona.clientId);

  return store;
});
