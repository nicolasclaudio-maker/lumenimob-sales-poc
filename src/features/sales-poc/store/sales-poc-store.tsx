"use client";

import * as React from "react";
import type { DomainResult } from "@/features/sales-poc/domain/state-machine";
import type { SalesPocFixture } from "@/features/sales-poc/domain/types";
import {
  cloneInitialFixture,
  loadSalesPocSnapshotFromStorage,
  persistSalesPocData,
  resetSalesPocDataToFixture,
  SALES_POC_STORAGE_KEY,
  type SalesPocStorageSnapshot,
} from "@/features/sales-poc/repositories/local-sales-repository";

type StoreListener = () => void;

const serverSnapshot: SalesPocStorageSnapshot = {
  data: cloneInitialFixture(),
  updatedAt: cloneInitialFixture().generatedAt,
  source: "fixture",
};

let clientSnapshotCache: SalesPocStorageSnapshot | null = null;
const listeners = new Set<StoreListener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getClientSnapshot(): SalesPocStorageSnapshot {
  if (typeof window === "undefined") {
    return serverSnapshot;
  }
  if (!clientSnapshotCache) {
    clientSnapshotCache = loadSalesPocSnapshotFromStorage();
  }
  return clientSnapshotCache;
}

function getServerSnapshot(): SalesPocStorageSnapshot {
  return serverSnapshot;
}

function subscribe(listener: StoreListener): () => void {
  listeners.add(listener);

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === null || event.key === SALES_POC_STORAGE_KEY) {
      clientSnapshotCache = loadSalesPocSnapshotFromStorage();
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageEvent);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

export interface SalesPocContextValue {
  fixture: SalesPocFixture;
  updatedAt: string;
  storageSource: SalesPocStorageSnapshot["source"];
  storageKey: string;
  isHydrated: boolean;
  updateFixture: (updater: (current: SalesPocFixture) => SalesPocFixture) => void;
  dispatchDomainAction: (
    action: (current: SalesPocFixture) => DomainResult,
  ) => DomainResult;
  resetDemo: () => void;
}

const SalesPocContext = React.createContext<SalesPocContextValue | null>(null);

export function SalesPocProvider({ children }: { children: React.ReactNode }) {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isHydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const updateFixture = React.useCallback(
    (updater: (current: SalesPocFixture) => SalesPocFixture) => {
      const current = getClientSnapshot().data;
      const next = updater(structuredClone(current));
      clientSnapshotCache = persistSalesPocData(next);
      emitChange();
    },
    [],
  );

  const dispatchDomainAction = React.useCallback(
    (action: (current: SalesPocFixture) => DomainResult): DomainResult => {
      const current = getClientSnapshot().data;
      const result = action(current);
      if (result.ok) {
        clientSnapshotCache = persistSalesPocData(result.next);
        emitChange();
      }
      return result;
    },
    [],
  );

  const resetDemo = React.useCallback(() => {
    clientSnapshotCache = resetSalesPocDataToFixture();
    emitChange();
  }, []);

  const value = React.useMemo<SalesPocContextValue>(
    () => ({
      fixture: snapshot.data,
      updatedAt: snapshot.updatedAt,
      storageSource: snapshot.source,
      storageKey: SALES_POC_STORAGE_KEY,
      isHydrated,
      updateFixture,
      dispatchDomainAction,
      resetDemo,
    }),
    [dispatchDomainAction, isHydrated, resetDemo, snapshot, updateFixture],
  );

  return (
    <SalesPocContext.Provider value={value}>{children}</SalesPocContext.Provider>
  );
}

export function useSalesPocStore(): SalesPocContextValue {
  const context = React.useContext(SalesPocContext);
  if (!context) {
    throw new Error(
      "useSalesPocStore deve ser utilizado dentro de um SalesPocProvider.",
    );
  }
  return context;
}

