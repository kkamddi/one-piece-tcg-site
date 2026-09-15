import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import englishSnapshot from './data/riftbound-preview.json';
import chineseSnapshot from './data/riftbound-preview-cn.json';
import koreanSnapshot from './data/riftbound-preview-kr.json';
import { RIFTBOUND_SET_PRODUCTS, getRiftboundSetName } from './data/riftbound-set-products';
import { collectionSummary, filterRiftboundCards, getRiftboundCategories, RIFTBOUND_STORAGE_KEY, RIFTBOUND_EDITIONS, normalizeRiftboundLocale, sanitizeCollection } from './riftbound-catalog';
import './riftbound-catalog.css';

const variants = { base: '기본', alternate: '얼터너트 아트', overnumber: '오버넘버', signature: '시그니처', special: '특별 인쇄', promo: '프로모' };
const snapshots = {
  EN: englishSnapshot,
  CN: chineseSnapshot,
  KR: koreanSnapshot
};
const cardIds = new Set(Object.values(snapshots).flatMap((snapshot) => snapshot.cards.map((card) => card.id)));
const getRarities = (snapshot) => [...new Map(snapshot.cards.map((card) => [card.rarity, card.rarityLabel])).entries()];
const PAGE_SIZE = 8;
// Keep public browsing independent of the unfinished account collection storage.
const COLLECTION_ENABLED = false;

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  const locale = normalizeRiftboundLocale(params.get('locale'));
  const snapshot = snapshots[locale];
  return {
    locale,
    query: params.get('q') || '',
    set: snapshot.sets.some((set) => set.id === params.get('set')) ? params.get('set') : '',
    rarity: getRarities(snapshot).some(([id]) => id === params.get('rarity')) ? params.get('rarity') : '',
    view: COLLECTION_ENABLED && ['owned', 'wishlist'].includes(params.get('view')) ? params.get('view') : 'all'
  };
}

function CardImage({ card, eager = false }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="rb-image-error">이미지 연결 실패<br />{card.code}</span>
    : <img src={card.image} alt={card.name} style={card.imagePresentation === 'centered-card' ? { objectFit: 'cover', aspectRatio: '5 / 7' } : undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}

function SetImage({ set, locale }) {
  const [failed, setFailed] = useState(false);
  const product = RIFTBOUND_SET_PRODUCTS[locale]?.[set.id];
  return <span className="renew-series-thumb">
    {product && !failed ? <img src={product.image} alt={`${getRiftboundSetName(set, locale)} ${locale} 박스`} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      : <span className="renew-series-thumb-label">{set.id}</span>}
  </span>;
}

function CardDetail({ card, snapshot, entry, onChange }) {
  return <section className="renew-card-modal is-page" aria-labelledby="rb-detail-title">
      <div className="renew-card-modal-image is-loaded"><CardImage card={card} eager /></div>
      <div className="renew-card-modal-info">
        <div className="renew-modal-code">{card.code} · {card.rarityLabel} · {card.printedMark || snapshot.locale}{card.preview ? ' · 선공개' : ''}</div>
        <h2 id="rb-detail-title" tabIndex={-1}>{card.name}</h2>
        <p>{snapshot.sets.find((set) => set.id === card.set)?.name} · {card.variantLabel || variants[card.variant]}</p>
        <div className="renew-modal-actions no-alert">
          {COLLECTION_ENABLED && <><button type="button" className="renew-modal-primary-action" aria-pressed={entry.quantity > 0} onClick={() => onChange({ quantity: entry.quantity ? 0 : 1 })}>{entry.quantity ? `보유 ${entry.quantity}장` : '보유 추가'}</button>
          <button type="button" className="renew-modal-portfolio-action" aria-pressed={entry.wished} onClick={() => onChange({ wished: !entry.wished })}>{entry.wished ? '위시리스트 저장됨' : '위시리스트 추가'}</button></>}
          <details className="renew-modal-more-actions">
            <summary aria-label="더보기" title="더보기"><span aria-hidden="true">⋮</span></summary>
            <div className="renew-modal-more-menu"><a href={card.source || snapshot.source} target="_blank" rel="noreferrer">공식 정보</a></div>
          </details>
        </div>
        {COLLECTION_ENABLED && <div className="rb-detail-controls">
          <label htmlFor="rb-owned-quantity">보유 수량</label>
          <div className="rb-stepper">
            <button type="button" aria-label="보유 수량 줄이기" disabled={!entry.quantity} onClick={() => onChange({ quantity: entry.quantity - 1 })}>−</button>
            <input id="rb-owned-quantity" type="number" min="0" max="999" step="1" value={entry.quantity} onChange={(event) => onChange({ quantity: Math.min(999, Math.max(0, Math.trunc(Number(event.target.value) || 0))) })} />
            <button type="button" aria-label="보유 수량 늘리기" disabled={entry.quantity >= 999} onClick={() => onChange({ quantity: entry.quantity + 1 })}>+</button>
          </div>
        </div>}
        <details>
        <summary>카드 정보</summary>
        <dl className="rb-facts">
          <div><dt>유형</dt><dd>{card.types.join(' / ')}</dd></div>
          <div><dt>{snapshot.locale === 'CN' ? '색상' : '도메인'}</dt><dd>{card.domains.join(' / ') || '-'}</dd></div>
          <div><dt>에너지 / 공격력</dt><dd>{card.energy ?? '-'} / {card.might ?? '-'}</dd></div>
          <div><dt>일러스트</dt><dd>{card.artists.join(', ') || '-'}</dd></div>
        </dl>
        <p className="rb-card-text" lang={RIFTBOUND_EDITIONS.find((edition) => edition.id === snapshot.locale)?.lang}>{card.description}</p>
        {card.errata && <p className="rb-card-text" lang="zh-Hans"><strong>공식 정정</strong><br />{card.errata}</p>}
        </details>
      </div>
  </section>;
}

function RiftboundCatalog({ onBackHandlerChange }) {
  const [filters, setFilters] = useState(readFilters);
  const snapshot = snapshots[filters.locale];
  const categories = useMemo(() => getRiftboundCategories(snapshot.sets), [snapshot]);
  const [openCategory, setOpenCategory] = useState(() => categories.find((category) => category.sets.some((set) => set.id === filters.set))?.id || '');
  const activeCategory = categories.find((category) => category.id === openCategory);
  const rarities = useMemo(() => getRarities(snapshot), [snapshot]);
  const [collection, setCollection] = useState(() => {
    if (!COLLECTION_ENABLED) return {};
    try { return sanitizeCollection(JSON.parse(window.localStorage.getItem(RIFTBOUND_STORAGE_KEY)), cardIds); }
    catch { return {}; }
  });
  const [storageError, setStorageError] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('card') || '');
  const [rarityPanelOpen, setRarityPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState('rarity');
  const lastTrigger = useRef(null);
  const visibleCards = useMemo(() => filterRiftboundCards(snapshot.cards, filters, collection), [snapshot, filters, collection]);
  const setCards = useMemo(() => snapshot.cards.filter((card) => !filters.set || card.set === filters.set), [snapshot, filters.set]);
  const summary = useMemo(() => collectionSummary(setCards, collection), [setCards, collection]);
  const selected = snapshot.cards.find((card) => card.id === selectedId);
  const setName = snapshot.sets.find((set) => set.id === filters.set)?.name || '전체 카드';
  const groups = useMemo(() => sortMode === 'number'
    ? [{ id: 'number', label: '카드번호순', cards: visibleCards }]
    : ['promo', 'showcase', 'epic', 'rare', 'uncommon', 'common'].map((id) => ({
      id, label: rarities.find(([key]) => key === id)?.[1] || id,
      cards: visibleCards.filter((card) => card.rarity === id)
    })).filter((group) => group.cards.length), [visibleCards, sortMode, rarities]);

  useEffect(() => {
    const restore = () => {
      const cardId = new URLSearchParams(window.location.search).get('card') || '';
      const restored = readFilters();
      setFilters(restored);
      setOpenCategory(getRiftboundCategories(snapshots[restored.locale].sets).find((category) => category.sets.some((set) => set.id === restored.set))?.id || '');
      setSelectedId(cardId);
      if (!cardId) requestAnimationFrame(() => {
        window.scrollTo(0, window.history.state?.cardPoneScrollY || 0);
        document.getElementById(`rb-card-${lastTrigger.current}`)?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const closeDetail = useCallback(() => {
    if (window.history.state?.riftboundDetail) {
      window.history.back();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.delete('card');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`);
    setSelectedId('');
  }, []);

  useEffect(() => {
    onBackHandlerChange?.(selectedId ? closeDetail : null);
    return () => onBackHandlerChange?.(null);
  }, [selectedId, closeDetail, onBackHandlerChange]);

  useEffect(() => {
    if (!selectedId) return;
    window.scrollTo(0, 0);
    document.getElementById('rb-detail-title')?.focus({ preventScroll: true });
  }, [selectedId]);

  function updateFilters(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(PAGE_SIZE);
    const params = new URLSearchParams({ game: 'riftbound' });
    for (const [key, value] of Object.entries(next)) if (value && value !== 'all') params.set(key === 'query' ? 'q' : key, value);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`);
  }

  function changeEntry(id, patch) {
    if (!COLLECTION_ENABLED) return;
    const next = sanitizeCollection({ ...collection, [id]: { quantity: 0, wished: false, ...collection[id], ...patch } }, cardIds);
    try {
      window.localStorage.setItem(RIFTBOUND_STORAGE_KEY, JSON.stringify(next));
      setCollection(next);
      setStorageError('');
    } catch { setStorageError('이 기기에 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.'); }
  }

  function changeLocale(locale) {
    if (locale === filters.locale) return;
    setSelectedId(null);
    setRarityPanelOpen(false);
    setOpenCategory('');
    updateFilters({ locale, query: '', set: '', rarity: '', view: 'all' });
  }

  function openDetail(card) {
    lastTrigger.current = card.id;
    window.history.replaceState({ ...window.history.state, cardPoneScrollY: window.scrollY }, '');
    const params = new URLSearchParams(window.location.search);
    params.set('game', 'riftbound');
    params.set('locale', filters.locale);
    params.set('card', card.id);
    window.history.pushState({ cardPoneInternal: true, riftboundDetail: true }, '', `${window.location.pathname}?${params}`);
    setSelectedId(card.id);
  }

  function selectSet(id) {
    updateFilters({ set: id });
    if (!id) setOpenCategory('');
  }

  function renderSets(category, mobile = false) {
    return <div id={`rb-${mobile ? 'mobile' : 'desktop'}-${category.id}`} className={mobile ? 'renew-mobile-series-list' : 'renew-series-list'}>
      {category.sets.map((set) => <a key={set.id} className={`renew-series-item ${RIFTBOUND_SET_PRODUCTS[filters.locale]?.[set.id] ? '' : 'rb-series-text-only'} ${filters.set === set.id ? 'is-active' : ''}`} aria-current={filters.set === set.id ? 'true' : undefined} href={`?game=riftbound&locale=${filters.locale}&set=${set.id}`} onClick={(event) => { event.preventDefault(); selectSet(set.id); }}>
        {RIFTBOUND_SET_PRODUCTS[filters.locale]?.[set.id] && <SetImage key={`${filters.locale}:${set.id}`} set={set} locale={filters.locale} />}
        {set.id !== getRiftboundSetName(set, filters.locale) && <b>{set.id}</b>}<span>{getRiftboundSetName(set, filters.locale)}</span>
      </a>)}
    </div>;
  }

  if (selectedId) return <main className="renew-card-detail-page rb-catalog">
    {selected ? <CardDetail key={selected.id} card={selected} snapshot={snapshot} entry={collection[selected.id] || { quantity: 0, wished: false }} onChange={(patch) => changeEntry(selected.id, patch)} />
      : <section className="renew-card-detail-state"><strong>카드를 찾을 수 없습니다.</strong><button type="button" onClick={closeDetail}>목록으로 돌아가기</button></section>}
    {storageError && <p role="alert" className="rb-storage-error">{storageError}</p>}
  </main>;

  return <main className="renew-catalog rb-catalog">
      <aside className="renew-catalog-side" aria-label="리프트바운드 카테고리">
        <div className="renew-catalog-headline"><span>카테고리</span><div className="renew-catalog-locale" role="group" aria-label="카드 판본">{RIFTBOUND_EDITIONS.map((edition) => <button type="button" key={edition.id} className={filters.locale === edition.id ? 'is-active' : ''} aria-pressed={filters.locale === edition.id} onClick={() => changeLocale(edition.id)}>{edition.label}</button>)}</div></div>
        {snapshot.cards.length > 0 && <>
        <div className="renew-mobile-category-panel">
          <div className="renew-mobile-category-chips" role="group" aria-label="카테고리">
            <button type="button" className={!filters.set && !openCategory ? 'is-active' : ''} aria-pressed={!filters.set && !openCategory} onClick={() => selectSet('')}>ALL</button>
            {categories.map((category) => <button type="button" key={category.id} disabled={!category.sets.length} title={!category.sets.length ? '등록된 카드 데이터 없음' : category.label} className={openCategory === category.id ? 'is-active' : ''} aria-expanded={openCategory === category.id} aria-controls={`rb-mobile-${category.id}`} onClick={() => setOpenCategory(openCategory === category.id ? '' : category.id)}>{category.shortLabel}</button>)}
          </div>
          {activeCategory && renderSets(activeCategory, true)}
        </div>
        <div className="renew-catalog-desktop-categories">
          <button type="button" className={`renew-category-row ${!filters.set && !openCategory ? 'is-open' : ''}`} aria-pressed={!filters.set && !openCategory} onClick={() => selectSet('')}>전체</button>
          {categories.map((category) => <div className="renew-category-block" key={category.id}>
            <button type="button" className={`renew-category-row ${openCategory === category.id ? 'is-open' : ''}`} disabled={!category.sets.length} title={!category.sets.length ? '등록된 카드 데이터 없음' : undefined} aria-expanded={openCategory === category.id} aria-controls={`rb-desktop-${category.id}`} onClick={() => setOpenCategory(openCategory === category.id ? '' : category.id)}>{category.label}<strong>{openCategory === category.id ? '-' : '+'}</strong></button>
            {openCategory === category.id && renderSets(category)}
          </div>)}
        </div>
        </>}
      </aside>
      <section className="renew-catalog-main" aria-label="리프트바운드 카드 목록">
        {snapshot.cards.length === 0 ? <div className="renew-empty rb-edition-empty" role="status"><h2>한글판 카드 데이터 준비 중</h2><p>공식 한글 카드명과 이미지 확인 후 제공됩니다.</p><a className="rb-source-link" href={snapshot.source} target="_blank" rel="noreferrer">한국 공식 홈페이지 ↗</a></div> : <>
        <div className="renew-catalog-toolbar">
          <input type="search" aria-label="리프트바운드 카드 검색" placeholder="카드명, 챔피언, 카드번호 검색" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} />
          <div className="renew-mobile-rarity-filter">
            <button type="button" className={rarityPanelOpen ? 'is-open' : ''} aria-label={rarityPanelOpen ? '필터 닫기' : '필터 열기'} aria-expanded={rarityPanelOpen} onClick={() => setRarityPanelOpen((value) => !value)}>{rarityPanelOpen ? '×' : '필터'}</button>
            {rarityPanelOpen && <div className="renew-mobile-rarity-menu">{[['', 'ALL'], ...rarities].map(([id, label]) => <button type="button" key={id} className={filters.rarity === id ? 'is-active' : ''} onClick={() => { updateFilters({ rarity: id }); setRarityPanelOpen(false); }}>{label}</button>)}</div>}
          </div>
          <button type="button" onClick={() => updateFilters({ query: filters.query.trim() })}>검색</button>
        </div>
        <div className="renew-filter-line">
          {COLLECTION_ENABLED && <div className="renew-chip-group renew-catalog-view-group" role="group" aria-label="보기"><span className="renew-chip-group-label">보기</span><div className="renew-catalog-segments">
            {[['all', '전체'], ['owned', '보유중'], ['wishlist', '위시리스트']].map(([key, label]) => <button type="button" key={key} className={filters.view === key ? 'is-active' : ''} aria-pressed={filters.view === key} onClick={() => updateFilters({ view: key })}>{label}</button>)}
          </div></div>}
          <div className="renew-chip-group renew-catalog-sort-group" role="group" aria-label="정렬"><span className="renew-chip-group-label">정렬</span><div className="renew-catalog-segments">
            {[['rarity', '등급순'], ['number', '번호순']].map(([key, label]) => <button type="button" key={key} className={sortMode === key ? 'is-active' : ''} aria-pressed={sortMode === key} onClick={() => { setSortMode(key); setLimit(PAGE_SIZE); }}>{label}</button>)}
          </div></div>
          <div className="renew-chip-group renew-rarity-chip-group" role="group" aria-label="등급">
            {[['', 'ALL'], ...rarities].map(([id, label]) => <button type="button" key={id} className={filters.rarity === id ? 'is-active' : ''} aria-pressed={filters.rarity === id} onClick={() => updateFilters({ rarity: id })}>{label}</button>)}
          </div>
        </div>
        <div className="renew-catalog-title"><div><h2>{filters.query.trim() ? '검색 결과' : setName}</h2><p aria-live="polite">{filters.locale}-{filters.set || 'ALL'} {visibleCards.length}장</p></div>{COLLECTION_ENABLED && <span className="renew-lineup-progress">보유 {summary.owned} / {setCards.length}</span>}</div>
        {storageError && <p role="alert" className="rb-storage-error">{storageError}</p>}
        {!visibleCards.length ? <div className="renew-empty"><p>{filters.view === 'owned' ? '보유한 카드가 없습니다' : filters.view === 'wishlist' ? '위시리스트가 비어 있습니다' : '검색 결과가 없습니다'}</p><button type="button" onClick={() => updateFilters({ query: '', set: '', rarity: '', view: 'all' })}>전체 카드 보기</button></div> : groups.map((group) => <section className="renew-grade-section" key={group.id}>
          <header><h2>{group.label}</h2><span>{group.cards.length}장</span></header>
          <div className="renew-card-grid">
          {group.cards.slice(0, limit).map((card, index) => {
            const entry = collection[card.id] || { quantity: 0, wished: false };
            return <article key={card.id} className={`renew-card-tile ${entry.quantity ? 'is-owned' : ''} ${entry.wished ? 'is-wished' : ''}`}>
              <div className="renew-card-image">
                <button type="button" id={`rb-card-${card.id}`} className="rb-open-card" aria-label={`${card.code} ${card.name} 상세 보기`} onClick={() => openDetail(card)}><CardImage card={card} eager={index < 6} /></button>
                {COLLECTION_ENABLED && <button type="button" className={`renew-card-wish-button ${entry.wished ? 'is-wished' : ''}`} aria-label={`${card.code} 위시리스트`} aria-pressed={entry.wished} title={entry.wished ? '위시리스트에서 제거' : '위시리스트에 추가'} onClick={() => changeEntry(card.id, { wished: !entry.wished })}>♥</button>}
              </div>
              <div className="renew-card-body">
                <button type="button" className="renew-card-code-link rb-code-button" onClick={() => openDetail(card)}>{card.code}</button>
                <div className="rb-card-caption" title={card.name}>{card.name}</div>
                {COLLECTION_ENABLED && <div className="renew-card-actions"><button type="button" className={entry.quantity ? 'is-owned' : ''} aria-pressed={entry.quantity > 0} aria-label={`${card.code} ${entry.quantity ? `보유 ${entry.quantity}장` : '보유 추가'}`} onClick={() => changeEntry(card.id, { quantity: entry.quantity ? 0 : 1 })}>{entry.quantity ? `보유 ${entry.quantity}장` : '미보유'}</button></div>}
              </div>
            </article>;
          })}
          </div>
          {group.cards.length > limit && <button type="button" className="renew-deferred-rarity-button" onClick={() => setLimit((value) => value + PAGE_SIZE)}>{group.label} {group.cards.length - limit}장 더보기 +</button>}
        </section>)}
        <p className="rb-source-note">{snapshot.sourceLabel || '공식 공개 자료 기준'} · {snapshot.capturedAt.slice(0, 10)} <a className="rb-source-link" href={snapshot.source} target="_blank" rel="noreferrer">{snapshot.sourceLabel || '공식 카드 갤러리'} ↗</a></p>
        </>}
      </section>
  </main>;
}

export default function CatalogPreviewShell({ children, onBackHandlerChange }) {
  const riftbound = new URLSearchParams(window.location.search).get('game') === 'riftbound';
  return <>
    <nav className="rb-game-tabs" aria-label="도감 게임 선택">
      <a href={`${window.location.pathname.startsWith('/ja/') ? '/ja' : ''}/cards`} aria-current={!riftbound ? 'page' : undefined}>원피스</a>
      <a href={`${window.location.pathname.startsWith('/ja/') ? '/ja' : ''}/cards?game=riftbound`} aria-current={riftbound ? 'page' : undefined}>리프트바운드</a>
    </nav>
    {riftbound ? <RiftboundCatalog onBackHandlerChange={onBackHandlerChange} /> : children}
  </>;
}
