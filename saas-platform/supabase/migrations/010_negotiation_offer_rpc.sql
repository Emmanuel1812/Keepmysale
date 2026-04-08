create or replace function append_negotiation_offer(
  p_negotiation_id uuid,
  p_offer jsonb
)
returns setof negotiations
language plpgsql
security definer
as $$
declare
  v_current_offers jsonb;
  v_new_step integer;
begin
  select offers into v_current_offers
  from negotiations
  where id = p_negotiation_id
  for update;

  if v_current_offers is null then
    v_current_offers := '[]'::jsonb;
  end if;

  v_new_step := jsonb_array_length(v_current_offers) + 1;

  update negotiations
  set
    offers = v_current_offers || jsonb_build_array(p_offer),
    current_step = v_new_step,
    updated_at = now()
  where id = p_negotiation_id;

  return query
  select *
  from negotiations
  where id = p_negotiation_id;
end;
$$;
