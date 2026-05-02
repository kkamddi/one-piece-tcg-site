import { useEffect, useMemo, useState } from 'react';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import seriesData from './data/series.json';

const rarityOrder = ['SEC', 'L', 'SR', 'R', 'UC', 'C'];

function groupByRarity(cards) {
  return rarityOrder
    .map((rarity) => ({ rarity, cards: cards.filter((card) => card.rarity === rarity) }))
    .filter((group) => group.cards.length > 0);
}

function placeholderImage(event) {
  event.currentTarget.src = '/card-placeholder.svg';
}

export default function App() {
  const [selectedSeries, setSelectedSeries] = useState(seriesData[0]?.id ?? '');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeRarity, setActiveRarity] = useState('ALL');

  const currentSeries = useMemo(
    () => seriesData.find((series) => series.id === selectedSeries) ?? seriesData[0],
    [selectedSeries]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const load = async () => {
      const fetchedCards = searchKeyword.trim()
        ? await searchCards(searchKeyword)
        : await fetchCards({ series: selectedSeries, rarity: activeRarity === 'ALL' ? '' : activeRarity });

      const filteredCards = fetchedCards.filter((card) => {
        const matchesSeries = card.series === selectedSeries;
        const matchesRarity = activeRarity === 'ALL' || card.rarity === activeRarity;
        return matchesSeries && matchesRarity;
      });

      if (alive) {
        setCards(filteredCards);
        setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [selectedSeries, activeRarity, searchKeyword]);

  const groupedCards = useMemo(() => groupByRarity(cards), [cards]);

  async function openCard(id) {
    const detail = await fetchCardById(id);
    setSelectedCard(detail);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1800px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-slate-800 bg-slate-950/95 px-4 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">ONE PIECE TCG</p>
            <h1 className="mt-2 text-3xl font-bold">원피스 카드 도감</h1>
          </div>

          <div className="space-y-2.5">
            {seriesData.map((series) => {
              const active = series.id === selectedSeries;
              return (
                <button
                  key={series.id}
                  type="button"
                  onClick={() => {
                    setSelectedSeries(series.id);
                    setSearchKeyword('');
                    setActiveRarity('ALL');
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-rose-400/70 bg-rose-500/10 shadow-[0_0_0_1px_rgba(251,113,133,0.18)]'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-xs font-semibold tracking-wide text-rose-200">{series.id}</div>
                  <div className="mt-1 text-base font-bold text-white">{series.koName}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{series.enName}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{series.kindKo}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">선택된 시리즈</p>
                <h2 className="mt-2 text-3xl font-bold text-white">{currentSeries?.koName}</h2>
                <div className="mt-1 text-sm text-slate-400">{currentSeries?.enName}</div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{currentSeries?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200">표시 카드 {cards.length}장</span>
                <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-rose-200">시세: 준비 중</span>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">현재 시리즈 내 카드 검색</span>
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="카드명 또는 카드번호 검색"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400"
                />
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-300">등급 필터</div>
                <div className="flex flex-wrap gap-2">
                  {['ALL', ...rarityOrder].map((rarity) => {
                    const active = activeRarity === rarity;
                    return (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => setActiveRarity(rarity)}
                        className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                          active
                            ? 'border-rose-400/70 bg-rose-500/10 text-rose-100'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {rarity}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 space-y-5">
            {loading ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">불러오는 중...</div>
            ) : groupedCards.length ? (
              groupedCards.map((group) => (
                <div key={group.rarity} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">{group.rarity}</h3>
                    <span className="text-sm text-slate-400">{group.cards.length}장</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {group.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => openCard(card.id)}
                        className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 text-left transition hover:-translate-y-1 hover:border-rose-400/50 hover:shadow-lg hover:shadow-rose-900/20"
                      >
                        <div className="aspect-[5/7] overflow-hidden bg-slate-950 p-1">
                          <img
                            src={card.imageUrl || '/card-placeholder.svg'}
                            alt={card.name}
                            onError={placeholderImage}
                            className="h-full w-full object-contain [image-rendering:auto]"
                          />
                        </div>
                        <div className="space-y-2.5 p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-semibold text-slate-400">{card.cardNo}</span>
                            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">{card.rarity}</span>
                          </div>
                          <div>
                            <div className="line-clamp-2 text-sm font-bold text-white">{card.name}</div>
                            {card.nameEn ? <div className="mt-0.5 text-[11px] text-slate-500">{card.nameEn}</div> : null}
                            <div className="mt-1 text-[11px] text-slate-400">{card.categoryKo}</div>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-xs">
                            <Stat label="비용" value={card.cost} compactSize />
                            <Stat label="파워" value={card.power} compactSize />
                            <Stat label="카운터" value={card.counter} compactSize />
                            <Stat label="속성" value={card.attributeKo} compactSize />
                          </dl>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">검색 결과가 없습니다.</div>
            )}
          </section>
        </main>
      </div>

      {selectedCard ? <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} /> : null}
    </div>
  );
}

function Stat({ label, value, compact = false, compactSize = false }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2 ${compact ? 'col-span-2' : ''}`}>
      <dt className={`font-semibold uppercase tracking-[0.18em] text-slate-500 ${compactSize ? 'text-[10px]' : 'text-[11px]'}`}>{label}</dt>
      <dd className={`mt-1 break-words font-medium text-slate-100 ${compactSize ? 'text-xs' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}

function CardModal({ card, onClose }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 p-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
          <div>
            <div className="overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900">
              <img
                src={card.imageUrl || '/card-placeholder.svg'}
                alt={card.name}
                onError={placeholderImage}
                className="aspect-[5/7] h-full w-full object-contain [image-rendering:auto]"
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-rose-300">{card.cardNo}</div>
                <h3 className="mt-2 text-3xl font-bold text-white">{card.name}</h3>
                {card.nameEn ? <div className="mt-1 text-sm text-slate-500">{card.nameEn}</div> : null}
                <p className="mt-2 text-sm text-slate-400">{card.seriesName} · {card.seriesNameEn}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="등급" value={card.rarity} />
              <Stat label="종류" value={card.categoryKo} />
              <Stat label="색상" value={card.colorKo} />
              <Stat label="비용" value={card.cost} />
              <Stat label="파워" value={card.power} />
              <Stat label="카운터" value={card.counter} />
              <Stat label="속성" value={card.attributeKo} />
              <Stat label="타입" value={card.type} compact />
            </div>

            <section className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm font-semibold text-slate-200">효과</div>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-300">{card.effect || '효과 정보 준비 중'}</p>
            </section>

            <section className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm font-semibold text-slate-200">시세</div>
              <p className="mt-3 text-sm text-slate-400">준비 중</p>
            </section>

            <div className="flex flex-wrap gap-3">
              <a
                href={card.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                공식 정보 보기
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
