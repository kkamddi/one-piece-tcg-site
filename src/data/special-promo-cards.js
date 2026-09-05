const createSpecialPromoCard = ({
  id,
  cardNo,
  name,
  rarity = 'P',
  category = 'CHARACTER',
  categoryKo = '캐릭터',
  event,
  variant,
  apparelId,
  sourceImageUrl,
  locale = 'JP',
  assetKey = apparelId,
  sourceUrl = apparelId ? `https://snkrdunk.com/en/trading-cards/${apparelId}?slide=right` : null,
  officialUrl = null
}) => ({
  id,
  locale,
  cardNo,
  baseCardNo: cardNo,
  marketCode: cardNo,
  name,
  nameEn: null,
  series: `${locale}-PROMO`,
  baseSeriesId: 'PROMO',
  seriesName: `${locale === 'KR' ? '프로모션 카드' : 'プロモーションカード'} · ${event}${variant ? ` · ${variant}` : ''}`,
  seriesNameEn: `Promotional Card · ${event}${variant ? ` · ${variant}` : ''}`,
  originSeries: `${locale}-PROMO`,
  originBaseSeriesId: 'PROMO',
  originSeriesName: locale === 'KR' ? '프로모션 카드' : 'プロモーションカード',
  originSeriesNameEn: 'Promotional Card',
  rarity,
  category,
  categoryKo,
  color: '',
  colorKo: '',
  cost: '',
  power: '',
  counter: '',
  attribute: '',
  attributeKo: '',
  type: locale === 'KR' ? '대회 기념 카드' : '大会記念カード',
  effect: '',
  imageUrl: `/special-promos/${assetKey}.webp`,
  thumbnailUrl: `/special-promos/${assetKey}.webp`,
  sourceImageUrl,
  sourceUrl,
  officialUrl,
  marketApparelId: apparelId || null,
  specialPromo: true,
  marketPrice: null
});

const referencedPromoCards = [
  { id: 'JP::EB01-003_vjump_2024_10', cardNo: 'EB01-003', name: 'キッド＆キラー', event: 'V JUMP 2024.10 応募', apparelId: 362050, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250107112126-1.webp?size=m' },
  { id: 'JP::OP07-047_vjump_2024_10', cardNo: 'OP07-047', name: 'トラファルガー・ロー', event: 'V JUMP 2024.10 応募', apparelId: 362049, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250107112126-0.webp?size=m' },
  { id: 'JP::OP07-109_vjump_2024_10', cardNo: 'OP07-109', name: 'モンキー・D・ルフィ', event: 'V JUMP 2024.10 応募', apparelId: 362048, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20241229073330-0.webp?size=m' },
  { id: 'JP::OP07-113_vjump_2025_10', cardNo: 'OP07-113', name: 'ロロノア・ゾロ', event: 'V JUMP 2025.10 応募', apparelId: 725658, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2025-11-10-02-of.webp?size=m' },
  { id: 'JP::OP09-034_vjump_2025_10', cardNo: 'OP09-034', name: 'ペローナ', event: 'V JUMP 2025.10 応募', apparelId: 725659, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2025-11-10-03-of.webp?size=m' },
  { id: 'JP::ST12-003_vjump_2025_10', cardNo: 'ST12-003', name: 'ジュラキュール・ミホーク', event: 'V JUMP 2025.10 応募', apparelId: 725657, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2025-11-10-01-of.webp?size=m' },
  { id: 'JP::P-150_vjump_2026_07', cardNo: 'P-150', name: 'クザン', event: 'V JUMP 2026.07 付録', apparelId: 826700, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/011dd6f8-66cf-4e57-8c53-6c4762a9d5ef.webp?size=m' },
  { id: 'JP::P-151_saikyo_2026_07', cardNo: 'P-151', name: 'スモーカー', event: '最強ジャンプ 2026.07 付録', apparelId: 835597, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-06-08-001-of.webp?size=m' },
  { id: 'JP::P-152_saikyo_2026_05', cardNo: 'P-152', name: 'エドワード・ニューゲート', event: '最強ジャンプ 2026.05 応募', apparelId: 860464, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/81430217-628b-4a1c-a8fc-33d2b2734f4e.webp?size=m' },
  { id: 'JP::P-153_saikyo_2026_05', cardNo: 'P-153', name: 'ポートガス・D・エース', event: '最強ジャンプ 2026.05 応募', apparelId: 860465, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/778c8226-920e-42bb-89e6-f9026f8ea03d.webp?size=m' },
  { id: 'JP::P-154_saikyo_2026_05', cardNo: 'P-154', name: 'モンキー・D・ルフィ', event: '最強ジャンプ 2026.05 応募', apparelId: 860466, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/45353938-3883-4d67-9493-01cf4504483b.webp?size=m' },
  { id: 'JP::P-159_jump_2026_33', cardNo: 'P-159', name: 'モンキー・D・ルフィ', event: '週刊少年ジャンプ 2026.33 付録', apparelId: 854923, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/0bb3034a-3114-4814-bcc9-722ba1e351a7.webp?size=m' },
  { id: 'JP::ST01-001_jump_2023_0607', cardNo: 'ST01-001', name: 'モンキー・D・ルフィ', category: 'LEADER', categoryKo: '리더', event: '週刊少年ジャンプ 2023.06-07 応募', apparelId: 171995, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/TCG-OPC-ST01-001.webp?size=m' },
  { id: 'JP::OP01-001_jump_2024_03', cardNo: 'OP01-001', name: 'ロロノア・ゾロ', category: 'LEADER', categoryKo: '리더', event: '週刊少年ジャンプ 2024.03 応募', apparelId: 171996, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20251111103048-0.webp?size=m' },
  { id: 'JP::OP07-019_jump_2024_35', cardNo: 'OP07-019', name: 'ジュエリー・ボニー', category: 'LEADER', categoryKo: '리더', event: '週刊少年ジャンプ 2024.35 応募', apparelId: 333636, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250204041217-0.webp?size=m' },
  { id: 'JP::OP06-022_jump_2024_3637', cardNo: 'OP06-022', name: 'ヤマト', category: 'LEADER', categoryKo: '리더', event: '週刊少年ジャンプ 2024.36-37 応募', apparelId: 333635, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250311100352-0.webp?size=m' },
  { id: 'JP::ST01-012_jump_2025_19', cardNo: 'ST01-012', name: 'モンキー・D・ルフィ', event: '週刊少年ジャンプ 2025.19 応募', apparelId: 568241, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250416033914-0.webp?size=m' },
  { id: 'JP::OP07-053_jump_2025_19', cardNo: 'OP07-053', name: 'ポートガス・D・エース', event: '週刊少年ジャンプ 2025.19 応募', apparelId: 568242, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250416033915-2.webp?size=m' },
  { id: 'JP::OP09-027_jump_2025_19', cardNo: 'OP09-027', name: 'サボ', event: '週刊少年ジャンプ 2025.19 応募', apparelId: 568243, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250416033914-1.webp?size=m' },
  { id: 'JP::OP13-007_jump_2026_0405', cardNo: 'OP13-007', name: 'エース＆サボ＆ルフィ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818462, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-001-of.webp?size=m' },
  { id: 'JP::P-122_jump_2026_0405', cardNo: 'P-122', name: 'エース＆サボ＆ルフィ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818463, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-002-of.webp?size=m' },
  { id: 'JP::P-123_jump_2026_0405', cardNo: 'P-123', name: 'エドワード・ニューゲート', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818464, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-003-of.webp?size=m' },
  { id: 'JP::P-124_jump_2026_0405', cardNo: 'P-124', name: 'カーリー・ダダン', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818465, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-004-of.webp?size=m' },
  { id: 'JP::P-125_jump_2026_0405', cardNo: 'P-125', name: 'コビー', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818466, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-005-of.webp?size=m' },
  { id: 'JP::P-126_jump_2026_0405', cardNo: 'P-126', name: 'サボ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818467, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-006-of.webp?size=m' },
  { id: 'JP::P-127_jump_2026_0405', cardNo: 'P-127', name: 'シャンクス', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818469, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-007-of.webp?size=m' },
  { id: 'JP::P-128_jump_2026_0405', cardNo: 'P-128', name: 'ポートガス・D・エース', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818470, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-008-of.webp?size=m' },
  { id: 'JP::P-129_jump_2026_0405', cardNo: 'P-129', name: 'マキノ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818472, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-009-of.webp?size=m' },
  { id: 'JP::P-130_jump_2026_0405', cardNo: 'P-130', name: 'モンキー・D・ガープ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818473, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-010-of.webp?size=m' },
  { id: 'JP::P-131_jump_2026_0405', cardNo: 'P-131', name: 'モンキー・D・ドラゴン', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818474, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-011-of.webp?size=m' },
  { id: 'JP::P-132_jump_2026_0405', cardNo: 'P-132', name: 'モンキー・D・ルフィ', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818475, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-012-of.webp?size=m' },
  { id: 'JP::P-133_jump_2026_0405', cardNo: 'P-133', name: 'ヤマト', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818477, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-013-of.webp?size=m' },
  { id: 'JP::P-134_jump_2026_0405', cardNo: 'P-134', name: '食い逃げ常習犯', category: 'EVENT', categoryKo: '이벤트', event: '週刊少年ジャンプ 2026.04-05 応募', apparelId: 818478, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-05-07-OP-014-of.webp?size=m' },
  { id: 'JP::ST01-009_jumpgiga_2023w', cardNo: 'ST01-009', name: 'ネフェルタリ・ビビ', event: 'JUMP GIGA 2023 Winter', apparelId: 106738, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230124030857-0.webp?size=m' },
  { id: 'JP::OP01-016_jumpgiga_2023s', cardNo: 'OP01-016', name: 'ナミ', event: 'JUMP GIGA 2023 Spring', apparelId: 129630, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230929090824-4.webp?size=m' },
  { id: 'JP::OP02-029_jumpgiga_2023s', cardNo: 'OP02-029', name: 'キャロット', event: 'JUMP GIGA 2023 Spring', apparelId: 129627, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230929090823-1.webp?size=m' },
  { id: 'JP::OP01-077_jumpgiga_2023s', cardNo: 'OP01-077', name: 'ペローナ', event: 'JUMP GIGA 2023 Spring', apparelId: 129632, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230929090824-2.webp?size=m' },
  { id: 'JP::ST07-008_jumpgiga_2023s', cardNo: 'ST07-008', name: 'シャーロット・プリン', event: 'JUMP GIGA 2023 Spring', apparelId: 129628, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20240717071132-0.webp?size=m' },
  { id: 'JP::ST04-011_jumpgiga_2023s', cardNo: 'ST04-011', name: 'ブラックマリア', event: 'JUMP GIGA 2023 Spring', apparelId: 129631, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230929090824-3.webp?size=m' },
  { id: 'JP::OP02-105_jumpgiga_2023s', cardNo: 'OP02-105', name: 'たしぎ', event: 'JUMP GIGA 2023 Spring', apparelId: 129629, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230929090825-5.webp?size=m' },
  { id: 'JP::EB02-003_choppers', cardNo: 'EB02-003', name: 'トニートニー・チョッパー', event: 'ONE PIECE CHOPPER’s Vol.1 付録', apparelId: 816214, sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-0501-EB02-003-ot.webp?size=m' }
].map((card) => createSpecialPromoCard({ rarity: 'P', ...card }));

const specialPromoCards = [
  ...referencedPromoCards,
  createSpecialPromoCard({
    id: 'JP::OP05-119_cs2023wf_1', cardNo: 'OP05-119', name: 'モンキー・D・ルフィ', rarity: 'SEC',
    event: 'Championship 2023 World Final', variant: 'Gold', apparelId: 220911,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OP05-119-1.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP05-119_cs2023wf_2', cardNo: 'OP05-119', name: 'モンキー・D・ルフィ', rarity: 'SEC',
    event: 'Championship 2023 World Final', variant: 'Silver', apparelId: 220912,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OP05-119-2.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP05-119_cs2023wf_3', cardNo: 'OP05-119', name: 'モンキー・D・ルフィ', rarity: 'SEC',
    event: 'Championship 2023 World Final', variant: 'Bronze', apparelId: 220913,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OP05-119-3.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OPCD-015_cs2023wf', cardNo: 'OPCD-015', name: 'ドン!!カード（モンキー・D・ルフィ）',
    category: 'DON', categoryKo: 'DON!!', event: 'Championship 2023 World Final', variant: '参加記念', apparelId: 214954,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20240515022122-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP03-114_cs2024_wave1', cardNo: 'OP03-114', name: 'シャーロット・リンリン', rarity: 'SR',
    event: 'Championship 2024 Wave 1', variant: '決勝大会 Best 32', apparelId: 277359,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20240814064506-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP07-119_cs2024_final', cardNo: 'OP07-119', name: 'ポートガス・D・エース', rarity: 'SEC',
    event: 'Championship 2024 日本一決定戦', variant: 'シリアルカード', apparelId: 216889,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20240612085943-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP07-109_cs2024wf_1', cardNo: 'OP07-109', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Championship 2024 World Final', variant: 'Gold', apparelId: 522331,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250212074418-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP07-109_cs2024wf_2', cardNo: 'OP07-109', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Championship 2024 World Final', variant: 'Silver', apparelId: 522332,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250212074418-1.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP07-109_cs2024wf_3', cardNo: 'OP07-109', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Championship 2024 World Final', variant: 'Bronze', apparelId: 522333,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250212074418-2.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OPCD-053_cs2024wf', cardNo: 'OPCD-053', name: 'ドン!!カード（モンキー・D・ルフィ）',
    category: 'DON', categoryKo: 'DON!!', event: 'Championship 2024 World Final', variant: '参加記念', apparelId: 522335,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250212075017-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP09-013_cs2025_wave1', cardNo: 'OP09-013', name: 'ヤソップ', rarity: 'R',
    event: 'Championship 2025-26 Wave 1', variant: '地域大会 Best 32', apparelId: 549021,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250318075817-1.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP09-009_cs2025_wave1', cardNo: 'OP09-009', name: 'ベン・ベックマン', rarity: 'SR',
    event: 'Championship 2025-26 Wave 1', variant: '地域大会 Best 8', apparelId: 549020,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250318075817-2.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::ST21-014_cs2526_final_1', cardNo: 'ST21-014', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Championship 2025-26 日本一決定戦', variant: '優勝', apparelId: 764409,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-02-16-001-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::ST21-014_cs2526_final_2', cardNo: 'ST21-014', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Championship 2025-26 日本一決定戦', variant: '準優勝', apparelId: 764410,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-02-16-002-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::TCG-ONEP-CS2526WF_1', cardNo: 'CS25-26WF', name: 'モンキー・D・ルフィ',
    event: 'Championship 2025-26 World Final', variant: 'Gold', apparelId: 766175,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-EN-TCG-OP-WC-2026-0220-001-.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::TCG-ONEP-CS2526WF_2', cardNo: 'CS25-26WF', name: 'モンキー・D・ルフィ',
    event: 'Championship 2025-26 World Final', variant: 'Silver', apparelId: 766176,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-EN-TCG-OP-WC-2026-0220-002-.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::TCG-ONEP-CS2526WF_3', cardNo: 'CS25-26WF', name: 'モンキー・D・ルフィ',
    event: 'Championship 2025-26 World Final', variant: 'Bronze', apparelId: 766177,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-EN-TCG-OP-WC-2026-0220-003-.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::CS25-26WF-DON', cardNo: 'CS25-26WF-DON', name: 'ドン!!カード（モンキー・D・ルフィ）',
    category: 'DON', categoryKo: 'DON!!', event: 'Championship 2025-26 World Final', variant: '参加記念', apparelId: 768194,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-02-24-033-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP14-112_cs2627_wave1', cardNo: 'OP14-112', name: 'ボア・ハンコック', rarity: 'SR',
    event: 'Championship 2026-27 Wave 1', variant: '地域大会 Best 16', apparelId: 766293,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-OP-TCG-2026-0220-BCGF-001-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP14-120_cs2627_wave1', cardNo: 'OP14-120', name: 'クロコダイル', rarity: 'SEC',
    event: 'Championship 2026-27 Wave 1', variant: '地域大会 Best 8', apparelId: 766294,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-OP-TCG-2026-0220-BCGF-002-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP14-119_cs2627_wave1', cardNo: 'OP14-119', name: 'ジュラキュール・ミホーク', rarity: 'SEC',
    event: 'Championship 2026-27 Wave 1', variant: '決勝大会 Best 32', apparelId: 880563,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-08-17-001-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP13-002_extra2627_wave1', cardNo: 'OP13-002', name: 'ポートガス・D・エース', rarity: 'L',
    event: 'Extra Championship 2026-27 Wave 1', variant: 'Best 64', apparelId: 864498,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-07-22-OP13-002-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP11-040_extra2627_wave1', cardNo: 'OP11-040', name: 'モンキー・D・ルフィ', rarity: 'L',
    event: 'Extra Championship 2026-27 Wave 1', variant: 'Best 32', apparelId: 864497,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-07-22-OP11-040-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'KR::OP03-116_cs2627_wave1', cardNo: 'OP03-116', name: '시라호시', rarity: 'UC', locale: 'KR',
    event: '한국 챔피언십 2026-27 Wave 1', variant: '본선 TOP 16', assetKey: 'kr-op03-116-p2',
    sourceImageUrl: 'https://onepiece-cardgame.kr/fileDownload?downname=20260806_193134_27e5d1f01bcd4616a1e1b8f19a64d088',
    sourceUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP03-116&series=all&search=true',
    officialUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP03-116&series=all&search=true'
  }),
  createSpecialPromoCard({
    id: 'KR::OP05-086_cs2627_wave1', cardNo: 'OP05-086', name: '네펠타리 비비', rarity: 'SR', locale: 'KR',
    event: '한국 챔피언십 2026-27 Wave 1', variant: '본선 TOP 8', assetKey: 'kr-op05-086-p1',
    sourceImageUrl: 'https://onepiece-cardgame.kr/fileDownload?downname=20260806_193145_c87528604768467a92e791cf9751f631',
    sourceUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP05-086&series=all&search=true',
    officialUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP05-086&series=all&search=true'
  }),
  createSpecialPromoCard({
    id: 'KR::OP05-091_cs2627_wave1', cardNo: 'OP05-091', name: '레베카', rarity: 'SR', locale: 'KR',
    event: '한국 챔피언십 2026-27 Wave 1', variant: '본선 TOP 4', assetKey: 'kr-op05-091-p3',
    sourceImageUrl: 'https://onepiece-cardgame.kr/fileDownload?downname=20260806_193201_a4dcab32c6574285a2e694bebed72fa4',
    sourceUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP05-091&series=all&search=true',
    officialUrl: 'https://onepiece-cardgame.kr/cardlist.do?freewords=OP05-091&series=all&search=true'
  }),
  createSpecialPromoCard({
    id: 'JP::OP01-120_flagship_2023_0709', cardNo: 'OP01-120', name: 'シャンクス', rarity: 'SEC',
    event: 'Flagship Battle 2023.07-09', variant: '優勝', apparelId: 117170,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20230317070435-2.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::ST21-014_flagship_2025_09', cardNo: 'ST21-014', name: 'モンキー・D・ルフィ', rarity: 'SR',
    event: 'Flagship Battle 2025.09', variant: '優勝', apparelId: 605546,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250729094402-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::ST21-015_flagship_2025_09', cardNo: 'ST21-015', name: 'ロロノア・ゾロ', rarity: 'SR',
    event: 'Flagship Battle 2025.09', variant: 'TOP 8', apparelId: 635880,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/20250701071049-0.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::EB04-061_flagship_2026_06', cardNo: 'EB04-061', name: 'モンキー・D・ルフィ', rarity: 'SEC',
    event: 'Flagship Battle 2026.06', variant: '優勝', apparelId: 764510,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-02-16-005-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP15-060_flagship_2026_06', cardNo: 'OP15-060', name: 'エネル', rarity: 'SR',
    event: 'Flagship Battle 2026.06', variant: 'TOP 8', apparelId: 764512,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-02-16-007-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP16-032_flagship_2026_0708', cardNo: 'OP16-032', name: 'ボア・ハンコック', rarity: 'SR',
    event: 'Flagship Battle 2026.07-08', variant: '優勝', apparelId: 835342,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-06-05-OP16-032-of.webp?size=m'
  }),
  createSpecialPromoCard({
    id: 'JP::OP15-113_flagship_2026_0708', cardNo: 'OP15-113', name: 'ロロノア・ゾロ', rarity: 'SR',
    event: 'Flagship Battle 2026.07-08', variant: 'TOP 8', apparelId: 835343,
    sourceImageUrl: 'https://cdn.snkrdunk.com/upload_bg_removed/OPC-TCG-2026-06-05-OP15-113-of.webp?size=m'
  })
];

export default specialPromoCards;
