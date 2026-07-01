import { create } from "zustand";

interface SyncState {
  status: "idle" | "syncing" | "offline" | "error";
  lastSync: Date | null;
  setStatus: (status: "idle" | "syncing" | "offline" | "error") => void;
  setLastSync: (date: Date) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  lastSync: null,
  setStatus: (status) => set({ status }),
  setLastSync: (date) => set({ lastSync: date }),
}));
