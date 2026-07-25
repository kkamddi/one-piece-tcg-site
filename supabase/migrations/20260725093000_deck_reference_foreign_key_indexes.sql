create index if not exists deck_archetypes_leader_id_idx
  on public.deck_archetypes (leader_id);

create index if not exists deck_template_versions_environment_id_idx
  on public.deck_template_versions (environment_id);
