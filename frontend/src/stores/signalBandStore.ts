import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";

type SignalBand = {
  label: string;
  detail: string;
  value: string | null;
  targetId: string;
  actionLabel: string;
  tone: "signal" | "dark";
  pathname: string | null;
};

type SignalBandState = SignalBand & {
  setBand: (band: SignalBand) => void;
};

const initial: SignalBand = {
  label: "Workspace",
  detail: "Advisory signals inform your next step. You decide.",
  value: null,
  targetId: "main-content",
  actionLabel: "Continue",
  tone: "dark",
  pathname: null,
};

export const useSignalBand = create<SignalBandState>((set) => ({
  ...initial,
  setBand: (band) => set(band),
}));

export function useSetSignalBand({
  label,
  detail,
  value,
  targetId,
  actionLabel,
  tone = "signal",
}: Omit<SignalBand, "pathname" | "tone"> & {
  tone?: SignalBand["tone"];
}) {
  const { pathname } = useLocation();
  const setBand = useSignalBand((state) => state.setBand);

  useEffect(() => {
    setBand({ label, detail, value, targetId, actionLabel, tone, pathname });
  }, [label, detail, value, targetId, actionLabel, tone, pathname, setBand]);
}
