insert into public.deck_game_environments (
  environment_key,
  region,
  format,
  name,
  rules_version,
  effective_from,
  notes,
  is_active
)
values (
  'KR_STANDARD_2026_07',
  'KR',
  'STANDARD',
  '한국판 스탠다드',
  '2026-07-24',
  '2026-07-24',
  'EBK-03 발매 환경. 금지 페어는 공식 공지를 함께 확인해야 합니다.',
  true
)
on conflict (environment_key) do update set
  name = excluded.name,
  rules_version = excluded.rules_version,
  effective_from = excluded.effective_from,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

with active_environment as (
  select id
  from public.deck_game_environments
  where environment_key = 'KR_STANDARD_2026_07'
),
current_bans(card_no, effective_from) as (
  values
    ('OP03-040', date '2026-07-01'),
    ('OP02-117', date '2026-03-01'),
    ('OP06-086', date '2026-03-01'),
    ('EB01-059', date '2026-03-01'),
    ('OP07-045', date '2026-03-01'),
    ('OP03-098', date '2025-10-01'),
    ('ST10-001', date '2025-10-01'),
    ('OP06-116', date '2025-07-01'),
    ('ST06-015', date '2025-04-01'),
    ('OP02-024', date '2024-09-01')
)
insert into public.deck_legality_rules (
  environment_id,
  card_no,
  restriction_type,
  max_copies,
  effective_from,
  source_url,
  notes
)
select
  active_environment.id,
  current_bans.card_no,
  'BANNED',
  0,
  current_bans.effective_from,
  'https://www.onepiece-cardgame.kr/topics/view.do?brdno=1171',
  '원피스 카드게임 한국 공식 금지/제한 카드 공지'
from active_environment
cross join current_bans
on conflict (environment_id, card_no, effective_from) do update set
  restriction_type = excluded.restriction_type,
  max_copies = excluded.max_copies,
  effective_to = null,
  source_url = excluded.source_url,
  notes = excluded.notes,
  updated_at = now();
