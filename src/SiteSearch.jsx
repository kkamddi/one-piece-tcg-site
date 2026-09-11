import React, { useEffect, useId, useMemo, useState } from 'react';
import series from './data/series.json';
import { fetchCards, searchCards } from './api/cards';
import { fetchShops } from './api/shops';
import { createSiteSearchLoader, parseSiteQuery, searchSiteContent } from './lib/site-search';
import './site-search.css';

const loadSearch = createSiteSearchLoader({
  searchCards: (query, locale) => {
    const { seriesCode } = parseSiteQuery(query);
    if (!seriesCode) return searchCards(query, locale);
    const match = series.find(item => item.locale === locale && item.baseSeriesId === seriesCode);
    return match ? fetchCards({ series: match.id, locale }) : Promise.resolve([]);
  },
  fetchShops
});
const LABELS = {
  KR: { title: '통합 검색', placeholder: '통합검색', submit: '검색', suggestions: '추천 검색 결과', all: '전체', cards: '카드', series: '시리즈', guides: '가이드·정보', shops: '구매처', more: '더 보기', catalog: '도감 보기', price: '시세 보기', loading: '검색 중', empty: '검색 결과가 없습니다.', enter: '검색어를 입력해 주세요.', short: '두 글자 이상 입력해 주세요.', error: '일부 결과를 불러오지 못했습니다.', retry: '다시 검색', kr: '한글판', jp: '일본판', language: '카드 언어', map: '지도 보기' },
  EN: { title: 'Site search', placeholder: 'Search cards, sets, guides and shops', submit: 'Search', suggestions: 'Suggestions', all: 'All', cards: 'Cards', series: 'Sets', guides: 'Guides & info', shops: 'Shops', more: 'Show more', catalog: 'Card details', price: 'Prices', loading: 'Searching', empty: 'No results found.', enter: 'Enter a search term.', short: 'Enter at least two characters.', error: 'Some results could not be loaded.', retry: 'Retry', kr: 'Korean', jp: 'Japanese', language: 'Card language', map: 'View map' },
  JP: { title: 'サイト内検索', placeholder: 'カード・シリーズ・ガイド・店舗を検索', submit: '検索', suggestions: '検索候補', all: 'すべて', cards: 'カード', series: 'シリーズ', guides: 'ガイド・情報', shops: '店舗', more: 'もっと見る', catalog: 'カード詳細', price: '相場を見る', loading: '検索中', empty: '検索結果がありません。', enter: '検索語を入力してください。', short: '2文字以上入力してください。', error: '一部の結果を取得できませんでした。', retry: '再検索', kr: '韓国語版', jp: '日本語版', language: 'カードの言語', map: '地図を見る' }
};

export function SiteSearchInput({ initialQuery = '', onSubmit, uiLang = 'KR', documents = [] }) {
  const text = LABELS[uiLang] || LABELS.KR;
  const [value, setValue] = useState(initialQuery), [suggestQuery, setSuggestQuery] = useState('');
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(-1);
  const id = useId();
  useEffect(() => { setValue(initialQuery); setOpen(false); }, [initialQuery]);
  useEffect(() => { const timer = setTimeout(() => setSuggestQuery(value), 180); return () => clearTimeout(timer); }, [value]);
  const suggestions = useMemo(() => searchSiteContent(suggestQuery, series, documents).slice(0, 5), [suggestQuery, documents]);
  function submit(event) { event.preventDefault(); if (!value.trim()) return; setOpen(false); onSubmit(value.trim()); }
  return <div className="site-search-input" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <form className="renew-search" role="search" onSubmit={submit}>
      <input role="combobox" aria-label={text.placeholder} aria-expanded={open && suggestions.length > 0} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open && selected >= 0 && suggestions[selected] ? `${id}-${selected}` : undefined}
        value={value} placeholder={text.placeholder} maxLength={100} autoComplete="off"
        onFocus={() => setOpen(true)} onChange={event => { setValue(event.target.value); setOpen(true); setSelected(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
            if (event.key === 'Enter') event.preventDefault();
            return;
          }
          if (event.key === 'Escape') { setOpen(false); setSelected(-1); }
          if (['ArrowDown', 'ArrowUp'].includes(event.key) && suggestions.length) { event.preventDefault(); setOpen(true); setSelected(index => Math.max(0, Math.min(suggestions.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
          if (event.key === 'Enter' && open && selected >= 0 && suggestions[selected]) { event.preventDefault(); window.location.assign(suggestions[selected].href); }
        }} />
      <button type="submit" className="renew-search-submit" aria-label={text.submit}>{text.submit}</button>
    </form>
    {open && suggestions.length > 0 ? <ul id={id} role="listbox" aria-label={text.suggestions} className="site-search-suggestions">
      {suggestions.map((item, index) => <li key={item.id} role="option" aria-selected={selected === index} id={`${id}-${index}`}><a href={item.href}><span>{item.title}</span><small>{text[item.type]}{item.locale ? ` · ${item.locale}` : ''}</small></a></li>)}
    </ul> : null}
  </div>;
}

export default function SiteSearch({ query = '', onSubmit, onOpenCard, onOpenPrice, uiLang = 'KR', documents = [] }) {
  const text = LABELS[uiLang] || LABELS.KR;
  const savedView = typeof window !== 'undefined' && window.history.state?.siteSearchView;
  const restoreView = savedView?.query === query;
  const [tab, setTab] = useState(() => restoreView && ['all', 'cards', 'series', 'guides', 'shops'].includes(savedView.tab) ? savedView.tab : 'all');
  const [locale, setLocale] = useState(() => restoreView && ['all', 'KR', 'JP'].includes(savedView.locale) ? savedView.locale : 'all');
  const [limit, setLimit] = useState(() => restoreView && Number.isFinite(savedView.limit) ? Math.max(24, savedView.limit) : 24);
  const [remote, setRemote] = useState({ cards: [], shops: [], errors: [] }), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const parsed = parseSiteQuery(query);
  const content = useMemo(() => searchSiteContent(query, series, documents), [query, documents]);
  useEffect(() => {
    let cancelled = false;
    setRemote({ cards: [], shops: [], errors: [] }); setLoading(parsed.cardQuery.length >= 2);
    const saved = window.history.state?.siteSearchView;
    const restore = saved?.query === query;
    setTab(restore && ['all', 'cards', 'series', 'guides', 'shops'].includes(saved.tab) ? saved.tab : 'all');
    setLocale(restore && ['all', 'KR', 'JP'].includes(saved.locale) ? saved.locale : 'all');
    setLimit(restore && Number.isFinite(saved.limit) ? Math.max(24, saved.limit) : 24);
    loadSearch(query).then(data => { if (!cancelled) setRemote(data); }).catch(() => { if (!cancelled) setRemote({ cards: [], shops: [], errors: ['cards', 'shops'] }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, retry]);
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, siteSearchView: { query, tab, locale, limit } }, '');
  }, [query, tab, locale, limit]);
  const groups = {
    cards: remote.cards.filter(card => locale === 'all' || card.locale === locale),
    series: content.filter(item => item.type === 'series'), guides: content.filter(item => item.type === 'guides'), shops: remote.shops
  };
  const types = parsed.exactCode || (!parsed.seriesCode && !content.some(item => item.type === 'guides' && item.score >= 70)) ? ['cards', 'series', 'guides', 'shops'] : ['series', 'guides', 'cards', 'shops'];
  const total = Object.values(groups).reduce((count, items) => count + items.length, 0);
  return <main className="site-search-page">
    <h1>{text.title}</h1>
    <SiteSearchInput initialQuery={query} onSubmit={onSubmit} uiLang={uiLang} documents={documents} />
    <nav className="site-search-tabs" aria-label={text.title}>{['all', 'cards', 'series', 'guides', 'shops'].map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setLimit(24); }}>{text[value]}{value !== 'all' && groups[value].length > 0 ? <small>{groups[value].length}</small> : null}</button>)}</nav>
    {loading ? <p role="status">{text.loading}...</p> : null}
    {remote.errors.length ? <p role="alert">{text.error} <button type="button" onClick={() => setRetry(value => value + 1)}>{text.retry}</button></p> : null}
    {!loading && (tab === 'all' ? total === 0 : groups[tab].length === 0) ? <div className="site-search-empty"><p>{!query ? text.enter : parsed.cardQuery.length < 2 && !content.length ? text.short : text.empty}</p><a href="/guide/collection/start">{LABELS.KR.guides}</a><a href="/cards">{text.cards}</a><a href="/shops">{text.shops}</a></div> : null}
    {types.filter(type => tab === 'all' || tab === type).map(type => groups[type].length > 0 || (type === 'cards' && remote.cards.length > 0) ? <section className="site-search-section" key={type}>
      <header><h2>{text[type]} <small>{groups[type].length}</small></h2>{tab === 'all' && groups[type].length > (type === 'cards' ? 6 : 3) ? <button type="button" onClick={() => { setTab(type); setLimit(24); }}>{text.more}</button> : null}</header>
      {type === 'cards' ? <div className="site-search-locales" role="group" aria-label={text.language}>{[['all', text.all], ['KR', text.kr], ['JP', text.jp]].map(([value, label]) => <button type="button" key={value} aria-pressed={locale === value} onClick={() => { setLocale(value); setLimit(24); }}>{label}</button>)}</div> : null}
      <div className={type === 'cards' ? 'site-search-cards' : 'site-search-rows'}>{groups[type].slice(0, tab === 'all' ? type === 'cards' ? 6 : 3 : limit).map(item => {
        if (type === 'cards') {
          const cardHref = `/cards?cardId=${encodeURIComponent(item.id)}`;
          const open = callback => event => {
            if (callback && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); callback(item); }
          };
          const image = item.thumbnailUrl || `https://cards.optcgkorea.com/cards/${item.locale}/${item.id.replace(/^[A-Z]+::/, '')}.webp`;
          return <article className="site-search-card" key={item.id}>
            <a href={cardHref} onClick={open(onOpenCard)} className="site-search-card-image"><img src={image} alt={item.nameKo || item.name || item.cardNo} loading="lazy" onError={event => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = '1'; event.currentTarget.src = item.imageUrl || '/card-placeholder.svg'; } else { event.currentTarget.onerror = null; event.currentTarget.src = '/card-placeholder.svg'; } }} /></a>
            <small>{item.cardNo} · {item.locale === 'KR' ? text.kr : text.jp}</small><h3><a href={cardHref} onClick={open(onOpenCard)}>{item.nameKo || item.name}</a></h3><p>{[item.rarity, item.series].filter(Boolean).join(' · ')}</p>
            <div className="site-search-card-actions"><a href={cardHref} onClick={open(onOpenCard)}>{text.catalog}</a>{item.locale === 'JP' ? <a onClick={open(onOpenPrice)} href={`/prices?code=${encodeURIComponent(item.baseCardNo || item.cardNo)}&cardId=${encodeURIComponent(item.id)}`}>{text.price}</a> : null}</div>
          </article>;
        }
        if (type === 'shops') return <article key={item.id || `${item.name}-${item.address}`}><h3>{item.name}</h3><p>{item.address}</p><small>{item.sourceLabel}</small><a href={`https://map.naver.com/p/search/${encodeURIComponent(`${item.name} ${item.address}`)}`} target="_blank" rel="noreferrer">{text.map}</a></article>;
        return <article key={item.id}><h3><a href={item.href}>{item.title}</a>{item.locale ? <small>{item.locale === 'KR' ? text.kr : text.jp}</small> : null}</h3><p>{item.description}</p>{item.catalogHref ? <a href={item.catalogHref}>{uiLang === 'EN' ? 'View cards in this set' : uiLang === 'JP' ? '収録カードを見る' : '수록 카드 보기'}</a> : null}</article>;
      })}</div>
      {tab !== 'all' && groups[type].length > limit ? <button className="site-search-more" type="button" onClick={() => setLimit(value => value + 24)}>{text.more}</button> : null}
    </section> : null)}
  </main>;
}
