// Persona de la lista de Vuelta. `returnBusId` vacío = todavía sin micro.
export interface ReturnPerson {
  registrationId: string;
  pilgrimCode: number | null;
  lastName: string;
  firstName: string;
  phone: string;
}

export interface ReturnAssignedPerson extends ReturnPerson {
  returnBusId: string;
  // Tiene micro de vuelta pero después se marcó que vuelve por su cuenta: se
  // muestra para poder sacarlo del micro.
  returnsIndependently: boolean;
}

export function comparePilgrimCode(a: ReturnPerson, b: ReturnPerson) {
  if (a.pilgrimCode === null && b.pilgrimCode === null) return 0;
  if (a.pilgrimCode === null) return 1;
  if (b.pilgrimCode === null) return -1;
  return a.pilgrimCode - b.pilgrimCode;
}

export function matchesPerson(p: ReturnPerson, needle: string) {
  return (
    p.lastName.toLowerCase().includes(needle) ||
    p.firstName.toLowerCase().includes(needle) ||
    String(p.pilgrimCode ?? "").includes(needle)
  );
}
