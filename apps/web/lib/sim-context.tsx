"use client";

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { SimStore } from "@standard-law/engine";
import type { TapeRow, World } from "@standard-law/engine";
import { buildDemoWorld } from "./demo-seed";

export interface EpochSnapshot {
  epoch: number;
  F_n: bigint;
  m: number;
  supplyCirc: bigint;
  supplyMax: bigint;
  gold: bigint;
}

interface SimContextValue {
  store: SimStore;
  historyRef: React.MutableRefObject<EpochSnapshot[]>;
}

const SimContext = createContext<SimContextValue | null>(null);

function snapshotOf(world: World): EpochSnapshot {
  return {
    epoch: world.epoch,
    F_n: world.F.length > 0 ? world.F[world.F.length - 1] : 0n,
    m: world.m,
    supplyCirc: 100_000_000n * 10n ** 18n + world.M - world.B,
    supplyMax: 1_000_000_000n * 10n ** 18n - world.B,
    gold: world.vaults.expansionGold,
  };
}

export function SimProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<SimStore | null>(null);
  const historyRef = useRef<EpochSnapshot[]>([]);
  const lastEpochRef = useRef<number>(-1);

  if (!storeRef.current) {
    const world = buildDemoWorld();
    storeRef.current = new SimStore(world);
    historyRef.current = [snapshotOf(world)];
    lastEpochRef.current = world.epoch;
  }
  const store = storeRef.current;

  useEffect(() => {
    return store.subscribe(() => {
      if (store.world.epoch === lastEpochRef.current) return;
      lastEpochRef.current = store.world.epoch;
      historyRef.current = [...historyRef.current, snapshotOf(store.world)].slice(-60);
    });
  }, [store]);

  return <SimContext.Provider value={{ store, historyRef }}>{children}</SimContext.Provider>;
}

function useSimContext(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSimStore/useWorld must be used within a SimProvider");
  return ctx;
}

export function useSimStore(): SimStore {
  return useSimContext().store;
}

export function useWorld(): World {
  const { store } = useSimContext();
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.world,
    () => store.world,
  );
}

export function useEpochHistory(): EpochSnapshot[] {
  const { store, historyRef } = useSimContext();
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.world.epoch,
    () => store.world.epoch,
  );
  return historyRef.current;
}

/**
 * The shared print tape. Lab, Desk and the cockpit all write to it through
 * SimStore.apply, so what the Desk shows is what actually hit the World.
 */
export function useTape(): TapeRow[] {
  const { store } = useSimContext();
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.tape,
    () => store.tape,
  );
}
