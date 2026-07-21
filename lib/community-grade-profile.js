import { getCommunityGrade } from './community-grades.js';
import { supabaseAdmin } from './supabase-admin.js';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export async function resolveCommunityAuthorGrades(authorIds = []) {
  const ids = [...new Set(authorIds.map((value) => String(value || '').trim()).filter(isUuid))];
  if (!ids.length || !supabaseAdmin) return new Map();

  try {
    const { data, error } = await supabaseAdmin
      .from('community_point_ledger')
      .select('user_id,amount')
      .in('user_id', ids);
    if (error) throw error;

    const totals = new Map(ids.map((id) => [id, 0]));
    for (const row of data || []) {
      const userId = String(row.user_id || '');
      if (!totals.has(userId)) continue;
      totals.set(userId, totals.get(userId) + Number(row.amount || 0));
    }
    return new Map([...totals].map(([userId, points]) => [userId, getCommunityGrade(points).key]));
  } catch (error) {
    console.error('community_author_grades_failed', error?.message || error);
    return new Map();
  }
}
