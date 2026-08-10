-- Algunos peregrinos vuelven por sus propios medios (no necesitan micro de
-- vuelta). Se declara en la inscripción y se puede corregir después desde
-- el panel admin.
alter table public.registrations
  add column returns_independently boolean not null default false;
