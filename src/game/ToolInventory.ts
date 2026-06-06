export type ToolKind = "swap" | "bomb" | "refresh" | "hint";

export type ToolInventory = Record<ToolKind, number>;

export function defaultTools(): ToolInventory {
  return {
    swap: 4,
    bomb: 3,
    refresh: 2,
    hint: 1,
  };
}

export function consumeTool(inventory: ToolInventory, kind: ToolKind): boolean {
  if (inventory[kind] <= 0) return false;
  inventory[kind] -= 1;
  return true;
}
