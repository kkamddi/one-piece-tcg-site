begin;

with deck_seed (
  slug,
  leader_no,
  colors,
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
  template_title,
  template_description,
  version_label,
  published_at,
  source_url
) as (
  values
    (
      'green-zoro-midrange',
      'OP12-020',
      array['Green'],
      '녹조로',
      '낮은 코스트 캐릭터를 효율적으로 전개하고 리더 효과로 공격 기회를 늘리는 녹색 미드레인지 덱입니다.',
      '초반 필드를 넓힌 뒤 리더 효과와 리스탠드 수단으로 공격 횟수를 늘려 상대의 패와 라이프를 압박합니다.',
      3, 4, 3, 3,
      array['필드 전개', '연속 공격', '안정적인 중반'],
      array['초반 필드 정리', '손패 소모 관리'],
      array['공격적인 운영을 선호하는 사용자', '녹색 덱 입문자'],
      '녹조로 · Bandai Miyagi Area Qualifier TOP 4',
      '2025년 11월 15일 Bandai Miyagi Area Qualifier에서 10-2로 TOP 4에 입상한 녹조로 덱입니다.',
      '2025-11-15 Miyagi 10-2',
      timestamptz '2025-11-15 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'red-blue-vivi',
      'EB03-001',
      array['Red', 'Blue'],
      '적청 비비',
      '적색의 공격 전개와 청색의 패 순환을 함께 사용하는 EB03 비비 덱입니다.',
      '효율적인 캐릭터 전개와 드로우를 반복해 패를 유지하면서 중후반 공격을 이어갑니다.',
      3, 4, 3, 3,
      array['패 순환', '다양한 선택지', '중후반 압박'],
      array['초반 템포 관리', '상황별 선택 난이도'],
      array['비비를 좋아하는 사용자', '공격과 운영을 함께 원하는 사용자'],
      '적청 비비 · 플래그십 우승 덱',
      '2025년 11월 1일 플래그십에서 5-0으로 우승한 EB03 비비 덱입니다.',
      '2025-11-01 Flagship 5-0',
      timestamptz '2025-11-01 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'green-purple-lim',
      'OP09-022',
      array['Green', 'Purple'],
      '녹자 림',
      '도크터와 ODYSSEY 계열 카드를 중심으로 전개와 DON!! 운용을 연결하는 녹자색 덱입니다.',
      '전용 서치와 전개 수단으로 필요한 카드를 모으고, DON!! 가속과 녹색의 필드 제어를 함께 사용합니다.',
      3, 3, 3, 4,
      array['전용 카드 연계', '자원 가속', '필드 운영'],
      array['전용 파츠 의존', '초반 손패 영향'],
      array['콤보형 덱을 선호하는 사용자', 'ODYSSEY 테마 사용자'],
      '녹자 림 · 플래그십 우승 덱',
      '2025년 11월 1일 27인 플래그십에서 5-0으로 우승한 림 덱입니다.',
      '2025-11-01 Flagship 5-0',
      timestamptz '2025-11-01 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'green-black-perona',
      'OP06-021',
      array['Green', 'Black'],
      '녹흑 페로나',
      '코스트 감소와 KO 효과를 결합해 상대 필드를 정리하는 녹흑색 컨트롤 덱입니다.',
      '흑색 카드로 상대 캐릭터의 코스트를 낮추고 녹색과 흑색의 제거 수단으로 필드를 통제합니다.',
      4, 2, 4, 5,
      array['캐릭터 제거', '필드 통제', '장기전'],
      array['복합 콤보 필요', '빠른 덱 대응 난이도'],
      array['컨트롤 덱을 선호하는 사용자', '계산적인 운영을 원하는 사용자'],
      '녹흑 페로나 · Heroines Cup 우승 덱',
      '2025년 11월 1일 16인 Heroines Cup에서 우승한 페로나 덱입니다.',
      '2025-11-01 Heroines Cup 1st',
      timestamptz '2025-11-01 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'red-rayleigh-midrange',
      'OP12-001',
      array['Red'],
      '적레일리',
      '적색의 효율적인 공격 카드와 레일리 전용 연계를 사용하는 미드레인지 덱입니다.',
      '초반부터 상대의 패를 압박하고, 중반 이후 공격 가능한 캐릭터를 연속 전개해 마무리합니다.',
      3, 4, 3, 2,
      array['공격 템포', '일관된 전개', '강한 중반'],
      array['수비 자원 관리', '제거 중심 덱 상대'],
      array['적색 입문자', '정석적인 공격 덱을 원하는 사용자'],
      '적레일리 · Bandai Miyagi Area Qualifier TOP 16',
      '2025년 11월 15일 Bandai Miyagi Area Qualifier에서 7-3으로 TOP 16에 입상한 레일리 덱입니다.',
      '2025-11-15 Miyagi 7-3',
      timestamptz '2025-11-15 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'yellow-bonney-life',
      'OP13-100',
      array['Yellow'],
      '황보니',
      '라이프 조작과 트리거를 활용해 방어와 역전을 노리는 황색 보니 덱입니다.',
      '라이프의 순서와 수량을 조절해 필요한 트리거를 준비하고, 후반 고성능 캐릭터로 역전합니다.',
      4, 3, 5, 4,
      array['라이프 조작', '트리거 활용', '후반 역전'],
      array['확률 관리', '초반 전개 속도'],
      array['황색 운영을 익히려는 사용자', '수비적인 덱을 선호하는 사용자'],
      '황보니 · Bandai Hiroshima Area Qualifier 입상 덱',
      '2025년 11월 1일 Bandai Hiroshima Area Qualifier에서 7-2를 기록한 황색 보니 덱입니다.',
      '2025-11-01 Hiroshima 7-2',
      timestamptz '2025-11-01 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'blue-kuzan-control',
      'OP12-040',
      array['Blue'],
      '청쿠잔',
      '청색의 바운스와 패 순환으로 상대 전개를 늦추는 컨트롤 덱입니다.',
      '상대 캐릭터를 패나 덱으로 되돌리면서 손패를 보충하고, 고코스트 캐릭터로 게임을 마무리합니다.',
      4, 2, 4, 5,
      array['바운스 제거', '패 순환', '장기전'],
      array['초반 공격력', '상황 판단 난이도'],
      array['청색 컨트롤 사용자', '상대 필드 대응을 선호하는 사용자'],
      '청쿠잔 · JTC 2대2 우승 덱',
      '2025년 11월 13일 JTC 2대2 대회에서 우승한 청쿠잔 덱입니다.',
      '2025-11-13 JTC 2v2 1st',
      timestamptz '2025-11-13 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'red-black-koby',
      'OP11-001',
      array['Red', 'Black'],
      '적흑 코비',
      '적색의 공격력과 흑색의 코스트 기반 제거를 결합한 미드레인지 덱입니다.',
      '초반 공격으로 상대 패를 줄이고, 코스트 감소와 KO 효과로 상대 필드를 정리합니다.',
      4, 4, 3, 4,
      array['공격과 제거 병행', '필드 교환', '중반 압박'],
      array['자원 배분 난이도', '색상별 파츠 조합'],
      array['공격형 컨트롤 사용자', '코비 테마 사용자'],
      '적흑 코비 · 64인 플래그십 우승 덱',
      '2025년 11월 21일 64인 플래그십에서 우승한 적흑 코비 덱입니다.',
      '2025-11-21 Flagship 64 1st',
      timestamptz '2025-11-21 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'green-uta-film',
      'ST11-001',
      array['Green'],
      '녹우타',
      'FILM 특징 카드의 서치와 연속 전개를 활용하는 입문 친화적인 녹색 덱입니다.',
      '리더 효과로 FILM 카드를 보충하고, 여러 캐릭터를 빠르게 전개해 공격 횟수를 늘립니다.',
      2, 4, 3, 2,
      array['쉬운 서치 연계', '필드 전개', '스타터 기반'],
      array['전용 특징 의존', '전체 제거 대응'],
      array['처음 덱을 만드는 사용자', '스타터덱 기반 업그레이드 사용자'],
      '녹우타 · 스탠다드 배틀 우승 덱',
      '2025년 11월 11일 스탠다드 배틀에서 우승한 녹우타 덱입니다.',
      '2025-11-11 Standard Battle 1st',
      timestamptz '2025-11-11 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'blue-purple-reiju',
      'OP06-042',
      array['Blue', 'Purple'],
      '청자 레이주',
      'GERMA 66 특징과 DON!! 차이를 활용해 패를 보충하고 전개하는 콤보 덱입니다.',
      'DON!! 수를 조절하면서 전용 캐릭터를 저비용으로 전개하고, 레이주 효과로 손패를 유지합니다.',
      4, 4, 2, 3,
      array['폭발적인 전개', '패 보충', '전용 콤보'],
      array['콤보 파츠 의존', 'DON!! 관리 난이도'],
      array['콤보 덱 사용자', 'GERMA 66 테마 사용자'],
      '청자 레이주 · Heroines Cup 우승 덱',
      '2025년 10월 26일 Heroines Cup에서 5-0으로 우승한 레이주 덱입니다.',
      '2025-10-26 Heroines Cup 5-0',
      timestamptz '2025-10-26 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'yellow-pudding-life',
      'OP08-058',
      array['Purple', 'Yellow'],
      '황푸딩',
      '빅 맘 해적단과 라이프 조작을 중심으로 안정적인 후반을 만드는 황색 덱입니다.',
      '라이프를 늘리거나 순서를 조정해 수비력을 확보하고, 고코스트 캐릭터로 게임을 마무리합니다.',
      3, 3, 5, 4,
      array['높은 수비력', '라이프 회복', '후반 파워'],
      array['초반 속도', '라이프 관리'],
      array['빅 맘 해적단 사용자', '장기전을 선호하는 사용자'],
      '황푸딩 · Heroines Cup 3대3 우승 덱',
      '2025년 10월 26일 Heroines Cup 3대3에서 5-0으로 우승한 황푸딩 덱입니다.',
      '2025-10-26 Heroines Cup 3v3 5-0',
      timestamptz '2025-10-26 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    ),
    (
      'red-black-sabo',
      'OP13-004',
      array['Red', 'Black'],
      '적흑 사보',
      '혁명군 카드의 공격력과 흑색 제거를 함께 사용하는 실전형 미드레인지 덱입니다.',
      '적색 캐릭터로 압박하면서 흑색의 코스트 감소와 제거를 연결해 필드 우위를 유지합니다.',
      4, 4, 3, 4,
      array['공격과 제거 병행', '혁명군 연계', '중반 압박'],
      array['복합 색상 운용', '핵심 카드 의존'],
      array['혁명군 테마 사용자', '공격형 컨트롤 사용자'],
      '적흑 사보 · 3대3 우승 덱',
      '2025년 10월 26일 3대3 대회에서 5-1로 우승한 적흑 사보 덱입니다.',
      '2025-10-26 3v3 5-1',
      timestamptz '2025-10-26 00:00:00+00',
      'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'
    )
)
insert into public.deck_leaders (
  region,
  card_id,
  card_no,
  card_name,
  colors,
  image_url,
  is_active
)
select
  'KR',
  'KR::' || seed.leader_no,
  seed.leader_no,
  case seed.leader_no
    when 'OP12-020' then '롤로노아 조로'
    when 'EB03-001' then '네펠타리 비비'
    when 'OP09-022' then '리무'
    when 'OP06-021' then '페로나'
    when 'OP12-001' then '실버즈 레일리'
    when 'OP13-100' then '쥬얼리 보니'
    when 'OP12-040' then '쿠잔'
    when 'OP11-001' then '코비'
    when 'ST11-001' then '우타'
    when 'OP06-042' then '빈스모크 레이주'
    when 'OP08-058' then '샬롯 푸딩'
    when 'OP13-004' then '사보'
  end,
  seed.colors,
  null,
  true
from deck_seed seed
on conflict (region, card_id) do update set
  card_no = excluded.card_no,
  card_name = excluded.card_name,
  colors = excluded.colors,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  updated_at = now();

with deck_seed (
  slug,
  leader_no,
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
  source_url
) as (
  values
    ('green-zoro-midrange', 'OP12-020', '녹조로', '낮은 코스트 캐릭터를 효율적으로 전개하고 리더 효과로 공격 기회를 늘리는 녹색 미드레인지 덱입니다.', '초반 필드를 넓힌 뒤 리더 효과와 리스탠드 수단으로 공격 횟수를 늘려 상대의 패와 라이프를 압박합니다.', 3, 4, 3, 3, array['필드 전개', '연속 공격', '안정적인 중반'], array['초반 필드 정리', '손패 소모 관리'], array['공격적인 운영을 선호하는 사용자', '녹색 덱 입문자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-blue-vivi', 'EB03-001', '적청 비비', '적색의 공격 전개와 청색의 패 순환을 함께 사용하는 EB03 비비 덱입니다.', '효율적인 캐릭터 전개와 드로우를 반복해 패를 유지하면서 중후반 공격을 이어갑니다.', 3, 4, 3, 3, array['패 순환', '다양한 선택지', '중후반 압박'], array['초반 템포 관리', '상황별 선택 난이도'], array['비비를 좋아하는 사용자', '공격과 운영을 함께 원하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-purple-lim', 'OP09-022', '녹자 림', '도크터와 ODYSSEY 계열 카드를 중심으로 전개와 DON!! 운용을 연결하는 녹자색 덱입니다.', '전용 서치와 전개 수단으로 필요한 카드를 모으고, DON!! 가속과 녹색의 필드 제어를 함께 사용합니다.', 3, 3, 3, 4, array['전용 카드 연계', '자원 가속', '필드 운영'], array['전용 파츠 의존', '초반 손패 영향'], array['콤보형 덱을 선호하는 사용자', 'ODYSSEY 테마 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-black-perona', 'OP06-021', '녹흑 페로나', '코스트 감소와 KO 효과를 결합해 상대 필드를 정리하는 녹흑색 컨트롤 덱입니다.', '흑색 카드로 상대 캐릭터의 코스트를 낮추고 녹색과 흑색의 제거 수단으로 필드를 통제합니다.', 4, 2, 4, 5, array['캐릭터 제거', '필드 통제', '장기전'], array['복합 콤보 필요', '빠른 덱 대응 난이도'], array['컨트롤 덱을 선호하는 사용자', '계산적인 운영을 원하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-rayleigh-midrange', 'OP12-001', '적레일리', '적색의 효율적인 공격 카드와 레일리 전용 연계를 사용하는 미드레인지 덱입니다.', '초반부터 상대의 패를 압박하고, 중반 이후 공격 가능한 캐릭터를 연속 전개해 마무리합니다.', 3, 4, 3, 2, array['공격 템포', '일관된 전개', '강한 중반'], array['수비 자원 관리', '제거 중심 덱 상대'], array['적색 입문자', '정석적인 공격 덱을 원하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('yellow-bonney-life', 'OP13-100', '황보니', '라이프 조작과 트리거를 활용해 방어와 역전을 노리는 황색 보니 덱입니다.', '라이프의 순서와 수량을 조절해 필요한 트리거를 준비하고, 후반 고성능 캐릭터로 역전합니다.', 4, 3, 5, 4, array['라이프 조작', '트리거 활용', '후반 역전'], array['확률 관리', '초반 전개 속도'], array['황색 운영을 익히려는 사용자', '수비적인 덱을 선호하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('blue-kuzan-control', 'OP12-040', '청쿠잔', '청색의 바운스와 패 순환으로 상대 전개를 늦추는 컨트롤 덱입니다.', '상대 캐릭터를 패나 덱으로 되돌리면서 손패를 보충하고, 고코스트 캐릭터로 게임을 마무리합니다.', 4, 2, 4, 5, array['바운스 제거', '패 순환', '장기전'], array['초반 공격력', '상황 판단 난이도'], array['청색 컨트롤 사용자', '상대 필드 대응을 선호하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-black-koby', 'OP11-001', '적흑 코비', '적색의 공격력과 흑색의 코스트 기반 제거를 결합한 미드레인지 덱입니다.', '초반 공격으로 상대 패를 줄이고, 코스트 감소와 KO 효과로 상대 필드를 정리합니다.', 4, 4, 3, 4, array['공격과 제거 병행', '필드 교환', '중반 압박'], array['자원 배분 난이도', '색상별 파츠 조합'], array['공격형 컨트롤 사용자', '코비 테마 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-uta-film', 'ST11-001', '녹우타', 'FILM 특징 카드의 서치와 연속 전개를 활용하는 입문 친화적인 녹색 덱입니다.', '리더 효과로 FILM 카드를 보충하고, 여러 캐릭터를 빠르게 전개해 공격 횟수를 늘립니다.', 2, 4, 3, 2, array['쉬운 서치 연계', '필드 전개', '스타터 기반'], array['전용 특징 의존', '전체 제거 대응'], array['처음 덱을 만드는 사용자', '스타터덱 기반 업그레이드 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('blue-purple-reiju', 'OP06-042', '청자 레이주', 'GERMA 66 특징과 DON!! 차이를 활용해 패를 보충하고 전개하는 콤보 덱입니다.', 'DON!! 수를 조절하면서 전용 캐릭터를 저비용으로 전개하고, 레이주 효과로 손패를 유지합니다.', 4, 4, 2, 3, array['폭발적인 전개', '패 보충', '전용 콤보'], array['콤보 파츠 의존', 'DON!! 관리 난이도'], array['콤보 덱 사용자', 'GERMA 66 테마 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('yellow-pudding-life', 'OP08-058', '황푸딩', '빅 맘 해적단과 라이프 조작을 중심으로 안정적인 후반을 만드는 황색 덱입니다.', '라이프를 늘리거나 순서를 조정해 수비력을 확보하고, 고코스트 캐릭터로 게임을 마무리합니다.', 3, 3, 5, 4, array['높은 수비력', '라이프 회복', '후반 파워'], array['초반 속도', '라이프 관리'], array['빅 맘 해적단 사용자', '장기전을 선호하는 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-black-sabo', 'OP13-004', '적흑 사보', '혁명군 카드의 공격력과 흑색 제거를 함께 사용하는 실전형 미드레인지 덱입니다.', '적색 캐릭터로 압박하면서 흑색의 코스트 감소와 제거를 연결해 필드 우위를 유지합니다.', 4, 4, 3, 4, array['공격과 제거 병행', '혁명군 연계', '중반 압박'], array['복합 색상 운용', '핵심 카드 의존'], array['혁명군 테마 사용자', '공격형 컨트롤 사용자'], 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/')
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
  environment.id,
  leader.id,
  seed.slug,
  seed.nickname,
  seed.summary,
  seed.play_style,
  seed.difficulty,
  seed.offense,
  seed.defense,
  seed.control,
  seed.strengths,
  seed.weaknesses,
  seed.recommended_for,
  seed.leader_no = 'ST11-001',
  seed.source_url,
  true
from deck_seed seed
join public.deck_game_environments environment
  on environment.environment_key = 'KR_STANDARD_2026_07'
join public.deck_leaders leader
  on leader.region = 'KR'
 and leader.card_no = seed.leader_no
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
  starter_based = excluded.starter_based,
  source_url = excluded.source_url,
  is_published = excluded.is_published,
  updated_at = now();

with template_seed (slug, title, description, version_label, published_at, source_url) as (
  values
    ('green-zoro-midrange', '녹조로 · Bandai Miyagi Area Qualifier TOP 4', '2025년 11월 15일 Bandai Miyagi Area Qualifier에서 10-2로 TOP 4에 입상한 녹조로 덱입니다.', '2025-11-15 Miyagi 10-2', timestamptz '2025-11-15 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-blue-vivi', '적청 비비 · 플래그십 우승 덱', '2025년 11월 1일 플래그십에서 5-0으로 우승한 EB03 비비 덱입니다.', '2025-11-01 Flagship 5-0', timestamptz '2025-11-01 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-purple-lim', '녹자 림 · 플래그십 우승 덱', '2025년 11월 1일 27인 플래그십에서 5-0으로 우승한 림 덱입니다.', '2025-11-01 Flagship 5-0', timestamptz '2025-11-01 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-black-perona', '녹흑 페로나 · Heroines Cup 우승 덱', '2025년 11월 1일 16인 Heroines Cup에서 우승한 페로나 덱입니다.', '2025-11-01 Heroines Cup 1st', timestamptz '2025-11-01 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-rayleigh-midrange', '적레일리 · Bandai Miyagi Area Qualifier TOP 16', '2025년 11월 15일 Bandai Miyagi Area Qualifier에서 7-3으로 TOP 16에 입상한 레일리 덱입니다.', '2025-11-15 Miyagi 7-3', timestamptz '2025-11-15 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('yellow-bonney-life', '황보니 · Bandai Hiroshima Area Qualifier 입상 덱', '2025년 11월 1일 Bandai Hiroshima Area Qualifier에서 7-2를 기록한 황색 보니 덱입니다.', '2025-11-01 Hiroshima 7-2', timestamptz '2025-11-01 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('blue-kuzan-control', '청쿠잔 · JTC 2대2 우승 덱', '2025년 11월 13일 JTC 2대2 대회에서 우승한 청쿠잔 덱입니다.', '2025-11-13 JTC 2v2 1st', timestamptz '2025-11-13 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-black-koby', '적흑 코비 · 64인 플래그십 우승 덱', '2025년 11월 21일 64인 플래그십에서 우승한 적흑 코비 덱입니다.', '2025-11-21 Flagship 64 1st', timestamptz '2025-11-21 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('green-uta-film', '녹우타 · 스탠다드 배틀 우승 덱', '2025년 11월 11일 스탠다드 배틀에서 우승한 녹우타 덱입니다.', '2025-11-11 Standard Battle 1st', timestamptz '2025-11-11 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('blue-purple-reiju', '청자 레이주 · Heroines Cup 우승 덱', '2025년 10월 26일 Heroines Cup에서 5-0으로 우승한 레이주 덱입니다.', '2025-10-26 Heroines Cup 5-0', timestamptz '2025-10-26 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('yellow-pudding-life', '황푸딩 · Heroines Cup 3대3 우승 덱', '2025년 10월 26일 Heroines Cup 3대3에서 5-0으로 우승한 황푸딩 덱입니다.', '2025-10-26 Heroines Cup 3v3 5-0', timestamptz '2025-10-26 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/'),
    ('red-black-sabo', '적흑 사보 · 3대3 우승 덱', '2025년 10월 26일 3대3 대회에서 5-1로 우승한 적흑 사보 덱입니다.', '2025-10-26 3v3 5-1', timestamptz '2025-10-26 00:00:00+00', 'https://onepiecetopdecks.com/deck-list/japan-eb-03-deck-list-one-piece-heroines-edition/')
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
  archetype.id,
  'TOURNAMENT',
  seed.title,
  seed.description,
  seed.source_url,
  true
from template_seed seed
join public.deck_archetypes archetype
  on archetype.slug = seed.slug
join public.deck_game_environments environment
  on environment.id = archetype.environment_id
 and environment.environment_key = 'KR_STANDARD_2026_07'
on conflict (archetype_id, template_type, title) do update set
  description = excluded.description,
  source_url = excluded.source_url,
  is_published = excluded.is_published,
  updated_at = now();

with template_seed (slug, title, version_label) as (
  values
    ('green-zoro-midrange', '녹조로 · Bandai Miyagi Area Qualifier TOP 4', '2025-11-15 Miyagi 10-2'),
    ('red-blue-vivi', '적청 비비 · 플래그십 우승 덱', '2025-11-01 Flagship 5-0'),
    ('green-purple-lim', '녹자 림 · 플래그십 우승 덱', '2025-11-01 Flagship 5-0'),
    ('green-black-perona', '녹흑 페로나 · Heroines Cup 우승 덱', '2025-11-01 Heroines Cup 1st'),
    ('red-rayleigh-midrange', '적레일리 · Bandai Miyagi Area Qualifier TOP 16', '2025-11-15 Miyagi 7-3'),
    ('yellow-bonney-life', '황보니 · Bandai Hiroshima Area Qualifier 입상 덱', '2025-11-01 Hiroshima 7-2'),
    ('blue-kuzan-control', '청쿠잔 · JTC 2대2 우승 덱', '2025-11-13 JTC 2v2 1st'),
    ('red-black-koby', '적흑 코비 · 64인 플래그십 우승 덱', '2025-11-21 Flagship 64 1st'),
    ('green-uta-film', '녹우타 · 스탠다드 배틀 우승 덱', '2025-11-11 Standard Battle 1st'),
    ('blue-purple-reiju', '청자 레이주 · Heroines Cup 우승 덱', '2025-10-26 Heroines Cup 5-0'),
    ('yellow-pudding-life', '황푸딩 · Heroines Cup 3대3 우승 덱', '2025-10-26 Heroines Cup 3v3 5-0'),
    ('red-black-sabo', '적흑 사보 · 3대3 우승 덱', '2025-10-26 3v3 5-1')
)
update public.deck_template_versions version
set
  is_current = false,
  updated_at = now()
from public.deck_templates template
join public.deck_archetypes archetype
  on archetype.id = template.archetype_id
join public.deck_game_environments environment
  on environment.id = archetype.environment_id
join template_seed seed
  on seed.slug = archetype.slug
 and seed.title = template.title
where version.template_id = template.id
  and environment.environment_key = 'KR_STANDARD_2026_07'
  and version.version_label <> seed.version_label;

with template_seed (slug, title, version_label, published_at) as (
  values
    ('green-zoro-midrange', '녹조로 · Bandai Miyagi Area Qualifier TOP 4', '2025-11-15 Miyagi 10-2', timestamptz '2025-11-15 00:00:00+00'),
    ('red-blue-vivi', '적청 비비 · 플래그십 우승 덱', '2025-11-01 Flagship 5-0', timestamptz '2025-11-01 00:00:00+00'),
    ('green-purple-lim', '녹자 림 · 플래그십 우승 덱', '2025-11-01 Flagship 5-0', timestamptz '2025-11-01 00:00:00+00'),
    ('green-black-perona', '녹흑 페로나 · Heroines Cup 우승 덱', '2025-11-01 Heroines Cup 1st', timestamptz '2025-11-01 00:00:00+00'),
    ('red-rayleigh-midrange', '적레일리 · Bandai Miyagi Area Qualifier TOP 16', '2025-11-15 Miyagi 7-3', timestamptz '2025-11-15 00:00:00+00'),
    ('yellow-bonney-life', '황보니 · Bandai Hiroshima Area Qualifier 입상 덱', '2025-11-01 Hiroshima 7-2', timestamptz '2025-11-01 00:00:00+00'),
    ('blue-kuzan-control', '청쿠잔 · JTC 2대2 우승 덱', '2025-11-13 JTC 2v2 1st', timestamptz '2025-11-13 00:00:00+00'),
    ('red-black-koby', '적흑 코비 · 64인 플래그십 우승 덱', '2025-11-21 Flagship 64 1st', timestamptz '2025-11-21 00:00:00+00'),
    ('green-uta-film', '녹우타 · 스탠다드 배틀 우승 덱', '2025-11-11 Standard Battle 1st', timestamptz '2025-11-11 00:00:00+00'),
    ('blue-purple-reiju', '청자 레이주 · Heroines Cup 우승 덱', '2025-10-26 Heroines Cup 5-0', timestamptz '2025-10-26 00:00:00+00'),
    ('yellow-pudding-life', '황푸딩 · Heroines Cup 3대3 우승 덱', '2025-10-26 Heroines Cup 3v3 5-0', timestamptz '2025-10-26 00:00:00+00'),
    ('red-black-sabo', '적흑 사보 · 3대3 우승 덱', '2025-10-26 3v3 5-1', timestamptz '2025-10-26 00:00:00+00')
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
  template.id,
  archetype.environment_id,
  seed.version_label,
  '메인 덱 50장, 한국판 카드 존재 여부, 리더 색상, 현재 금지·제한 목록을 검증했습니다.',
  seed.published_at,
  true,
  true
from template_seed seed
join public.deck_archetypes archetype
  on archetype.slug = seed.slug
join public.deck_game_environments environment
  on environment.id = archetype.environment_id
 and environment.environment_key = 'KR_STANDARD_2026_07'
join public.deck_templates template
  on template.archetype_id = archetype.id
 and template.template_type = 'TOURNAMENT'
 and template.title = seed.title
on conflict (template_id, version_label) do update set
  environment_id = excluded.environment_id,
  notes = excluded.notes,
  published_at = excluded.published_at,
  is_current = excluded.is_current,
  is_published = excluded.is_published,
  updated_at = now();

with target_versions as (
  select version.id
  from public.deck_template_versions version
  join public.deck_templates template
    on template.id = version.template_id
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and archetype.slug in (
      'green-zoro-midrange',
      'red-blue-vivi',
      'green-purple-lim',
      'green-black-perona',
      'red-rayleigh-midrange',
      'yellow-bonney-life',
      'blue-kuzan-control',
      'red-black-koby',
      'green-uta-film',
      'blue-purple-reiju',
      'yellow-pudding-life',
      'red-black-sabo'
    )
    and version.is_current = true
)
delete from public.deck_template_cards
where version_id in (select id from target_versions);

with deck_cards (slug, card_no, quantity, sort_order) as (
  values
    ('green-zoro-midrange', 'EB01-015', 4, 10),
    ('green-zoro-midrange', 'OP12-028', 4, 20),
    ('green-zoro-midrange', 'OP12-034', 4, 30),
    ('green-zoro-midrange', 'OP12-027', 4, 40),
    ('green-zoro-midrange', 'ST12-003', 4, 50),
    ('green-zoro-midrange', 'OP12-026', 2, 60),
    ('green-zoro-midrange', 'PRB02-006', 4, 70),
    ('green-zoro-midrange', 'OP13-037', 4, 80),
    ('green-zoro-midrange', 'EB01-012', 4, 90),
    ('green-zoro-midrange', 'OP12-031', 4, 100),
    ('green-zoro-midrange', 'OP13-031', 4, 110),
    ('green-zoro-midrange', 'OP13-028', 1, 120),
    ('green-zoro-midrange', 'OP05-037', 1, 130),
    ('green-zoro-midrange', 'OP12-037', 2, 140),
    ('green-zoro-midrange', 'OP12-039', 4, 150),

    ('red-blue-vivi', 'OP13-012', 4, 10),
    ('red-blue-vivi', 'OP04-002', 4, 20),
    ('red-blue-vivi', 'OP04-006', 4, 30),
    ('red-blue-vivi', 'OP10-011', 4, 40),
    ('red-blue-vivi', 'OP13-011', 4, 50),
    ('red-blue-vivi', 'EB03-006', 4, 60),
    ('red-blue-vivi', 'OP09-009', 2, 70),
    ('red-blue-vivi', 'OP06-007', 3, 80),
    ('red-blue-vivi', 'EB02-026', 2, 90),
    ('red-blue-vivi', 'OP10-045', 4, 100),
    ('red-blue-vivi', 'OP11-054', 4, 110),
    ('red-blue-vivi', 'EB03-024', 4, 120),
    ('red-blue-vivi', 'OP05-118', 3, 130),
    ('red-blue-vivi', 'OP13-058', 4, 140),

    ('green-purple-lim', 'OP10-037', 4, 10),
    ('green-purple-lim', 'OP10-033', 4, 20),
    ('green-purple-lim', 'OP09-037', 4, 30),
    ('green-purple-lim', 'OP09-027', 4, 40),
    ('green-purple-lim', 'OP09-031', 4, 50),
    ('green-purple-lim', 'OP09-035', 3, 60),
    ('green-purple-lim', 'OP10-024', 2, 70),
    ('green-purple-lim', 'OP10-025', 4, 80),
    ('green-purple-lim', 'OP10-029', 4, 90),
    ('green-purple-lim', 'OP06-118', 4, 100),
    ('green-purple-lim', 'OP13-028', 3, 110),
    ('green-purple-lim', 'ST18-001', 4, 120),
    ('green-purple-lim', 'OP12-037', 4, 130),
    ('green-purple-lim', 'ST04-016', 2, 140),

    ('green-black-perona', 'OP02-106', 4, 10),
    ('green-black-perona', 'OP06-082', 4, 20),
    ('green-black-perona', 'ST06-006', 3, 30),
    ('green-black-perona', 'ST06-008', 1, 40),
    ('green-black-perona', 'EB01-046', 4, 50),
    ('green-black-perona', 'OP02-096', 4, 60),
    ('green-black-perona', 'OP05-091', 4, 70),
    ('green-black-perona', 'OP06-093', 4, 80),
    ('green-black-perona', 'EB01-048', 2, 90),
    ('green-black-perona', 'OP06-092', 4, 100),
    ('green-black-perona', 'PRB02-013', 4, 110),
    ('green-black-perona', 'OP06-036', 4, 120),
    ('green-black-perona', 'OP08-023', 4, 130),
    ('green-black-perona', 'OP13-031', 3, 140),
    ('green-black-perona', 'OP06-035', 1, 150),

    ('red-rayleigh-midrange', 'OP01-016', 4, 10),
    ('red-rayleigh-midrange', 'OP03-008', 4, 20),
    ('red-rayleigh-midrange', 'OP12-006', 4, 30),
    ('red-rayleigh-midrange', 'OP13-012', 3, 40),
    ('red-rayleigh-midrange', 'OP01-024', 1, 50),
    ('red-rayleigh-midrange', 'OP12-014', 4, 60),
    ('red-rayleigh-midrange', 'OP01-025', 2, 70),
    ('red-rayleigh-midrange', 'P-006', 2, 80),
    ('red-rayleigh-midrange', 'OP10-005', 4, 90),
    ('red-rayleigh-midrange', 'EB01-003', 1, 100),
    ('red-rayleigh-midrange', 'OP12-015', 4, 110),
    ('red-rayleigh-midrange', 'OP12-016', 4, 120),
    ('red-rayleigh-midrange', 'OP12-017', 3, 130),
    ('red-rayleigh-midrange', 'OP12-018', 4, 140),
    ('red-rayleigh-midrange', 'OP12-019', 3, 150),
    ('red-rayleigh-midrange', 'OP06-018', 2, 160),
    ('red-rayleigh-midrange', 'ST21-017', 1, 170),

    ('yellow-bonney-life', 'OP13-113', 4, 10),
    ('yellow-bonney-life', 'OP06-106', 4, 20),
    ('yellow-bonney-life', 'PRB02-016', 4, 30),
    ('yellow-bonney-life', 'OP04-100', 3, 40),
    ('yellow-bonney-life', 'OP06-104', 4, 50),
    ('yellow-bonney-life', 'OP10-109', 4, 60),
    ('yellow-bonney-life', 'OP07-113', 4, 70),
    ('yellow-bonney-life', 'PRB02-017', 4, 80),
    ('yellow-bonney-life', 'OP09-107', 3, 90),
    ('yellow-bonney-life', 'EB03-059', 4, 100),
    ('yellow-bonney-life', 'OP13-110', 3, 110),
    ('yellow-bonney-life', 'OP13-108', 4, 120),
    ('yellow-bonney-life', 'OP06-115', 1, 130),
    ('yellow-bonney-life', 'OP07-116', 4, 140),

    ('blue-kuzan-control', 'OP06-050', 4, 10),
    ('blue-kuzan-control', 'OP05-052', 2, 20),
    ('blue-kuzan-control', 'OP12-047', 4, 30),
    ('blue-kuzan-control', 'OP12-051', 4, 40),
    ('blue-kuzan-control', 'OP06-047', 2, 50),
    ('blue-kuzan-control', 'OP12-053', 4, 60),
    ('blue-kuzan-control', 'OP06-051', 4, 70),
    ('blue-kuzan-control', 'OP12-046', 4, 80),
    ('blue-kuzan-control', 'EB02-025', 4, 90),
    ('blue-kuzan-control', 'OP12-043', 4, 100),
    ('blue-kuzan-control', 'OP12-044', 4, 110),
    ('blue-kuzan-control', 'OP12-056', 4, 120),
    ('blue-kuzan-control', 'OP12-057', 2, 130),
    ('blue-kuzan-control', 'OP04-056', 2, 140),
    ('blue-kuzan-control', 'OP06-058', 2, 150),

    ('red-black-koby', 'ST19-002', 2, 10),
    ('red-black-koby', 'OP11-082', 4, 20),
    ('red-black-koby', 'OP11-096', 4, 30),
    ('red-black-koby', 'EB03-041', 4, 40),
    ('red-black-koby', 'EB01-049', 1, 50),
    ('red-black-koby', 'OP11-092', 3, 60),
    ('red-black-koby', 'OP11-119', 3, 70),
    ('red-black-koby', 'OP05-015', 4, 80),
    ('red-black-koby', 'OP11-013', 1, 90),
    ('red-black-koby', 'OP13-007', 4, 100),
    ('red-black-koby', 'OP07-005', 2, 110),
    ('red-black-koby', 'PRB02-001', 4, 120),
    ('red-black-koby', 'OP11-010', 4, 130),
    ('red-black-koby', 'OP11-099', 4, 140),
    ('red-black-koby', 'OP01-029', 2, 150),
    ('red-black-koby', 'OP01-027', 4, 160),

    ('green-uta-film', 'ST16-002', 2, 10),
    ('green-uta-film', 'ST16-005', 4, 20),
    ('green-uta-film', 'OP02-036', 4, 30),
    ('green-uta-film', 'ST16-003', 4, 40),
    ('green-uta-film', 'OP02-040', 4, 50),
    ('green-uta-film', 'EB01-014', 4, 60),
    ('green-uta-film', 'OP13-027', 4, 70),
    ('green-uta-film', 'OP13-036', 1, 80),
    ('green-uta-film', 'OP13-029', 3, 90),
    ('green-uta-film', 'EB03-061', 4, 100),
    ('green-uta-film', 'ST16-004', 2, 110),
    ('green-uta-film', 'ST11-004', 4, 120),
    ('green-uta-film', 'OP12-037', 4, 130),
    ('green-uta-film', 'EB03-020', 4, 140),
    ('green-uta-film', 'ST11-005', 2, 150),

    ('blue-purple-reiju', 'OP06-063', 4, 10),
    ('blue-purple-reiju', 'OP06-072', 1, 20),
    ('blue-purple-reiju', 'OP10-063', 4, 30),
    ('blue-purple-reiju', 'OP06-068', 4, 40),
    ('blue-purple-reiju', 'OP07-066', 4, 50),
    ('blue-purple-reiju', 'OP06-060', 4, 60),
    ('blue-purple-reiju', 'OP06-069', 2, 70),
    ('blue-purple-reiju', 'OP06-076', 4, 80),
    ('blue-purple-reiju', 'OP06-061', 3, 90),
    ('blue-purple-reiju', 'OP11-047', 4, 100),
    ('blue-purple-reiju', 'OP11-043', 3, 110),
    ('blue-purple-reiju', 'OP06-078', 4, 120),
    ('blue-purple-reiju', 'OP06-079', 4, 130),
    ('blue-purple-reiju', 'OP05-077', 2, 140),
    ('blue-purple-reiju', 'OP06-077', 1, 150),
    ('blue-purple-reiju', 'OP04-056', 2, 160),

    ('yellow-pudding-life', 'OP03-112', 4, 10),
    ('yellow-pudding-life', 'OP11-106', 4, 20),
    ('yellow-pudding-life', 'OP04-100', 4, 30),
    ('yellow-pudding-life', 'OP03-123', 4, 40),
    ('yellow-pudding-life', 'OP03-114', 4, 50),
    ('yellow-pudding-life', 'OP11-070', 4, 60),
    ('yellow-pudding-life', 'OP08-062', 3, 70),
    ('yellow-pudding-life', 'ST18-001', 4, 80),
    ('yellow-pudding-life', 'EB01-061', 2, 90),
    ('yellow-pudding-life', 'OP08-063', 4, 100),
    ('yellow-pudding-life', 'PRB02-010', 4, 110),
    ('yellow-pudding-life', 'OP11-067', 4, 120),
    ('yellow-pudding-life', 'OP06-115', 4, 130),
    ('yellow-pudding-life', 'OP05-115', 1, 140),

    ('red-black-sabo', 'OP12-086', 4, 10),
    ('red-black-sabo', 'OP12-089', 3, 20),
    ('red-black-sabo', 'OP12-093', 2, 30),
    ('red-black-sabo', 'EB03-042', 3, 40),
    ('red-black-sabo', 'PRB02-014', 4, 50),
    ('red-black-sabo', 'OP13-090', 4, 60),
    ('red-black-sabo', 'OP13-120', 4, 70),
    ('red-black-sabo', 'OP12-094', 4, 80),
    ('red-black-sabo', 'OP07-085', 4, 90),
    ('red-black-sabo', 'OP05-015', 4, 100),
    ('red-black-sabo', 'OP13-016', 2, 110),
    ('red-black-sabo', 'OP07-015', 2, 120),
    ('red-black-sabo', 'OP12-098', 4, 130),
    ('red-black-sabo', 'OP09-097', 2, 140),
    ('red-black-sabo', 'OP05-021', 4, 150)
),
target_versions as (
  select
    archetype.slug,
    version.id
  from public.deck_template_versions version
  join public.deck_templates template
    on template.id = version.template_id
  join public.deck_archetypes archetype
    on archetype.id = template.archetype_id
  join public.deck_game_environments environment
    on environment.id = archetype.environment_id
  where environment.environment_key = 'KR_STANDARD_2026_07'
    and version.is_current = true
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
  version.id,
  'KR::' || seed.card_no,
  seed.card_no,
  null,
  seed.quantity,
  array[]::text[],
  seed.sort_order
from deck_cards seed
join target_versions version
  on version.slug = seed.slug;

do $$
declare
  invalid_decks text;
begin
  with target_slugs (slug) as (
    values
      ('green-zoro-midrange'),
      ('red-blue-vivi'),
      ('green-purple-lim'),
      ('green-black-perona'),
      ('red-rayleigh-midrange'),
      ('yellow-bonney-life'),
      ('blue-kuzan-control'),
      ('red-black-koby'),
      ('green-uta-film'),
      ('blue-purple-reiju'),
      ('yellow-pudding-life'),
      ('red-black-sabo')
  ),
  deck_totals as (
    select
      target.slug,
      coalesce(sum(card.quantity), 0) as total_cards
    from target_slugs target
    left join public.deck_archetypes archetype
      on archetype.slug = target.slug
    left join public.deck_game_environments environment
      on environment.id = archetype.environment_id
     and environment.environment_key = 'KR_STANDARD_2026_07'
    left join public.deck_templates template
      on template.archetype_id = archetype.id
     and template.template_type = 'TOURNAMENT'
     and template.is_published = true
    left join public.deck_template_versions version
      on version.template_id = template.id
     and version.is_current = true
     and version.is_published = true
    left join public.deck_template_cards card
      on card.version_id = version.id
    group by target.slug
  )
  select string_agg(slug || '=' || total_cards::text, ', ' order by slug)
  into invalid_decks
  from deck_totals
  where total_cards <> 50;

  if invalid_decks is not null then
    raise exception 'Tournament deck validation failed: %', invalid_decks;
  end if;

  if exists (
    select 1
    from public.deck_template_cards card
    join public.deck_template_versions version
      on version.id = card.version_id
     and version.is_current = true
    join public.deck_templates template
      on template.id = version.template_id
    join public.deck_archetypes archetype
      on archetype.id = template.archetype_id
    join public.deck_game_environments environment
      on environment.id = archetype.environment_id
     and environment.environment_key = 'KR_STANDARD_2026_07'
    join public.deck_legality_rules rule
      on rule.environment_id = environment.id
     and rule.card_no = card.card_no
     and rule.effective_from <= current_date
     and (rule.effective_to is null or rule.effective_to >= current_date)
    where archetype.slug in (
      'green-zoro-midrange',
      'red-blue-vivi',
      'green-purple-lim',
      'green-black-perona',
      'red-rayleigh-midrange',
      'yellow-bonney-life',
      'blue-kuzan-control',
      'red-black-koby',
      'green-uta-film',
      'blue-purple-reiju',
      'yellow-pudding-life',
      'red-black-sabo'
    )
      and (
        rule.restriction_type = 'BANNED'
        or card.quantity > rule.max_copies
      )
  ) then
    raise exception 'Tournament deck validation failed: active legality conflict';
  end if;
end
$$;

commit;
