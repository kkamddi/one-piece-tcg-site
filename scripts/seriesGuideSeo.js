import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seriesPath = path.join(rootDir, 'src', 'data', 'series.json');
const countsPath = path.join(rootDir, 'src', 'data', 'series-card-counts.json');
const cardsPath = path.join(rootDir, 'src', 'data', 'cards.json');
const seriesData = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
const seriesCardCounts = JSON.parse(fs.readFileSync(countsPath, 'utf8'));
const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const contentReviewedAt = '2026-08-25';

const rarityOrder = ['L', 'SEC', 'SR', 'SP', 'R', 'UC', 'C', 'P', 'DON!!'];

function getBaseCardNo(cardNo) {
  return String(cardNo || '').replace(/_p\d+$/i, '');
}

function getSeriesCardSummary(series) {
  const uniqueCards = new Map();
  const seriesCards = cardsData.filter((card) => card.series === series.id);
  for (const card of seriesCards) {
    const cardNo = getBaseCardNo(card.cardNo);
    if (!cardNo || uniqueCards.has(cardNo)) continue;
    uniqueCards.set(cardNo, { ...card, cardNo });
  }

  const cards = [...uniqueCards.values()];
  const rarityCounts = new Map();
  for (const card of cards) {
    const rarity = String(card.rarity || '').trim() || '기타';
    rarityCounts.set(rarity, (rarityCounts.get(rarity) || 0) + 1);
  }

  const rarityEntries = [...rarityCounts.entries()].sort(([left], [right]) => {
    const leftIndex = rarityOrder.indexOf(left);
    const rightIndex = rarityOrder.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  const priority = new Map(rarityOrder.map((rarity, index) => [rarity, index]));
  const examples = [...cards]
    .sort((left, right) => {
      const rarityDifference = (priority.get(left.rarity) ?? 99) - (priority.get(right.rarity) ?? 99);
      return rarityDifference || left.cardNo.localeCompare(right.cardNo);
    })
    .slice(0, 10);

  return {
    rarityEntries,
    examples,
    uniqueCardCount: cards.length,
    variantCount: Math.max(0, seriesCards.length - cards.length),
    leaderCount: rarityCounts.get('L') || 0,
    secretCount: rarityCounts.get('SEC') || 0,
    superRareCount: rarityCounts.get('SR') || 0,
    specialCount: rarityCounts.get('SP') || 0
  };
}

function normalizeSeriesSlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getSeriesCode(series) {
  return String(series.baseSeriesId || series.id || '').replace(/^(KR|JP|EN)-/, '');
}

function getLocaleLabel(locale, japanese = false) {
  if (japanese) return locale === 'JP' ? '日本版' : locale === 'EN' ? '英語版' : '韓国版';
  return locale === 'JP' ? '일본판' : locale === 'EN' ? '영문판' : '한글판';
}

function createSeo(series, cardCount, cardSummary, japanese = false) {
  const locale = series.locale || 'JP';
  const code = getSeriesCode(series);
  const name = (japanese ? series.enName : series.koName) || series.enName || series.koName || code;
  const kind = (japanese ? series.kindEn : series.kindKo) || series.kindEn || series.kindKo || (japanese ? 'カードシリーズ' : '카드 시리즈');
  const localeLabel = getLocaleLabel(locale, japanese);
  const raritySummary = cardSummary.rarityEntries
    .map(([rarity, count]) => `${rarity} ${count}${japanese ? '枚' : '장'}`)
    .join(japanese ? '・' : ' · ');
  const cardExamples = cardSummary.examples.map((card) => `${card.cardNo} ${card.name} (${card.rarity || '-'})`);
  const catalogSlug = normalizeSeriesSlug(series.id || series.baseSeriesId);
  const countSummary = japanese
    ? `基本カード番号${cardSummary.uniqueCardCount}種、追加イラスト・パラレル${cardSummary.variantCount}種`
    : `기본 카드번호 ${cardSummary.uniqueCardCount}종, 추가 일러스트·패러렐 ${cardSummary.variantCount}종`;
  const highRaritySummary = japanese
    ? `リーダー${cardSummary.leaderCount}種、SEC ${cardSummary.secretCount}種、SR ${cardSummary.superRareCount}種${cardSummary.specialCount ? `、SP ${cardSummary.specialCount}種` : ''}`
    : `리더 ${cardSummary.leaderCount}종, SEC ${cardSummary.secretCount}종, SR ${cardSummary.superRareCount}종${cardSummary.specialCount ? `, SP ${cardSummary.specialCount}종` : ''}`;

  if (japanese) {
    return {
      title: `${code} ${name} カードリスト・シリーズガイド | Card Pone`,
      description: `${localeLabel}${code} ${name}の登録カード${cardCount}枚をカード番号、レアリティ、画像から確認できるシリーズガイドです。`,
      keywords: `${code},${name},ワンピースカードゲーム,カードリスト,${localeLabel}`,
      schemaType: 'CollectionPage',
      editor: 'Card Pone データ編集',
      reviewedAt: contentReviewedAt,
      heading: `${code} ${name} シリーズガイド`,
      paragraphs: [
        `${localeLabel}の${kind}として登録されている${code} ${name}をまとめたページです。`,
        `Card Poneのカード図鑑にはこのシリーズのカードが${cardCount}枚登録されています。${countSummary}を区別し、対応するカードは相場ページへ移動できます。`
      ],
      sections: [
        {
          heading: 'レアリティ構成',
          paragraphs: [`基本カード番号基準では${raritySummary || '登録情報を確認中です'}。${highRaritySummary}を含み、同じカード番号のパラレル画像は別に数えています。`]
        },
        {
          heading: '収録カード例',
          items: cardExamples
        },
        {
          heading: '確認できる情報',
          items: ['シリーズの基本情報と登録枚数', '収録カードの画像、カード番号、レアリティ', '対応カードのSingle・PSA10参考相場への導線']
        },
        {
          heading: '見る順番',
          items: ['まずリーダーとSEC・SRの構成を確認', '同じカード番号の追加イラストを別バージョンとして確認', '必要なカードを図鑑から相場ページへ移動して確認']
        },
        {
          heading: '情報の扱い',
          paragraphs: ['未確認の封入率や体感確率は確定情報として掲載せず、実際に登録されたカード図鑑データを優先します。']
        }
      ],
      links: [`/jp/cards/${catalogSlug}`, '/jp/prices', '/jp/news']
    };
  }

  return {
    title: `${code} ${name} 카드 리스트·시리즈 가이드 | Card Pone`,
    description: `${localeLabel} ${code} ${name}의 도감 등록 카드 ${cardCount}장을 카드번호, 레어도, 이미지로 확인하는 원피스카드 시리즈 가이드입니다.`,
    keywords: `${code}, ${name}, 원피스카드 리스트, 원피스카드 도감, ${localeLabel} 원피스카드`,
    schemaType: 'CollectionPage',
    editor: 'Card Pone 데이터 편집',
    reviewedAt: contentReviewedAt,
    heading: `${code} ${name} 시리즈 가이드`,
    paragraphs: [
      `${localeLabel} ${kind}으로 등록된 ${code} ${name}의 상품 정보와 수록 카드를 한곳에서 확인하는 페이지입니다.`,
      `Card Pone 도감에는 이 시리즈의 카드 ${cardCount}장이 등록되어 있습니다. ${countSummary}을 구분해 집계하며, 시세가 연결된 카드는 카드별 가격 화면으로 이동할 수 있습니다.`
    ],
    sections: [
      {
        heading: '레어도 구성',
        paragraphs: [`기본 카드번호 기준 ${raritySummary || '등록 정보 확인 중'}입니다. ${highRaritySummary}을 포함하며, 같은 카드번호의 추가 일러스트는 별도 버전으로 집계했습니다.`]
      },
      {
        heading: '수록 카드 예시',
        items: cardExamples
      },
      {
        heading: '이 페이지에서 확인할 수 있는 정보',
        items: ['시리즈의 언어, 상품 분류와 도감 등록 수', '수록 카드의 이미지, 카드번호와 레어도', '시세가 연결된 카드의 Single·PSA10 참고 가격']
      },
      {
        heading: '확인 순서',
        items: ['먼저 리더와 SEC·SR 구성을 확인', '같은 카드번호의 추가 일러스트를 별도 버전으로 비교', '필요한 카드를 도감에서 열어 연결된 시세 확인']
      },
      {
        heading: '정보 표시 기준',
        paragraphs: ['확인되지 않은 봉입률이나 체감 확률은 확정 정보처럼 표시하지 않으며, 실제 도감에 등록된 카드 데이터를 우선합니다.']
      }
    ],
    links: [`/cards/${catalogSlug}`, '/prices', '/guide/card-catalog']
  };
}

export function getSeriesGuideEntries({ japanese = false } = {}) {
  return seriesData
    .map((series) => {
      const locale = series.locale || 'JP';
      const cardCount = Number(seriesCardCounts?.[locale]?.series?.[series.id] || 0);
      const slug = normalizeSeriesSlug(series.id || series.baseSeriesId);
      if (!slug || cardCount < 1) return null;
      const basePath = `/guides/series/${slug}`;
      const cardSummary = getSeriesCardSummary(series);
      return {
        pathname: japanese ? `/jp${basePath}` : basePath,
        seo: createSeo(series, cardCount, cardSummary, japanese),
        catalogSlugs: [...new Set([
          normalizeSeriesSlug(series.id),
          normalizeSeriesSlug(series.baseSeriesId)
        ].filter(Boolean))]
      };
    })
    .filter(Boolean);
}

export const seriesGuideSourcePaths = [seriesPath, countsPath, cardsPath];
