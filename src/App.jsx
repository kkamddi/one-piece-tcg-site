import { useEffect, useMemo, useState } from 'react';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import seriesData from './data/series.json';

const DECK_SIZE = 50;
const MAX_COPIES = 4;
const rarityPriority = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const OFFICIAL_LOGO_URL = 'https://onepiece-cardgame.kr/image/logo/main_logo.png';

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
  if (rarity === 'SP') return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
  if (rarity === 'SEC') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (rarity === 'L') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (rarity === 'SR') return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-stone-50 text-stone-700 border-stone-200';
}

export default function App() {
  const [selectedSeries, setSelectedSeries] = useState(seriesData[0]?.id ?? '');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeRarity, setActiveRarity] = useState('ALL');
  const [openRaritySections, setOpenRaritySections] = useState({});
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('archive');
  const [deckEntries, setDeckEntries] = useState([]);
  const [leaderCardId, setLeaderCardId] = useState(null);
  const [ownedCardIds, setOwnedCardIds] = useState([]);

  const currentSeries = useMemo(
    () => seriesData.find((series) => series.id === selectedSeries) ?? seriesData[0],
    [selectedSeries]
  );

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('one-piece-tcg-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);

    try {
      const savedOwned = JSON.parse(window.localStorage.getItem('one-piece-tcg-owned') ?? '[]');
      if (Array.isArray(savedOwned)) setOwnedCardIds(savedOwned);
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem('one-piece-tcg-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('one-piece-tcg-owned', JSON.stringify(ownedCardIds));
  }, [ownedCardIds]);

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
        const hideBaseLeader = card.rarity === 'L' && !card.cardNo.includes('_P');
        const keyword = searchKeyword.trim().toLowerCase();
        const matchesSearch = !keyword || [card.name, card.cardNo, card.type, card.effect].some((value) => String(value).toLowerCase().includes(keyword));
        return matchesSeries && matchesRarity && matchesSearch && !hideBaseLeader;
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

  useEffect(() => {
    setOpenRaritySections({});
  }, [selectedSeries, searchKeyword, activeRarity]);

  const groupedCards = useMemo(() => groupByRarity(cards), [cards]);
  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);
  const isDark = theme === 'dark';
  const ownedSet = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);
  const ownedInSeries = useMemo(() => cards.filter((card) => ownedSet.has(card.id)).length, [cards, ownedSet]);

  const deckCards = useMemo(
    () => [...deckEntries].sort((a, b) => (a.categoryKo === '리더' ? -1 : b.categoryKo === '리더' ? 1 : b.count - a.count)),
    [deckEntries]
  );
  const deckCount = useMemo(() => deckEntries.filter((entry) => entry.categoryKo !== '리더').reduce((sum, entry) => sum + entry.count, 0), [deckEntries]);
  const leaderCard = useMemo(() => deckEntries.find((entry) => entry.id === leaderCardId) ?? null, [deckEntries, leaderCardId]);

  async function openCard(id) {
    const detail = await fetchCardById(id);
    setSelectedCard(detail);
  }

  function addToDeck(card) {
    if (card.categoryKo === '리더') {
      setLeaderCardId(card.id);
      setDeckEntries((prev) => {
        const withoutOldLeader = prev.filter((entry) => entry.categoryKo !== '리더');
        const exists = withoutOldLeader.find((entry) => entry.id === card.id);
        return exists ? [{ ...exists, count: 1 }, ...withoutOldLeader.filter((entry) => entry.id !== card.id)] : [{ ...card, count: 1 }, ...withoutOldLeader];
      });
      return;
    }

    setDeckEntries((prev) => {
      const existing = prev.find((entry) => entry.id === card.id);
      if (existing) {
        if (existing.count >= MAX_COPIES) return prev;
        return prev.map((entry) => (entry.id === card.id ? { ...entry, count: entry.count + 1 } : entry));
      }
      return [...prev, { ...card, count: 1 }];
    });
  }

  function changeDeckCount(cardId, nextCount) {
    if (nextCount <= 0) {
      setDeckEntries((prev) => prev.filter((entry) => entry.id !== cardId));
      if (leaderCardId === cardId) setLeaderCardId(null);
      return;
    }

    setDeckEntries((prev) => prev.map((entry) => (entry.id === cardId ? { ...entry, count: entry.categoryKo === '리더' ? 1 : Math.min(MAX_COPIES, nextCount) } : entry)));
  }

  function clearDeck() {
    setDeckEntries([]);
    setLeaderCardId(null);
  }

  function toggleOwned(cardId) {
    setOwnedCardIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }

  const shellClass = isDark ? 'bg-[#161514] text-stone-100' : 'bg-[#f3efe7] text-stone-900';
  const panelClass = isDark ? 'border-[#34312e] bg-[#211f1d]' : 'border-[#d9d0c2] bg-[#fbf8f2]';
  const cardClass = isDark ? 'border-[#34312e] bg-[#1a1918]' : 'border-[#e2d9cc] bg-white';
  const subtleClass = isDark ? 'bg-[#191817] border-[#2e2b29]' : 'bg-[#f7f3ed] border-[#e7ddcf]';
  const textMuted = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen ${shellClass}`}>
        <div className="mx-auto max-w-[1880px] px-4 py-5 sm:px-6 lg:px-8">
          <header className={`mb-5 border ${panelClass} rounded-2xl p-4`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <img src={OFFICIAL_LOGO_URL} alt="ONE PIECE CARD GAME" className={`h-14 w-auto object-contain ${isDark ? 'brightness-0 invert' : ''}`} onError={placeholderImage} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#b6422e]">One Piece TCG Archive</div>
                  <div className={`mt-1 text-sm ${textMuted}`}>시리즈별 카드 도감 · 수집표 · 덱 시뮬레이터</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} className={`rounded-full border px-4 py-2 text-sm font-semibold ${subtleClass}`}>
                  {isDark ? '라이트모드' : '다크모드'}
                </button>
                <ModeButton active={viewMode === 'archive'} onClick={() => setViewMode('archive')} label="도감" />
                <ModeButton active={viewMode === 'collection'} onClick={() => setViewMode('collection')} label="수집표" />
                <ModeButton active={viewMode === 'deck'} onClick={() => setViewMode('deck')} label="덱" />
              </div>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className={`border ${panelClass} rounded-2xl p-3`}>
              <div className={`mb-3 border ${subtleClass} rounded-xl px-4 py-3`}>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6422e]">Series</div>
              </div>
              <div className="space-y-2">
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
                      className={`w-full rounded-xl border px-4 py-3 text-left ${active ? 'border-[#c94d35] bg-[#f7ede5] text-stone-900' : `${cardClass}`}`}
                    >
                      <div className="text-xs font-bold tracking-wide text-[#c94d35]">{series.id}</div>
                      <div className={`mt-1 text-[15px] font-extrabold ${isDark && !active ? 'text-white' : 'text-stone-900'}`}>{series.koName}</div>
                      <div className={`mt-1 text-[11px] ${textMuted}`}>{series.enName}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-5">
              <section className={`border ${panelClass} rounded-2xl p-5`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#b6422e]">{currentSeries?.id}</div>
                    <h1 className={`mt-2 text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>{currentSeries?.koName}</h1>
                    <div className={`mt-1 text-sm ${textMuted}`}>{currentSeries?.enName}</div>
                    <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>{currentSeries?.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Metric label="표시 카드" value={`${cards.length}장`} subtleClass={subtleClass} />
                    <Metric label="수집" value={`${ownedInSeries}/${cards.length}`} subtleClass={subtleClass} />
                    {viewMode === 'deck' ? <Metric label="덱" value={`${deckCount}/${DECK_SIZE}`} subtleClass={deckCount > DECK_SIZE ? 'border-red-300 bg-red-50 text-red-700' : subtleClass} /> : null}
                  </div>
                </div>
              </section>

              <section className={`border ${panelClass} rounded-2xl p-4`}>
                <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                  <label className="block">
                    <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>카드 찾기</div>
                    <input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder="카드명 또는 카드번호 검색"
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`}
                    />
                  </label>
                  <div>
                    <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>등급</div>
                    <div className="flex flex-wrap gap-2">
                      {rarityOptions.map((rarity) => (
                        <ModeButton key={rarity} active={activeRarity === rarity} onClick={() => setActiveRarity(rarity)} label={rarity} compact />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {viewMode === 'archive' ? (
                <section className="space-y-5">
                  {loading ? (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>불러오는 중...</div>
                  ) : groupedCards.length ? (
                    groupedCards.map((group) => {
                      const defaultOpen = !['UC', 'C'].includes(group.rarity);
                      const isOpen = activeRarity === group.rarity ? true : (openRaritySections[group.rarity] ?? defaultOpen);

                      return (
                        <div key={group.rarity} className="space-y-3">
                          <button type="button" onClick={() => setOpenRaritySections((prev) => ({ ...prev, [group.rarity]: !isOpen }))} className={`flex w-full items-center justify-between border ${panelClass} rounded-xl px-4 py-3 text-left`}>
                            <div className="flex items-center gap-3">
                              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{group.rarity}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${rarityTone(group.rarity)}`}>{group.rarity}</span>
                              {['UC', 'C'].includes(group.rarity) ? <span className={`text-xs ${textMuted}`}>기본 숨김</span> : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm ${textMuted}`}>{group.cards.length}장</span>
                              <span className={textMuted}>{isOpen ? '−' : '+'}</span>
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                              {group.cards.map((card) => (
                                <button key={card.id} type="button" onClick={() => openCard(card.id)} className={`overflow-hidden border ${cardClass} rounded-xl text-left transition hover:-translate-y-0.5`}>
                                  <div className={`relative aspect-[5/7] overflow-hidden p-2 ${isDark ? 'bg-[#111111]' : 'bg-[#f6f1e9]'}`}>
                                    <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="h-full w-full object-contain [image-rendering:auto]" />
                                    {ownedSet.has(card.id) ? <div className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">보유</div> : null}
                                  </div>
                                  <div className={`space-y-2 border-t p-3 ${isDark ? 'border-[#333333]' : 'border-[#eee5d8]'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`text-[11px] font-bold ${textMuted}`}>{card.cardNo}</span>
                                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                                    </div>
                                    <div className={`line-clamp-2 text-sm font-extrabold ${isDark ? 'text-white' : 'text-stone-900'}`}>{card.name}</div>
                                    <div className={`text-[11px] ${textMuted}`}>{card.categoryKo}</div>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <button type="button" onClick={(event) => { event.stopPropagation(); addToDeck(card); }} className="rounded-full bg-[#c94d35] px-3 py-1.5 text-xs font-bold text-white">덱 추가</button>
                                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleOwned(card.id); }} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${ownedSet.has(card.id) ? 'border-emerald-600 bg-emerald-600 text-white' : subtleClass}`}>
                                        {ownedSet.has(card.id) ? '보유중' : '체크'}
                                      </button>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>검색 결과가 없습니다.</div>
                  )}
                </section>
              ) : viewMode === 'collection' ? (
                <section className="space-y-4">
                  <div className={`border ${panelClass} rounded-2xl p-5`}>
                    <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>수집 도감</h3>
                    <p className={`mt-1 text-sm ${textMuted}`}>카드를 눌러 보유 여부를 체크하면 도감처럼 관리할 수 있어.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {cards.map((card) => {
                      const owned = ownedSet.has(card.id);
                      return (
                        <button key={card.id} type="button" onClick={() => toggleOwned(card.id)} className={`overflow-hidden border ${cardClass} rounded-xl text-left ${owned ? 'ring-1 ring-emerald-500' : ''}`}>
                          <div className={`relative aspect-[5/7] overflow-hidden p-2 ${isDark ? 'bg-[#111111]' : 'bg-[#f6f1e9]'}`}>
                            <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className={`h-full w-full object-contain [image-rendering:auto] ${owned ? '' : 'opacity-65 grayscale-[0.15]'}`} />
                            <div className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${owned ? 'bg-emerald-600 text-white' : 'bg-black/55 text-white'}`}>{owned ? 'CHECK' : 'EMPTY'}</div>
                          </div>
                          <div className={`space-y-2 border-t p-3 ${isDark ? 'border-[#333333]' : 'border-[#eee5d8]'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] font-bold ${textMuted}`}>{card.cardNo}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                            </div>
                            <div className={`line-clamp-2 text-sm font-extrabold ${isDark ? 'text-white' : 'text-stone-900'}`}>{card.name}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className={`border ${panelClass} rounded-2xl p-5`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>덱 시뮬레이터</h3>
                        <p className={`mt-1 text-sm ${textMuted}`}>리더 1장 / 메인 덱 50장 / 동일 카드 최대 4장</p>
                      </div>
                      <button type="button" onClick={clearDeck} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>초기화</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cards.slice(0, 60).map((card) => (
                        <div key={card.id} className={`border ${subtleClass} rounded-xl p-3`}>
                          <div className="flex gap-3">
                            <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="h-24 w-16 rounded-lg object-contain" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-extrabold">{card.name}</div>
                              <div className={`mt-1 text-[11px] ${textMuted}`}>{card.cardNo}</div>
                              <div className={`mt-1 text-[11px] ${textMuted}`}>{card.categoryKo} · {card.rarity}</div>
                              <button type="button" onClick={() => addToDeck(card)} className="mt-3 rounded-full bg-[#c94d35] px-3 py-1.5 text-xs font-bold text-white">{card.categoryKo === '리더' ? '리더 지정' : '덱 추가'}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`border ${panelClass} rounded-2xl p-5`}>
                    <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>내 덱</h3>
                    <div className="mt-4 space-y-3">
                      <div className={`border ${subtleClass} rounded-xl p-4`}>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#b6422e]">Leader</div>
                        <div className={`mt-2 text-sm font-bold ${leaderCard ? '' : textMuted}`}>{leaderCard ? leaderCard.name : '리더를 지정해줘'}</div>
                      </div>
                      <div className={`border ${subtleClass} rounded-xl p-4`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">메인 덱</span>
                          <span className={`text-sm font-black ${deckCount > DECK_SIZE ? 'text-red-500' : ''}`}>{deckCount}/{DECK_SIZE}</span>
                        </div>
                      </div>
                      <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                        {deckCards.length ? deckCards.map((entry) => (
                          <div key={entry.id} className={`border ${subtleClass} rounded-xl p-3`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold">{entry.name}</div>
                                <div className={`mt-1 text-[11px] ${textMuted}`}>{entry.cardNo} · {entry.rarity}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {entry.categoryKo === '리더' ? (
                                  <button type="button" onClick={() => changeDeckCount(entry.id, 0)} className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700">해제</button>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => changeDeckCount(entry.id, entry.count - 1)} className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700">-</button>
                                    <span className="w-6 text-center text-sm font-black">{entry.count}</span>
                                    <button type="button" onClick={() => changeDeckCount(entry.id, entry.count + 1)} className="rounded-full bg-[#c94d35] px-2.5 py-1 text-xs font-bold text-white">+</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )) : <div className={`border ${subtleClass} rounded-xl p-5 text-center ${textMuted}`}>아직 덱에 담긴 카드가 없어.</div>}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>

        {selectedCard ? <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} dark={isDark} /> : null}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, label, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border py-2 text-sm font-semibold ${compact ? 'px-3.5' : 'px-4'} ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : 'border-[#d8cebf] bg-[#f7f3ed] text-stone-700'}`}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, subtleClass }) {
  return <span className={`rounded-full border px-4 py-2 ${subtleClass}`}><strong className="mr-2">{label}</strong>{value}</span>;
}

function Stat({ label, value, compact = false, compactSize = false, dark = false }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${compact ? 'col-span-2' : ''} ${dark ? 'border-[#303030] bg-[#1b1b1b]' : 'border-[#ede3d8] bg-[#faf7f2]'}`}>
      <dt className={`font-bold uppercase tracking-[0.18em] ${compactSize ? 'text-[10px]' : 'text-[11px]'} ${dark ? 'text-stone-500' : 'text-stone-400'}`}>{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${compactSize ? 'text-xs' : 'text-sm'} ${dark ? 'text-stone-100' : 'text-stone-900'}`}>{value}</dd>
    </div>
  );
}

function CardModal({ card, onClose, dark }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border shadow-2xl ${dark ? 'border-[#363636] bg-[#202020]' : 'border-[#e4d7c7] bg-[#fffdf9]'}`} onClick={(event) => event.stopPropagation()}>
        <div className="grid gap-6 p-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-7">
          <div>
            <div className={`overflow-hidden rounded-xl border p-2 ${dark ? 'border-[#333333] bg-[#111111]' : 'border-[#ece0d4] bg-[#f8f5f0]'}`}>
              <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="aspect-[5/7] h-full w-full object-contain [image-rendering:auto]" />
            </div>
          </div>
          <div className="space-y-5">
            <div className={`rounded-xl border p-5 ${dark ? 'border-[#333333] bg-[#1b1b1b]' : 'border-[#ece0d4] bg-[#fff9f4]'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#b6422e]">{card.cardNo}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                    {card.originSeries && card.originSeries !== card.series ? <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${dark ? 'border-[#444] bg-[#2a2a2a] text-stone-300' : 'border-[#e7dccc] bg-[#faf7f2] text-stone-600'}`}>원본 {card.originSeries}</span> : null}
                  </div>
                  <h3 className={`mt-3 text-3xl font-black ${dark ? 'text-white' : 'text-stone-950'}`}>{card.name}</h3>
                  <p className={`mt-2 text-sm ${dark ? 'text-stone-300' : 'text-stone-500'}`}>현재 표시 시리즈: {card.seriesName} · {card.seriesNameEn}</p>
                  {card.originSeries && card.originSeries !== card.series ? <p className={`mt-1 text-sm ${dark ? 'text-stone-400' : 'text-stone-400'}`}>원본 카드 계열: {card.originSeriesName} · {card.originSeriesNameEn}</p> : null}
                </div>
                <button type="button" onClick={onClose} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${dark ? 'border-[#444] bg-[#262626] text-stone-200' : 'border-[#e2d5c8] bg-white text-stone-600'}`}>닫기</button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="등급" value={card.rarity} dark={dark} />
              <Stat label="종류" value={card.categoryKo} dark={dark} />
              <Stat label="색상" value={card.colorKo} dark={dark} />
              <Stat label="비용" value={card.cost} dark={dark} />
              <Stat label="파워" value={card.power} dark={dark} />
              <Stat label="카운터" value={card.counter} dark={dark} />
              <Stat label="속성" value={card.attributeKo} dark={dark} />
              <Stat label="타입" value={card.type} compact dark={dark} />
            </div>
            <section className={`rounded-xl border p-4 ${dark ? 'border-[#333333] bg-[#1b1b1b]' : 'border-[#ece0d4] bg-white'}`}>
              <div className={`text-sm font-bold ${dark ? 'text-stone-100' : 'text-stone-800'}`}>효과</div>
              <p className={`mt-3 whitespace-pre-line text-sm leading-7 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>{card.effect || '효과 정보 준비 중'}</p>
            </section>
            <div className="flex flex-wrap gap-3">
              <a href={card.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full bg-[#c94d35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b6422e]">공식 정보 보기</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
