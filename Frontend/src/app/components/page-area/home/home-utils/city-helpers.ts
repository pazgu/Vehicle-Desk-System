export interface City {
  id: string;
  name: string;
}

export function normalizeCitiesResponse(raw: any[]): City[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((city: any) => ({
    id: String(city.id),
    name: String(city.name),
  }));
}

export function getSelectedStopNameFromList(
  stopId: string | null | undefined,
  cities: City[]
): string {
  if (!stopId) return 'לא נבחרה תחנה';
  const city = cities.find((c) => c.id === stopId);
  return city ? city.name : 'לא נבחרה תחנה';
}

/** Map extra stop IDs to their names */
export function getExtraStopNamesFromList(
  stopIds: string[] | null | undefined,
  cities: City[]
): string[] {
  if (!stopIds || !Array.isArray(stopIds)) return [];

  return stopIds
    .map((id) => {
      const city = cities.find((c) => c.id === id);
      return city?.name || null;
    })
    .filter((name): name is string => !!name);
}
