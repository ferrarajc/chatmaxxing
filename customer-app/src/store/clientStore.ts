import { create } from 'zustand';
import { PERSONAS, Persona } from '../data/personas';

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
}

export const useClientStore = create<ClientStore>((set) => ({
  activePersona: loadActivePersona(),
  setActivePersona: (id: string) => {
    const persona = PERSONAS.find(p => p.clientId === id) ?? PERSONAS[0];
    try { localStorage.setItem(STORAGE_KEY, persona.clientId); } catch { /* ignore */ }
    set({ activePersona: persona });
  },
}));
