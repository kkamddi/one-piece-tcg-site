import { useEffect, useMemo, useState } from 'react';
import { fetchAdminStats, trackVisit } from './api/admin';
import { checkAuthAvailability, resolveLoginEmail, signupWithProfile } from './api/auth';
import { fetchMyState, saveMyState } from './api/me';
import { fetchCardById, fetchCards, searchCards } from './api/cards';
import { addCommunityComment, createCommunityPost, deleteCommunityPost as deleteCommunityPostRequest, fetchCommunityComments, fetchCommunityPosts, incrementCommunityPostView, toggleCommunityPostLike, updateCommunityPost as updateCommunityPostRequest } from './api/community';
import { hasSupabaseAuthConfig, supabase } from './lib/supabase';
import { fetchShopRegions, fetchShops } from './api/shops';
import cardsData from './data/cards.json';
import seriesData from './data/series.json';
import shopsData from './data/shops.json';

const DECK_SIZE = 50;
const MAX_COPIES = 4;
const DECK_PAGE_SIZE = 24;
const LAB_PACK_SIZE = 6;
const GUEST_OWNED_KEY = 'one-piece-tcg-owned';
const COMMUNITY_NICKNAME_KEY = 'one-piece-tcg-community-nickname';
const COMMUNITY_AUTHOR_TOKEN_KEY = 'one-piece-tcg-community-author-token';
const VISITOR_TOKEN_KEY = 'one-piece-tcg-visitor-token';
const rarityPriority = ['SP', 'SEC', 'L', 'SR', 'R', 'UC', 'C', 'P'];
const OFFICIAL_LOGO_URL = 'https://onepiece-cardgame.kr/image/logo/main_logo.png';
const DONATION_URL = 'https://acoffee.shop/d/573d0164-c9c5-45e7-84ce-ed432026517c';
const SHOP_TYPES = [
  { id: 'general', label: '공식 취급 점포', pageUrl: 'https://onepiece-cardgame.kr/shoplist.do' },
  { id: 'official', label: '공인/공식 점포', pageUrl: 'https://onepiece-cardgame.kr/officialshoplist.do' }
];
const LAB_BASE_RARITY_WEIGHTS = { C: 40, UC: 26, R: 16, SR: 8, SEC: 4, SP: 3, L: 2, P: 1 };
const LAB_RARE_RARITY_WEIGHTS = { R: 46, SR: 24, SEC: 12, SP: 9, L: 6, P: 3 };
const COMMUNITY_BOARDS = [
  { id: 'free', label: '자유게시판', description: '잡담, 질문, 후기, 소소한 이야기' },
  { id: 'feedback', label: '피드백', description: '사이트 개선점, 오류 제보, 건의사항' },
  { id: 'showoff', label: '카드자랑', description: '희귀 카드, 사인 카드, 수집 자랑용 게시판' },
  { id: 'deck-talk', label: '덱 상담', description: '준비 중', disabled: true }
];
const SIDEBAR_CATEGORIES = [
  { id: 'regular-booster', label: '정규 부스터' },
  { id: 'extra-premium', label: '엑스트라 / 프리미엄' },
  { id: 'starter-deck', label: '스타터덱' },
  { id: 'promo-line', label: '프로모' },
  { id: 'flagship-line', label: '플래그십' },
  { id: 'championship-line', label: '챔피언십 / 시리얼' }
];

function getSeriesCategory(seriesId) {
  if (/^OP\d+/.test(seriesId)) return 'regular-booster';
  if (/^(EB|PRB)\d+/.test(seriesId)) return 'extra-premium';
  if (/^ST\d+/.test(seriesId)) return 'starter-deck';
  if (/^P/.test(seriesId)) return 'promo-line';
  return 'regular-booster';
}

function getDisplaySeriesCode(series) {
  const match = series?.queryLabel?.match(/^\[([^\]]+)\]/);
  return match?.[1] ?? series?.id ?? '';
}

function sortDescByCode(items) {
  return [...items].sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));
}

function normalizeMultiValue(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function matchesMultiValue(cardValue, selectedValue) {
  if (selectedValue === 'ALL') return true;
  return normalizeMultiValue(cardValue).includes(selectedValue);
}

function getFriendlyAuthErrorMessage(error, mode = 'login') {
  const rawMessage = String(error?.message ?? '').trim();
  if (mode === 'login') {
    if (
      rawMessage === 'not_found'
      || rawMessage === 'invalid_credentials'
      || /invalid login credentials/i.test(rawMessage)
      || rawMessage.includes('아이디 또는 비밀번호가 잘못되었습니다')
    ) {
      return '아이디 또는 비밀번호가 잘못되었습니다. 입력한 정보를 다시 확인해 주세요.';
    }
  }

  if (rawMessage === 'email_taken') return '이미 사용 중인 이메일입니다.';
  if (rawMessage === 'username_taken') return '이미 사용 중인 아이디입니다.';
  if (rawMessage === 'nickname_taken') return '이미 사용 중인 닉네임입니다.';

  return rawMessage || '인증 처리에 실패했어.';
}

function buildSidebarSections() {
  const regular = sortDescByCode(seriesData.filter((series) => /^OP\d+/.test(series.id)));
  const extraPremium = sortDescByCode(seriesData.filter((series) => /^(EB|PRB)\d+/.test(series.id)));
  const starter = sortDescByCode(seriesData.filter((series) => /^ST\d+/.test(series.id)));
  const promo = seriesData.filter((series) => series.id === 'PROMO');

  return [
    { id: 'regular-booster', label: '정규 부스터', children: regular },
    { id: 'extra-premium', label: '엑스트라 / 프리미엄', children: extraPremium },
    { id: 'starter-deck', label: '스타터덱', children: starter },
    {
      id: 'promo-line',
      label: '프로모',
      children: [
        ...promo,
        { id: 'promo-p', koName: 'P Promo', enName: 'Promo', disabled: true },
        { id: 'promo-magazine', koName: 'Magazine Promo', enName: 'Promo', disabled: true },
        { id: 'promo-store', koName: 'Store Tournament', enName: 'Promo', disabled: true },
        { id: 'promo-prerelease', koName: 'Pre-Release', enName: 'Promo', disabled: true },
        { id: 'promo-event', koName: 'Event Pack', enName: 'Promo', disabled: true },
        { id: 'promo-special', koName: 'Anniversary / Special Goods', enName: 'Promo', disabled: true }
      ]
    },
    {
      id: 'flagship-line',
      label: '플래그십',
      children: [
        { id: 'flagship-participation', koName: 'Participation', enName: 'Flagship', disabled: true },
        { id: 'flagship-topcut', koName: 'Top Cut', enName: 'Flagship', disabled: true },
        { id: 'flagship-winner', koName: 'Winner', enName: 'Flagship', disabled: true }
      ]
    },
    {
      id: 'championship-line',
      label: '챔피언십 / 시리얼',
      children: [
        { id: 'championship-main', koName: 'Championship', enName: 'Championship', disabled: true },
        { id: 'championship-serial', koName: 'Serial Numbered', enName: 'Championship', disabled: true },
        { id: 'championship-winner', koName: 'Winner Prize', enName: 'Championship', disabled: true }
      ]
    }
  ];
}

function getDefaultSeriesId() {
  const sections = buildSidebarSections();
  for (const section of sections) {
    const firstSeries = section.children.find((series) => !series.disabled && series.id);
    if (firstSeries) return firstSeries.id;
  }
  return seriesData[0]?.id ?? '';
}

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

function formatCommunityDate(value) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function shuffleArray(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickWeightedRarity(pool, weights) {
  const entries = Object.entries(weights).filter(([rarity]) => pool.some((card) => card.rarity === rarity));
  if (!entries.length) return null;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const [rarity, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

function drawLabPack(pool, size = LAB_PACK_SIZE) {
  const available = shuffleArray(pool.filter((card) => card.imageUrl));
  if (!available.length) return [];

  const usedIds = new Set();
  const results = [];

  for (let index = 0; index < size; index += 1) {
    const weights = index === size - 1 ? LAB_RARE_RARITY_WEIGHTS : LAB_BASE_RARITY_WEIGHTS;
    const rarity = pickWeightedRarity(available.filter((card) => !usedIds.has(card.id)), weights);
    const rarityPool = available.filter((card) => !usedIds.has(card.id) && (!rarity || card.rarity === rarity));
    const fallbackPool = available.filter((card) => !usedIds.has(card.id));
    const nextCard = shuffleArray(rarityPool.length ? rarityPool : fallbackPool)[0];
    if (!nextCard) break;
    usedIds.add(nextCard.id);
    results.push(nextCard);
    if (usedIds.size >= available.length) break;
  }

  return results;
}

function serializeDeckEntries(entries = []) {
  return entries
    .map((entry) => ({ id: String(entry?.id ?? '').trim(), count: Math.max(1, Number(entry?.count ?? 1) || 1) }))
    .filter((entry) => entry.id);
}

function hydrateDeckEntries(entries = []) {
  return serializeDeckEntries(entries)
    .map((entry) => {
      const card = cardsData.find((item) => item.id === entry.id);
      return card ? { ...card, count: entry.count } : null;
    })
    .filter(Boolean);
}

function hydrateSavedDecks(decks = []) {
  return Array.isArray(decks)
    ? decks
        .map((deck) => ({
          id: String(deck?.id ?? '').trim(),
          name: String(deck?.name ?? '').trim() || '내 덱',
          deckEntries: hydrateDeckEntries(deck?.deckEntries ?? []),
          leaderCardId: deck?.leaderCardId ? String(deck.leaderCardId) : null,
          updatedAt: deck?.updatedAt ?? null
        }))
        .filter((deck) => deck.id)
    : [];
}

function serializeSavedDecks(decks = []) {
  return (Array.isArray(decks) ? decks : []).map((deck) => ({
    id: String(deck?.id ?? '').trim(),
    name: String(deck?.name ?? '').trim() || '내 덱',
    deckEntries: serializeDeckEntries(deck?.deckEntries ?? []),
    leaderCardId: deck?.leaderCardId ? String(deck.leaderCardId) : null,
    updatedAt: deck?.updatedAt ?? null
  })).filter((deck) => deck.id);
}

export default function App() {
  const [selectedSeries, setSelectedSeries] = useState(getDefaultSeriesId);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCommunityPost, setSelectedCommunityPost] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchScope, setSearchScope] = useState('series');
  const [activeRarity, setActiveRarity] = useState('ALL');
  const [activeColor, setActiveColor] = useState('ALL');
  const [activeCost, setActiveCost] = useState('ALL');
  const [activeAttribute, setActiveAttribute] = useState('ALL');
  const [openRaritySections, setOpenRaritySections] = useState({});
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('home');
  const [deckEntries, setDeckEntries] = useState([]);
  const [leaderCardId, setLeaderCardId] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [ownedCardIds, setOwnedCardIds] = useState([]);
  const [shopType, setShopType] = useState('general');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [selectedGungu, setSelectedGungu] = useState('전체');
  const [shopSearchKeyword, setShopSearchKeyword] = useState('');
  const [shops, setShops] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopRegions, setShopRegions] = useState({ sidos: [], gungus: [] });
  const [openSidebarCategories, setOpenSidebarCategories] = useState({
    'regular-booster': true,
    'extra-premium': false,
    'starter-deck': false,
    'promo-line': false,
    'flagship-line': false,
    'championship-line': false
  });
  const [deckSearchKeyword, setDeckSearchKeyword] = useState('');
  const [deckFilterColor, setDeckFilterColor] = useState('ALL');
  const [deckFilterRarity, setDeckFilterRarity] = useState('ALL');
  const [deckFilterCategory, setDeckFilterCategory] = useState('ALL');
  const [deckPage, setDeckPage] = useState(1);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityNickname, setCommunityNickname] = useState('');
  const [communityTitle, setCommunityTitle] = useState('');
  const [communityCardName, setCommunityCardName] = useState('');
  const [communityImageUrl, setCommunityImageUrl] = useState('');
  const [communityContent, setCommunityContent] = useState('');
  const [communityEditingId, setCommunityEditingId] = useState(null);
  const [communityBoard, setCommunityBoard] = useState('free');
  const [communityComposerOpen, setCommunityComposerOpen] = useState(false);
  const [communityAuthorToken, setCommunityAuthorToken] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityStorageMode, setCommunityStorageMode] = useState('shared');
  const [communityCommentContent, setCommunityCommentContent] = useState('');
  const [communityCommentLoading, setCommunityCommentLoading] = useState(false);
  const [labSeriesId, setLabSeriesId] = useState(getDefaultSeriesId);
  const [labOpenedPack, setLabOpenedPack] = useState([]);
  const [labRevealCount, setLabRevealCount] = useState(0);
  const [labOpening, setLabOpening] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authCheckState, setAuthCheckState] = useState({ username: null, nickname: null });
  const [visitorToken, setVisitorToken] = useState('');
  const [adminStats, setAdminStats] = useState(null);
  const [userStateReady, setUserStateReady] = useState(false);

  const currentSeries = useMemo(
    () => seriesData.find((series) => series.id === selectedSeries) ?? seriesData.find((series) => series.id === getDefaultSeriesId()) ?? seriesData[0],
    [selectedSeries]
  );
  const trimmedSearchKeyword = searchKeyword.trim();
  const isGlobalSearch = searchScope === 'all' && Boolean(trimmedSearchKeyword);
  const sidebarSections = useMemo(() => buildSidebarSections(), []);
  const activeSidebarCategory = useMemo(() => getSeriesCategory(selectedSeries), [selectedSeries]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('one-piece-tcg-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);

    try {
      const savedOwned = JSON.parse(window.localStorage.getItem(GUEST_OWNED_KEY) ?? '[]');
      if (Array.isArray(savedOwned)) setOwnedCardIds(savedOwned);
    } catch {}

    const savedNickname = window.localStorage.getItem(COMMUNITY_NICKNAME_KEY);
    if (savedNickname) setCommunityNickname(savedNickname);

    const savedAuthorToken = window.localStorage.getItem(COMMUNITY_AUTHOR_TOKEN_KEY);
    if (savedAuthorToken) {
      setCommunityAuthorToken(savedAuthorToken);
    } else {
      const nextAuthorToken = `community-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(COMMUNITY_AUTHOR_TOKEN_KEY, nextAuthorToken);
      setCommunityAuthorToken(nextAuthorToken);
    }

    const savedVisitorToken = window.localStorage.getItem(VISITOR_TOKEN_KEY);
    if (savedVisitorToken) {
      setVisitorToken(savedVisitorToken);
    } else {
      const nextVisitorToken = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(VISITOR_TOKEN_KEY, nextVisitorToken);
      setVisitorToken(nextVisitorToken);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('one-piece-tcg-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return undefined;

    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authUser) return;
    window.localStorage.setItem(GUEST_OWNED_KEY, JSON.stringify(ownedCardIds));
  }, [authUser, ownedCardIds]);

  useEffect(() => {
    if (authUser) return;
    window.localStorage.setItem(COMMUNITY_NICKNAME_KEY, communityNickname);
  }, [authUser, communityNickname]);

  useEffect(() => {
    if (!communityAuthorToken) return;

    let alive = true;
    setCommunityLoading(true);

    const loadCommunityPosts = async () => {
      try {
        const response = await fetchCommunityPosts(communityAuthorToken);
        if (!alive) return;
        setCommunityPosts(response?.posts ?? []);
        setCommunityStorageMode(response?.storage ?? 'shared');
      } catch (error) {
        console.error('Failed to load community posts', error);
      } finally {
        if (alive) setCommunityLoading(false);
      }
    };

    loadCommunityPosts();
    return () => {
      alive = false;
    };
  }, [communityAuthorToken]);

  useEffect(() => {
    if (!authUser?.id) {
      setUserStateReady(false);
      const guestAuthorToken = window.localStorage.getItem(COMMUNITY_AUTHOR_TOKEN_KEY);
      const guestNickname = window.localStorage.getItem(COMMUNITY_NICKNAME_KEY);
      if (guestAuthorToken) setCommunityAuthorToken(guestAuthorToken);
      if (guestNickname) setCommunityNickname(guestNickname);
      return;
    }

    let alive = true;
    const authNicknameValue = authUser.user_metadata?.nickname || authUser.user_metadata?.username || authUser.email || '';
    setCommunityAuthorToken(authUser.id);
    setCommunityNickname(authNicknameValue);

    fetchMyState()
      .then((state) => {
        if (!alive) return;
        if (state?.hasState) {
          setOwnedCardIds(Array.isArray(state.ownedCardIds) ? state.ownedCardIds : []);
          setDeckEntries(hydrateDeckEntries(state.deckEntries));
          setLeaderCardId(state.leaderCardId || null);
          setSavedDecks(hydrateSavedDecks(state.savedDecks));
          setActiveDeckId(state.activeDeckId || null);
        }
      })
      .catch((error) => console.error('Failed to load user state', error))
      .finally(() => {
        if (alive) setUserStateReady(true);
      });

    return () => {
      alive = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.id || !userStateReady) return undefined;

    const timer = window.setTimeout(() => {
      saveMyState({
        ownedCardIds,
        deckEntries: serializeDeckEntries(deckEntries),
        leaderCardId,
        savedDecks: serializeSavedDecks(savedDecks),
        activeDeckId
      }).catch((error) => console.error('Failed to save user state', error));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [authUser, userStateReady, ownedCardIds, deckEntries, leaderCardId, savedDecks, activeDeckId]);

  useEffect(() => {
    if (!visitorToken) return;
    trackVisit(visitorToken, window.location.pathname).catch((error) => console.error('Failed to track visit', error));
  }, [visitorToken]);

  useEffect(() => {
    const username = authUser?.user_metadata?.username;
    if (username !== 'admin') {
      setAdminStats(null);
      return;
    }

    let alive = true;
    fetchAdminStats(username)
      .then((stats) => {
        if (alive) setAdminStats(stats);
      })
      .catch((error) => console.error('Failed to load admin stats', error));

    return () => {
      alive = false;
    };
  }, [authUser]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const load = async () => {
      const fetchedCards = trimmedSearchKeyword
        ? isGlobalSearch
          ? await searchCards(trimmedSearchKeyword)
          : await fetchCards({ series: selectedSeries, rarity: activeRarity === 'ALL' ? '' : activeRarity })
        : await fetchCards({ series: selectedSeries, rarity: activeRarity === 'ALL' ? '' : activeRarity });

      const filteredCards = fetchedCards.filter((card) => {
        const matchesSeries = isGlobalSearch || card.series === selectedSeries;
        const matchesRarity = activeRarity === 'ALL' || card.rarity === activeRarity;
        const matchesColor = matchesMultiValue(card.colorKo, activeColor);
        const matchesCost = activeCost === 'ALL' || String(card.cost ?? '').trim() === activeCost;
        const matchesAttribute = matchesMultiValue(card.attributeKo || card.attribute, activeAttribute);
        const hideBaseLeader = card.rarity === 'L' && !card.cardNo.includes('_P');
        const keyword = trimmedSearchKeyword.toLowerCase();
        const matchesSearch = !keyword || [card.name, card.cardNo, card.type, card.effect].some((value) => String(value).toLowerCase().includes(keyword));
        return matchesSeries && matchesRarity && matchesColor && matchesCost && matchesAttribute && matchesSearch && !hideBaseLeader;
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
  }, [selectedSeries, activeRarity, activeColor, activeCost, activeAttribute, trimmedSearchKeyword, isGlobalSearch]);

  useEffect(() => {
    setOpenRaritySections({});
  }, [selectedSeries, searchKeyword, searchScope, activeRarity, activeColor, activeCost, activeAttribute]);

  useEffect(() => {
    setOpenSidebarCategories((prev) => ({
      ...prev,
      [activeSidebarCategory]: true
    }));
  }, [activeSidebarCategory]);

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

  useEffect(() => {
    setDeckPage(1);
  }, [deckSearchKeyword, deckFilterColor, deckFilterRarity, deckFilterCategory]);

  const groupedCards = useMemo(() => groupByRarity(cards), [cards]);
  const rarityOptionSourceCards = useMemo(
    () => (isGlobalSearch ? cardsData : cardsData.filter((card) => card.series === selectedSeries)),
    [isGlobalSearch, selectedSeries]
  );
  const rarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(rarityOptionSourceCards)], [rarityOptionSourceCards]);
  const colorOptions = useMemo(() => ['ALL', ...new Set(rarityOptionSourceCards.flatMap((card) => normalizeMultiValue(card.colorKo)))], [rarityOptionSourceCards]);
  const costOptions = useMemo(() => ['ALL', ...[...new Set(rarityOptionSourceCards.map((card) => String(card.cost ?? '').trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b))], [rarityOptionSourceCards]);
  const attributeOptions = useMemo(() => ['ALL', ...new Set(rarityOptionSourceCards.flatMap((card) => normalizeMultiValue(card.attributeKo || card.attribute)))], [rarityOptionSourceCards]);
  const isDark = theme === 'dark';
  const ownedSet = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);
  const collectionVisibleCards = useMemo(() => (activeRarity === 'ALL' ? cards : cards.filter((card) => card.rarity === activeRarity)), [cards, activeRarity]);
  const ownedInSeries = useMemo(() => cards.filter((card) => ownedSet.has(card.id)).length, [cards, ownedSet]);
  const ownedInVisibleCollection = useMemo(() => collectionVisibleCards.filter((card) => ownedSet.has(card.id)).length, [collectionVisibleCards, ownedSet]);
  const officialSeriesCount = useMemo(() => cardsData.filter((card) => card.series === selectedSeries).length, [selectedSeries]);

  const deckCards = useMemo(
    () => [...deckEntries].sort((a, b) => (a.categoryKo === '리더' ? -1 : b.categoryKo === '리더' ? 1 : b.count - a.count)),
    [deckEntries]
  );
  const activeSavedDeck = useMemo(() => savedDecks.find((deck) => deck.id === activeDeckId) ?? null, [savedDecks, activeDeckId]);
  const activeShopType = useMemo(() => SHOP_TYPES.find((item) => item.id === shopType) ?? SHOP_TYPES[0], [shopType]);
  const isAdminUser = authUser?.user_metadata?.username === 'admin';
  const defaultCollapsedRarities = useMemo(() => {
    if (cards.length < 30) return ['UC'];
    if (cards.length >= 100) return ['R', 'UC', 'C'];
    return ['UC', 'C'];
  }, [cards.length]);
  const deckCount = useMemo(() => deckEntries.filter((entry) => entry.categoryKo !== '리더').reduce((sum, entry) => sum + entry.count, 0), [deckEntries]);
  const leaderCard = useMemo(() => deckEntries.find((entry) => entry.id === leaderCardId) ?? null, [deckEntries, leaderCardId]);
  const deckFilterCards = useMemo(() => {
    const keyword = deckSearchKeyword.trim().toLowerCase();
    return cardsData.filter((card) => {
      const matchesKeyword = !keyword || [card.name, card.cardNo, card.type, card.effect].some((value) => String(value ?? '').toLowerCase().includes(keyword));
      const matchesColor = deckFilterColor === 'ALL' || card.colorKo === deckFilterColor;
      const matchesRarity = deckFilterRarity === 'ALL' || card.rarity === deckFilterRarity;
      const matchesCategory = deckFilterCategory === 'ALL' || card.categoryKo === deckFilterCategory;
      const hideBaseLeader = card.rarity === 'L' && !card.cardNo.includes('_P');
      return matchesKeyword && matchesColor && matchesRarity && matchesCategory && !hideBaseLeader;
    });
  }, [deckSearchKeyword, deckFilterColor, deckFilterRarity, deckFilterCategory]);
  const deckPageCount = useMemo(() => Math.max(1, Math.ceil(deckFilterCards.length / DECK_PAGE_SIZE)), [deckFilterCards.length]);
  const safeDeckPage = Math.min(deckPage, deckPageCount);
  const pagedDeckCards = useMemo(() => {
    const start = (safeDeckPage - 1) * DECK_PAGE_SIZE;
    return deckFilterCards.slice(start, start + DECK_PAGE_SIZE);
  }, [deckFilterCards, safeDeckPage]);
  const deckColorOptions = useMemo(() => ['ALL', ...new Set(cardsData.map((card) => card.colorKo).filter(Boolean))], []);
  const deckRarityOptions = useMemo(() => ['ALL', ...getOrderedRarities(cardsData)], []);
  const deckCategoryOptions = useMemo(() => ['ALL', ...new Set(cardsData.map((card) => card.categoryKo).filter(Boolean))], []);
  const homeOwnedCount = useMemo(() => cardsData.filter((card) => ownedSet.has(card.id)).length, [ownedSet]);
  const homeOwnedPercent = useMemo(() => (cardsData.length ? ((homeOwnedCount / cardsData.length) * 100).toFixed(1) : '0.0'), [homeOwnedCount]);
  const collectionOwnedPercent = useMemo(() => (collectionVisibleCards.length ? ((ownedInVisibleCollection / collectionVisibleCards.length) * 100).toFixed(1) : '0.0'), [ownedInVisibleCollection, collectionVisibleCards.length]);
  const homeShopCounts = useMemo(
    () => ({
      general: shopsData.filter((shop) => shop.sourceType === 'general').length,
      official: shopsData.filter((shop) => shop.sourceType === 'official').length
    }),
    []
  );
  const currentRarityCardIds = useMemo(
    () => (activeRarity === 'ALL' ? [] : cards.filter((card) => card.rarity === activeRarity).map((card) => card.id)),
    [cards, activeRarity]
  );
  const currentSeriesCardIds = useMemo(
    () => cardsData.filter((card) => card.series === selectedSeries).map((card) => card.id),
    [selectedSeries]
  );
  const allCollectionCardIds = useMemo(
    () => cardsData.map((card) => card.id),
    []
  );
  const isCurrentRarityFullyOwned = useMemo(
    () => currentRarityCardIds.length > 0 && currentRarityCardIds.every((id) => ownedSet.has(id)),
    [currentRarityCardIds, ownedSet]
  );
  const isCurrentSeriesFullyOwned = useMemo(
    () => currentSeriesCardIds.length > 0 && currentSeriesCardIds.every((id) => ownedSet.has(id)),
    [currentSeriesCardIds, ownedSet]
  );
  const isAllCollectionFullyOwned = useMemo(
    () => allCollectionCardIds.length > 0 && allCollectionCardIds.every((id) => ownedSet.has(id)),
    [allCollectionCardIds, ownedSet]
  );
  const activeCommunityBoard = useMemo(
    () => COMMUNITY_BOARDS.find((board) => board.id === communityBoard) ?? COMMUNITY_BOARDS[0],
    [communityBoard]
  );
  const labSeriesOptions = useMemo(
    () => seriesData.filter((series) => cardsData.some((card) => card.series === series.id)),
    []
  );
  const activeLabSeries = useMemo(
    () => labSeriesOptions.find((series) => series.id === labSeriesId) ?? labSeriesOptions[0] ?? null,
    [labSeriesOptions, labSeriesId]
  );
  const labSeriesCards = useMemo(
    () => cardsData.filter((card) => card.series === (activeLabSeries?.id ?? labSeriesId)),
    [activeLabSeries, labSeriesId]
  );
  const boardCommunityPosts = useMemo(
    () => communityPosts.filter((post) => (post.boardId ?? 'free') === communityBoard),
    [communityPosts, communityBoard]
  );
  const isFeedbackBoard = communityBoard === 'feedback';
  const likedCommunityPostIds = useMemo(
    () => communityPosts.filter((post) => post.likedByMe).map((post) => post.id),
    [communityPosts]
  );
  const popularCommunityPosts = useMemo(
    () => [...boardCommunityPosts]
      .sort((a, b) => ((b.likes ?? 0) * 10 + (b.views ?? 0)) - ((a.likes ?? 0) * 10 + (a.views ?? 0)))
      .slice(0, 3),
    [boardCommunityPosts]
  );
  const communityPostCount = boardCommunityPosts.length;

  useEffect(() => {
    if (!labOpening || !labOpenedPack.length) return undefined;
    if (labRevealCount >= labOpenedPack.length) {
      setLabOpening(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setLabRevealCount((prev) => prev + 1);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [labOpening, labOpenedPack, labRevealCount]);

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

  function saveCurrentDeck() {
    if (!authUser) {
      window.alert('로그인 후 덱을 저장해줘.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }

    const nextName = window.prompt('덱 이름 입력', activeSavedDeck?.name || `내 덱 ${savedDecks.length + 1}`)?.trim();
    if (!nextName) return;

    const nextDeckId = activeDeckId || `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextDeck = {
      id: nextDeckId,
      name: nextName,
      deckEntries,
      leaderCardId,
      updatedAt: new Date().toISOString()
    };

    setSavedDecks((prev) => {
      const exists = prev.some((deck) => deck.id === nextDeckId);
      return exists ? prev.map((deck) => (deck.id === nextDeckId ? nextDeck : deck)) : [nextDeck, ...prev];
    });
    setActiveDeckId(nextDeckId);
  }

  function loadSavedDeck(deckId) {
    const targetDeck = savedDecks.find((deck) => deck.id === deckId);
    if (!targetDeck) return;
    setDeckEntries(targetDeck.deckEntries);
    setLeaderCardId(targetDeck.leaderCardId || null);
    setActiveDeckId(targetDeck.id);
  }

  function createNewDeck() {
    setDeckEntries([]);
    setLeaderCardId(null);
    setActiveDeckId(null);
  }

  function deleteSavedDeck(deckId) {
    const targetDeck = savedDecks.find((deck) => deck.id === deckId);
    if (!targetDeck) return;
    if (!window.confirm(`'${targetDeck.name}' 덱을 삭제할까?`)) return;
    setSavedDecks((prev) => prev.filter((deck) => deck.id !== deckId));
    if (activeDeckId === deckId) {
      setActiveDeckId(null);
      setDeckEntries([]);
      setLeaderCardId(null);
    }
  }

  function resetDeckFilters() {
    setDeckSearchKeyword('');
    setDeckFilterColor('ALL');
    setDeckFilterRarity('ALL');
    setDeckFilterCategory('ALL');
    setDeckPage(1);
  }

  function promptLoginRequired(message = '로그인 후 이용해줘.') {
    window.alert(message);
    setAuthMode('login');
    setAuthModalOpen(true);
  }

  function toggleOwned(cardId) {
    if (!authUser) {
      promptLoginRequired('카드 체크는 로그인 후 이용할 수 있어.');
      return;
    }
    setOwnedCardIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }

  function setOwnedForIds(cardIds, shouldOwn) {
    if (!authUser) {
      promptLoginRequired('수집표 체크는 로그인 후 이용할 수 있어.');
      return;
    }
    const uniqueIds = [...new Set(cardIds.filter(Boolean))];
    if (!uniqueIds.length) return;

    setOwnedCardIds((prev) => {
      const prevSet = new Set(prev);
      if (shouldOwn) {
        uniqueIds.forEach((id) => prevSet.add(id));
      } else {
        uniqueIds.forEach((id) => prevSet.delete(id));
      }
      return [...prevSet];
    });
  }

  function openSeriesView(seriesId, nextViewMode = 'archive') {
    setSelectedSeries(seriesId);
    setSearchKeyword('');
    setActiveRarity('ALL');
    setOpenSidebarCategories((prev) => ({
      ...prev,
      [getSeriesCategory(seriesId)]: true
    }));
    setViewMode(nextViewMode);
  }

  function openSeriesArchive(seriesId) {
    openSeriesView(seriesId, 'archive');
  }

  function openLatestArchive() {
    const latestSeriesId = getDefaultSeriesId();
    setSelectedSeries(latestSeriesId);
    setSearchKeyword('');
    setActiveRarity('ALL');
    setOpenSidebarCategories((prev) => ({
      ...prev,
      [getSeriesCategory(latestSeriesId)]: true
    }));
    setViewMode('archive');
  }

  function openLatestCollection() {
    const latestSeriesId = getDefaultSeriesId();
    openSeriesView(latestSeriesId, 'collection');
  }

  function openLabPack() {
    const nextPack = drawLabPack(labSeriesCards);
    setLabOpenedPack(nextPack);
    setLabRevealCount(0);
    setLabOpening(nextPack.length > 0);
  }

  async function submitCommunityPost(event) {
    event.preventDefault();
    if (!authUser) {
      promptLoginRequired('게시글 작성은 로그인 후 이용할 수 있어.');
      return;
    }

    const nickname = communityNickname.trim();
    const title = communityTitle.trim();
    const cardName = communityCardName.trim();
    const imageUrl = communityImageUrl.trim();
    const content = communityContent.trim();

    if (!nickname || !title || !content) return;

    try {
      if (communityEditingId) {
        const updatedPost = await updateCommunityPostRequest(communityEditingId, {
          boardId: communityBoard,
          nickname,
          title,
          cardName,
          imageUrl,
          content
        }, communityAuthorToken);

        setCommunityPosts((prev) => prev.map((post) => (post.id === communityEditingId ? updatedPost : post)));
        if (selectedCommunityPost?.id === communityEditingId) setSelectedCommunityPost(updatedPost);
        setCommunityEditingId(null);
      } else {
        const createdPost = await createCommunityPost({
          boardId: communityBoard,
          nickname,
          title,
          cardName,
          imageUrl,
          content
        }, communityAuthorToken);

        setCommunityPosts((prev) => [createdPost, ...prev]);
      }

      setCommunityComposerOpen(false);
    } catch (error) {
      console.error('Failed to save community post', error);
      window.alert('게시글 저장에 실패했어. 잠시 후 다시 시도해줘.');
      return;
    }

    setCommunityTitle('');
    setCommunityCardName('');
    setCommunityImageUrl('');
    setCommunityContent('');
  }

  function startEditCommunityPost(post) {
    setCommunityComposerOpen(true);
    setCommunityEditingId(post.id);
    setCommunityBoard(post.boardId ?? 'free');
    setCommunityNickname(post.nickname || '');
    setCommunityTitle(post.title || '');
    setCommunityCardName(post.cardName || '');
    setCommunityImageUrl(post.imageUrl || '');
    setCommunityContent(post.content || '');
  }

  function cancelEditCommunityPost() {
    setCommunityComposerOpen(false);
    setCommunityEditingId(null);
    setCommunityTitle('');
    setCommunityCardName('');
    setCommunityImageUrl('');
    setCommunityContent('');
  }

  function openCommunityComposer(boardId = communityBoard) {
    if (!authUser) {
      promptLoginRequired('게시글 작성은 로그인 후 이용할 수 있어.');
      return;
    }
    setCommunityBoard(boardId);
    setCommunityEditingId(null);
    setCommunityTitle('');
    setCommunityCardName('');
    setCommunityImageUrl('');
    setCommunityContent('');
    setCommunityComposerOpen(true);
  }

  async function deleteCommunityPost(postId) {
    if (!authUser) {
      window.alert('로그인 후 이용해줘.');
      return;
    }
    try {
      await deleteCommunityPostRequest(postId, communityAuthorToken);
      setCommunityPosts((prev) => prev.filter((post) => post.id !== postId));
      if (communityEditingId === postId) cancelEditCommunityPost();
      if (selectedCommunityPost?.id === postId) setSelectedCommunityPost(null);
    } catch (error) {
      console.error('Failed to delete community post', error);
      window.alert('삭제 권한이 없거나 삭제에 실패했어.');
    }
  }

  async function loadCommunityComments(postId, basePost = null) {
    try {
      const response = await fetchCommunityComments(postId, communityAuthorToken);
      const comments = response?.comments ?? [];
      setSelectedCommunityPost((prev) => {
        const source = prev?.id === postId ? prev : basePost;
        return source ? { ...source, comments, commentCount: comments.length } : prev;
      });
      setCommunityPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, commentCount: comments.length } : post)));
    } catch (error) {
      console.error('Failed to load community comments', error);
    }
  }

  async function openCommunityPost(post) {
    try {
      const updatedPost = await incrementCommunityPostView(post.id, communityAuthorToken);
      const nextPost = { ...updatedPost, comments: [] };
      setCommunityPosts((prev) => prev.map((item) => (item.id === post.id ? nextPost : item)));
      setSelectedCommunityPost(nextPost);
      loadCommunityComments(post.id, nextPost);
    } catch (error) {
      console.error('Failed to open community post', error);
      const fallbackPost = { ...post, comments: post.comments ?? [] };
      setSelectedCommunityPost(fallbackPost);
      loadCommunityComments(post.id, fallbackPost);
    }
  }

  async function submitCommunityComment() {
    if (!authUser) {
      window.alert('로그인 후 댓글을 작성해줘.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    if (!selectedCommunityPost?.id) return;

    const nickname = communityNickname.trim();
    const content = communityCommentContent.trim();
    if (!nickname || !content) return;

    try {
      setCommunityCommentLoading(true);
      const comment = await addCommunityComment(selectedCommunityPost.id, { nickname, content }, communityAuthorToken);
      setSelectedCommunityPost((prev) => prev ? {
        ...prev,
        comments: [...(prev.comments ?? []), comment],
        commentCount: Number(prev.commentCount ?? prev.comments?.length ?? 0) + 1
      } : prev);
      setCommunityPosts((prev) => prev.map((post) => (
        post.id === selectedCommunityPost.id
          ? { ...post, commentCount: Number(post.commentCount ?? 0) + 1 }
          : post
      )));
      setCommunityCommentContent('');
    } catch (error) {
      console.error('Failed to save community comment', error);
      window.alert('댓글 저장에 실패했어. 잠시 후 다시 시도해줘.');
    } finally {
      setCommunityCommentLoading(false);
    }
  }

  async function toggleCommunityLike(postId) {
    if (!authUser) {
      window.alert('로그인 후 좋아요를 눌러줘.');
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      const updatedPost = await toggleCommunityPostLike(postId, communityAuthorToken);
      setCommunityPosts((prev) => prev.map((post) => (post.id === postId ? updatedPost : post)));
      if (selectedCommunityPost?.id === postId) setSelectedCommunityPost(updatedPost);
    } catch (error) {
      console.error('Failed to toggle community like', error);
    }
  }

  function handleCommunityImageFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCommunityImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!supabase) {
      setAuthMessage('인증 설정이 아직 연결되지 않았어.');
      return;
    }

    const email = authEmail.trim();
    const password = authPassword.trim();
    const username = authUsername.trim();
    const nickname = authNickname.trim();
    const identifier = authIdentifier.trim();
    if ((authMode === 'login' && !identifier) || !password) return;

    setAuthLoading(true);
    setAuthMessage('');

    try {
      if (authMode === 'signup') {
        if (!email || !username || !nickname) throw new Error('입력값을 확인해줘.');
        if (password !== authPasswordConfirm.trim()) throw new Error('비밀번호 확인이 일치하지 않아.');
        if (authCheckState.username !== true) throw new Error('아이디 중복확인을 해줘.');
        if (authCheckState.nickname !== true) throw new Error('닉네임 중복확인을 해줘.');

        await signupWithProfile({ email, password, username, nickname });
        setAuthMessage('회원가입 완료. 이제 바로 로그인하면 돼.');
        setAuthMode('login');
        setAuthIdentifier(username);
      } else {
        const lookup = await resolveLoginEmail(identifier);
        const { error } = await supabase.auth.signInWithPassword({ email: lookup.email, password });
        if (error) throw error;
        setAuthModalOpen(false);
        setAuthIdentifier('');
        setAuthEmail('');
        setAuthUsername('');
        setAuthNickname('');
        setAuthPassword('');
        setAuthPasswordConfirm('');
        setAuthCheckState({ username: null, nickname: null });
      }
    } catch (error) {
      const message = getFriendlyAuthErrorMessage(error, authMode);
      setAuthMessage(message);
      if (authMode === 'login' && message.includes('아이디 또는 비밀번호가 잘못되었습니다')) {
        window.alert(message);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function logoutAuth() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function checkDuplicate(type) {
    const label = type === 'username' ? '아이디' : '닉네임';
    const value = (type === 'username' ? authUsername : authNickname).trim();
    if (!value) {
      window.alert(`${label}를 먼저 입력해줘.`);
      return;
    }
    try {
      const result = await checkAuthAvailability(type, value);
      const message = result.available ? `${label} 사용 가능` : `${label} 중복됨`;
      setAuthCheckState((prev) => ({ ...prev, [type]: result.available }));
      setAuthMessage(message);
      window.alert(message);
    } catch (error) {
      const message = error?.message || '중복확인에 실패했어.';
      setAuthMessage(message);
      window.alert(message);
    }
  }

  const shellClass = isDark ? 'bg-[#161514] text-stone-100' : 'bg-[#f3efe7] text-stone-900';
  const panelClass = isDark ? 'border-[#34312e] bg-[#211f1d]' : 'border-[#d9d0c2] bg-[#fbf8f2]';
  const cardClass = isDark ? 'border-[#34312e] bg-[#1a1918]' : 'border-[#e2d9cc] bg-white';
  const subtleClass = isDark ? 'bg-[#191817] border-[#2e2b29] text-stone-200' : 'bg-[#f7f3ed] border-[#e7ddcf] text-stone-900';
  const textMuted = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen ${shellClass}`}>
        <div className="mx-auto max-w-[1880px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          <header className={`mb-4 border ${panelClass} rounded-2xl p-4 sm:mb-5`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <img src={OFFICIAL_LOGO_URL} alt="ONE PIECE CARD GAME" className={`h-10 w-auto object-contain sm:h-14 ${isDark ? 'brightness-0 invert' : ''}`} onError={placeholderImage} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#b6422e]">One Piece TCG Archive</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {authUser ? (
                  <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${subtleClass}`}>
                    <a href={DONATION_URL} target="_blank" rel="noreferrer" className="rounded-full bg-[#ffde59] px-4 py-2 text-sm font-black text-[#6f3d00]">후원하기</a>
                    <span className="max-w-[150px] truncate font-bold">{authUser.user_metadata?.nickname || authUser.user_metadata?.username || authUser.email}</span>
                    <button type="button" onClick={logoutAuth} className="rounded-full bg-[#c94d35] px-3 py-1 text-xs font-bold text-white">로그아웃</button>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 rounded-full border px-2 py-2 ${subtleClass}`}>
                    <a href={DONATION_URL} target="_blank" rel="noreferrer" className="rounded-full bg-[#ffde59] px-4 py-2 text-sm font-black text-[#6f3d00]">후원하기</a>
                    <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(''); setAuthModalOpen(true); }} className="rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">로그인</button>
                    <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage(''); setAuthModalOpen(true); }} className="rounded-full border border-[#c94d35] px-4 py-2 text-sm font-bold text-[#c94d35]">회원가입</button>
                  </div>
                )}
                <button type="button" aria-label={isDark ? '라이트모드' : '다크모드'} onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} className={`rounded-full border px-4 py-2 text-xl font-semibold ${subtleClass}`}>
                  {isDark ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </header>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:mb-5 lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0">
            <TopTab active={viewMode === 'home'} onClick={() => setViewMode('home')} label="메인" />
            <TopTab active={viewMode === 'archive'} onClick={openLatestArchive} label="카드 도감" />
            <TopTab active={viewMode === 'collection'} onClick={openLatestCollection} label="수집표" />
            <TopTab active={viewMode === 'deck'} onClick={() => setViewMode('deck')} label="덱 시뮬레이터" />
            <TopTab active={viewMode === 'community'} onClick={() => setViewMode('community')} label="커뮤니티" />
            <TopTab active={viewMode === 'lab'} onClick={() => setViewMode('lab')} label="실험실" />
            <TopTab active={viewMode === 'shops'} onClick={() => setViewMode('shops')} label="오프라인 구매처" />
          </div>

          <div className={`grid gap-5 ${viewMode === 'home' || viewMode === 'deck' || viewMode === 'shops' || viewMode === 'community' || viewMode === 'lab' ? 'xl:grid-cols-1' : 'xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
            {viewMode === 'home' || viewMode === 'deck' || viewMode === 'shops' || viewMode === 'community' || viewMode === 'lab' ? null : <aside className={`border ${panelClass} rounded-2xl p-3`}>
              <div className={`mb-3 border ${subtleClass} rounded-xl px-4 py-3`}>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6422e]">Category</div>
              </div>
              <div className="space-y-2">
                {sidebarSections.map((section) => {
                  const isOpen = openSidebarCategories[section.id] ?? false;
                  const isActiveCategory = activeSidebarCategory === section.id;
                  return (
                    <div key={section.id} className={`overflow-hidden rounded-xl border ${isActiveCategory ? 'border-[#c94d35]' : isDark ? 'border-[#34312e]' : 'border-[#e2d9cc]'}`}>
                      <button
                        type="button"
                        onClick={() => setOpenSidebarCategories((prev) => ({ ...prev, [section.id]: !isOpen }))}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left ${isActiveCategory ? 'bg-[#f7ede5] text-stone-900' : cardClass}`}
                      >
                        <span className="text-sm font-extrabold">{section.label}</span>
                        <span className={`text-xs ${isActiveCategory ? 'text-stone-700' : textMuted}`}>{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen ? (
                        <div className={`${isDark ? 'bg-[#171615]' : 'bg-[#f8f4ed]'} px-2 py-2`}>
                          <div className="space-y-1">
                            {section.children.map((series) => {
                              const active = !series.disabled && series.id === selectedSeries;
                              return (
                                <button
                                  key={series.id}
                                  type="button"
                                  onClick={() => {
                                    if (series.disabled) return;
                                    openSeriesView(series.id, viewMode === 'collection' ? 'collection' : 'archive');
                                  }}
                                  className={`w-full rounded-lg border px-3 py-2 text-left ${series.disabled ? 'cursor-default opacity-55' : ''} ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : `${cardClass}`}`}
                                >
                                  <div className={`text-xs font-bold tracking-wide ${active ? 'text-white/80' : 'text-[#c94d35]'}`}>{series.disabled ? section.label : getDisplaySeriesCode(series)}</div>
                                  <div className={`mt-1 text-[14px] font-extrabold ${active ? 'text-white' : isDark ? 'text-white' : 'text-stone-900'}`}>{series.koName}</div>
                                  <div className={`mt-1 text-[11px] ${active ? 'text-white/75' : textMuted}`}>{series.disabled ? '준비 중' : series.enName}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
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
                        <div className="flex flex-wrap items-center gap-3">
                          <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>원피스 TCG</h1>
                          <a href="https://cafe.naver.com/onepiecetcg" target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-[#c94d35] px-4 py-2 text-sm font-black text-[#c94d35]">공식카페</a>
                        </div>
                      </>
                    ) : viewMode === 'shops' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>오프라인 구매처</h1>
                      </>
                    ) : viewMode === 'deck' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>덱 시뮬레이터</h1>
                      </>
                    ) : viewMode === 'lab' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>실험실</h1>
                      </>
                    ) : viewMode === 'community' ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>커뮤니티</h1>
                      </>
                    ) : isGlobalSearch ? (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>전체 카드 검색</h1>
                        <div className={`mt-1 text-sm ${textMuted}`}>"{trimmedSearchKeyword}" 검색 결과</div>
                        <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>현재 시리즈에 묶지 않고 전체 카드에서 결과를 보여줘.</p>
                      </>
                    ) : (
                      <>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-stone-950'}`}>{currentSeries?.koName}</h1>
                        <div className={`mt-1 text-sm ${textMuted}`}>{currentSeries?.enName}</div>
                        {officialSeriesCount !== cards.length ? <div className={`mt-2 text-sm ${textMuted}`}>현재 표시 {cards.length}장 · 공식 기준 {officialSeriesCount}장</div> : null}
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
                    ) : viewMode === 'deck' ? (
                      <>
                        <Metric label="덱" value={`${deckCount}/${DECK_SIZE}`} className={deckCount > DECK_SIZE ? 'border-red-300 bg-red-50 text-red-700' : subtleClass} />
                        <Metric label="리더" value={leaderCard ? leaderCard.name : '미지정'} className={subtleClass} />
                        <Metric label="검색 대상" value={`${deckFilterCards.length}장`} className={subtleClass} />
                      </>
                    ) : viewMode === 'lab' ? (
                      <>
                        <Metric label="시리즈" value={activeLabSeries?.koName ?? '없음'} className={subtleClass} />
                        <Metric label="대상 카드" value={`${labSeriesCards.length}장`} className={subtleClass} />
                        <Metric label="팩 구성" value={`${LAB_PACK_SIZE}장`} className={subtleClass} />
                      </>
                    ) : viewMode === 'community' ? (
                      <>
                        <Metric label="게시판" value={activeCommunityBoard.label} className={subtleClass} />
                        <Metric label="게시물" value={`${communityPostCount}개`} className={subtleClass} />
                      </>
                    ) : isGlobalSearch ? (
                      <>
                        <Metric label="검색 결과" value={`${cards.length}장`} className={subtleClass} />
                        <Metric label="검색 범위" value="전체 카드" className={subtleClass} />
                        <Metric label="수집" value={`${cards.filter((card) => ownedSet.has(card.id)).length}/${cards.length}`} className={subtleClass} />
                      </>
                    ) : (
                      <>
                        <Metric label="공식 카드" value={`${officialSeriesCount}장`} className={subtleClass} />
                        <Metric label="수집" value={`${ownedInVisibleCollection}/${collectionVisibleCards.length || 0}`} className={subtleClass} />
                      </>
                    )}
                  </div>
                </div>
              </section>

              {viewMode === 'archive' || viewMode === 'collection' ? (
                <section className={`border ${panelClass} rounded-2xl p-4`}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                    <label className="block">
                      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>카드 찾기</div>
                      <input
                        value={searchKeyword}
                        onChange={(event) => setSearchKeyword(event.target.value)}
                        placeholder="카드명 또는 카드번호 검색"
                        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`}
                      />
                    </label>
                    <div className="space-y-4">
                      <div>
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>검색 범위</div>
                        <div className="flex flex-wrap gap-2">
                          <ModeChip active={searchScope === 'series'} onClick={() => setSearchScope('series')} label="현재 시리즈" />
                          <ModeChip active={searchScope === 'all'} onClick={() => setSearchScope('all')} label="전체 카드" />
                        </div>
                      </div>
                      <div>
                      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>등급</div>
                      <div className="flex flex-wrap gap-2">
                        {rarityOptions.map((rarity) => (
                          <ModeChip key={rarity} active={activeRarity === rarity} onClick={() => setActiveRarity(rarity)} label={rarity} />
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FilterSelect label="컬러" value={activeColor} onChange={setActiveColor} options={colorOptions} subtleClass={subtleClass} isDark={isDark} />
                      <FilterSelect label="코스트" value={activeCost} onChange={setActiveCost} options={costOptions} subtleClass={subtleClass} isDark={isDark} />
                      <FilterSelect label="속성" value={activeAttribute} onChange={setActiveAttribute} options={attributeOptions} subtleClass={subtleClass} isDark={isDark} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {!authUser ? <div className={`text-sm ${textMuted}`}>카드 체크와 수집표 저장은 로그인 후 이용할 수 있어.</div> : <div />}
                      <button
                        type="button"
                        onClick={() => {
                          setSearchKeyword('');
                          setSearchScope('series');
                          setActiveRarity('ALL');
                          setActiveColor('ALL');
                          setActiveCost('ALL');
                          setActiveAttribute('ALL');
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}
                      >
                        필터 초기화
                      </button>
                    </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {viewMode === 'home' ? (
                <section className="space-y-4 sm:space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[0.72fr_1.18fr_0.5fr] xl:items-stretch">
                    <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <button type="button" onClick={openLatestArchive} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">카드 도감</div>
                        </button>
                        <button type="button" onClick={openLatestCollection} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">수집표</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('deck')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">덱 시뮬레이터</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('shops')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">오프라인 구매처</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('community')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">커뮤니티</div>
                        </button>
                        <button type="button" onClick={() => setViewMode('lab')} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-base font-black">실험실</div>
                        </button>
                      </div>
                    </div>

                    <div className={`hidden overflow-hidden border ${panelClass} rounded-2xl p-3 sm:p-4 xl:block`}>
                      <div className={`flex h-full items-center justify-center overflow-hidden rounded-xl border ${cardClass}`}>
                        <img src="/uploads/home-main.jpg" alt="ONE PIECE CARD GAME 메인 이미지" className="h-full max-h-[560px] w-full object-cover" />
                      </div>
                    </div>

                    <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                      <div className="grid h-full gap-3 grid-cols-2 xl:grid-cols-1">
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>수집 진행</div>
                          <div className="mt-2 text-2xl font-black">{homeOwnedCount} / {cardsData.length}</div>
                          <div className={`mt-1 text-sm ${textMuted}`}>{homeOwnedPercent}%</div>
                        </div>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className={`text-sm ${textMuted}`}>현재 덱</div>
                          <div className="mt-2 text-2xl font-black">{deckCount} / {DECK_SIZE}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-1">
                    <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <button type="button" onClick={() => { setShopType('official'); setSelectedRegion('서울특별시'); setSelectedGungu('전체'); setViewMode('shops'); }} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-sm font-black">서울 공식 점포 보기</div>
                        </button>
                        <button type="button" onClick={() => { setShopType('general'); setSelectedRegion('경기도'); setSelectedGungu('전체'); setViewMode('shops'); }} className={`rounded-xl border px-4 py-4 text-left ${cardClass}`}>
                          <div className="text-sm font-black">경기 취급 점포 보기</div>
                        </button>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className="text-sm font-black">취급 점포 {homeShopCounts.general}곳 · 공인/공식 점포 {homeShopCounts.official}곳</div>
                        </div>
                        <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                          <div className="text-sm font-black">사이트 운영과 업데이트 계속 진행 중</div>
                        </div>
                      </div>
                    </div>
                  </div>

                </section>
              ) : viewMode === 'archive' ? (
                <section className="space-y-5">
                  {loading ? (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>불러오는 중...</div>
                  ) : groupedCards.length ? (
                    groupedCards.map((group) => {
                      const defaultOpen = !defaultCollapsedRarities.includes(group.rarity);
                      const isOpen = activeRarity === group.rarity ? true : (openRaritySections[group.rarity] ?? defaultOpen);
                      return (
                        <div key={group.rarity} className="space-y-3">
                          <button type="button" onClick={() => setOpenRaritySections((prev) => ({ ...prev, [group.rarity]: !isOpen }))} className={`flex w-full items-center justify-between border ${panelClass} rounded-xl px-4 py-3 text-left`}>
                            <div className="flex items-center gap-3">
                              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{group.rarity}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${rarityTone(group.rarity)}`}>{group.rarity}</span>
                              {defaultCollapsedRarities.includes(group.rarity) ? <span className={`text-xs ${textMuted}`}>기본 숨김</span> : null}
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
                                    {isGlobalSearch ? <div className={`text-[11px] font-bold text-[#c94d35]`}>{card.seriesName || card.series}</div> : null}
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
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>수집 도감</h3>
                        <div className={`mt-1 text-sm ${textMuted}`}>{authUser ? '계정에 자동 저장됨' : '로그인 후 체크/저장이 가능해.'}</div>
                      </div>
                      <div className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>
                        {ownedInVisibleCollection} / {collectionVisibleCards.length || 0} · {collectionOwnedPercent}%
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={activeRarity === 'ALL' || !currentRarityCardIds.length}
                        onClick={() => setOwnedForIds(currentRarityCardIds, !isCurrentRarityFullyOwned)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass} disabled:opacity-45`}
                      >
                        {activeRarity === 'ALL' ? '등급 선택 필요' : `등급 ${isCurrentRarityFullyOwned ? '해제' : '체크'}`}
                      </button>
                      <button
                        type="button"
                        disabled={!currentSeriesCardIds.length}
                        onClick={() => setOwnedForIds(currentSeriesCardIds, !isCurrentSeriesFullyOwned)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass} disabled:opacity-45`}
                      >
                        시리즈 {isCurrentSeriesFullyOwned ? '해제' : '체크'}
                      </button>
                      <button
                        type="button"
                        disabled={!allCollectionCardIds.length}
                        onClick={() => setOwnedForIds(allCollectionCardIds, !isAllCollectionFullyOwned)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass} disabled:opacity-45`}
                      >
                        전체 {isAllCollectionFullyOwned ? '해제' : '체크'}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {collectionVisibleCards.map((card) => {
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
                <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className={`order-2 border ${panelClass} rounded-2xl p-4 sm:p-5 lg:order-1`}>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>덱 시뮬레이터</h3>
                        <div className={`mt-1 text-sm ${textMuted}`}>{authUser ? '계정에 자동 저장됨' : '비로그인 상태에선 이 기기 브라우저에 저장됨'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={saveCurrentDeck} className="rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">덱 저장</button>
                        <button type="button" onClick={createNewDeck} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>새 덱</button>
                        <button type="button" onClick={clearDeck} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>초기화</button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px] xl:gap-4">
                      <label className="block xl:col-span-1">
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>카드 검색</div>
                        <input
                          value={deckSearchKeyword}
                          onChange={(event) => setDeckSearchKeyword(event.target.value)}
                          placeholder="카드명 또는 카드번호 검색"
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`}
                        />
                      </label>
                      <FilterSelect label="색상" value={deckFilterColor} onChange={setDeckFilterColor} options={deckColorOptions} subtleClass={subtleClass} isDark={isDark} />
                      <FilterSelect label="등급" value={deckFilterRarity} onChange={setDeckFilterRarity} options={deckRarityOptions} subtleClass={subtleClass} isDark={isDark} />
                      <FilterSelect label="종류" value={deckFilterCategory} onChange={setDeckFilterCategory} options={deckCategoryOptions} subtleClass={subtleClass} isDark={isDark} />
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className={`text-sm ${textMuted}`}>전체 {deckFilterCards.length}장 · {safeDeckPage}/{deckPageCount} 페이지</div>
                      <button type="button" onClick={resetDeckFilters} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>필터 초기화</button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pagedDeckCards.map((card) => (
                        <div key={card.id} className={`border ${subtleClass} rounded-xl p-3`}>
                          <div className="flex gap-3">
                            <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="h-24 w-16 rounded-lg object-contain" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-extrabold">{card.name}</div>
                              <div className={`mt-1 text-[11px] ${textMuted}`}>{card.cardNo}</div>
                              <div className={`mt-1 text-[11px] ${textMuted}`}>{card.categoryKo} · {card.rarity} · {card.colorKo}</div>
                              <button type="button" onClick={() => addToDeck(card)} className="mt-3 rounded-full bg-[#c94d35] px-3 py-1.5 text-xs font-bold text-white">{card.categoryKo === '리더' ? '리더 지정' : '덱 추가'}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pagedDeckCards.length ? null : <div className={`mt-4 border ${subtleClass} rounded-xl p-5 text-center ${textMuted}`}>조건에 맞는 카드가 없어.</div>}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button type="button" onClick={() => setDeckPage((prev) => Math.max(1, prev - 1))} disabled={safeDeckPage === 1} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${subtleClass} disabled:opacity-45`}>이전</button>
                      <span className={`px-3 text-sm font-bold ${textMuted}`}>{safeDeckPage} / {deckPageCount}</span>
                      <button type="button" onClick={() => setDeckPage((prev) => Math.min(deckPageCount, prev + 1))} disabled={safeDeckPage === deckPageCount} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${subtleClass} disabled:opacity-45`}>다음</button>
                    </div>
                  </div>

                  <div className={`order-1 border ${panelClass} rounded-2xl p-4 sm:p-5 lg:order-2 lg:sticky lg:top-4 lg:self-start`}>
                    <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>내 덱</h3>
                    <div className="mt-4 space-y-3">
                      <div className={`border ${subtleClass} rounded-xl p-4`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">저장된 덱</span>
                          <span className={`text-xs ${textMuted}`}>{savedDecks.length}개</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {savedDecks.length ? savedDecks.map((deck) => (
                            <div key={deck.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${activeDeckId === deck.id ? 'border-[#c94d35] bg-[#fff3ee] text-stone-900' : subtleClass}`}>
                              <button type="button" onClick={() => loadSavedDeck(deck.id)} className="min-w-0 flex-1 text-left">
                                <div className="truncate text-sm font-black">{deck.name}</div>
                                <div className={`text-[11px] ${textMuted}`}>{deck.updatedAt ? formatCommunityDate(deck.updatedAt) : ''}</div>
                              </button>
                              <button type="button" onClick={() => deleteSavedDeck(deck.id)} className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">삭제</button>
                            </div>
                          )) : <div className={`text-sm ${textMuted}`}>저장된 덱이 없어.</div>}
                        </div>
                      </div>
                      <div className={`border ${subtleClass} rounded-xl p-4`}>
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#b6422e]">Leader</div>
                        <div className={`mt-2 text-sm font-bold ${leaderCard ? '' : textMuted}`}>{leaderCard ? leaderCard.name : '리더를 지정해줘'}</div>
                      </div>
                      <div className={`border ${subtleClass} rounded-xl p-4`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{activeSavedDeck?.name || '현재 덱'}</span>
                          <span className={`text-sm font-black ${deckCount > DECK_SIZE ? 'text-red-500' : ''}`}>{deckCount}/{DECK_SIZE}</span>
                        </div>
                      </div>
                      <div className="space-y-2 lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
                        {deckCards.length ? deckCards.map((entry) => (
                          <div key={entry.id} className={`border ${subtleClass} rounded-xl p-3`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold">{entry.name}</div>
                                <div className={`mt-1 text-[11px] ${textMuted}`}>{entry.cardNo} · {entry.rarity} · {entry.colorKo}</div>
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
              ) : viewMode === 'lab' ? (
                <section className="space-y-5">
                  <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px] xl:items-end">
                      <label className="block">
                        <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>팩 시리즈</div>
                        <select
                          value={activeLabSeries?.id ?? ''}
                          onChange={(event) => setLabSeriesId(event.target.value)}
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} focus:border-[#c94d35]`}
                        >
                          {labSeriesOptions.map((series) => (
                            <option key={series.id} value={series.id}>{series.koName}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" onClick={openLabPack} disabled={!labSeriesCards.length || labOpening} className="inline-flex items-center justify-center rounded-xl bg-[#c94d35] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                        {labOpening ? '개봉 중...' : '카드팩 개봉'}
                      </button>
                    </div>
                    <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'border-[#333333] bg-[#171717]' : 'border-[#eadfce] bg-[#fff8f2]'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-black">{activeLabSeries?.koName ?? '시리즈 선택'}</div>
                        </div>
                        <div className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>{labSeriesCards.length}장 풀</div>
                      </div>
                    </div>
                  </div>

                  <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-xl font-black">가상 카드깡</div>
                      {labOpenedPack.length ? <button type="button" onClick={openLabPack} disabled={labOpening} className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass} disabled:opacity-50`}>다시 뽑기</button> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                      {(labOpenedPack.length ? labOpenedPack : Array.from({ length: LAB_PACK_SIZE }, () => null)).map((card, index) => {
                        const revealed = index < labRevealCount && card;
                        return (
                          <button
                            key={card?.id ?? `placeholder-${index}`}
                            type="button"
                            disabled={!revealed}
                            onClick={() => revealed ? openCard(card.id) : null}
                            className={`overflow-hidden rounded-2xl border text-left transition duration-300 ${revealed ? `${cardClass} translate-y-0 opacity-100` : `${isDark ? 'border-[#333333] bg-[#161616]' : 'border-[#eadfce] bg-[#fff8f2]'} translate-y-2 opacity-80`} ${revealed ? 'hover:-translate-y-1' : ''}`}
                          >
                            {revealed ? (
                              <>
                                <div className={`relative aspect-[5/7] overflow-hidden p-2 ${isDark ? 'bg-[#111111]' : 'bg-[#f6f1e9]'}`}>
                                  <img src={card.imageUrl || '/card-placeholder.svg'} alt={card.name} onError={placeholderImage} className="h-full w-full object-contain [image-rendering:auto]" />
                                  <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[11px] font-bold ${rarityTone(card.rarity)}`}>{card.rarity}</span>
                                </div>
                                <div className={`border-t p-3 ${isDark ? 'border-[#333333]' : 'border-[#eee5d8]'}`}>
                                  <div className={`text-[11px] font-bold ${textMuted}`}>{card.cardNo}</div>
                                  <div className={`mt-1 line-clamp-2 text-sm font-extrabold ${isDark ? 'text-white' : 'text-stone-900'}`}>{card.name}</div>
                                </div>
                              </>
                            ) : (
                              <div className="flex aspect-[5/7] items-center justify-center p-4">
                                <div className={`flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed ${isDark ? 'border-[#4a4a4a] bg-[#1d1d1d] text-stone-500' : 'border-[#d8c8b6] bg-[#fbf5ed] text-stone-400'}`}>
                                  <div className="text-center">
                                    <div className="text-3xl font-black">?</div>
                                    <div className="mt-2 text-xs font-bold tracking-[0.18em]">PACK</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ) : viewMode === 'community' ? (
                <section className="space-y-5">
                  <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {COMMUNITY_BOARDS.map((board) => {
                        const active = communityBoard === board.id;
                        return (
                          <button
                            key={board.id}
                            type="button"
                            disabled={board.disabled}
                            onClick={() => setCommunityBoard(board.id)}
                            className={`rounded-2xl border px-4 py-4 text-left transition ${board.disabled ? 'cursor-default opacity-50' : 'hover:-translate-y-0.5'} ${active ? 'border-[#c94d35] bg-[#fff3ee]' : cardClass}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className={`text-base font-black ${active ? 'text-[#c94d35]' : isDark ? 'text-white' : 'text-stone-900'}`}>{board.label}</div>
                              {active ? <span className="rounded-full bg-[#c94d35] px-2.5 py-1 text-[11px] font-bold text-white">선택됨</span> : null}
                            </div>
                            <div className={`mt-2 text-sm leading-6 ${textMuted}`}>{board.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className={`text-lg font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{activeCommunityBoard.label}</div>
                          {!authUser ? <div className={`mt-1 text-sm ${textMuted}`}>로그인하면 계정 기준으로 글/좋아요가 저장돼.</div> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={`rounded-full border px-4 py-2 text-sm font-bold ${subtleClass}`}>{communityPostCount}개</div>
                          <button type="button" onClick={() => openCommunityComposer(activeCommunityBoard.id)} className="inline-flex rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">글쓰기</button>
                        </div>
                      </div>
                    </div>
                    {isFeedbackBoard ? (
                      <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                        <div className={`text-sm leading-6 ${textMuted}`}>
                          {isAdminUser ? '피드백 게시판 글은 잠금 상태지만 관리자에게는 내용까지 보여져.' : '피드백 게시판은 글 제목과 작성 여부는 보이지만, 본문 내용은 관리자만 확인할 수 있어.'}
                        </div>
                      </div>
                    ) : null}
                    {!isFeedbackBoard && popularCommunityPosts.length ? (
                      <div className={`border ${panelClass} rounded-2xl p-4 sm:p-5`}>
                        <div className="mb-3 text-lg font-black">인기글</div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {popularCommunityPosts.map((post, index) => (
                            <button key={post.id} type="button" onClick={() => openCommunityPost(post)} className={`rounded-xl border p-4 text-left ${cardClass}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-[#c94d35]">TOP {index + 1}</span>
                                <span className={`text-xs ${textMuted}`}>조회 {(post.views ?? 0)}</span>
                              </div>
                              <div className="mt-2 line-clamp-2 text-sm font-black">{post.title}</div>
                              <div className={`mt-2 flex flex-wrap gap-2 text-xs ${textMuted}`}>
                                <span>❤️ {(post.likes ?? 0)}</span>
                                <span>{post.nickname}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {communityLoading ? <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>게시글 불러오는 중...</div> : boardCommunityPosts.length ? boardCommunityPosts.map((post) => (
                      <article key={post.id} className={`border ${cardClass} rounded-2xl p-4 shadow-sm sm:p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button type="button" onClick={() => openCommunityPost(post)} className="min-w-0 text-left">
                            <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{post.title}</h3>
                            <div className={`mt-2 flex flex-wrap gap-2 text-xs ${textMuted}`}>
                              <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>{post.nickname}</span>
                              {post.cardName ? <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>{post.cardName}</span> : null}
                              {post.locked ? <span className="rounded-full bg-stone-900 px-3 py-1 text-white">🔒 관리자 전용</span> : null}
                              <span>{formatCommunityDate(post.createdAt)}</span>
                              {post.updatedAt ? <span>수정 {formatCommunityDate(post.updatedAt)}</span> : null}
                              <span>조회 {(post.views ?? 0)}</span>
                              <span>좋아요 {(post.likes ?? 0)}</span>
                              <span>댓글 {(post.commentCount ?? 0)}</span>
                            </div>
                          </button>
                          <div className="flex gap-2">
                            {post.canInteract ? <button type="button" onClick={() => toggleCommunityLike(post.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${likedCommunityPostIds.includes(post.id) ? 'bg-pink-500 text-white' : `${subtleClass}`}`}>❤️ {(post.likes ?? 0)}</button> : null}
                            {post.canEdit ? <button type="button" onClick={() => startEditCommunityPost(post)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${subtleClass}`}>수정</button> : null}
                            {post.canEdit ? <button type="button" onClick={() => deleteCommunityPost(post.id)} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white">삭제</button> : null}
                          </div>
                        </div>
                        {post.canReadContent && post.imageUrl ? <img src={post.imageUrl} alt={post.title} onError={placeholderImage} className="mt-4 max-h-[420px] w-full rounded-xl border object-contain p-2" /> : null}
                        <p className={`mt-4 whitespace-pre-line text-sm leading-6 ${textMuted}`}>{post.content}</p>
                      </article>
                    )) : <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>아직 올라온 {activeCommunityBoard.label} 글이 없어. 첫 글을 남겨봐.</div>}
                  </div>
                </section>
              ) : (
                <section className="space-y-4">
                  <div className={`border ${panelClass} rounded-2xl p-4`}>
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
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
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px] xl:gap-4">
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
                    <div className="flex justify-start sm:justify-end">
                      <a href={activeShopType.pageUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white">공식 페이지 열기</a>
                    </div>
                  </div>

                  {shopLoading ? (
                    <div className={`border ${panelClass} rounded-2xl p-10 text-center ${textMuted}`}>매장 목록 불러오는 중...</div>
                  ) : shops.length ? (
                    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                      {shops.map((shop) => (
                        <article key={shop.id} className={`border ${cardClass} rounded-xl p-4 sm:p-5`}>
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

            {authUser?.user_metadata?.username === 'admin' && adminStats ? (
              <section className={`mt-5 border ${panelClass} rounded-2xl p-5`}>
                <div className="mb-3 text-lg font-black">관리자 통계</div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm ${textMuted}`}>오늘 방문</div>
                    <div className="mt-2 text-2xl font-black">{adminStats.todayVisits}</div>
                  </div>
                  <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm ${textMuted}`}>오늘 순방문</div>
                    <div className="mt-2 text-2xl font-black">{adminStats.todayUniqueVisitors}</div>
                  </div>
                  <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm ${textMuted}`}>전체 회원</div>
                    <div className="mt-2 text-2xl font-black">{adminStats.totalUsers}</div>
                  </div>
                  <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm ${textMuted}`}>오늘 가입</div>
                    <div className="mt-2 text-2xl font-black">{adminStats.todaySignups}</div>
                  </div>
                  <div className={`rounded-xl border px-4 py-4 ${cardClass}`}>
                    <div className={`text-sm ${textMuted}`}>전체 게시글</div>
                    <div className="mt-2 text-2xl font-black">{adminStats.totalPosts}</div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className={`mt-5 border ${panelClass} rounded-2xl p-5 text-center`}>
              <div className="text-lg font-black">배너문의 주세요</div>
            </section>
          </div>
        </div>

        {communityComposerOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cancelEditCommunityPost}>
            <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl ${isDark ? 'border-[#363636] bg-[#202020]' : 'border-[#e4d7c7] bg-[#fffdf9]'}`} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{communityEditingId ? `${activeCommunityBoard.label} 수정` : `${activeCommunityBoard.label} 글쓰기`}</h3>
                <button type="button" onClick={cancelEditCommunityPost} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-[#444] bg-[#262626] text-stone-200' : 'border-[#e2d5c8] bg-white text-stone-600'}`}>닫기</button>
              </div>
              <form onSubmit={submitCommunityPost} className="space-y-3 p-5">
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>닉네임</div>
                  <input value={communityNickname} onChange={(event) => setCommunityNickname(event.target.value)} readOnly={Boolean(authUser)} placeholder="닉네임 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35] ${authUser ? 'opacity-70' : ''}`} />
                </label>
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>제목</div>
                  <input value={communityTitle} onChange={(event) => setCommunityTitle(event.target.value)} placeholder="제목 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                </label>
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>카드명</div>
                  <input value={communityCardName} onChange={(event) => setCommunityCardName(event.target.value)} placeholder="카드명 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                </label>
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>이미지 파일 (선택)</div>
                  <input type="file" accept="image/*" onChange={handleCommunityImageFile} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} file:mr-3 file:rounded-full file:border-0 file:bg-[#c94d35] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white`} />
                </label>
                {communityImageUrl ? <div className={`rounded-xl border p-3 ${subtleClass}`}><img src={communityImageUrl} alt="preview" className="max-h-64 w-full rounded-lg object-contain" /></div> : null}
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>내용</div>
                  <textarea value={communityContent} onChange={(event) => setCommunityContent(event.target.value)} placeholder={communityBoard === 'showoff' ? '자랑 한마디 적기' : communityBoard === 'feedback' ? '불편한 점이나 개선 의견 적기' : '자유롭게 글쓰기'} rows={6} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" disabled={!authUser || !communityNickname.trim() || !communityTitle.trim() || !communityContent.trim()} className="inline-flex rounded-full bg-[#c94d35] px-5 py-3 text-sm font-bold text-white disabled:opacity-45">{communityEditingId ? '수정 저장' : '게시물 올리기'}</button>
                  <button type="button" onClick={cancelEditCommunityPost} className={`inline-flex rounded-full border px-5 py-3 text-sm font-bold ${subtleClass}`}>취소</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {authModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setAuthModalOpen(false)}>
            <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${isDark ? 'border-[#363636] bg-[#202020]' : 'border-[#e4d7c7] bg-[#fffdf9]'}`} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{authMode === 'signup' ? '회원가입' : '로그인'}</h3>
                <button type="button" onClick={() => setAuthModalOpen(false)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-[#444] bg-[#262626] text-stone-200' : 'border-[#e2d5c8] bg-white text-stone-600'}`}>닫기</button>
              </div>
              <form onSubmit={submitAuth} className="space-y-3 p-5">
                {authMode === 'signup' ? (
                  <>
                    <label className="block">
                      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>아이디</div>
                      <div className="flex gap-2">
                        <input value={authUsername} onChange={(event) => { setAuthUsername(event.target.value); setAuthCheckState((prev) => ({ ...prev, username: null })); }} placeholder="아이디 입력" className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                        <button type="button" onClick={() => checkDuplicate('username')} className="shrink-0 rounded-xl border border-[#c94d35] px-4 py-3 text-sm font-bold text-[#c94d35]">중복확인</button>
                      </div>
                    </label>
                    <label className="block">
                      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>닉네임</div>
                      <div className="flex gap-2">
                        <input value={authNickname} onChange={(event) => { setAuthNickname(event.target.value); setAuthCheckState((prev) => ({ ...prev, nickname: null })); }} placeholder="닉네임 입력" className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                        <button type="button" onClick={() => checkDuplicate('nickname')} className="shrink-0 rounded-xl border border-[#c94d35] px-4 py-3 text-sm font-bold text-[#c94d35]">중복확인</button>
                      </div>
                    </label>
                    <label className="block">
                      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>이메일</div>
                      <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="이메일 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>아이디 또는 이메일</div>
                    <input value={authIdentifier} onChange={(event) => setAuthIdentifier(event.target.value)} placeholder="아이디 또는 이메일 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                  </label>
                )}
                <label className="block">
                  <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>비밀번호</div>
                  <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="비밀번호 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                </label>
                {authMode === 'signup' ? (
                  <label className="block">
                    <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>비밀번호 확인</div>
                    <input value={authPasswordConfirm} onChange={(event) => setAuthPasswordConfirm(event.target.value)} type="password" placeholder="비밀번호 다시 입력" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`} />
                  </label>
                ) : null}
                {authMessage ? <div className={`text-sm ${textMuted}`}>{authMessage}</div> : null}
                {!hasSupabaseAuthConfig ? <div className={`text-sm ${textMuted}`}>인증 환경변수가 아직 연결되지 않았어.</div> : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" disabled={authLoading || !authPassword.trim() || !hasSupabaseAuthConfig || (authMode === 'login' ? !authIdentifier.trim() : !authEmail.trim() || !authUsername.trim() || !authNickname.trim() || !authPasswordConfirm.trim())} className="inline-flex rounded-full bg-[#c94d35] px-5 py-3 text-sm font-bold text-white disabled:opacity-45">{authLoading ? '처리 중...' : authMode === 'signup' ? '회원가입' : '로그인'}</button>
                  <button type="button" onClick={() => { setAuthMode((prev) => prev === 'signup' ? 'login' : 'signup'); setAuthMessage(''); }} className={`inline-flex rounded-full border px-5 py-3 text-sm font-bold ${subtleClass}`}>{authMode === 'signup' ? '로그인으로' : '회원가입으로'}</button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {selectedCommunityPost ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedCommunityPost(null)}>
            <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border shadow-2xl ${isDark ? 'border-[#363636] bg-[#202020]' : 'border-[#e4d7c7] bg-[#fffdf9]'}`} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-stone-900'}`}>{selectedCommunityPost.title}</h3>
                  <div className={`mt-2 flex flex-wrap gap-2 text-xs ${textMuted}`}>
                    <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>{selectedCommunityPost.nickname}</span>
                    {selectedCommunityPost.cardName ? <span className={`rounded-full border px-3 py-1 ${subtleClass}`}>{selectedCommunityPost.cardName}</span> : null}
                    {selectedCommunityPost.locked ? <span className="rounded-full bg-stone-900 px-3 py-1 text-white">🔒 관리자 전용</span> : null}
                    <span>조회 {selectedCommunityPost.views ?? 0}</span>
                    <span>좋아요 {selectedCommunityPost.likes ?? 0}</span>
                    <span>댓글 {selectedCommunityPost.commentCount ?? selectedCommunityPost.comments?.length ?? 0}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedCommunityPost(null)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-[#444] bg-[#262626] text-stone-200' : 'border-[#e2d5c8] bg-white text-stone-600'}`}>닫기</button>
              </div>
              <div className="space-y-4 p-5">
                {selectedCommunityPost.canReadContent && selectedCommunityPost.imageUrl ? <img src={selectedCommunityPost.imageUrl} alt={selectedCommunityPost.title} onError={placeholderImage} className="max-h-[520px] w-full rounded-xl border object-contain p-2" /> : null}
                <p className={`whitespace-pre-line text-sm leading-7 ${textMuted}`}>{selectedCommunityPost.content}</p>
                {selectedCommunityPost.canInteract ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => toggleCommunityLike(selectedCommunityPost.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${likedCommunityPostIds.includes(selectedCommunityPost.id) ? 'bg-pink-500 text-white' : `${subtleClass}`}`}>❤️ {(selectedCommunityPost.likes ?? 0)}</button>
                  </div>
                ) : null}
                <div className={`rounded-2xl border p-4 ${cardClass}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-base font-black">댓글</div>
                    <div className={`text-xs ${textMuted}`}>{selectedCommunityPost.commentCount ?? selectedCommunityPost.comments?.length ?? 0}개</div>
                  </div>
                  <div className="space-y-3">
                    {(selectedCommunityPost.comments ?? []).length ? (
                      selectedCommunityPost.comments.map((comment) => (
                        <div key={comment.id} className={`rounded-xl border px-4 py-3 ${subtleClass}`}>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold">{comment.nickname}</span>
                            <span className={textMuted}>{formatCommunityDate(comment.createdAt)}</span>
                          </div>
                          <p className={`mt-2 whitespace-pre-line text-sm leading-6 ${textMuted}`}>{comment.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className={`rounded-xl border px-4 py-6 text-center text-sm ${subtleClass}`}>아직 댓글이 없어.</div>
                    )}
                  </div>
                  {selectedCommunityPost.canInteract ? (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={communityCommentContent}
                        onChange={(event) => setCommunityCommentContent(event.target.value)}
                        placeholder="댓글 입력"
                        rows={3}
                        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} ${isDark ? 'placeholder:text-stone-500' : 'placeholder:text-stone-400'} focus:border-[#c94d35]`}
                      />
                      <div className="flex justify-end">
                        <button type="button" onClick={submitCommunityComment} disabled={communityCommentLoading || !communityCommentContent.trim()} className="inline-flex rounded-full bg-[#c94d35] px-4 py-2 text-sm font-bold text-white disabled:opacity-45">{communityCommentLoading ? '등록 중...' : '댓글 등록'}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition sm:px-5 lg:w-full lg:min-w-0 lg:px-3 lg:text-[13px] xl:px-4 xl:text-sm ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : 'border-[#d8cebf] bg-[#f7f3ed] text-stone-700 hover:border-[#cbbba8]'}`}
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
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold ${active ? 'border-[#c94d35] bg-[#c94d35] text-white' : 'border-[#d8cebf] bg-[#f7f3ed] text-stone-700'}`}
    >
      {label}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options, subtleClass, isDark }) {
  return (
    <label className="block">
      <div className={`mb-2 text-sm font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${subtleClass} focus:border-[#c94d35]`}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
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
