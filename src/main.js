import './styles.css';
import { cardSeries, rarityOrder } from './card-data.js';

const state = {
  selectedSeriesId: cardSeries[0]?.id ?? null,
  selectedRarity: 'ALL',
  search: ''
};

const app = document.querySelector('#app');

function getSelectedSeries() {
  return cardSeries.find((series) => series.id === state.selectedSeriesId) ?? cardSeries[0];
}

function getVisibleCards() {
  const series = getSelectedSeries();
  if (!series) return [];

  return series.cards.filter((card) => {
    const matchesRarity = state.selectedRarity === 'ALL' || card.rarity === state.selectedRarity;
    const keyword = state.search.trim().toLowerCase();
    const matchesSearch = !keyword || [card.name, card.number, card.type, card.color].some((value) =>
      String(value).toLowerCase().includes(keyword)
    );
    return matchesRarity && matchesSearch;
  });
}

function render() {
  const series = getSelectedSeries();
  const cards = getVisibleCards();

  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <p class="eyebrow">ONE PIECE TCG</p>
          <h1>카드 아카이브</h1>
          <p class="muted">시리즈별로 보고, 등급별로 바로 걸러보는 구조</p>
        </div>

        <nav class="series-list">
          ${cardSeries
            .map(
              (item) => `
                <button class="series-item ${item.id === state.selectedSeriesId ? 'active' : ''}" data-series-id="${item.id}">
                  <span class="series-code">${item.code}</span>
                  <span class="series-name">${item.name}</span>
                </button>
              `
            )
            .join('')}
        </nav>
      </aside>

      <main class="content">
        <section class="hero card-panel">
          <div>
            <p class="eyebrow">선택된 시리즈</p>
            <h2>${series.code} · ${series.name}</h2>
            <p class="muted">${series.description}</p>
          </div>
          <div class="hero-meta">
            <span class="meta-chip">카드 ${series.cards.length}장</span>
            <span class="meta-chip">표시 ${cards.length}장</span>
          </div>
        </section>

        <section class="toolbar card-panel">
          <div class="filter-group">
            <span class="filter-label">등급</span>
            <div class="rarity-list">
              ${rarityOrder
                .map(
                  (rarity) => `
                    <button class="rarity-chip ${rarity === state.selectedRarity ? 'active' : ''}" data-rarity="${rarity}">${rarity}</button>
                  `
                )
                .join('')}
            </div>
          </div>

          <label class="search-box">
            <span class="filter-label">검색</span>
            <input type="text" id="searchInput" placeholder="카드명 / 번호 / 타입" value="${escapeHtml(state.search)}" />
          </label>
        </section>

        <section class="cards-grid">
          ${cards.length ? cards.map(renderCard).join('') : '<div class="empty-state card-panel">조건에 맞는 카드가 없습니다.</div>'}
        </section>
      </main>
    </div>
  `;

  bindEvents();
}

function renderCard(card) {
  return `
    <article class="card-panel card-item">
      <div class="card-topline">
        <span class="card-number">${card.number}</span>
        <span class="rarity-badge">${card.rarity}</span>
      </div>
      <h3>${card.name}</h3>
      <div class="info-row"><span>타입</span><strong>${card.type}</strong></div>
      <div class="info-row"><span>색상</span><strong>${card.color}</strong></div>
      <div class="info-row"><span>코스트</span><strong>${card.cost}</strong></div>
      <div class="info-row"><span>파워</span><strong>${Number(card.power).toLocaleString()}</strong></div>
    </article>
  `;
}

function bindEvents() {
  document.querySelectorAll('[data-series-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSeriesId = button.dataset.seriesId;
      state.selectedRarity = 'ALL';
      state.search = '';
      render();
    });
  });

  document.querySelectorAll('[data-rarity]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedRarity = button.dataset.rarity;
      render();
    });
  });

  document.querySelector('#searchInput')?.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

render();
