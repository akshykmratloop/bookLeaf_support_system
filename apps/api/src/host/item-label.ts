/** "Royalty status (per book)" reads as "Royalty status" inside the item it belongs to. */
const PER_ITEM_SUFFIX = /\s*\(per [^)]*\)\s*$/i;

/** A per-item field's label as shown inside its item; never empty. */
export const itemLabelOf = (label: string): string => label.replace(PER_ITEM_SUFFIX, '') || label;
