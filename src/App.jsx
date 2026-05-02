import { useEffect, useMemo, useState } from 'react';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import { fetchShopRegions, fetchShops } from './api/shops';
import cardsData from './data/cards.json';
import seriesData from './data/series.json';
import shopsData from './data/shops.json';

const DECK_SIZE = 50;
const MAX_COPIES = 4;
const rarityPriority = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const OFFICIAL_LOGO_URL = 'https://onepiece-cardgame.kr/image/logo/main_logo.png';
const SHOP_TYPES = [
  { id: 'general', label: '공식 취급 점포', pageUrl: 'https://onepiece-cardgame.kr/shoplist.do' },
  { id: 'official', label: '공인/공식 점포', pageUrl: 'https://onepiece-cardgame.kr/officialshoplist.do' }
];

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
  const [viewMode, setViewMode] = useState('home');
  const [deckEntries, setDeckEntries] = useState([]);
  const [leaderCardId, setLeaderCardId] = useState(null);
  const [ownedCardIds, setOwnedCardIds] = useState([]);
  const [shopType, setShopType] = useState('general');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [selectedGungu, setSelectedGungu] = useState('전체');
  const [shopSearchKeyword, setShopSearchKeyword] = useState('');
  const [shops, setShops] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopRegions, setShopRegions] = useState({ sidos: [], gungus: [] });

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

  useEffect(() => {
    let alive = true;

    const loadRegions = async () => {
      const next = await fetchShopRegions(shopType, selectedRegion === '전체' ? '' : selectedRegion);
      if (!alive) return;
      setShopRegions(next);
      if (selectedRegion !== '전체' && selectedGungu !== '전체' && !next.gungus.includes(selectedGungu)) {
        setSelectedGungu('전체');
      }
    };

    loadRegions();
    return () => {
      alive = false;
    };
  }, [shopType, selectedRegion, selectedGungu]);

  useEffect(() => {
    let alive = true;
    setShopLoading(true);

    const loadShops = async () => {
      const next = await fetchShops({
        type: shopType,
        sido: selectedRegion === '전체' ? '' : selectedRegion,
        gungu: selectedGungu === '전체' ? '' : selectedGungu,
        q: shopSearchKeyword.trim()
      });

      if (alive) {
        setShops(next);
        setShopLoading(false);
      }
    };

    loadShops();
    return () => {
      alive = false;
    };
  }, [shopType, selectedRegion, selectedGungu, shopSearchKeyword]);

  const groupedCards = useMemo(() => groupByRarity(cards), [cards]);
  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cards)], [cards]);
  const isDark = theme === 'dark';
  const ownedSet = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);
  const ownedInSeries = useMemo(() => cards.filter((card) => ownedSet.has(card.id)).length, [cards, ownedSet]);

  const deckCards = useMemo(
    () => [...deckEntries].sort((a, b) => (a.categoryKo === '리더' ? -1 : b.categoryKo === '리더' ? 1 : b.count - a.count)),
    [deckEntries]
  );
  const activeShopType = useMemo(() => SHOP_TYPES.find((item) => item.id === shopType) ?? SHOP_TYPES[0], [shopType]);
  const deckCount = useMemo(() => deckEntries.filter((entry) => entry.categoryKo !== '리더').reduce((sum, entry) => sum + entry.count, 0), [deckEntries]);
  const leaderCard = useMemo(() => deckEntries.find((entry) => entry.id === leaderCardId) ?? null, [deckEntries, leaderCardId]);
  const homeFeaturedSeries = useMemo(() => seriesData.slice(0, 6), []);
  const homeFeaturedCards = useMemo(
    () => cardsData.filter((card) => ['SP', 'SEC', 'L', 'SR'].includes(card.rarity)).slice(0, 8),
    []
  );
  const homeOwnedCount = useMemo(() => cardsData.filter((card) => ownedSet.has(card.id)).length, [ownedSet]);
  const homeShopCounts = useMemo(
    () => ({
      general: shopsData.filter((shop) => shop.sourceType === 'general').length,
      official: shopsData.filter((shop) => shop.sourceType === 'official').length
    }),
    []
  );

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

  function openSeriesArchive(seriesId) {
    setSelectedSeries(seriesId);
    setSearchKeyword('');
    setActiveRarity('ALL');
    setViewMode('archive');
  }

  const shellClass = isDark ? 'bg-[#161514] text-stone-100' : 'bg-[#f3efe7] text-stone-900';
  const panelClass = isDark ? 'border-[#34312e] bg-[#211f1d]' : 'border-[#d9d0c2] bg-[#fbf8f2]';
  const cardClass = isDark ? 'border-[#34312e] bg-[#1a1918]' : 'border-[#e2d9cc] bg-white';
  const subtleClass = isDark ? 'bg-[#191817] border-[#2e2b29] text-stone-200' : 'bg-[#f7f3ed] border-[#e7ddcf] text-stone-900';
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
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} className={`rounded-full border px-4 py-2 text-sm font-semibold ${subtleClass}`}>
                  {isDark ? '라이트모드' : '다크모드'}
                </button>
              </div>
            </div>
          </header>

          <div className="mb-5 flex flex-wrap gap-2">
            <TopTab active={viewMode === 'home'} onClick={() => setViewMode('home')} label="메인" />
            <TopTab active={viewMode === 'archive'} onClick={() => setViewMode('archive')} label="카드 도감" />
            <TopTab active={viewMode === 'collection'} onClick={() => setViewMode('collection')} label="수집표" />
            <TopTab active={viewMode === 'deck'} onClick={() => setViewMode('deck')} label="덱 시뮬레이터" />
            <TopTab active={viewMode === 'shops'} onClick={() => setViewMode('shops')} label="오프라인 구매처" />
          </div>

          <div className={`grid gap-5 ${viewMode === 'home' ? 'xl:grid-cols-1' : 'xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
            {viewMode === 'home' ? null : <aside className={`border ${panelClass} rounded-2xl p-3`}>
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
                      onClick={() => openSeriesArchive(series.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${active ? 'border-[#c94d35] bg-[#f7ede5] text-stone-900' : `${cardClass}`}`}
                    >
                      <div className="text-xs font-bold tracking-wide text-[#c94d35]">{series.id}</div>
                      <div className={`mt-1 text-[15px] font-extrabold ${isDark && !active ? 'text-white' : 'text-stone-900'}`}>{series.koName}</div>
                      <div className={`mt-1 text-[11px] ${textMuted}`}>{series.enName}</div>
                    </button>
                  );
                })}
              </div>
            </aside>}

            <main className="space-y-5">
              <section className={`border ${panelClass} rounded-2xl p-5`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    {viewMode === 'home' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>원피스 TCG 도감</h1>
                        <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>도감, 수집표, 덱, 오프라인 구매처까지 한 번에 바로 들어갈 수 있는 시작 화면으로 바꿔봤어.</p>
                      </>
                    ) : viewMode === 'shops' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>오프라인 구매처</h1>
                        <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>공식 사이트 점포 데이터를 내부 API로 가져와서 지역별로 바로 볼 수 있게 바꿔뒀어.</p>
                      </>
                    ) : (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>{currentSeries?.koName}</h1>
                        <div className={`mt-1 text-sm ${textMuted}`}>{currentSeries?.enName}</div>
                        <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>{currentSeries?.description}</p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {viewMode === 'home' ? (
                      <>
                        <Metric label="전체 카드" value={`${cardsData.length}장`} className={subtleClass} />
                        <Metric label="시리즈" value={`${seriesData.length}개`} className={subtleClass} />
                        <Metric label="내 수집" value={`${homeOwnedCount}장`} className={subtleClass} />
                      </>
                    ) : viewMode === 'shops' ? (
                      <>
                        <Metric label="표시 매장" value={`${shops.length}곳`} className={subtleClass} />
                        <Metric label="구분" value={activeShopType.label} className={subtleClass} />
                        <Metric label="지역" value={selectedRegion === '전체' ? '전국' : selectedRegion} className={subtleClass} />
                      </>
                    ) : (
                      <>
                        <Metric label="표시 카드" value={`${cards.length}장`} className={subtleClass} />
                        <Metric label="수집" value={`${ownedInSeries}/${cards.length}`} className={subtleClass} />
                        {viewMode === 'deck' ? <Metric label="덱" value={`${deckCount}/${DECK_SIZE}`} className={deckCount > DECK_SIZE ? 'border-red-300 bg-red-50 text-red-700' : subtleClass} /> : null}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {viewMode !== 'shops' && viewMode !== 'home' ? (
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
                          <ModeChip key={rarity} active={activeRarity === rarity} onClick={() => setActiveRarity(rarity)} label={rarity} />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {viewMode === 'home' ? (
                <section className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className={`border ${panelClass} rounded-2xl p-5`}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => setViewMode('archive')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">카드 도감</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>시리즈별 카드 바로 보기</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('collection')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">수집표</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>보유 카드 체크하기</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('deck')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">덱 시뮬레이터</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>리더와 메인 덱 구성</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('shops')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">오프라인 구매처</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>공식 점포 바로 찾기</div>
                        </button>
                      </div>
                    </div>
                    <div className={`border ${panelClass} rounded-2xl p-5`}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>수집 진행</div>
                          <div className="mt-2 text-2xl font-black">{homeOwnedCount} / {cardsData.length}</div>
                        </div>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>현재 덱</div>
                          <div className="mt-2 text-2xl font-black">{deckCount} / {DECK_SIZE}</div>
                        </div>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>공식 점포</div>
                          <div className="mt-2 text-2xl font-black">{homeShopCounts.official}곳</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-1">
                    <div className={`border ${panelClass} rounded-2xl p-5`}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <button type="button" onClick={() => { setShopType('official'); setSelectedRegion('서울특별시'); setSelectedGungu('전체'); setViewMode('shops'); }} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-sm font-black">서울 공식 점포 보기</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>공인/공식 점포 중심</div>
                        </button>
                        <button type="button" onClick={() => { setShopType('general'); setSelectedRegion('경기도'); setSelectedGungu('전체'); setViewMode('shops'); }} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-sm font-black">경기 취급 점포 보기</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>일반 취급 매장 중심</div>
                        </button>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>취급 점포 {homeShopCounts.general}곳 · 공인/공식 점포 {homeShopCounts.official}곳</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`border ${panelClass} rounded-2xl p-5`}>
                    <div className="mb-4 flex justify-end">
                      <button type="button" onClick={() => setViewMode('archive')} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>전체 도감 보기</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                      {homeFeaturedCards.map((card) => (
                        <button key={card.id} type="button" onClick={() => openCard(card.id)} className={`overflow-hidden rounded-xl border text-left ${cardClass}`}>
                          <div className={`aspect-[5/7] overflow-hidden p-2 ${isDark ? 'bg-[#111111]' : 'bg-[#f6f1e9]'}`}>
                            <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="h-full w-full object-contain" />
                          </div>
                          <div className={`border-t p-3 ${isDark ? 'border-[#333333]' : 'border-[#eee5d8]'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] font-bold ${textMuted}`}>{card.cardNo}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                            </div>
                            <div className="mt-2 line-clamp-2 text-sm font-extrabold">{card.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : viewMode === 'archive' ? (
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
              ) : viewMode === 'deck' ? (
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
              ) : (
                <section className="space-y-4">
                  <div className={`border ${panelClass} rounded-2xl p-4`}>
                    <div className="flex flex-wrap gap-2">
                      {SHOP_TYPES.map((type) => (
                        <ModeChip
                          key={type.id}
                          active={shopType === type.id}
                          onClick={() => {
                            setShopType(type.id);
                            setSelectedRegion('전체');
                            setSelectedGungu('전체');
                            setShopSearchKeyword('');
                          }}
                          label={type.label}
                        />
                      ))}
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
                      <label className="block">
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>매장명/주소 검색</div>
                        <input
                          value={shopSearchKeyword}
                          onChange={(event) => setShopSearchKeyword(event.target.value)}
                          placeholder="매장명 또는 주소 검색"
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`}
                        />
                      </label>
                      <label className="block">
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>시/도</div>
                        <select
                          value={selectedRegion}
                          onChange={(event) => {
                            setSelectedRegion(event.target.value);
                            setSelectedGungu('전체');
                          }}
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} focus:border-[#c94d35]`}
                        >
                          <option value="전체">전체</option>
                          {shopRegions.sidos.map((region) => (
                            <option key={region} value={region}>{region}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>군/구</div>
                        <select
                          value={selectedGungu}
                          onChange={(event) => setSelectedGungu(event.target.value)}
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} focus:border-[#c94d35]`}
                        >
                          <option value="전체">전체</option>
                          {shopRegions.gungus.map((gungu) => (
                            <option key={gungu} value={gungu}>{gungu}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={`border ${panelClass} rounded-2xl p-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className={`text-sm ${textMuted}`}>공식 API 기준 동기화 결과를 바로 보여줘.</div>
                      <a href={activeShopType.pageUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">공식 페이지 열기</a>
                    </div>
                  </div>

                  {shopLoading ? (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>매장 목록 불러오는 중...</div>
                  ) : shops.length ? (
                    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      {shops.map((shop) => (
                        <article key={shop.id} className={`border ${cardClass} rounded-xl p-5`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6422e]">{shop.sourceLabel}</div>
                              <h4 className={`mt-2 text-lg font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{shop.name}</h4>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${subtleClass}`}>{shop.sido}</span>
                          </div>
                          <div className={`mt-3 text-sm leading-6 ${textMuted}`}>{shop.address}</div>
                          <div className={`mt-4 flex flex-wrap gap-2 text-xs ${textMuted}`}>
                            <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>{shop.gungu || '군/구 정보 없음'}</span>
                            {shop.lat && shop.lng ? <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>지도 좌표 있음</span> : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {shop.lat && shop.lng ? (
                              <a
                                href={`https://map.kakao.com/link/map/${encodeURIComponent(shop.name)},${shop.lat},${shop.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex rounded-full border border-[#d8cebf] bg-[#f7f3ed] px-4 py-2 text-sm font-bold text-stone-700"
                              >
                                지도 보기
                              </a>
                            ) : null}
                            <a href={shop.officialPageUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">공식 원문</a>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>조건에 맞는 매장이 없어.</div>
                  )}
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

function TopTab({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-bold transition ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : 'border-[#d8cebf] bg-[#f7f3ed] text-stone-700 hover:border-[#cbbba8]'}`}
    >
      {label}
    </button>
  );
}

function ModeChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : 'border-[#d8cebf] bg-[#f7f3ed] text-stone-700'}`}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, className }) {
  return <span className={`rounded-full border px-4 py-2 ${className}`}><strong className="mr-2">{label}</strong>{value}</span>;
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
