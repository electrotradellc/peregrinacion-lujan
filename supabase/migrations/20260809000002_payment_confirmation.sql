-- RPC atómica usada por el webhook de Mercado Pago: registra el pago y, si
-- fue aprobado, confirma la inscripción — todo en una sola transacción para
-- que un fallo parcial nunca deje pago=approved con inscripción=pending.

create or replace function public.confirm_payment(
  p_mp_payment_id text,
  p_mp_preference_id text,
  p_registration_id uuid,
  p_status public.payment_status,
  p_amount numeric,
  p_raw jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payments (
    registration_id, mp_preference_id, mp_payment_id, status, amount,
    raw_webhook_payload, processed_at
  )
  values (
    p_registration_id, p_mp_preference_id, p_mp_payment_id, p_status, p_amount,
    p_raw, now()
  )
  on conflict (mp_payment_id) do update
    set status = excluded.status,
        amount = excluded.amount,
        raw_webhook_payload = excluded.raw_webhook_payload,
        processed_at = now();

  if p_status = 'approved' then
    update public.registrations
      set status = 'confirmed'
      where id = p_registration_id and status <> 'confirmed';
  end if;
end;
$$;

grant execute on function public.confirm_payment(
  text, text, uuid, public.payment_status, numeric, jsonb
) to service_role;
