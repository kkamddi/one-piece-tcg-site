import { useMemo, useState } from 'react';

export const PROFIT_CALCULATOR_FAQ = [
  {
    question: '손익은 어떻게 계산하나요?',
    answer: '예상 판매금액에서 판매 수수료와 판매 배송비를 뺀 뒤, 매입금액과 매입 부대비용을 제외해 계산합니다.'
  },
  {
    question: '손익분기 판매가는 무엇인가요?',
    answer: '수수료와 배송비를 모두 반영했을 때 이익과 손실이 0원이 되는 카드 1장당 판매 가격입니다.'
  },
  {
    question: '실제 거래 금액과 차이가 날 수 있나요?',
    answer: '네. 결제 수수료, 포장비, 환율, 거래 플랫폼 정책과 실제 배송비에 따라 결과가 달라질 수 있습니다.'
  }
];

const PROFIT_CALCULATOR_FAQ_BY_LANG = {
  KR: PROFIT_CALCULATOR_FAQ,
  EN: [
    {
      question: 'How is profit calculated?',
      answer: 'Expected profit equals expected proceeds minus the purchase amount and purchase costs. Expected proceeds reflect selling fees and shipping costs.'
    },
    {
      question: 'What is the break-even price?',
      answer: 'It is the per-card sale price at which profit becomes zero after selling fees and shipping costs are included.'
    },
    {
      question: 'Why can the result differ from a completed sale?',
      answer: 'Actual results vary with platform policies, payment fees, exchange rates, transaction conditions, and shipping costs.'
    }
  ],
  JP: [
    {
      question: '損益はどのように計算されますか？',
      answer: '予想受取額から仕入れ金額と付帯費用を差し引いて計算します。予想受取額には販売手数料と送料を反映します。'
    },
    {
      question: '損益分岐販売価格とは何ですか？',
      answer: '手数料と送料を反映したうえで、損益が0円になるカード1枚あたりの販売価格です。'
    },
    {
      question: '実際の取引結果と差が出ることはありますか？',
      answer: '販売先の規約、決済手数料、為替、取引条件、送料によって実際の結果は変わります。'
    }
  ]
};

export function getProfitCalculatorFaq(uiLang = 'KR') {
  return PROFIT_CALCULATOR_FAQ_BY_LANG[uiLang] || PROFIT_CALCULATOR_FAQ;
}

const COPY = {
  KR: {
    eyebrow: 'TOOLS',
    title: '손익 계산기',
    guide: '사용 가이드',
    reset: '초기화',
    purchasePrice: '매입 단가',
    targetPrice: '판매 예정 단가',
    quantity: '수량',
    purchaseExtra: '매입 부대비용',
    saleFee: '판매 수수료',
    saleShipping: '판매 배송비',
    currency: '통화',
    unit: '장',
    percent: '%',
    totalCost: '총 매입금액',
    saleProceeds: '예상 정산금',
    profit: '예상 손익',
    returnRate: '예상 수익률',
    breakEven: '손익분기 판매가',
    pending: '금액 입력 필요',
    perCard: '1장 기준',
    profitState: '이익 예상',
    lossState: '손실 예상',
    neutralState: '손익분기',
    note: '입력값은 이 기기에서만 계산되며 저장되지 않습니다.'
  },
  EN: {
    eyebrow: 'TOOLS',
    title: 'Profit Calculator',
    guide: 'Guide',
    reset: 'Reset',
    purchasePrice: 'Purchase price',
    targetPrice: 'Target sale price',
    quantity: 'Quantity',
    purchaseExtra: 'Purchase costs',
    saleFee: 'Selling fee',
    saleShipping: 'Shipping cost',
    currency: 'Currency',
    unit: 'cards',
    percent: '%',
    totalCost: 'Total cost',
    saleProceeds: 'Expected proceeds',
    profit: 'Expected profit',
    returnRate: 'Expected return',
    breakEven: 'Break-even price',
    pending: 'Add prices to calculate',
    perCard: 'per card',
    profitState: 'Profit expected',
    lossState: 'Loss expected',
    neutralState: 'Break-even',
    note: 'Values are calculated only in this browser and are not saved.'
  },
  JP: {
    eyebrow: 'TOOLS',
    title: '損益計算機',
    guide: '使い方',
    reset: 'リセット',
    purchasePrice: '購入単価',
    targetPrice: '予定販売単価',
    quantity: '数量',
    purchaseExtra: '購入時の諸費用',
    saleFee: '販売手数料',
    saleShipping: '販売送料',
    currency: '通貨',
    unit: '枚',
    percent: '%',
    totalCost: '購入総額',
    saleProceeds: '予想受取額',
    profit: '予想損益',
    returnRate: '予想収益率',
    breakEven: '損益分岐販売価格',
    pending: '金額を入力してください',
    perCard: '1枚あたり',
    profitState: '利益見込み',
    lossState: '損失見込み',
    neutralState: '損益分岐',
    note: '入力値はこのブラウザ内でのみ計算され、保存されません。'
  }
};

const GUIDE_COPY = {
  KR: {
    eyebrow: 'GUIDE',
    title: '손익 계산 가이드',
    calculator: '계산기로',
    sections: [
      ['계산 기준', '예상 정산금은 판매 예정 단가 x 수량에서 판매 수수료와 판매 배송비를 제외한 금액입니다.'],
      ['매입금액에 포함할 항목', '카드 매입 단가 외에 구매 배송비, 대행 수수료, 관세처럼 실제로 지출한 비용은 매입 부대비용에 합산하세요.'],
      ['결과 확인', '예상 손익은 총 매입금액과 예상 정산금의 차이입니다. 손익분기 판매가는 수수료를 포함해 손익이 0원이 되는 1장 기준 가격입니다.']
    ],
    faq: '자주 묻는 질문',
    note: '계산 결과는 참고용입니다. 실제 거래 전 플랫폼 수수료와 배송 조건을 다시 확인하세요.'
  },
  EN: {
    eyebrow: 'GUIDE',
    title: 'Profit Calculator Guide',
    calculator: 'Open calculator',
    sections: [
      ['Calculation basis', 'Expected proceeds equal target sales minus selling fees and shipping costs.'],
      ['Include every purchase cost', 'Add delivery, proxy, customs, and other paid costs to purchase costs.'],
      ['Reading the result', 'Expected profit is the difference between total cost and expected proceeds. The break-even price includes fees.']
    ],
    faq: 'FAQ',
    note: 'Results are estimates. Confirm platform fees and shipping terms before a real transaction.'
  },
  JP: {
    eyebrow: 'GUIDE',
    title: '損益計算ガイド',
    calculator: '計算機へ',
    sections: [
      ['計算基準', '予想受取額は、予定販売額から販売手数料と送料を引いた金額です。'],
      ['購入額に含める費用', '送料、代行手数料、関税など実際に支払った費用は購入時の諸費用に加えてください。'],
      ['結果の見方', '予想損益は購入総額と予想受取額の差額です。損益分岐価格は手数料込みで損益が0になる1枚あたりの価格です。']
    ],
    faq: 'よくある質問',
    note: '計算結果は参考値です。取引前に販売先の手数料と送料条件を確認してください。'
  }
};

function asNumber(value) {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getCurrencyFormatter(currency, locale) {
  const options = { maximumFractionDigits: 0 };
  if (currency === 'USD') return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency: 'USD' });
  if (currency === 'JPY') return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency: 'JPY' });
  return new Intl.NumberFormat(locale, { ...options, style: 'currency', currency: 'KRW' });
}

function getCopy(uiLang) {
  return COPY[uiLang] || COPY.KR;
}

function getGuideCopy(uiLang) {
  return GUIDE_COPY[uiLang] || GUIDE_COPY.KR;
}

function getLocale(uiLang) {
  if (uiLang === 'JP') return 'ja-JP';
  if (uiLang === 'EN') return 'en-US';
  return 'ko-KR';
}

function NumberField({ id, label, value, onChange, suffix, min = 0, step = 1 }) {
  return (
    <label className="renew-profit-field" htmlFor={id}>
      <span>{label}</span>
      <div>
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" type="number" min={min} step={step} />
        {suffix ? <b>{suffix}</b> : null}
      </div>
    </label>
  );
}

export default function ProfitCalculator({ uiLang = 'KR', onOpenGuide }) {
  const copy = getCopy(uiLang);
  const [values, setValues] = useState({
    currency: 'KRW',
    purchasePrice: '',
    targetPrice: '',
    quantity: '1',
    purchaseExtra: '',
    saleFee: '',
    saleShipping: ''
  });
  const locale = getLocale(uiLang);
  const updateValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const calculation = useMemo(() => {
    const purchasePrice = asNumber(values.purchasePrice);
    const targetPrice = asNumber(values.targetPrice);
    const quantity = Math.max(1, Math.floor(asNumber(values.quantity)) || 1);
    const purchaseExtra = asNumber(values.purchaseExtra);
    const saleFeeRate = Math.min(99.99, asNumber(values.saleFee)) / 100;
    const saleShipping = asNumber(values.saleShipping);
    const totalCost = purchasePrice * quantity + purchaseExtra;
    const grossSale = targetPrice * quantity;
    const fee = grossSale * saleFeeRate;
    const proceeds = grossSale - fee - saleShipping;
    const profit = proceeds - totalCost;
    const returnRate = totalCost > 0 ? (profit / totalCost) * 100 : null;
    const breakEven = quantity > 0 && saleFeeRate < 1 ? (totalCost + saleShipping) / (quantity * (1 - saleFeeRate)) : null;
    return { totalCost, proceeds, profit, returnRate, breakEven, ready: purchasePrice > 0 && targetPrice > 0 };
  }, [values]);
  const formatter = useMemo(() => getCurrencyFormatter(values.currency, locale), [values.currency, locale]);
  const profitState = calculation.profit > 0 ? 'is-profit' : calculation.profit < 0 ? 'is-loss' : 'is-even';
  const profitLabel = calculation.profit > 0 ? copy.profitState : calculation.profit < 0 ? copy.lossState : copy.neutralState;

  return (
    <main className="renew-subpage renew-profit-page">
      <header className="renew-profit-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
        <div>
          <button type="button" className="renew-profit-guide-button" onClick={onOpenGuide}>{copy.guide}</button>
          <button type="button" className="renew-profit-reset-button" onClick={() => setValues({ currency: values.currency, purchasePrice: '', targetPrice: '', quantity: '1', purchaseExtra: '', saleFee: '', saleShipping: '' })}>{copy.reset}</button>
        </div>
      </header>

      <section className="renew-panel renew-profit-panel">
        <div className="renew-profit-currency-row">
          <span>{copy.currency}</span>
          <div role="group" aria-label={copy.currency}>
            {['KRW', 'JPY', 'USD'].map((currency) => <button key={currency} type="button" className={values.currency === currency ? 'is-active' : ''} onClick={() => updateValue('currency', currency)}>{currency}</button>)}
          </div>
        </div>

        <div className="renew-profit-form-grid">
          <NumberField id="profit-purchase" label={copy.purchasePrice} value={values.purchasePrice} onChange={(value) => updateValue('purchasePrice', value)} />
          <NumberField id="profit-target" label={copy.targetPrice} value={values.targetPrice} onChange={(value) => updateValue('targetPrice', value)} />
          <NumberField id="profit-quantity" label={copy.quantity} value={values.quantity} onChange={(value) => updateValue('quantity', value)} suffix={copy.unit} min={1} />
          <NumberField id="profit-purchase-extra" label={copy.purchaseExtra} value={values.purchaseExtra} onChange={(value) => updateValue('purchaseExtra', value)} />
          <NumberField id="profit-fee" label={copy.saleFee} value={values.saleFee} onChange={(value) => updateValue('saleFee', value)} suffix={copy.percent} min={0} step={0.1} />
          <NumberField id="profit-shipping" label={copy.saleShipping} value={values.saleShipping} onChange={(value) => updateValue('saleShipping', value)} />
        </div>

        <div className="renew-profit-result-grid" aria-live="polite">
          <article><span>{copy.totalCost}</span><strong>{calculation.ready ? formatter.format(calculation.totalCost) : copy.pending}</strong></article>
          <article><span>{copy.saleProceeds}</span><strong>{calculation.ready ? formatter.format(calculation.proceeds) : copy.pending}</strong></article>
          <article className={`renew-profit-highlight ${profitState}`}><span>{copy.profit}</span><strong>{calculation.ready ? `${calculation.profit > 0 ? '+' : ''}${formatter.format(calculation.profit)}` : copy.pending}</strong><small>{calculation.ready ? profitLabel : ''}</small></article>
          <article className={profitState}><span>{copy.returnRate}</span><strong>{calculation.ready && calculation.returnRate != null ? `${calculation.returnRate > 0 ? '+' : ''}${calculation.returnRate.toFixed(2)}%` : copy.pending}</strong></article>
          <article><span>{copy.breakEven}</span><strong>{calculation.ready && calculation.breakEven != null ? formatter.format(calculation.breakEven) : copy.pending}</strong><small>{calculation.ready ? copy.perCard : ''}</small></article>
        </div>
        <p className="renew-profit-privacy-note">{copy.note}</p>
      </section>
    </main>
  );
}

export function ProfitCalculatorGuide({ uiLang = 'KR', onOpenCalculator }) {
  const copy = getGuideCopy(uiLang);
  const faqItems = getProfitCalculatorFaq(uiLang);
  return (
    <main className="renew-subpage renew-profit-guide-page">
      <header className="renew-profit-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
        </div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenCalculator}>{copy.calculator}</button>
      </header>
      <section className="renew-profit-guide-grid">
        {copy.sections.map(([title, body]) => <article key={title} className="renew-panel renew-profit-guide-card"><h2>{title}</h2><p>{body}</p></article>)}
      </section>
      <section className="renew-panel renew-profit-faq-panel">
        <h2>{copy.faq}</h2>
        <div>
          {faqItems.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
        </div>
        <p className="renew-profit-guide-note">{copy.note}</p>
      </section>
    </main>
  );
}
