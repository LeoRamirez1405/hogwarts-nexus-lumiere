import { SelectedConvType } from "../types";

export function markNotifsReadMatching(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  markNotifsReadMatching: (fn: (n: { type: string; related_id?: string }) => boolean) => void
) {
  if (!selectedId || !selectedType) return;
  markNotifsReadMatching((n) => {
    if (selectedType === "direct") return n.type === "dm_message" && n.related_id === selectedId;
    if (n.type === "group_added") return n.related_id === selectedId;
    if (n.type === "mention") return (n.related_id ?? "").split(":")[0] === selectedId;
    return false;
  });
}