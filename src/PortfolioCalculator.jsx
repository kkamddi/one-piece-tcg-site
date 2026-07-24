import { useEffect, useMemo, useState } from 'react';

function fallbackCardImage(event) {
  const image = event.currentTarget;
  const proxyFallbackSrc = image.dataset.proxyFallbackSrc;
  if (proxyFallbackSrc && image.dataset.proxyFallbackAttempted !== '1') {
    image.dataset.proxyFallbackAttempted = '1';
    image.src = proxyFallbackSrc;
    return;
  }
  const originalFallbackSrc = image.dataset.originalFallbackSrc;
  if (originalFallbackSrc && image.dataset.originalFallbackAttempted !== '1') {
    image.dataset.originalFallbackAttempted = '1';
    image.src = originalFallbackSrc;
    return;
  }
  if (image.dataset.placeholderApplied !== '1') {
    image.dataset.placeholderApplied = '1';
    image.src = '/card-placeholder.svg';
  }
}

const COPY = {
  KR: {
    eyebrow: 'PORTFOLIO TOOL',
    title: '포트폴리오 수익률 계산기',
    guide: '사용 가이드',
    searchLabel: '카드 검색',
    searchPlaceholder: '카드명 또는 일련번호',
    search: '검색',
    searching: '검색 중',
    noResults: '검색 결과가 없습니다.',
    selectCard: '카드를 선택해 주세요.',
    grade: '등급',
    manual: '매입가 직접 입력',
    estimate: '매입일 시세로 추정',
    purchaseDate: '매입 날짜',
    currency: '통화',
    purchasePrice: '1장당 매입가',
    quantity: '수량',
    currentPrice: '현재 참고 시세',
    totalCost: '총 매입금액',
    currentValue: '현재 평가금액',
    profit: '평가손익',
    returnRate: '수익률',
    unavailable: '시세 없음',
    estimateUnavailable: '선택한 날짜 이전 7일 내 유효한 시세가 없습니다.',
    estimateSource: '날짜 시세 추정',
    save: '포트폴리오에 저장',
    saving: '저장 중',
    saved: '포트폴리오에 저장했습니다.',
    loginSave: '로그인 후 저장',
    detail: '시세 상세 보기',
    selectFirst: '검색 결과에서 카드를 선택하면 계산 결과가 바로 표시됩니다.',
    privacy: '입력값은 이 기기에서 계산되며, 저장 버튼을 누르기 전에는 서버에 저장되지 않습니다.'
  },
  EN: {
    eyebrow: 'PORTFOLIO TOOL',
    title: 'Portfolio Return Calculator',
    guide: 'Guide',
    searchLabel: 'Card search',
    searchPlaceholder: 'Card name or number',
    search: 'Search',
    searching: 'Searching',
    noResults: 'No cards found.',
    selectCard: 'Select a card.',
    grade: 'Grade',
    manual: 'Enter purchase price',
    estimate: 'Estimate by purchase date',
    purchaseDate: 'Purchase date',
    currency: 'Currency',
    purchasePrice: 'Purchase price per card',
    quantity: 'Quantity',
    currentPrice: 'Current reference price',
    totalCost: 'Total cost',
    currentValue: 'Current value',
    profit: 'Unrealized gain/loss',
    returnRate: 'Return',
    unavailable: 'No price',
    estimateUnavailable: 'No valid price was found within the previous 7 days.',
    estimateSource: 'Estimated from date',
    save: 'Save to portfolio',
    saving: 'Saving',
    saved: 'Saved to your portfolio.',
    loginSave: 'Sign in to save',
    detail: 'Open price details',
    selectFirst: 'Select a search result to preview the calculation.',
    privacy: 'Inputs are calculated on this device and are not stored until you save.'
  },
  JP: {
    eyebrow: 'PORTFOLIO TOOL',
    title: 'ポートフォリオ収益率計算',
    guide: '使い方',
    searchLabel: 'カード検索',
    searchPlaceholder: 'カード名またはカード番号',
    search: '検索',
    searching: '検索中',
    noResults: '検索結果がありません。',
    selectCard: 'カードを選択してください。',
    grade: 'グレード',
    manual: '購入価格を入力',
    estimate: '購入日の相場から推定',
    purchaseDate: '購入日',
    currency: '通貨',
    purchasePrice: '1枚あたりの購入価格',
    quantity: '数量',
    currentPrice: '現在の参考相場',
    totalCost: '購入総額',
    currentValue: '現在評価額',
    profit: '評価損益',
    returnRate: '収益率',
    unavailable: '相場なし',
    estimateUnavailable: '選択日以前7日以内の有効な相場がありません。',
    estimateSource: '購入日の相場から推定',
    save: 'ポートフォリオに保存',
    saving: '保存中',
    saved: 'ポートフォリオに保存しました。',
    loginSave: 'ログインして保存',
    detail: '相場詳細を見る',
    selectFirst: '検索結果からカードを選ぶと計算結果が表示されます。',
    privacy: '入力値は端末内で計算され、保存操作をするまでサーバーには保存されません。'
  }
};

const GUIDE = {
  KR: {
    eyebrow: 'GUIDE',
    title: '포트폴리오 계산 가이드',
    calculator: '계산기로',
    sections: [
      ['카드와 등급 선택', '일본판 시세에 연결된 카드를 검색하고 Single 또는 PSA10을 선택합니다. 현재 평가는 Card Pone의 최신 참고 시세를 사용합니다.'],
      ['매입가 입력', '실제 매입가를 직접 입력하거나 매입 날짜를 선택해 그 날짜 이전 7일 내 최근 유효 시세로 추정할 수 있습니다.'],
      ['결과 확인', '현재 평가금액에서 총 매입금액을 뺀 값이 평가손익이며, 수익률은 평가손익을 총 매입금액으로 나눈 값입니다.']
    ],
    faq: [
      ['표시 가격이 실제 판매 보장 가격인가요?', '아닙니다. 최근 거래와 현재 시세를 정리한 참고값이며 카드 상태와 거래 시점에 따라 달라질 수 있습니다.'],
      ['로그인하지 않아도 계산할 수 있나요?', '네. 검색과 계산은 공개 기능입니다. 계산 결과를 포트폴리오에 저장할 때만 로그인이 필요합니다.'],
      ['날짜 추정값은 어떻게 고르나요?', '선택한 날짜를 포함해 이전 7일 안에서 가장 가까운 유효 시세 기록을 사용합니다.']
    ],
    note: '수익률은 참고용 평가값입니다. 실제 매도 수수료, 배송비와 환율은 포함하지 않습니다.'
  },
  EN: {
    eyebrow: 'GUIDE',
    title: 'Portfolio Calculator Guide',
    calculator: 'Open calculator',
    sections: [
      ['Choose a card and grade', 'Search a card linked to Japanese market data and select Single or PSA10.'],
      ['Set the purchase cost', 'Enter the actual cost or estimate it from the nearest valid price within the previous seven days.'],
      ['Read the result', 'Unrealized gain/loss is current value minus total cost. Return divides that amount by total cost.']
    ],
    faq: [
      ['Is the displayed price a guaranteed sale price?', 'No. It is a reference value and can differ by card condition and transaction date.'],
      ['Can I calculate without signing in?', 'Yes. Only saving the result to your portfolio requires sign-in.'],
      ['How is the date estimate selected?', 'The nearest valid observation on or before the selected date, within seven days, is used.']
    ],
    note: 'Results are estimates and exclude actual selling fees, shipping, and exchange-rate changes.'
  },
  JP: {
    eyebrow: 'GUIDE',
    title: 'ポートフォリオ計算ガイド',
    calculator: '計算機へ',
    sections: [
      ['カードとグレードを選択', '日本版相場に接続されたカードを検索し、SingleまたはPSA10を選択します。'],
      ['購入価格を設定', '実際の購入価格を入力するか、購入日以前7日以内の有効な相場から推定できます。'],
      ['結果を確認', '現在評価額から購入総額を引いた値が評価損益で、収益率は評価損益を購入総額で割った値です。']
    ],
    faq: [
      ['表示価格は実際の売却価格を保証しますか？', 'いいえ。カードの状態や取引時期によって異なる参考値です。'],
      ['ログインなしで計算できますか？', 'はい。計算は公開機能で、ポートフォリオへの保存時のみログインが必要です。'],
      ['日付の推定値はどのように選びますか？', '選択日を含む過去7日以内で最も近い有効な相場を使用します。']
    ],
    note: '結果は参考値であり、実際の販売手数料、送料、為替変動は含みません。'
  }
};

export function getPortfolioCalculatorFaq(uiLang = 'KR') {
  return (GUIDE[uiLang] || GUIDE.KR).faq.map(([question, answer]) => ({ question, answer }));
}

function asPositiveNumber(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatMoneyFromJpy(value, uiLang, rates) {
  const amount = Number(value || 0);
  if (!amount) return uiLang === 'JP' ? '¥0' : uiLang === 'EN' ? '$0' : '₩0';
  const sign = amount < 0 ? '-' : '';
  const absoluteAmount = Math.abs(amount);
  if (uiLang === 'JP') return `${sign}¥${Math.round(absoluteAmount).toLocaleString('ja-JP')}`;
  if (uiLang === 'EN') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount / rates.jpyPerUsd);
  return `${sign}₩${Math.round(absoluteAmount * rates.krwPerJpy).toLocaleString('ko-KR')}`;
}

function convertToJpy(value, currency, rates) {
  const amount = asPositiveNumber(value);
  if (currency === 'JPY') return amount;
  if (currency === 'USD') return amount * rates.jpyPerUsd;
  return amount / rates.krwPerJpy;
}

function getLocalDateKey() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10);
}

export default function PortfolioCalculator({
  uiLang = 'KR',
  authUser,
  onOpenGuide,
  onRequireLogin,
  onSearchCards,
  onLoadQuote,
  onEstimatePrice,
  onSave,
  onOpenDetail,
  rates = { krwPerJpy: 9.4, jpyPerUsd: 155 }
}) {
  const copy = COPY[uiLang] || COPY.KR;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState(null);
  const [grade, setGrade] = useState('a');
  const [mode, setMode] = useState('manual');
  const [currency, setCurrency] = useState(uiLang === 'JP' ? 'JPY' : 'KRW');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getLocalDateKey);
  const [quantity, setQuantity] = useState('1');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCurrency(uiLang === 'JP' ? 'JPY' : 'KRW');
  }, [uiLang]);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setQuote(null);
      return undefined;
    }
    setQuoteLoading(true);
    setMessage('');
    Promise.resolve(onLoadQuote?.(selected))
      .then((payload) => {
        if (!cancelled) setQuote(payload || null);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, onLoadQuote]);

  const estimate = useMemo(() => (
    mode === 'estimate' && quote ? onEstimatePrice?.(quote.detail, grade, purchaseDate) || null : null
  ), [mode, quote, grade, purchaseDate, onEstimatePrice]);
  const manualPriceJpy = convertToJpy(purchasePrice, currency, rates);
  const purchaseUnitJpy = mode === 'estimate' ? Number(estimate?.price || 0) : manualPriceJpy;
  const currentUnitJpy = Number(quote?.prices?.[grade] || 0);
  const safeQuantity = Math.min(9999, Math.max(1, Math.floor(asPositiveNumber(quantity)) || 1));
  const totalCost = purchaseUnitJpy * safeQuantity;
  const currentValue = currentUnitJpy * safeQuantity;
  const profit = currentValue - totalCost;
  const returnRate = totalCost > 0 && currentUnitJpy > 0 ? (profit / totalCost) * 100 : null;
  const ready = Boolean(selected && purchaseUnitJpy > 0 && currentUnitJpy > 0);

  async function runSearch(event) {
    event?.preventDefault();
    const value = query.trim();
    if (!value || searching) return;
    setSearching(true);
    setHasSearched(true);
    setMessage('');
    try {
      const cards = await onSearchCards?.(value);
      setResults(Array.isArray(cards) ? cards.slice(0, 8) : []);
    } catch {
      setResults([]);
      setMessage(copy.noResults);
    } finally {
      setSearching(false);
    }
  }

  async function saveResult() {
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    if (!ready || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await onSave?.({
        card: selected,
        quote,
        grade,
        lot: {
          id: globalThis.crypto?.randomUUID?.() || `lot-${Date.now()}`,
          mode,
          quantity: safeQuantity,
          purchaseDate,
          originalCurrency: mode === 'manual' ? currency : 'JPY',
          originalUnitPrice: mode === 'manual' ? asPositiveNumber(purchasePrice) : Number(estimate?.price || 0),
          unitPriceJpy: purchaseUnitJpy,
          referenceDate: mode === 'estimate' ? estimate?.dateKey || '' : '',
          referenceSource: mode === 'estimate' ? estimate?.referenceSource || '' : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      setMessage(copy.saved);
    } catch (error) {
      setMessage(error?.message || 'save_failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="renew-subpage renew-profit-page renew-portfolio-calculator-page">
      <header className="renew-profit-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
        <button type="button" className="renew-profit-guide-button" onClick={onOpenGuide}>{copy.guide}</button>
      </header>

      <section className="renew-panel renew-portfolio-calculator-shell">
        <div className="renew-portfolio-calculator-search">
          <form onSubmit={runSearch}>
            <label htmlFor="portfolio-calculator-search">{copy.searchLabel}</label>
            <div>
              <input id="portfolio-calculator-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
              <button type="submit" disabled={searching}>{searching ? copy.searching : copy.search}</button>
            </div>
          </form>
          {results.length ? (
            <div className="renew-portfolio-calculator-results">
              {results.map((card) => (
                <button key={card.id} type="button" className={selected?.id === card.id ? 'is-active' : ''} onClick={() => setSelected(card)}>
                  <img
                    src={card.thumbnailUrl || card.imageUrl || '/card-placeholder.svg'}
                    data-proxy-fallback-src={card.thumbnailProxyUrl || ''}
                    data-original-fallback-src={card.thumbnailOriginalUrl || card.imageUrl || ''}
                    alt=""
                    loading="lazy"
                    onError={fallbackCardImage}
                  />
                  <span><b>{card.cardNo}</b><strong>{card.name}</strong><small>{card.rarity || card.seriesName}</small></span>
                </button>
              ))}
            </div>
          ) : hasSearched && !searching ? <p className="renew-portfolio-calculator-empty">{copy.noResults}</p> : null}
        </div>

        <div className="renew-portfolio-calculator-workspace">
          {selected ? (
            <>
              <article className="renew-portfolio-calculator-card">
                <img
                  src={selected.thumbnailUrl || selected.imageUrl || '/card-placeholder.svg'}
                  data-proxy-fallback-src={selected.thumbnailProxyUrl || ''}
                  data-original-fallback-src={selected.thumbnailOriginalUrl || selected.imageUrl || ''}
                  alt={selected.name}
                  onError={fallbackCardImage}
                />
                <div>
                  <b>{selected.cardNo}</b>
                  <strong>{selected.name}</strong>
                  <span>{selected.rarity} · {selected.seriesName || ''}</span>
                  <small>{copy.currentPrice}: {quoteLoading ? '...' : currentUnitJpy ? formatMoneyFromJpy(currentUnitJpy, uiLang, rates) : copy.unavailable}</small>
                </div>
              </article>

              <div className="renew-portfolio-calculator-tabs" aria-label={copy.grade}>
                {['a', 'psa10'].map((key) => <button key={key} type="button" className={grade === key ? 'is-active' : ''} onClick={() => setGrade(key)}>{key === 'a' ? 'Single' : 'PSA10'}</button>)}
              </div>
              <div className="renew-portfolio-calculator-tabs">
                <button type="button" className={mode === 'manual' ? 'is-active' : ''} onClick={() => setMode('manual')}>{copy.manual}</button>
                <button type="button" className={mode === 'estimate' ? 'is-active' : ''} onClick={() => setMode('estimate')}>{copy.estimate}</button>
              </div>

              <div className="renew-profit-form-grid renew-portfolio-calculator-fields">
                <label className="renew-profit-field">
                  <span>{copy.quantity}</span>
                  <div><input type="number" min="1" max="9999" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
                </label>
                <label className="renew-profit-field">
                  <span>{copy.purchaseDate}</span>
                  <div><input type="date" max={getLocalDateKey()} value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></div>
                </label>
                {mode === 'manual' ? (
                  <>
                    <label className="renew-profit-field">
                      <span>{copy.currency}</span>
                      <div>
                        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                          <option value="KRW">KRW</option><option value="JPY">JPY</option><option value="USD">USD</option>
                        </select>
                      </div>
                    </label>
                    <label className="renew-profit-field">
                      <span>{copy.purchasePrice}</span>
                      <div><input type="number" min="0" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} /></div>
                    </label>
                  </>
                ) : (
                  <div className="renew-portfolio-calculator-estimate">
                    <span>{copy.estimateSource}</span>
                    <strong>{estimate?.price ? formatMoneyFromJpy(estimate.price, uiLang, rates) : copy.estimateUnavailable}</strong>
                    {estimate?.dateKey ? <small>{estimate.dateKey}</small> : null}
                  </div>
                )}
              </div>

              <div className="renew-profit-result-grid renew-portfolio-calculator-preview" aria-live="polite">
                <article><span>{copy.totalCost}</span><strong>{ready ? formatMoneyFromJpy(totalCost, uiLang, rates) : '-'}</strong></article>
                <article><span>{copy.currentValue}</span><strong>{ready ? formatMoneyFromJpy(currentValue, uiLang, rates) : '-'}</strong></article>
                <article className={profit > 0 ? 'is-profit' : profit < 0 ? 'is-loss' : ''}><span>{copy.profit}</span><strong>{ready ? `${profit > 0 ? '+' : ''}${formatMoneyFromJpy(profit, uiLang, rates)}` : '-'}</strong></article>
                <article className={profit > 0 ? 'is-profit' : profit < 0 ? 'is-loss' : ''}><span>{copy.returnRate}</span><strong>{returnRate == null ? '-' : `${returnRate > 0 ? '+' : ''}${returnRate.toFixed(2)}%`}</strong></article>
              </div>

              <div className="renew-portfolio-calculator-actions">
                <button type="button" onClick={() => onOpenDetail?.(selected, quote)} disabled={!quote?.apparelId}>{copy.detail}</button>
                <button type="button" className="is-primary" onClick={saveResult} disabled={saving || (authUser && !ready)}>{saving ? copy.saving : authUser ? copy.save : copy.loginSave}</button>
              </div>
              {message ? <p className="renew-portfolio-message" aria-live="polite">{message}</p> : null}
            </>
          ) : (
            <div className="renew-portfolio-calculator-placeholder">{copy.selectFirst}</div>
          )}
        </div>
        <p className="renew-profit-privacy-note">{copy.privacy}</p>
      </section>
    </main>
  );
}

export function PortfolioCalculatorGuide({ uiLang = 'KR', onOpenCalculator }) {
  const copy = GUIDE[uiLang] || GUIDE.KR;
  return (
    <main className="renew-subpage renew-profit-guide-page">
      <header className="renew-profit-head">
        <div><span>{copy.eyebrow}</span><h1>{copy.title}</h1></div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenCalculator}>{copy.calculator}</button>
      </header>
      <section className="renew-profit-guide-grid">
        {copy.sections.map(([title, body]) => <article key={title} className="renew-panel renew-profit-guide-card"><h2>{title}</h2><p>{body}</p></article>)}
      </section>
      <section className="renew-panel renew-profit-faq-panel">
        <h2>FAQ</h2>
        <div>{copy.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        <p className="renew-profit-guide-note">{copy.note}</p>
      </section>
    </main>
  );
}
