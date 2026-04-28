type SaleActivityLike = {
  isActive?: boolean | null;
  IsActive?: boolean | null;
};

export function isSaleActive(
  sale: SaleActivityLike | null | undefined,
): boolean {
  const value = sale?.isActive ?? sale?.IsActive;
  return value !== false;
}
