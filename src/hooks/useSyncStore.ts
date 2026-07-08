import { create } from "zustand";

interface SyncState {
  status: "idle" | "syncing" | "offline" | "error";
  lastSync: Date | null;
  conflicts: string[];
  setStatus: (status: "idle" | "syncing" | "offline" | "error") => void;
  setLastSync: (date: Date) => void;
  addConflict: (id: string) => void;
  clearConflicts: (ids?: string[]) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  lastSync: null,
  conflicts: [],
  setStatus: (status) => set({ status }),
  setLastSync: (date) => set({ lastSync: date }),
  addConflict: (id) =>
    set((s) => (s.conflicts.includes(id) ? s : { conflicts: [...s.conflicts, id] })),
  clearConflicts: (ids) =>
    set((s) => ({ conflicts: ids ? s.conflicts.filter((id) => !ids.includes(id)) : [] })),
}));
