const ROUND_SIZES = new Set([16, 32, 64, 128]);
const MAX_RANKING_ROWS = 100;

function getD1() {
  const binding = process.env?.OPTCG_PUBLIC_D1 || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

function isEligibleCard(card) {
  const rarity = String(card?.rarity || '').toUpperCase().replace(/[^A-Z]/g, '');
  const isParallel = /_p\d+$/i.test(String(card?.id || ''))
    && card?.series_id === card?.origin_series_id;
  return (isParallel && ['R', 'SR', 'L'].includes(rarity))
    || ['SEC', 'SP', 'TR'].includes(rarity);
}

function normalizeResults(value, roundSize) {
  if (!Array.isArray(value) || value.length !== roundSize) return null;
  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    const id = String(item?.id || '').trim();
    const matches = Number(item?.matches || 0);
    const wins = Number(item?.wins || 0);
    if (!id || id.length > 100 || seen.has(id) || !Number.isInteger(matches) || !Number.isInteger(wins)
      || matches < 1 || wins < 0 || wins > matches || matches > 7) return null;
    seen.add(id);
    normalized.push({ id, matches, wins });
  }
  const totalMatches = normalized.reduce((sum, item) => sum + item.matches, 0);
  const totalWins = normalized.reduce((sum, item) => sum + item.wins, 0);
  return totalMatches === (roundSize - 1) * 2 && totalWins === roundSize - 1 ? normalized : null;
}

async function readRanking(db) {
  const [rankingResult, totalsResult] = await db.batch([
    db.prepare(
      `SELECT card_id, card_no, card_name, image_url, titles, match_wins, matches
       FROM card_world_cup_stats
       WHERE titles > 0
       ORDER BY titles DESC, (match_wins * 1.0 / MAX(matches, 1)) DESC, match_wins DESC
       LIMIT ?`
    ).bind(MAX_RANKING_ROWS),
    db.prepare('SELECT completed_tournaments FROM card_world_cup_totals WHERE id = 1')
  ]);
  const completedTournaments = Number(totalsResult?.results?.[0]?.completed_tournaments || 0);
  return {
    completedTournaments,
    ranking: (rankingResult?.results || []).map((row) => ({
      id: row.card_id,
      cardNo: row.card_no,
      name: row.card_name,
      imageUrl: row.image_url,
      titles: Number(row.titles || 0),
      matchWins: Number(row.match_wins || 0),
      matches: Number(row.matches || 0),
      titleRate: completedTournaments > 0 ? (Number(row.titles || 0) / completedTournaments) * 100 : 0,
      winRate: Number(row.matches || 0) > 0 ? (Number(row.match_wins || 0) / Number(row.matches)) * 100 : 0
    }))
  };
}

export default async function handler(request, response) {
  const db = getD1();
  if (!db) return response.status(503).json({ error: 'ranking_storage_unavailable' });

  if (request.method === 'GET') {
    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response.status(200).json(await readRanking(db));
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  const eventId = String(request.body?.eventId || '').trim();
  const championId = String(request.body?.championId || '').trim();
  const roundSize = Number(request.body?.roundSize || 0);
  const results = normalizeResults(request.body?.results, roundSize);
  if (!/^[a-f0-9-]{36}$/i.test(eventId) || !ROUND_SIZES.has(roundSize) || !results
    || !results.some((item) => item.id === championId && item.wins === Math.log2(roundSize))) {
    return response.status(400).json({ error: 'invalid_tournament_result' });
  }

  const idsJson = JSON.stringify(results.map((item) => item.id));
  const cardsResult = await db.prepare(
    `SELECT id, card_no, name, image_url, rarity, series_id, origin_series_id
     FROM cards
     WHERE locale = 'JP' AND id IN (SELECT value FROM json_each(?))`
  ).bind(idsJson).all();
  const cards = (cardsResult?.results || []).filter(isEligibleCard);
  if (cards.length !== roundSize) return response.status(400).json({ error: 'invalid_tournament_cards' });

  const resultById = new Map(results.map((item) => [item.id, item]));
  const aggregate = cards.map((card) => ({
    id: card.id,
    cardNo: card.card_no || '',
    name: card.name,
    imageUrl: card.image_url || '',
    titles: card.id === championId ? 1 : 0,
    matches: resultById.get(card.id).matches,
    wins: resultById.get(card.id).wins
  }));
  const aggregateJson = JSON.stringify(aggregate);

  await db.batch([
    db.prepare(
      `INSERT INTO card_world_cup_events (event_id, round_size, champion_card_id, processed, completed_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
       ON CONFLICT(event_id) DO NOTHING`
    ).bind(eventId, roundSize, championId),
    db.prepare(
      `INSERT INTO card_world_cup_stats
         (card_id, card_no, card_name, image_url, titles, match_wins, matches, updated_at)
       SELECT
         json_extract(value, '$.id'), json_extract(value, '$.cardNo'), json_extract(value, '$.name'),
         json_extract(value, '$.imageUrl'), json_extract(value, '$.titles'),
         json_extract(value, '$.wins'), json_extract(value, '$.matches'), CURRENT_TIMESTAMP
       FROM json_each(?)
       WHERE EXISTS (SELECT 1 FROM card_world_cup_events WHERE event_id = ? AND processed = 0)
       ON CONFLICT(card_id) DO UPDATE SET
         card_no = excluded.card_no, card_name = excluded.card_name, image_url = excluded.image_url,
         titles = card_world_cup_stats.titles + excluded.titles,
         match_wins = card_world_cup_stats.match_wins + excluded.match_wins,
         matches = card_world_cup_stats.matches + excluded.matches,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(aggregateJson, eventId),
    db.prepare(
      `INSERT INTO card_world_cup_totals (id, completed_tournaments, updated_at)
       SELECT 1, 1, CURRENT_TIMESTAMP
       WHERE EXISTS (SELECT 1 FROM card_world_cup_events WHERE event_id = ? AND processed = 0)
       ON CONFLICT(id) DO UPDATE SET
         completed_tournaments = card_world_cup_totals.completed_tournaments + 1,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(eventId),
    db.prepare('UPDATE card_world_cup_events SET processed = 1 WHERE event_id = ? AND processed = 0').bind(eventId)
  ]);

  return response.status(200).json(await readRanking(db));
}
