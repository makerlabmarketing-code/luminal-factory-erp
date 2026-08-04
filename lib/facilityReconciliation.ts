export type IdentifiedFacility = { id: number | string };

const sameId = (left: IdentifiedFacility, right: IdentifiedFacility) => String(left.id) === String(right.id);

export function reconcileUpdatedFacility<T extends IdentifiedFacility>(rows: readonly T[], facility: T): T[] {
  return rows.map((row) => sameId(row, facility) ? facility : row);
}

export function reconcileCreatedFacility<T extends IdentifiedFacility>(rows: readonly T[], facility: T): T[] {
  return [facility, ...rows.filter((row) => !sameId(row, facility))];
}

export function reconcileDeletedFacility<T extends IdentifiedFacility>(rows: readonly T[], deletedId: number | string): T[] {
  return rows.filter((row) => String(row.id) !== String(deletedId));
}

/** Keeps locally confirmed mutations authoritative if a previously started read arrives late. */
export function mergeFacilityRefetch<T extends IdentifiedFacility>(rows: readonly T[], incoming: readonly T[], protectedIds: ReadonlySet<string>): T[] {
  const protectedRows = new Map(rows.filter((row) => protectedIds.has(String(row.id))).map((row) => [String(row.id), row]));
  return incoming.map((row) => protectedRows.get(String(row.id)) || row);
}
