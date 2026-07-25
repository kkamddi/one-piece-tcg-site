insert into public.deck_leaders (
  region,
  card_id,
  card_no,
  card_name,
  colors,
  image_url,
  is_active
)
values
  (
    'KR',
    'KR::OP09-001',
    'OP09-001',
    '샹크스',
    array['Red'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20251111_170932_dd62e045cc',
    true
  ),
  (
    'KR',
    'KR::OP07-019',
    'OP07-019',
    '쥬얼리 보니',
    array['Green'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20250717_174617_e997078ddc',
    true
  ),
  (
    'KR',
    'KR::OP09-042',
    'OP09-042',
    '버기',
    array['Blue'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20251111_173649_e62c295050',
    true
  ),
  (
    'KR',
    'KR::OP09-061',
    'OP09-061',
    '몽키 D. 루피',
    array['Purple', 'Black'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20251111_174916_9567dbe9fb',
    true
  ),
  (
    'KR',
    'KR::OP09-081',
    'OP09-081',
    '마샬 D. 티치',
    array['Black'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20251111_175955_4f7071f6c2',
    true
  ),
  (
    'KR',
    'KR::OP06-022',
    'OP06-022',
    '야마토',
    array['Green', 'Yellow'],
    'https://onepiece-cardgame.kr/fileDownload?downname=20250424_172904_2d0bb6430a',
    true
  )
on conflict (region, card_id) do update set
  card_no = excluded.card_no,
  card_name = excluded.card_name,
  colors = excluded.colors,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  updated_at = now();
