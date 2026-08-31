// Edad cumplida a una fecha de referencia (ej. la del evento), no la edad
// actual — ambas fechas son strings "YYYY-MM-DD" (sin hora), por eso se
// parsean igual (medianoche local) en los dos casos: solo importa la
// diferencia calendario, no la zona horaria del server.
export function calculateAge(birthDate: string, asOfDate: string): number {
  const birth = new Date(birthDate + "T00:00:00");
  const asOf = new Date(asOfDate + "T00:00:00");
  let age = asOf.getFullYear() - birth.getFullYear();
  const hadBirthdayByThen =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hadBirthdayByThen) age--;
  return age;
}
