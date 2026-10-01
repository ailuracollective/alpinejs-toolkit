export interface MenuEvents extends Record<string, unknown[]> {
  open: [{ menuId: string }];
  close: [{ menuId: string }];
  select: [{ menuId: string; itemId: string }];
  change: [{ menuId?: string }];
}
