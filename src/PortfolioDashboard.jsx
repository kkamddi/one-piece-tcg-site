import React, { useEffect, useState } from 'react';
import './portfolio.css';

export function PortfolioCardImage({ card, imageSrc, resolveImages }) {
  const initialSource = imageSrc(card);
  const [sources, setSources] = useState([]);
  const [index, setIndex] = useState(0);
  const [productPhoto, setProductPhoto] = useState(false);
  const [needsFallback, setNeedsFallback] = useState(false);
  useEffect(() => {
    const initial = [...new Set([initialSource, card.previewImageUrl, card.imageUrl].filter((src) => src && !/placeholder|no[-_]?image/i.test(src)))];
    setSources(initial);
    setIndex(0);
    setProductPhoto(false);
    setNeedsFallback(!initial.length);
  }, [initialSource, card.cardId, card.apparelId, card.previewImageUrl, card.imageUrl]);
  useEffect(() => {
    if (!needsFallback) return undefined;
    let cancelled = false;
    resolveImages(card).then((extra) => {
      if (!cancelled) setSources((current) => [...new Set([...current, ...extra])]);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [needsFallback, card.cardId, card.apparelId, resolveImages]);
  const src = sources[index] || '/card-placeholder.svg';
  return <img src={src} alt="" loading="lazy" data-product-photo={productPhoto}
    onLoad={(event) => setProductPhoto(event.currentTarget.currentSrc.includes('cdn.snkrdunk.com/upload_bg_removed/'))}
    onError={() => { if (sources[index]) { setProductPhoto(false); setIndex((value) => value + 1); if (index === sources.length - 1) setNeedsFallback(true); } }} />;
}

export default function PortfolioDashboard({ model, loading, error, signedIn, onLogin, onRetry, onAdd, onEdit, onRemove, onOpenPrices, money, displayName, imageSrc, resolveImages, t }) {
  const [tab, setTab] = useState('holdings');
  const [grade, setGrade] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('value');
  const [actionError, setActionError] = useState('');
  const [removing, setRemoving] = useState('');
  const signClass = (value) => value > 0 ? 'is-up' : value < 0 ? 'is-down' : '';
  const signedMoney = (value) => value == null ? '-' : `${value > 0 ? '+' : value < 0 ? '-' : ''}${money(Math.abs(value))}`;
  const percent = (value) => value == null ? '-' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  const cards = model.cards.filter((card) => (grade === 'all' || card.grade === grade)
    && `${card.code} ${card.name} ${card.setName}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'name') return String(a.name || a.code).localeCompare(String(b.name || b.code));
    const key = sort === 'profit' ? 'profitJpy' : 'valueJpy';
    return (b[key] ?? -Infinity) - (a[key] ?? -Infinity);
  });
  const records = cards.flatMap((card) => card.lots.map((lot) => ({ card, lot })))
    .sort((a, b) => String(b.lot.purchaseDate || b.lot.createdAt).localeCompare(String(a.lot.purchaseDate || a.lot.createdAt)));
  const allocation = ['a', 'psa10'].map((key) => ({ key, label: key === 'a' ? 'Single' : 'PSA10', value: model.cards.filter((card) => card.grade === key).reduce((sum, card) => sum + (card.valueJpy || 0), 0) }));
  async function remove(card) {
    if (!window.confirm(t(`${card.code} 보유 내역과 매입 기록을 삭제할까요?`, `Remove ${card.code} and its purchases?`, `${card.code}の保有・購入記録を削除しますか？`))) return;
    setRemoving(card.id);
    setActionError('');
    try { await onRemove(card.id); }
    catch { setActionError(t('삭제하지 못했습니다. 다시 시도해 주세요.', 'Could not remove the holding. Please retry.', '削除できませんでした。再試行してください。')); }
    finally { setRemoving(''); }
  }
  return <main className="portfolio-page">
    <header className="portfolio-heading">
      <div><p>MY ASSETS</p><h1>{t('포트폴리오', 'Portfolio', 'ポートフォリオ')}</h1></div>
      {signedIn && <div className="portfolio-actions">
        <button type="button" className="portfolio-icon" onClick={onRetry} disabled={loading} title={t('새로고침', 'Refresh', '更新')} aria-label={t('새로고침', 'Refresh', '更新')}>↻</button>
        <button type="button" className="portfolio-primary" onClick={onAdd}>{t('+ 자산 추가', '+ Add asset', '+ 資産を追加')}</button>
      </div>}
    </header>
    {loading ? <div className="portfolio-state" role="status">{t('자산을 불러오는 중...', 'Loading your assets...', '資産を読み込み中...')}</div>
      : !signedIn ? <section className="portfolio-state"><h2>{t('내 카드의 가치를 한곳에서', 'Your card assets, together', 'カードの資産をひとつに')}</h2><p>{t('로그인하면 저장된 보유 카드와 매입 기록을 확인할 수 있습니다.', 'Sign in to view your holdings and purchase records.', 'ログインすると保有カードと購入記録を確認できます。')}</p><button type="button" className="portfolio-primary" onClick={onLogin}>{t('로그인', 'Sign in', 'ログイン')}</button></section>
      : error ? <section className="portfolio-state" role="alert"><p>{t('보유 내역을 불러오지 못했습니다.', 'Unable to load your holdings.', '保有記録を読み込めませんでした。')}</p><button type="button" onClick={onRetry}>{t('다시 시도', 'Retry', '再試行')}</button></section>
      : !model.cards.length ? <section className="portfolio-state"><h2>{t('아직 등록된 자산이 없습니다.', 'No assets yet.', '登録された資産はありません。')}</h2><p>{t('시세에서 보유 카드를 추가해 주세요.', 'Add your cards from Prices.', '相場ページからカードを追加してください。')}</p><button type="button" className="portfolio-primary" onClick={onAdd}>{t('카드 찾기', 'Find a card', 'カードを探す')}</button></section>
      : <>
        <section className="portfolio-overview" aria-label={t('자산 요약', 'Asset summary', '資産概要')}>
          <div className="portfolio-balance">
            <span>{model.missingQuotes ? t('확인된 평가액', 'Known market value', '確認済み評価額') : t('총 평가액', 'Market value', '総評価額')} · {t('최근 거래일 중앙값', 'Latest trading day median', '直近取引日の中央値')}</span>
            <strong>{money(model.totalJpy)}</strong>
            {import.meta.env.DEV && model.previousTotalJpy != null && <small>{t('기존 기준', 'Previous basis', '従来の基準')} {money(model.previousTotalJpy)} → {t('거래 기준', 'Trade basis', '取引基準')} {money(model.totalJpy)}</small>}
            <p className={signClass(model.profitJpy)}>{signedMoney(model.profitJpy)} <b>{percent(model.returnPercent)}</b></p>
            <dl className="portfolio-metrics">
              <div><dt>{t('등록 매입금액', 'Recorded cost', '登録購入額')}</dt><dd>{model.costJpy ? money(model.costJpy) : '-'}</dd></div>
              <div><dt>{t('보유 카드', 'Cards held', '保有カード')}</dt><dd>{model.quantity.toLocaleString()} <small>{t('장', 'cards', '枚')}</small></dd></div>
              <div><dt>{t('매입가 미등록', 'Missing cost', '購入価格未登録')}</dt><dd>{model.missingCostQuantity.toLocaleString()} <small>{t('장', 'cards', '枚')}</small></dd></div>
            </dl>
          </div>
          <aside className="portfolio-allocation" aria-label={t('자산 구성', 'Allocation', '資産構成')}>
            <h2>{t('자산 구성', 'Allocation', '資産構成')}</h2>
            <div className="portfolio-allocation-bar" aria-hidden="true">{allocation.map((item) => <span key={item.key} className={`grade-${item.key}`} style={{ width: `${model.totalJpy ? item.value / model.totalJpy * 100 : 0}%` }} />)}</div>
            {allocation.map((item) => <div className="portfolio-allocation-row" key={item.key}><span><i className={`grade-${item.key}`} />{item.label}</span><strong>{money(item.value)}</strong><small>{model.totalJpy ? (item.value / model.totalJpy * 100).toFixed(1) : '0'}%</small></div>)}
          </aside>
        </section>
        {(model.error || model.missingQuotes > 0) && <p className="portfolio-notice" role="status">{t(`시세 미확인 ${model.missingQuotes}종은 평가액·손익에서 제외했습니다.`, `${model.missingQuotes} unpriced holdings are excluded from value and return.`, `相場未確認${model.missingQuotes}種は評価額・損益から除外しています。`)} <button type="button" onClick={onRetry}>{t('다시 조회', 'Retry prices', '再取得')}</button></p>}
        {model.cards.some((card) => card.estimated) && <p className="portfolio-notice">{t('일부 매입가는 당시 시세로 추정한 금액입니다.', 'Some purchase costs are historical price estimates.', '一部の購入価格は当時の相場による推定値です。')}</p>}
        <section className="portfolio-assets">
          <div className="portfolio-tabs" role="group" aria-label={t('자산 보기', 'Asset view', '資産表示')}>
            <button type="button" aria-pressed={tab === 'holdings'} onClick={() => setTab('holdings')}>{t('보유 자산', 'Holdings', '保有資産')} <span>{model.cards.length}</span></button>
            <button type="button" aria-pressed={tab === 'purchases'} onClick={() => setTab('purchases')}>{t('매입 기록', 'Purchases', '購入記録')}</button>
          </div>
          <div className="portfolio-toolbar">
            <div className="portfolio-grades" role="group" aria-label={t('등급 필터', 'Grade filter', 'グレード絞り込み')}>{[['all', t('전체', 'All', 'すべて')], ['a', 'Single'], ['psa10', 'PSA10']].map(([key, label]) => <button type="button" key={key} aria-pressed={grade === key} onClick={() => setGrade(key)}>{label}</button>)}</div>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('보유 카드 검색', 'Search holdings', '保有カードを検索')} aria-label={t('보유 카드 검색', 'Search holdings', '保有カードを検索')} />
            {tab === 'holdings' && <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t('자산 정렬', 'Sort holdings', '資産の並び順')}><option value="value">{t('평가액순', 'Market value', '評価額順')}</option><option value="profit">{t('손익순', 'Return', '損益順')}</option><option value="name">{t('이름순', 'Name', '名前順')}</option></select>}
          </div>
          {actionError && <p role="alert">{actionError}</p>}
          {tab === 'holdings' ? <div className="portfolio-table" role="table" aria-label={t('보유 자산', 'Holdings', '保有資産')}>
            <div className="portfolio-table-head" role="row">{[t('자산', 'Asset', '資産'), t('수량 / 평균 매입가', 'Qty / Avg. cost', '数量 / 平均購入価格'), t('평가액 / 현재 단가', 'Value / Unit price', '評価額 / 現在単価'), t('평가손익', 'Return', '評価損益'), t('관리', 'Manage', '管理')].map((label) => <span role="columnheader" key={label}>{label}</span>)}</div>
            {cards.map((card) => <div className="portfolio-asset-row" role="row" key={card.id}>
<div role="cell" className="portfolio-card-cell"><button type="button" className="portfolio-card-link" onClick={() => onOpenPrices(card)}><PortfolioCardImage card={card} imageSrc={imageSrc} resolveImages={resolveImages} /><span><small>{card.code} · {card.grade === 'a' ? 'Single' : 'PSA10'}</small><strong>{displayName(card)}</strong><small>{card.setName}</small></span></button></div>
              <div role="cell" className="portfolio-cost-cell"><strong>{card.quantity}{t('장', ' units', '枚')}</strong><small>{card.pricedQuantity ? `${money(card.costJpy / card.pricedQuantity)}${card.estimated ? t(' (추정)', ' (est.)', ' (推定)') : ''}` : t('매입가 미등록', 'Cost not set', '購入価格未登録')}</small>{card.pricedQuantity > 0 && card.pricedQuantity < card.quantity && <small>{t(`${card.pricedQuantity}장만 원가 등록`, `Cost on ${card.pricedQuantity} units`, `${card.pricedQuantity}枚のみ価格登録`)}</small>}</div>
              <div role="cell" className="portfolio-value-cell"><strong>{card.valueJpy == null ? '-' : money(card.valueJpy)}</strong><small>{card.price == null ? t('거래 기록 없음', 'No trade records', '取引記録なし') : `${t('단가', 'Unit', '単価')} ${money(card.price)}`}</small>{card.priceDate && <small>{card.priceDate}</small>}</div>
              <div role="cell" className={`portfolio-profit-cell ${signClass(card.profitJpy)}`}><strong>{signedMoney(card.profitJpy)}</strong><small>{percent(card.returnPercent)}</small></div>
              <div role="cell" className="portfolio-row-actions"><button type="button" onClick={() => onEdit(card)}>{t('매입 관리', 'Edit purchases', '購入管理')}</button><button type="button" className="portfolio-icon" disabled={Boolean(removing)} onClick={() => remove(card)} aria-label={t(`${card.code} 삭제`, `Remove ${card.code}`, `${card.code}を削除`)} title={t('자산 삭제', 'Remove asset', '資産削除')}>×</button></div>
            </div>)}
            {!cards.length && <p className="portfolio-no-results">{t('검색 결과가 없습니다.', 'No matching holdings.', '該当する資産がありません。')}</p>}
          </div> : <div className="portfolio-purchases">{records.map(({ card, lot }) => <button type="button" className="portfolio-purchase-row" key={`${card.id}-${lot.id}`} onClick={() => onEdit(card)}><time>{lot.purchaseDate || t('날짜 미등록', 'Date not set', '日付未登録')}</time><span><strong>{displayName(card)}</strong><small>{card.code} · {card.grade === 'a' ? 'Single' : 'PSA10'} · {lot.quantity}{t('장', ' units', '枚')}</small></span><span><strong>{lot.unitPriceJpy > 0 ? money(lot.unitPriceJpy * lot.quantity) : t('매입가 미등록', 'Cost not set', '購入価格未登録')}</strong><small>{lot.mode === 'estimate' ? t('시세 추정가', 'Estimated cost', '相場推定価格') : lot.mode === 'manual' ? t('직접 입력', 'Recorded cost', '入力価格') : '-'}</small></span></button>)}{!records.length && <p className="portfolio-no-results">{t('매입 기록이 없습니다.', 'No purchase records.', '購入記録がありません。')}</p>}</div>}
        </section>
      </>}
  </main>;
}
