begin;

insert into public.deck_leaders (
  region,
  card_id,
  card_no,
  card_name,
  colors,
  image_url,
  is_active
)
values (
  'KR',
  'KR::OP13-079',
  'OP13-079',
  '임',
  array['Black'],
  null,
  true
)
on conflict (region, card_id) do update set
  card_no = excluded.card_no,
  card_name = excluded.card_name,
  colors = excluded.colors,
  is_active = excluded.is_active,
  updated_at = now();

with target_environment as (
  select id
  from public.deck_game_environments
  where environment_key = 'KR_STANDARD_2026_07'
),
target_leader as (
  select id
  from public.deck_leaders
  where region = 'KR'
    and card_no = 'OP13-079'
)
insert into public.deck_archetypes (
  environment_id,
  leader_id,
  slug,
  nickname,
  summary,
  play_style,
  difficulty,
  offense,
  defense,
  control,
  strengths,
  weaknesses,
  recommended_for,
  starter_based,
  source_url,
  is_published
)
select
  target_environment.id,
  target_leader.id,
  'black-imu-five-elders',
  '이무 오로성',
  '허의 옥좌로 오로성을 전개하고 제거와 방어를 병행하는 흑색 운영 덱입니다.',
  '초반에는 오로성과 허의 옥좌를 준비하고, 중후반에는 오로성 연속 전개와 제거 효과로 필드를 장악합니다.',
  3,
  2,
  4,
  5,
  array['오로성 전개', '필드 제어', '후반 운영'],
  array['초반 준비 의존', '핵심 스테이지 의존'],
  array['운영형 덱을 선호하는 사용자', '대회 덱을 그대로 연습하려는 사용자'],
  false,
  'https://onepiecetopdecks.com/deck-list/japan-op-13-deck-list-carrying-on-his-will/',
  true
from target_environment
cross join target_leader
on conflict (environment_id, slug) do update set
  leader_id = excluded.leader_id,
  nickname = excluded.nickname,
  summary = excluded.summary,
  play_style = excluded.play_style,
  difficulty = excluded.difficulty,
  offense = excluded.offense,
  defense = excluded.defense,
  control = excluded.control,
  strengths = excluded.strengths,
  weaknesses = excluded.weaknesses,
  recommended_for = excluded.recommended_for,
  source_url = excluded.source_url,
  is_published = excluded.is_published,
  updated_at = now();

with target_archetype as (
  select archetype.id
  from public.deck_archetypes archetype
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug = 'black-imu-five-elders'
)
insert into public.deck_templates (
  archetype_id,
  template_type,
  title,
  description,
  source_url,
  is_published
)
select
  target_archetype.id,
  'TOURNAMENT',
  '이무 오로성 · MYSCS 우승 덱',
  'JPN EB03 MYSCS 447명 규모 대회에서 12-1로 우승한 덱입니다. 한국판 EBK-03 카드 수록 범위와 현재 금지 목록을 대조했습니다.',
  'https://onepiecetopdecks.com/deck-list/japan-op-13-deck-list-carrying-on-his-will/',
  true
from target_archetype
on conflict (archetype_id, template_type, title) do update set
  description = excluded.description,
  source_url = excluded.source_url,
  is_published = excluded.is_published,
  updated_at = now();

with target_template as (
  select template.id
  from public.deck_templates template
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug = 'black-imu-five-elders'
    and template.template_type = 'TOURNAMENT'
    and template.title = '이무 오로성 · MYSCS 우승 덱'
)
update public.deck_template_versions version
set
  is_current = false,
  updated_at = now()
where version.template_id in (select id from target_template)
  and version.version_label <> '2025-10-12 MYSCS 12-1';

with target_template as (
  select template.id, archetype.environment_id
  from public.deck_templates template
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug = 'black-imu-five-elders'
    and template.template_type = 'TOURNAMENT'
    and template.title = '이무 오로성 · MYSCS 우승 덱'
)
insert into public.deck_template_versions (
  template_id,
  environment_id,
  version_label,
  notes,
  published_at,
  is_current,
  is_published
)
select
  target_template.id,
  target_template.environment_id,
  '2025-10-12 MYSCS 12-1',
  'OP13/EB03 입상 덱 13개를 교차 분석했습니다. 메인 덱 50장과 현재 한국판 카드 존재 여부 및 금지 목록을 검증했습니다.',
  timestamptz '2025-10-12 00:00:00+00',
  true,
  true
from target_template
on conflict (template_id, version_label) do update set
  environment_id = excluded.environment_id,
  notes = excluded.notes,
  published_at = excluded.published_at,
  is_current = excluded.is_current,
  is_published = excluded.is_published,
  updated_at = now();

with target_version as (
  select version.id
  from public.deck_template_versions version
  join public.deck_templates template
    on template.id = version.template_id
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug = 'black-imu-five-elders'
    and version.version_label = '2025-10-12 MYSCS 12-1'
)
delete from public.deck_template_cards
where version_id in (select id from target_version);

with target_version as (
  select version.id
  from public.deck_template_versions version
  join public.deck_templates template
    on template.id = version.template_id
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug = 'black-imu-five-elders'
    and version.version_label = '2025-10-12 MYSCS 12-1'
),
deck_cards(card_id, card_no, card_name, quantity, role_tags, sort_order) as (
  values
    ('KR::OP05-082', 'OP05-082', '시라호시', 3, array['FLEX', 'ADOPTION_69'], 10),
    ('KR::OP13-086', 'OP13-086', '샤를리아 궁', 4, array['CORE', 'ADOPTION_100'], 20),
    ('KR::OP13-092', 'OP13-092', '묘스가르드 성', 4, array['CORE', 'ADOPTION_100'], 30),
    ('KR::OP13-083', 'OP13-083', '제이가르시아 새턴 성', 4, array['CORE', 'ADOPTION_100'], 40),
    ('KR::OP13-089', 'OP13-089', '토프먼 워큐리 성', 4, array['CORE', 'ADOPTION_100'], 50),
    ('KR::OP13-080', 'OP13-080', '에단바론 V. 나스쥬로 성', 4, array['CORE', 'ADOPTION_100'], 60),
    ('KR::OP13-091', 'OP13-091', '마커스 마즈 성', 4, array['CORE', 'ADOPTION_100'], 70),
    ('KR::OP13-084', 'OP13-084', '셰퍼드 주. 피터 성', 4, array['CORE', 'ADOPTION_100'], 80),
    ('KR::OP07-085', 'OP07-085', '스튜시', 2, array['FLEX', 'ADOPTION_38'], 90),
    ('KR::OP13-082', 'OP13-082', '오로성', 4, array['CORE', 'ADOPTION_100'], 100),
    ('KR::OP11-097', 'OP11-097', '영락없이 무디어졌어……!!!', 1, array['FLEX', 'ADOPTION_31'], 110),
    ('KR::OP13-096', 'OP13-096', '''오로성'' 이 자리에!!!', 4, array['CORE', 'ADOPTION_100'], 120),
    ('KR::OP13-097', 'OP13-097', '세계의 균형을… 영원토록 유지할 수는 없음이야.', 2, array['CORE', 'ADOPTION_100'], 130),
    ('KR::OP13-098', 'OP13-098', '애당초… 없지 않았는가…', 4, array['CORE', 'ADOPTION_100'], 140),
    ('KR::OP05-097', 'OP05-097', '성지 마리조아', 1, array['CORE', 'ADOPTION_100'], 150),
    ('KR::OP13-099', 'OP13-099', '허의 옥좌', 1, array['CORE', 'ADOPTION_100'], 160)
)
insert into public.deck_template_cards (
  version_id,
  card_id,
  card_no,
  card_name,
  quantity,
  role_tags,
  sort_order
)
select
  target_version.id,
  deck_cards.card_id,
  deck_cards.card_no,
  deck_cards.card_name,
  deck_cards.quantity,
  deck_cards.role_tags,
  deck_cards.sort_order
from target_version
cross join deck_cards;

commit;
