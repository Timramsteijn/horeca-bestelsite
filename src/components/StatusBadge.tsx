import type { KoppeltabelStatus } from "../types/sligro";

const STATUS_LABEL: Record<KoppeltabelStatus, string> = {
  zeker: "Zeker",
  controleer: "Controleer",
  mix: "Mix",
  nvt: "N.v.t.",
};

const STATUS_CLASS: Record<KoppeltabelStatus, string> = {
  zeker: "bg-green-tint text-green-text",
  controleer: "bg-amber-tint text-amber-text",
  mix: "bg-keuring-tint text-keuring-text",
  nvt: "bg-neutral-fill text-text-muted",
};

export function StatusBadge({ status }: { status: KoppeltabelStatus }) {
  return (
    <span
      className={`kicker inline-flex items-center rounded-[999px] px-2.5 py-1 text-[10px] ${STATUS_CLASS[status] ?? STATUS_CLASS.nvt}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
