import { useEffect } from "react";
import { useSligroStore } from "../lib/store";

/** Triggert het laden van de dataset (eenmalig, vanuit localStorage of de
 * meegeleverde seed) en geeft de huidige data terug (null zolang nog niet
 * geladen). */
export function useSligroData() {
  const data = useSligroStore((s) => s.data);
  const laden = useSligroStore((s) => s.laden);
  useEffect(() => {
    laden();
  }, [laden]);
  return data;
}
