import React, { useEffect, useMemo, useState } from 'react';
import { fetchCardsByIds } from './api/cards';
import {
  CHAMPIONSHIP_COLLECTION_GROUPS,
  FLAGSHIP_COLLECTION_GROUPS,
  MANGA_COLLECTION_GROUPS,
  PROMO_COLLECTION_GROUPS
} from './data/collection-guide';

const CARD_THUMBNAIL_BASE_URL = (import.meta.env.VITE_CARD_THUMBNAIL_BASE_URL || 'https://cards.optcgkorea.com').replace(/\/+$/, '');
const COLLECTION_SECTIONS = {
  manga: { label: '망가 카드', title: '원피스카드 망가 카드 가이드', locale: '일본판' },
  championship: { label: '챔피언십', title: '원피스카드 챔피언십 카드 가이드', locale: '일본판·한국판' },
  flagship: { label: '플래그십', title: '원피스카드 플래그십 카드 가이드', locale: '일본판' },
  promo: { label: '프로모', title: '원피스카드 프로모 카드 가이드', locale: '일본판' }
};

function getCardThumbnailSrc(card) {
  if (card?.thumbnailUrl) return card.thumbnailUrl;
  if (!card?.id || !card?.locale) return '/card-placeholder.svg';
  const key = String(card.id).replace(/^[A-Z]+::/, '');
  const revision = key.startsWith('OP17-') ? '?v=20260903' : '';
  return `${CARD_THUMBNAIL_BASE_URL}/cards/${card.locale}/${key}.webp${revision}`;
}

function CollectionCard({ entry, card, onOpenCard }) {
  const imageUrl = getCardThumbnailSrc(card);
  return (
    <button type="button" className="renew-collection-card" onClick={() => card && onOpenCard?.(card)} disabled={!card}>
      <span className="renew-collection-card-image">
        <img
          src={imageUrl}
          alt={entry.nameKo}
          loading="lazy"
          onError={(event) => {
            if (card?.imageUrl && event.currentTarget.dataset.fallback !== 'official') {
              event.currentTarget.dataset.fallback = 'official';
              event.currentTarget.src = card.imageUrl;
              return;
            }
            event.currentTarget.src = '/card-placeholder.svg';
          }}
        />
      </span>
      <small>{card?.cardNo || entry.cardId.split('::').at(-1).split('_')[0]}</small>
      <strong>{entry.nameKo}</strong>
      {entry.variant ? <em>{entry.variant}</em> : null}
    </button>
  );
}

function groupByYear(groups) {
  return groups.reduce((years, group) => {
    const year = group.year || '기타';
    const current = years.find((entry) => entry.year === year);
    if (current) current.groups.push(group);
    else years.push({ year, groups: [group] });
    return years;
  }, []);
}

function groupFlagshipByYear(groups) {
  return groups.reduce((years, group) => {
    const year = [...group.label.matchAll(/\b20\d{2}\b/g)].at(-1)?.[0] || '기타';
    let current = years.find((entry) => entry.year === year);
    if (!current) {
      current = { year, cards: [] };
      years.push(current);
    }
    current.cards.push(...group.cards.map((card) => ({
      ...card,
      variant: [group.label, card.variant].filter(Boolean).join(' · ')
    })));
    return years;
  }, []);
}

export default function CollectionGuide({ onOpenCard }) {
  const pathSection = typeof window !== 'undefined' ? window.location.pathname.match(/^\/guide\/collection\/([^/]+)\/?$/)?.[1] : '';
  const hashSection = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  const activeSection = COLLECTION_SECTIONS[pathSection] ? pathSection : COLLECTION_SECTIONS[hashSection] ? hashSection : 'manga';
  const isCollectionOverview = !pathSection && !COLLECTION_SECTIONS[hashSection];
  const sectionMeta = isCollectionOverview
    ? { ...COLLECTION_SECTIONS.manga, title: '원피스카드 수집 가이드: 무엇을 모아야 할까?' }
    : COLLECTION_SECTIONS[activeSection];
  const [cardsById, setCardsById] = useState(new Map());
  const [championshipLocale, setChampionshipLocale] = useState('JP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cardIds = useMemo(() => {
    const groups = activeSection === 'manga'
      ? MANGA_COLLECTION_GROUPS
      : activeSection === 'championship'
        ? Object.values(CHAMPIONSHIP_COLLECTION_GROUPS).flat()
        : activeSection === 'flagship'
          ? FLAGSHIP_COLLECTION_GROUPS.JP
          : PROMO_COLLECTION_GROUPS;
    return groups.flatMap((group) => group.cards.map((card) => card.cardId));
  }, [activeSection]);

  useEffect(() => {
    if (!COLLECTION_SECTIONS[hashSection] || pathSection) return;
    window.history.replaceState(window.history.state, '', `/guide/collection/${hashSection}`);
  }, [hashSection, pathSection]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchCardsByIds(cardIds)
      .then((cards) => {
        if (cancelled) return;
        setCardsById(new Map((Array.isArray(cards) ? cards : []).map((card) => [card.id, card])));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cardIds]);

  return (
    <main className="renew-collection-guide">
      <header className="renew-collection-guide-head">
        <span>COLLECTION GUIDE</span>
        <h1>{sectionMeta.title}</h1>
        <dl>
          <div><dt>현재 범위</dt><dd>{sectionMeta.locale}</dd></div>
          <div><dt>가이드 수록</dt><dd>{cardIds.length}건</dd></div>
          <div><dt>기준</dt><dd>2026.08</dd></div>
        </dl>
      </header>

      <nav className="renew-collection-guide-nav" aria-label="수집 가이드 분류">
        {Object.entries(COLLECTION_SECTIONS).map(([section, meta]) => (
          <a key={section} className={activeSection === section ? 'is-active' : ''} href={`/guide/collection/${section}`}>{meta.label}</a>
        ))}
      </nav>

      {loading ? <p className="renew-collection-guide-status">도감 카드를 불러오는 중입니다.</p> : null}
      {error ? <p className="renew-collection-guide-status is-error">도감 카드를 불러오지 못했습니다.</p> : null}

      {activeSection === 'manga' ? <section id="manga" className="renew-collection-guide-section">
        <div className="renew-collection-guide-title">
          <div>
            <span>MANGA RARE</span>
            <h2>시리즈별 망가 카드</h2>
          </div>
          <p>카드를 누르면 도감 상세로 이동합니다.</p>
        </div>
        {!loading && !error ? (
          <div className="renew-collection-series-list">
            {MANGA_COLLECTION_GROUPS.map((group) => (
              <section
                key={group.set}
                className={`renew-collection-series${group.cards.length > 1 ? ' has-multiple' : ''}`}
                style={{ '--collection-card-count': Math.min(group.cards.length, 6) }}
              >
                <h3>{group.set}</h3>
                <div className="renew-collection-card-grid">
                  {group.cards.map((entry) => (
                    <CollectionCard key={entry.cardId} entry={entry} card={cardsById.get(entry.cardId)} onOpenCard={onOpenCard} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section> : null}

      {activeSection === 'championship' ? <section id="championship" className="renew-collection-guide-section renew-championship-guide-section">
        <div className="renew-collection-guide-title">
          <div>
            <span>CHAMPIONSHIP</span>
            <h2>챔피언십 카드</h2>
          </div>
          <div className="renew-collection-locale-tabs" role="group" aria-label="챔피언십 카드 언어">
            <button type="button" className={championshipLocale === 'JP' ? 'is-active' : ''} onClick={() => setChampionshipLocale('JP')}>일본판</button>
            <button type="button" className={championshipLocale === 'KR' ? 'is-active' : ''} onClick={() => setChampionshipLocale('KR')}>한국판</button>
          </div>
        </div>
        <div className="renew-championship-year-list">
          {groupByYear(CHAMPIONSHIP_COLLECTION_GROUPS[championshipLocale]).map((yearGroup) => (
            <section className="renew-championship-year" key={`${championshipLocale}-${yearGroup.year}`}>
              <h3>챔피언십 {yearGroup.year}</h3>
              <div className="renew-championship-event-list">
                {yearGroup.groups.map((group) => (
                  <section
                    className="renew-championship-event"
                    key={`${championshipLocale}-${group.label}`}
                    style={{ '--collection-card-count': Math.min(group.cards.length, 4) }}
                  >
                    <h4>{group.label}</h4>
                    <div className="renew-championship-card-grid">
                      {group.cards.map((entry) => (
                        <CollectionCard key={entry.cardId} entry={entry} card={cardsById.get(entry.cardId)} onOpenCard={onOpenCard} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section> : null}

      {activeSection === 'flagship' ? <section id="flagship" className="renew-collection-guide-section renew-championship-guide-section">
        <div className="renew-collection-guide-title">
          <div>
            <span>FLAGSHIP BATTLE</span>
            <h2>플래그십 배틀 카드</h2>
          </div>
        </div>
        <div className="renew-championship-year-list">
          {groupFlagshipByYear(FLAGSHIP_COLLECTION_GROUPS.JP).map((yearGroup) => (
            <section className="renew-championship-year" key={`JP-${yearGroup.year}`}>
              <h3>{yearGroup.year}</h3>
              <div className="renew-championship-card-grid renew-horizontal-card-row">
                {yearGroup.cards.map((entry) => (
                  <CollectionCard key={`${entry.cardId}-${entry.variant}`} entry={entry} card={cardsById.get(entry.cardId)} onOpenCard={onOpenCard} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section> : null}

      {activeSection === 'promo' ? <section id="promo" className="renew-collection-guide-section renew-championship-guide-section">
        <div className="renew-collection-guide-title">
          <div>
            <span>PROMOTIONAL CARDS</span>
            <h2>프로모 카드</h2>
          </div>
        </div>
        <div className="renew-championship-event-list renew-promo-event-list">
          {PROMO_COLLECTION_GROUPS.map((group) => (
            <section className="renew-championship-event" key={group.label}>
              <h3>{group.label}</h3>
              <div className="renew-championship-card-grid renew-promo-card-grid">
                {group.cards.map((entry) => (
                  <CollectionCard key={entry.cardId} entry={entry} card={cardsById.get(entry.cardId)} onOpenCard={onOpenCard} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section> : null}
    </main>
  );
}
