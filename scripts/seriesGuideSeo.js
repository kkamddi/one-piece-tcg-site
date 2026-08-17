import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seriesPath = path.join(rootDir, 'src', 'data', 'series.json');
const countsPath = path.join(rootDir, 'src', 'data', 'series-card-counts.json');
const seriesData = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
const seriesCardCounts = JSON.parse(fs.readFileSync(countsPath, 'utf8'));

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

function createSeo(series, cardCount, japanese = false) {
  const locale = series.locale || 'JP';
  const code = getSeriesCode(series);
  const name = (japanese ? series.enName : series.koName) || series.enName || series.koName || code;
  const kind = (japanese ? series.kindEn : series.kindKo) || series.kindEn || series.kindKo || (japanese ? 'カードシリーズ' : '카드 시리즈');
  const localeLabel = getLocaleLabel(locale, japanese);

  if (japanese) {
    return {
      title: `${code} ${name} カードリスト・シリーズガイド | Card Pone`,
      description: `${localeLabel}${code} ${name}の登録カード${cardCount}枚をカード番号、レアリティ、画像から確認できるシリーズガイドです。`,
      keywords: `${code},${name},ワンピースカードゲーム,カードリスト,${localeLabel}`,
      schemaType: 'CollectionPage',
      heading: `${code} ${name} シリーズガイド`,
      paragraphs: [
        `${localeLabel}の${kind}として登録されている${code} ${name}をまとめたページです。`,
        `Card Poneのカード図鑑にはこのシリーズのカードが${cardCount}枚登録されています。カード番号、レアリティ、画像を確認し、対応するカードは相場ページへ移動できます。`
      ],
      sections: [
        { heading: '確認できる情報', items: ['シリーズの基本情報と登録枚数', '収録カードの画像、カード番号、レアリティ', '対応カードのSingle・PSA10参考相場への導線'] },
        { heading: '情報の扱い', paragraphs: ['未確認の封入率や体感確率は確定情報として掲載せず、実際に登録されたカード図鑑データを優先します。'] }
      ],
      links: ['/jp/cards', '/jp/prices', '/jp/news']
    };
  }

  return {
    title: `${code} ${name} 카드 리스트·시리즈 가이드 | Card Pone`,
    description: `${localeLabel} ${code} ${name}의 도감 등록 카드 ${cardCount}장을 카드번호, 레어도, 이미지로 확인하는 원피스카드 시리즈 가이드입니다.`,
    keywords: `${code}, ${name}, 원피스카드 리스트, 원피스카드 도감, ${localeLabel} 원피스카드`,
    schemaType: 'CollectionPage',
    heading: `${code} ${name} 시리즈 가이드`,
    paragraphs: [
      `${localeLabel} ${kind}으로 등록된 ${code} ${name}의 상품 정보와 수록 카드를 한곳에서 확인하는 페이지입니다.`,
      `Card Pone 도감에는 이 시리즈의 카드 ${cardCount}장이 등록되어 있습니다. 카드번호, 레어도와 이미지를 확인하고 시세가 연결된 카드는 카드별 가격 화면으로 이동할 수 있습니다.`
    ],
    sections: [
      { heading: '이 페이지에서 확인할 수 있는 정보', items: ['시리즈의 언어, 상품 분류와 도감 등록 수', '수록 카드의 이미지, 카드번호와 레어도', '시세가 연결된 카드의 Single·PSA10 참고 가격'] },
      { heading: '정보 표시 기준', paragraphs: ['확인되지 않은 봉입률이나 체감 확률은 확정 정보처럼 표시하지 않으며, 실제 도감에 등록된 카드 데이터를 우선합니다.'] }
    ],
    links: ['/cards', '/prices', '/guide/card-catalog']
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
      return { pathname: japanese ? `/jp${basePath}` : basePath, seo: createSeo(series, cardCount, japanese) };
    })
    .filter(Boolean);
}

export const seriesGuideSourcePaths = [seriesPath, countsPath];
