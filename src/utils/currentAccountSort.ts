export function compareCurrentAccountFirst(
  leftId: string,
  rightId: string,
  currentAccountId: string | null | undefined,
): number {
  const normalizedCurrentId = currentAccountId?.trim();
  if (!normalizedCurrentId) return 0;

  const leftIsCurrent = leftId === normalizedCurrentId;
  const rightIsCurrent = rightId === normalizedCurrentId;
  if (leftIsCurrent === rightIsCurrent) return 0;
  return leftIsCurrent ? -1 : 1;
}
