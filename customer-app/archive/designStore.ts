import { create } from 'zustand';

type Design = 'original' | 'upgraded';

interface DesignStore {
  design: Design;
  setDesign: (d: Design) => void;
}

const STORAGE_KEY = 'bmf-design-preference';

export const useDesignStore = create<DesignStore>((set) => ({
  design: (localStorage.getItem(STORAGE_KEY) as Design) ?? 'original',
  setDesign: (design) => {
    localStorage.setItem(STORAGE_KEY, design);
    set({ design });
  },
}));
