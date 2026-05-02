import { useEffect, useMemo, useState } from 'react';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import seriesData from './data/series.json';

const rarityPriority = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];

function getOrderedRarities(cards) {
  const present = [...new Set(cards.map((card) => card.rarity).filter(Boolean))];
  const prioritized = rarityPriority.filter((rarity) => present.includes(rarity));
  const extra = present.filter((rarity) => !prioritized.includes(rarity)).sort();
  return [...prioritized, ...extra];
}

function groupByRarity(cards) {
  return getOrderedRarities(cards)
    .map((rarity) => ({ rarity, cards: cards.filter((card) => card.rarity === rarity) }))
    .filter((group) => group.cards.length > 0);
}

function placeholderImage(event) {
  event.currentTarget.src = '/card-placeholder.svg';
}

function rarityTone(rarity) {
  if (rarity === 'SP') return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
  if (rarity === 'SEC') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (rarity === 'L') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (rarity === 'SR') return 'bg-violet-100 text-violet-700 border-violet-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
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
        const keyword = searchKeyword.trim().toLowerCase();
        const matchesSearch =
          !keyword || [card.name, card.cardNo, card.type, card.effect].some((value) => String(value).toLowerCase().includes(keyword));
        return matchesSeries && matchesRarity && matchesSearch;
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
  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);

  async function openCard(id) {
    const detail = await fetchCardById(id);
    setSelectedCard(detail);
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1880px] lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-[#d6cec0] bg-[#faf7f1] px-4 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-5 rounded-[28px] border border-[#eadfd1] bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#b6422e]">ONE PIECE TCG</p>
            <h1 className="mt-2 text-3xl font-black text-[#171717]">카드 아카이브</h1>
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
                  className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[#c94d35] bg-[#fff4ee] shadow-sm'
                      : 'border-[#eadfd1] bg-white hover:border-[#d4b7a7]'
                  }`}
                >
                  <div className="text-xs font-bold tracking-wide text-[#c94d35]">{series.id}</div>
                  <div className="mt-1 text-base font-extrabold text-slate-900">{series.koName}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{series.enName}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{series.kindKo}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <section className="rounded-[32px] border border-[#e4d7c7] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b6422e]">Series</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">{currentSeries?.koName}</h2>
                <div className="mt-1 text-sm text-slate-500">{currentSeries?.enName}</div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{currentSeries?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[#e7dccc] bg-[#faf7f2] px-4 py-2 text-slate-700">카드 {cards.length}장</span>
                <span className="rounded-full border border-[#f0cfbe] bg-[#fff4ee] px-4 py-2 text-[#b6422e]">시세 준비 중</span>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[32px] border border-[#e4d7c7] bg-white p-4 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">시리즈 내 카드 검색</span>
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="카드명 또는 카드번호 검색"
                  className="w-full rounded-2xl border border-[#e3d7ca] bg-[#fbfaf8] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c94d35]"
                />
              </label>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">등급 필터</div>
                <div className="flex flex-wrap gap-2">
                  {rarityOptions.map((rarity) => {
                    const active = activeRarity === rarity;
                    return (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => setActiveRarity(rarity)}
                        className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                          active
                            ? 'border-[#c94d35] bg-[#c94d35] text-white'
                            : 'border-[#e3d7ca] bg-[#fbfaf8] text-slate-700 hover:border-[#d0b39f]'
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

          <section className="mt-5 space-y-6">
            {loading ? (
              <div className="rounded-[32px] border border-[#e4d7c7] bg-white p-8 text-center text-slate-500">불러오는 중...</div>
            ) : groupedCards.length ? (
              groupedCards.map((group) => (
                <div key={group.rarity} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black text-slate-900">{group.rarity}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${rarityTone(group.rarity)}`}>{group.rarity}</span>
                    </div>
                    <span className="text-sm text-slate-500">{group.cards.length}장</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {group.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => openCard(card.id)}
                        className="overflow-hidden rounded-[26px] border border-[#e4d7c7] bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-[#d4b7a7] hover:shadow-md"
                      >
                        <div className="aspect-[5/7] overflow-hidden bg-[#f8f5f0] p-2">
                          <img
                            src={card.imageUrl || '/card-placeholder.svg'}
                            alt={card.name}
                            onError={placeholderImage}
                            className="h-full w-full object-contain [image-rendering:auto]"
                          />
                        </div>
                        <div className="space-y-2.5 border-t border-[#f0e7dc] p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold text-slate-500">{card.cardNo}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                          </div>
                          <div>
                            <div className="line-clamp-2 text-sm font-extrabold text-slate-900">{card.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{card.categoryKo}</div>
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
              <div className="rounded-[32px] border border-[#e4d7c7] bg-white p-8 text-center text-slate-500">검색 결과가 없습니다.</div>
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
    <div className={`rounded-2xl border border-[#ede3d8] bg-[#faf7f2] px-3 py-2 ${compact ? 'col-span-2' : ''}`}>
      <dt className={`font-bold uppercase tracking-[0.18em] text-slate-400 ${compactSize ? 'text-[10px]' : 'text-[11px]'}`}>{label}</dt>
      <dd className={`mt-1 break-words font-semibold text-slate-900 ${compactSize ? 'text-xs' : 'text-sm'}`}>{value}</dd>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-[#e4d7c7] bg-[#fffdf9] shadow-2xl shadow-black/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 p-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
          <div>
            <div className="overflow-hidden rounded-[24px] border border-[#ece0d4] bg-[#f8f5f0] p-2">
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
                <div className="text-sm font-bold text-[#b6422e]">{card.cardNo}</div>
                <h3 className="mt-2 text-3xl font-black text-slate-950">{card.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{card.seriesName} · {card.seriesNameEn}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#e2d5c8] bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-[#cfb29e]"
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

            <section className="rounded-[24px] border border-[#ece0d4] bg-white p-4">
              <div className="text-sm font-bold text-slate-800">효과</div>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{card.effect || '효과 정보 준비 중'}</p>
            </section>

            <section className="rounded-[24px] border border-[#ece0d4] bg-white p-4">
              <div className="text-sm font-bold text-slate-800">시세</div>
              <p className="mt-3 text-sm text-slate-500">준비 중</p>
            </section>

            <div className="flex flex-wrap gap-3">
              <a
                href={card.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-[#c94d35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b6422e]"
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
