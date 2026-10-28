import rawFixtureJson from "@/data/fixtures.json";
import type { SalesPocFixture } from "@/features/sales-poc/domain/types";

export const SALES_POC_STORAGE_KEY = "lumenimob-sales-poc:v1";
export const SALES_POC_SCHEMA_VERSION = 2;

export interface PersistedSalesPocEnvelope {
  schemaVersion: number;
  updatedAt: string;
  data: SalesPocFixture;
}

export interface SalesPocStorageSnapshot {
  data: SalesPocFixture;
  updatedAt: string;
  source: "fixture" | "localStorage" | "recovered";
}

const typedFixture: SalesPocFixture = rawFixtureJson as SalesPocFixture;

export function cloneInitialFixture(): SalesPocFixture {
  return structuredClone(typedFixture);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidPersistedEnvelope(
  value: unknown,
): value is PersistedSalesPocEnvelope {
  if (!isObjectRecord(value)) return false;
  if (value.schemaVersion !== SALES_POC_SCHEMA_VERSION) return false;
  if (typeof value.updatedAt !== "string") return false;

  const data = value.data;
  if (!isObjectRecord(data)) return false;

  return (
    isObjectRecord(data.brokerage) &&
    isObjectRecord(data.manager) &&
    Array.isArray(data.brokers) &&
    Array.isArray(data.properties) &&
    Array.isArray(data.buyers) &&
    Array.isArray(data.sellers) &&
    Array.isArray(data.opportunities) &&
    Array.isArray(data.offers) &&
    Array.isArray(data.cases)
  );
}

function writeEnvelopeToStorage(envelope: PersistedSalesPocEnvelope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SALES_POC_STORAGE_KEY,
      JSON.stringify(envelope),
    );
  } catch {
    // Em modo restrito do navegador, mantém operação em memória sem interromper a UI.
  }
}

export function loadSalesPocSnapshotFromStorage(): SalesPocStorageSnapshot {
  const fallbackData = cloneInitialFixture();

  if (typeof window === "undefined") {
    return {
      data: fallbackData,
      updatedAt: fallbackData.generatedAt,
      source: "fixture",
    };
  }

  try {
    const raw = window.localStorage.getItem(SALES_POC_STORAGE_KEY);
    if (!raw) {
      const initialEnvelope: PersistedSalesPocEnvelope = {
        schemaVersion: SALES_POC_SCHEMA_VERSION,
        updatedAt: fallbackData.generatedAt,
        data: fallbackData,
      };
      writeEnvelopeToStorage(initialEnvelope);
      return {
        data: fallbackData,
        updatedAt: initialEnvelope.updatedAt,
        source: "fixture",
      };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedEnvelope(parsed)) {
      const recoveredUpdatedAt = new Date().toISOString();
      writeEnvelopeToStorage({
        schemaVersion: SALES_POC_SCHEMA_VERSION,
        updatedAt: recoveredUpdatedAt,
        data: fallbackData,
      });
      return {
        data: fallbackData,
        updatedAt: recoveredUpdatedAt,
        source: "recovered",
      };
    }

    return {
      data: parsed.data,
      updatedAt: parsed.updatedAt,
      source: "localStorage",
    };
  } catch {
    const recoveredUpdatedAt = new Date().toISOString();
    writeEnvelopeToStorage({
      schemaVersion: SALES_POC_SCHEMA_VERSION,
      updatedAt: recoveredUpdatedAt,
      data: fallbackData,
    });
    return {
      data: fallbackData,
      updatedAt: recoveredUpdatedAt,
      source: "recovered",
    };
  }
}

export function persistSalesPocData(
  data: SalesPocFixture,
): SalesPocStorageSnapshot {
  const updatedAt = new Date().toISOString();
  const cloned = structuredClone(data);
  writeEnvelopeToStorage({
    schemaVersion: SALES_POC_SCHEMA_VERSION,
    updatedAt,
    data: cloned,
  });
  return {
    data: cloned,
    updatedAt,
    source: "localStorage",
  };
}

export function resetSalesPocDataToFixture(): SalesPocStorageSnapshot {
  const freshData = cloneInitialFixture();
  const updatedAt = new Date().toISOString();
  writeEnvelopeToStorage({
    schemaVersion: SALES_POC_SCHEMA_VERSION,
    updatedAt,
    data: freshData,
  });
  return {
    data: freshData,
    updatedAt,
    source: "fixture",
  };
}

