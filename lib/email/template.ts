import "server-only";

// Reemplazo simple de {{tag}} — sin lógica condicional. Cualquier texto
// condicional (ej. "todavía no te asignamos micro") se resuelve en código
// antes de armar `vars`, nunca dentro del texto que edita el admin.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
