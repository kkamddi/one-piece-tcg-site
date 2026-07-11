import { supabaseAdmin } from '../lib/supabase-admin.js';

const LISTINGS_TABLE = process.env.SUPABASE_MARKET_LISTINGS_TABLE || 'market_listings';
const LISTING_IMAGES_TABLE = process.env.SUPABASE_MARKET_LISTING_IMAGES_TABLE || 'market_listing_images';
const VERIFICATIONS_TABLE = process.env.SUPABASE_MARKET_VERIFICATIONS_TABLE || 'market_seller_verifications';
const INQUIRIES_TABLE = process.env.SUPABASE_MARKET_INQUIRIES_TABLE || 'market_inquiries';
const CONVERSATIONS_TABLE = process.env.SUPABASE_MARKET_CONVERSATIONS_TABLE || 'market_conversations';
const MESSAGES_TABLE = process.env.SUPABASE_MARKET_MESSAGES_TABLE || 'market_messages';
const NOTIFICATIONS_TABLE = process.env.SUPABASE_USER_NOTIFICATIONS_TABLE || 'user_notifications';

function getAuthToken(request) {
  const authHeader = String(request.headers.authorization ?? '');
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getAuthToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) throw error;
  return data?.user ?? null;
}

function isAdminUser(user) {
  return user?.user_metadata?.username === 'admin';
}

async function getApprovedVerification(userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .select('id,user_id,cafe_profile_url,status')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function isMissingTableError(error) {
  return error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('relation') && String(error?.message || '').toLowerCase().includes('does not exist');
}

function safeImageUrl(value) {
  const next = safeString(value, 1000);
  if (!next || next.startsWith('blob:') || next.startsWith('data:')) return '';
  if (next.startsWith('/') || next.startsWith('http://') || next.startsWith('https://')) return next;
  return '';
}

function normalizeImageUrls(value) {
  const urls = Array.isArray(value) ? value : [];
  return urls.map((url) => safeImageUrl(url)).filter(Boolean).slice(0, 6);
}

function getListingImageUrls(row = {}) {
  const urls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const normalized = normalizeImageUrls(urls);
  const primary = safeImageUrl(row.image_url);
  return [...new Set([primary, ...normalized].filter(Boolean))];
}

function decodeBase64(value) {
  const base64 = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) return null;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  return null;
}

function getImageExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'webp';
}

function parsePrice(value) {
  const number = Number(String(value ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(number) && number > 0 ? Math.min(number, 2_000_000_000) : null;
}

function formatTimeLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '방금 전 등록';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return '방금 전 등록';
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / 60000))}분 전 등록`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}시간 전 등록`;
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

function mapListing(row = {}, verification = null) {
  const tags = [...new Set([
    row.trade_type,
    ...(Array.isArray(row.tags) ? row.tags : [row.locale, row.condition, row.delivery])
  ].filter(Boolean))];
  const price = row.negotiable
    ? '가격 협의'
    : row.price_krw
      ? `₩ ${Number(row.price_krw).toLocaleString('ko-KR')}`
      : '가격 미입력';
  const sellerVerified = Boolean(verification) || Boolean(row.seller_verified);
  return {
    id: row.id,
    sellerUserId: row.seller_user_id || '',
    cardId: row.card_id || '',
    cardNo: row.card_no || '',
    locale: row.locale || '',
    cardName: row.card_name || '',
    tradeType: row.trade_type || '',
    condition: row.condition || '',
    priceKrw: row.price_krw ?? null,
    negotiable: Boolean(row.negotiable),
    delivery: row.delivery || '',
    region: row.region || '',
    title: row.title || '',
    subtitle: [row.card_no, row.card_name, row.condition].filter(Boolean).join(' · ') || row.condition || '',
    price,
    time: formatTimeLabel(row.created_at),
    seller: row.seller_display_name || '판매자',
    sellerNote: '카페 인증 상태와 거래 조건을 확인하세요.',
    sellerStatus: sellerVerified ? '인증 완료' : '로그인 판매자',
    rawStatus: row.status || 'active',
    sellerProfileUrl: verification?.cafe_profile_url || '',
    description: row.description || '판매자가 상세 설명을 입력하지 않았습니다.',
    tags,
    likes: `관심 ${Number(row.likes_count || 0)}`,
    views: `조회 ${Number(row.views_count || 0)}`,
    likesCount: Number(row.likes_count || 0),
    viewsCount: Number(row.views_count || 0),
    imageUrl: row.image_url || '/card-placeholder.svg',
    imageUrls: getListingImageUrls(row)
  };
}

async function mapListingWithSellerVerification(row = {}) {
  const verification = await getApprovedVerification(row.seller_user_id);
  if (!verification) return null;
  const [withImages] = await attachListingImages([row]);
  return mapListing(withImages || row, verification);
}

async function attachListingImages(rows) {
  const listingIds = rows.map((row) => row.id).filter(Boolean);
  if (!listingIds.length) return rows;
  const { data, error } = await supabaseAdmin
    .from(LISTING_IMAGES_TABLE)
    .select('listing_id,image_url,sort_order')
    .in('listing_id', listingIds)
    .order('sort_order', { ascending: true });
  if (error && isMissingTableError(error)) return rows;
  if (error) throw error;
  const imagesByListing = new Map();
  (data ?? []).forEach((row) => {
    const current = imagesByListing.get(row.listing_id) || [];
    current.push(row.image_url);
    imagesByListing.set(row.listing_id, current);
  });
  return rows.map((row) => ({ ...row, image_urls: imagesByListing.get(row.id) || [] }));
}

async function listListings(request, response) {
  const cardId = safeString(request.query?.cardId, 160);
  let query = supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(100);

  if (cardId) query = query.eq('card_id', cardId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = await attachListingImages(data ?? []);
  const sellerIds = [...new Set(rows.map((row) => row.seller_user_id).filter(Boolean))];
  let verificationByUser = new Map();
  if (sellerIds.length) {
    const { data: verificationRows, error: verificationError } = await supabaseAdmin
      .from(VERIFICATIONS_TABLE)
      .select('user_id,cafe_profile_url,status')
      .eq('status', 'approved')
      .in('user_id', sellerIds);
    if (!verificationError) {
      verificationByUser = new Map((verificationRows ?? []).map((row) => [row.user_id, row]));
    }
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  const verifiedRows = rows.filter((row) => verificationByUser.has(row.seller_user_id));
  return response.status(200).json({ listings: verifiedRows.map((row) => mapListing(row, verificationByUser.get(row.seller_user_id))) });
}

async function incrementListingView(request, response) {
  const listingId = safeString(request.query?.id || request.body?.id, 80);
  if (!listingId) return response.status(400).json({ error: 'invalid_listing_id' });
  const { data: listing, error: listingError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('*')
    .eq('id', listingId)
    .neq('status', 'deleted')
    .single();
  if (listingError) throw listingError;
  if (!listing) return response.status(404).json({ error: 'listing_not_found' });
  const nextViews = Math.max(0, Number(listing.views_count || 0)) + 1;
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ views_count: nextViews })
    .eq('id', listingId)
    .select('*')
    .single();
  if (error) throw error;
  const mappedListing = await mapListingWithSellerVerification(data);
  if (!mappedListing) return response.status(404).json({ error: 'listing_not_found' });
  return response.status(200).json({ listing: mappedListing });
}

async function updateListingInterest(request, response, user) {
  const body = request.body ?? {};
  const listingId = safeString(request.query?.id || body.listingId || body.id, 80);
  if (!listingId) return response.status(400).json({ error: 'invalid_listing_id' });
  const active = Boolean(body.active);
  const { data: listing, error: listingError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('*')
    .eq('id', listingId)
    .neq('status', 'deleted')
    .single();
  if (listingError) throw listingError;
  if (!listing) return response.status(404).json({ error: 'listing_not_found' });
  if (listing.seller_user_id === user.id) return response.status(409).json({ error: 'cannot_like_own_listing' });
  const currentLikes = Math.max(0, Number(listing.likes_count || 0));
  const nextLikes = Math.max(0, currentLikes + (active ? 1 : -1));
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ likes_count: nextLikes })
    .eq('id', listingId)
    .select('*')
    .single();
  if (error) throw error;
  const mappedListing = await mapListingWithSellerVerification(data);
  if (!mappedListing) return response.status(404).json({ error: 'listing_not_found' });
  return response.status(200).json({ listing: mappedListing, interested: active });
}

async function createListing(request, response, user) {
  const approvedVerification = await getApprovedVerification(user.id);
  if (!approvedVerification) return response.status(403).json({ error: 'seller_not_verified' });
  const body = request.body ?? {};
  const title = safeString(body.title, 120);
  const priceKrw = parsePrice(body.priceKrw ?? body.price);
  const negotiable = Boolean(body.negotiable);
  if (!title || (!negotiable && !priceKrw)) {
    return response.status(400).json({ error: 'invalid_listing' });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count: todayCount, error: countError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('seller_user_id', user.id)
    .gte('created_at', dayStart.toISOString())
    .neq('status', 'deleted');
  if (countError) throw countError;
  if (Number(todayCount || 0) >= 5) {
    return response.status(429).json({ error: 'daily_listing_limit_exceeded' });
  }

  const imageUrls = normalizeImageUrls(body.imageUrls);
  const primaryImageUrl = imageUrls[0] || safeImageUrl(body.imageUrl);
  const row = {
    seller_user_id: user.id,
    seller_display_name: safeString(body.sellerDisplayName || user.user_metadata?.nickname || user.user_metadata?.username || user.email?.split('@')[0] || '판매자', 80),
    card_id: safeString(body.cardId, 160),
    card_no: safeString(body.cardNo, 80),
    locale: safeString(body.locale, 12),
    card_name: safeString(body.cardName, 160),
    title,
    trade_type: safeString(body.tradeType, 30) || '판매',
    condition: safeString(body.condition, 30) || '일반',
    price_krw: priceKrw,
    negotiable,
    delivery: safeString(body.delivery, 30) || '택배',
    region: safeString(body.region, 80),
    description: safeString(body.description, 2000),
    image_url: primaryImageUrl,
    tags: Array.isArray(body.tags) ? body.tags.map((tag) => safeString(tag, 30)).filter(Boolean).slice(0, 8) : []
  };

  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  if (imageUrls.length) {
    const { error: imagesError } = await supabaseAdmin
      .from(LISTING_IMAGES_TABLE)
      .insert(imageUrls.map((imageUrl, index) => ({
        listing_id: data.id,
        image_url: imageUrl,
        sort_order: index
      })));
    if (imagesError && !isMissingTableError(imagesError)) throw imagesError;
  }
  return response.status(201).json({ listing: mapListing({ ...data, image_urls: imageUrls }, approvedVerification) });
}

async function getListingForOwner(listingId, user) {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('*')
    .eq('id', listingId)
    .single();
  if (error) throw error;
  if (!data) return null;
  if (!isAdminUser(user) && data.seller_user_id !== user.id) return 'forbidden';
  return data;
}

async function updateListing(request, response, user) {
  const listingId = safeString(request.query?.id, 80);
  if (!listingId) return response.status(400).json({ error: 'invalid_listing_id' });
  const existing = await getListingForOwner(listingId, user);
  if (!existing) return response.status(404).json({ error: 'listing_not_found' });
  if (existing === 'forbidden') return response.status(403).json({ error: 'forbidden' });

  const body = request.body ?? {};
  const patch = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    const status = safeString(body.status, 20);
    if (!['active', 'hidden', 'closed', 'deleted'].includes(status)) return response.status(400).json({ error: 'invalid_listing_status' });
    patch.status = status;
  }
  if (body.title !== undefined) patch.title = safeString(body.title, 120);
  if (body.tradeType !== undefined) patch.trade_type = safeString(body.tradeType, 30) || existing.trade_type;
  if (body.condition !== undefined) patch.condition = safeString(body.condition, 30) || existing.condition;
  if (body.priceKrw !== undefined || body.price !== undefined) patch.price_krw = parsePrice(body.priceKrw ?? body.price);
  if (body.negotiable !== undefined) patch.negotiable = Boolean(body.negotiable);
  if (body.delivery !== undefined) patch.delivery = safeString(body.delivery, 30) || existing.delivery;
  if (body.region !== undefined) patch.region = safeString(body.region, 80);
  if (body.description !== undefined) patch.description = safeString(body.description, 2000);
  const imageUrls = body.imageUrls !== undefined ? normalizeImageUrls(body.imageUrls) : null;
  if (imageUrls?.length) patch.image_url = imageUrls[0];
  else if (body.imageUrl !== undefined) patch.image_url = safeImageUrl(body.imageUrl);
  if (Array.isArray(body.tags)) patch.tags = body.tags.map((tag) => safeString(tag, 30)).filter(Boolean).slice(0, 8);

  if (patch.title === '') return response.status(400).json({ error: 'invalid_listing' });
  if (patch.negotiable === false && patch.price_krw === null) return response.status(400).json({ error: 'invalid_listing' });

  const verification = await getApprovedVerification(existing.seller_user_id);
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update(patch)
    .eq('id', listingId)
    .select('*')
    .single();
  if (error) throw error;
  if (patch.status === 'closed') {
    const { error: closeConversationError } = await supabaseAdmin
      .from(CONVERSATIONS_TABLE)
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('listing_id', listingId)
      .neq('status', 'deleted');
    if (closeConversationError && !isMissingTableError(closeConversationError)) throw closeConversationError;
  }
  if (patch.status === 'active') {
    const { error: openConversationError } = await supabaseAdmin
      .from(CONVERSATIONS_TABLE)
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('listing_id', listingId)
      .eq('status', 'closed');
    if (openConversationError && !isMissingTableError(openConversationError)) throw openConversationError;
  }
  if (imageUrls?.length) {
    const { error: deleteImagesError } = await supabaseAdmin
      .from(LISTING_IMAGES_TABLE)
      .delete()
      .eq('listing_id', listingId);
    if (deleteImagesError && !isMissingTableError(deleteImagesError)) throw deleteImagesError;
    const { error: insertImagesError } = await supabaseAdmin
      .from(LISTING_IMAGES_TABLE)
      .insert(imageUrls.map((imageUrl, index) => ({
        listing_id: listingId,
        image_url: imageUrl,
        sort_order: index
      })));
    if (insertImagesError && !isMissingTableError(insertImagesError)) throw insertImagesError;
  }
  return response.status(200).json({ listing: mapListing({ ...data, image_urls: imageUrls || [] }, verification) });
}

async function deleteListing(request, response, user) {
  const listingId = safeString(request.query?.id, 80);
  if (!listingId) return response.status(400).json({ error: 'invalid_listing_id' });
  const existing = await getListingForOwner(listingId, user);
  if (!existing) return response.status(404).json({ error: 'listing_not_found' });
  if (existing === 'forbidden') return response.status(403).json({ error: 'forbidden' });
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', listingId)
    .select('id')
    .single();
  if (error) throw error;
  return response.status(200).json({ success: true, id: data?.id || listingId });
}

async function uploadListingImage(request, response, user) {
  const bucket = process.env?.CARD_THUMBNAILS;
  if (!bucket || typeof bucket.put !== 'function') {
    return response.status(503).json({ error: 'image_bucket_unavailable' });
  }
  const body = request.body ?? {};
  const mimeType = safeString(body.mimeType, 80) || 'image/webp';
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(mimeType)) {
    return response.status(400).json({ error: 'invalid_image_type' });
  }
  const bytes = decodeBase64(body.data);
  if (!bytes?.byteLength) return response.status(400).json({ error: 'invalid_image' });
  if (bytes.byteLength > 900 * 1024) return response.status(413).json({ error: 'image_too_large' });

  const key = `market/listings/${user.id}/${Date.now()}-${crypto.randomUUID()}.${getImageExtension(mimeType)}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: mimeType }
  });
  return response.status(201).json({
    key,
    imageUrl: `/api/card-thumb?key=${encodeURIComponent(key)}`
  });
}

async function getMyVerification(response, user) {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return response.status(200).json({ verification: data?.[0] ?? null });
}

async function startConversation(request, response, user) {
  const body = request.body ?? {};
  const listingId = safeString(body.listingId, 80);
  const message = safeString(body.message, 2000);
  if (!listingId || !message) return response.status(400).json({ error: 'invalid_message' });

  const { data: listing, error: listingError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('id,title,seller_user_id,status')
    .eq('id', listingId)
    .single();
  if (listingError) throw listingError;
  if (!listing || listing.status !== 'active') return response.status(404).json({ error: 'listing_not_found' });
  if (listing.seller_user_id === user.id) return response.status(400).json({ error: 'cannot_message_own_listing' });

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from(CONVERSATIONS_TABLE)
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_user_id', user.id)
    .limit(1);
  if (existingError && isMissingTableError(existingError)) {
    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from(INQUIRIES_TABLE)
      .insert({
        listing_id: listingId,
        buyer_user_id: user.id,
        message,
        status: 'open'
      })
      .select('*')
      .single();
    if (inquiryError) throw inquiryError;
    return response.status(201).json({ inquiry });
  }
  if (existingError) throw existingError;

  let conversation = existingRows?.[0] ?? null;
  if (!conversation) {
    const { data, error } = await supabaseAdmin
      .from(CONVERSATIONS_TABLE)
      .insert({
        listing_id: listingId,
        seller_user_id: listing.seller_user_id,
        buyer_user_id: user.id,
        status: 'open',
        last_message_at: new Date().toISOString()
      })
      .select('*')
      .single();
    if (error && isMissingTableError(error)) {
      const { data: inquiry, error: inquiryError } = await supabaseAdmin
        .from(INQUIRIES_TABLE)
        .insert({
          listing_id: listingId,
          buyer_user_id: user.id,
          message,
          status: 'open'
        })
        .select('*')
        .single();
      if (inquiryError) throw inquiryError;
      return response.status(201).json({ inquiry });
    }
    if (error) throw error;
    conversation = data;
  }

  const { data: messageRow, error: messageError } = await supabaseAdmin
    .from(MESSAGES_TABLE)
    .insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      body: message
    })
    .select('*')
    .single();
  if (messageError && isMissingTableError(messageError)) {
    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from(INQUIRIES_TABLE)
      .insert({
        listing_id: listingId,
        buyer_user_id: user.id,
        message,
        status: 'open'
      })
      .select('*')
      .single();
    if (inquiryError) throw inquiryError;
    return response.status(201).json({ inquiry });
  }
  if (messageError) throw messageError;

  await supabaseAdmin
    .from(CONVERSATIONS_TABLE)
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', conversation.id);

  await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .insert({
      user_id: listing.seller_user_id,
      type: 'market_message',
      title: '거래 문의가 도착했습니다.',
      body: listing.title,
      link_url: `/market?conversationId=${conversation.id}`,
      payload_json: {
        listingId,
        conversationId: conversation.id,
        messageId: messageRow.id
      }
    });

  return response.status(201).json({ conversation, message: messageRow });
}

function mapConversation(row = {}, listing = {}, latestMessage = null, viewerId = '') {
  const isSeller = row.seller_user_id === viewerId;
  const otherUserId = isSeller ? row.buyer_user_id : row.seller_user_id;
  return {
    id: row.id,
    listingId: row.listing_id,
    role: isSeller ? 'seller' : 'buyer',
    otherUserId,
    otherUserLabel: isSeller ? `문의자 ${String(otherUserId || '').slice(0, 8)}` : '판매자',
    title: listing?.title || '거래 문의',
    cardNo: listing?.card_no || '',
    cardName: listing?.card_name || '',
    imageUrl: listing?.image_url || '/card-placeholder.svg',
    listingStatus: listing?.status || '',
    status: row.status || 'open',
    lastMessage: latestMessage?.body || '',
    lastMessageAt: formatTimeLabel(latestMessage?.created_at || row.last_message_at || row.updated_at || row.created_at),
    rawLastMessageAt: latestMessage?.created_at || row.last_message_at || row.updated_at || row.created_at
  };
}

function mapMarketMessage(row = {}, viewerId = '') {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    isMine: row.sender_user_id === viewerId,
    body: row.body || '',
    time: formatTimeLabel(row.created_at),
    createdAt: row.created_at
  };
}

async function getConversationForParticipant(conversationId, user) {
  const { data, error } = await supabaseAdmin
    .from(CONVERSATIONS_TABLE)
    .select('*')
    .eq('id', conversationId)
    .or(`seller_user_id.eq.${user.id},buyer_user_id.eq.${user.id}`)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function listConversations(response, user) {
  const { data: rows, error } = await supabaseAdmin
    .from(CONVERSATIONS_TABLE)
    .select('*')
    .or(`seller_user_id.eq.${user.id},buyer_user_id.eq.${user.id}`)
    .neq('status', 'deleted')
    .order('last_message_at', { ascending: false });
  if (error && isMissingTableError(error)) return response.status(200).json({ conversations: [] });
  if (error) throw error;
  const conversations = rows ?? [];
  const listingIds = [...new Set(conversations.map((row) => row.listing_id).filter(Boolean))];
  const conversationIds = conversations.map((row) => row.id).filter(Boolean);
  let listingsById = new Map();
  if (listingIds.length) {
    const { data: listingRows, error: listingError } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select('id,title,card_no,card_name,image_url,status')
      .in('id', listingIds);
    if (listingError) throw listingError;
    listingsById = new Map((listingRows ?? []).map((row) => [row.id, row]));
  }
  let latestByConversation = new Map();
  if (conversationIds.length) {
    const { data: messageRows, error: messageError } = await supabaseAdmin
      .from(MESSAGES_TABLE)
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(200);
    if (messageError && !isMissingTableError(messageError)) throw messageError;
    latestByConversation = new Map();
    (messageRows ?? []).forEach((row) => {
      if (!latestByConversation.has(row.conversation_id)) latestByConversation.set(row.conversation_id, row);
    });
  }
  return response.status(200).json({
    conversations: conversations.map((row) => mapConversation(
      row,
      listingsById.get(row.listing_id),
      latestByConversation.get(row.id),
      user.id
    ))
  });
}

async function listConversationMessages(request, response, user) {
  const conversationId = safeString(request.query?.id, 80);
  if (!conversationId) return response.status(400).json({ error: 'invalid_conversation_id' });
  const conversation = await getConversationForParticipant(conversationId, user);
  if (!conversation) return response.status(404).json({ error: 'conversation_not_found' });
  const { data, error } = await supabaseAdmin
    .from(MESSAGES_TABLE)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return response.status(200).json({
    conversation,
    messages: (data ?? []).map((row) => mapMarketMessage(row, user.id))
  });
}

async function sendConversationMessage(request, response, user) {
  const body = request.body ?? {};
  const conversationId = safeString(body.conversationId, 80);
  const message = safeString(body.message, 2000);
  if (!conversationId || !message) return response.status(400).json({ error: 'invalid_message' });
  const conversation = await getConversationForParticipant(conversationId, user);
  if (!conversation || conversation.status !== 'open') return response.status(404).json({ error: 'conversation_not_found' });
  const { data: listing, error: listingError } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select('id,status')
    .eq('id', conversation.listing_id)
    .single();
  if (listingError) throw listingError;
  if (!listing || listing.status === 'closed' || listing.status === 'deleted') {
    return response.status(409).json({ error: 'listing_closed' });
  }
  const { data: messageRow, error } = await supabaseAdmin
    .from(MESSAGES_TABLE)
    .insert({
      conversation_id: conversationId,
      sender_user_id: user.id,
      body: message
    })
    .select('*')
    .single();
  if (error) throw error;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from(CONVERSATIONS_TABLE)
    .update({ last_message_at: now, updated_at: now })
    .eq('id', conversationId);

  return response.status(201).json({ message: mapMarketMessage(messageRow, user.id) });
}

async function listNotifications(response, user) {
  const { data, error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .neq('type', 'price_alert_rule')
    .neq('type', 'market_message')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return response.status(200).json({ notifications: data ?? [] });
}

async function markNotificationRead(request, response, user) {
  const id = safeString(request.query?.id, 80);
  if (!id) return response.status(400).json({ error: 'missing_notification_id' });
  const { data, error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .neq('type', 'price_alert_rule')
    .neq('type', 'market_message')
    .select('*')
    .single();
  if (error) throw error;
  return response.status(200).json({ notification: data });
}

async function markAllNotificationsRead(response, user) {
  const { error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .neq('type', 'price_alert_rule')
    .neq('type', 'market_message');
  if (error) throw error;
  return response.status(200).json({ ok: true });
}

async function submitVerification(request, response, user) {
  const body = request.body ?? {};
  const cafeNickname = safeString(body.cafeNickname, 80);
  const cafeProfileUrl = safeString(body.cafeProfileUrl, 500);
  if (!cafeNickname || !cafeProfileUrl) return response.status(400).json({ error: 'invalid_verification' });

  const { data: duplicateRows, error: duplicateError } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .select('id,user_id,status')
    .eq('cafe_profile_url', cafeProfileUrl)
    .neq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .limit(1);
  if (duplicateError) throw duplicateError;
  if (duplicateRows?.length) {
    return response.status(409).json({ error: 'duplicate_cafe_profile' });
  }

  const row = {
    user_id: user.id,
    cafe_nickname: cafeNickname,
    cafe_profile_url: cafeProfileUrl,
    cafe_grade: safeString(body.cafeGrade, 80),
    note: safeString(body.note, 1000),
    status: 'pending',
    updated_at: new Date().toISOString()
  };

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    const { data, error } = await supabaseAdmin
      .from(VERIFICATIONS_TABLE)
      .update(row)
      .eq('id', existingId)
      .select('*')
      .single();
    if (error) throw error;
    return response.status(200).json({ verification: data });
  }

  const { data, error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return response.status(201).json({ verification: data });
}

async function listVerifications(response) {
  const { data, error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return response.status(200).json({ verifications: data ?? [] });
}

async function updateVerification(request, response, user) {
  const id = safeString(request.query?.id, 80);
  const status = safeString(request.body?.status, 20);
  if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
    return response.status(400).json({ error: 'invalid_verification_update' });
  }
  const { data, error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return response.status(200).json({ verification: data });
}

async function deleteVerification(request, response) {
  const id = safeString(request.query?.id, 80);
  if (!id) return response.status(400).json({ error: 'invalid_verification_delete' });
  const { error } = await supabaseAdmin
    .from(VERIFICATIONS_TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return response.status(200).json({ success: true, id });
}

export default async function handler(request, response) {
  response.setHeader?.('Cache-Control', 'no-store, private');
  response.setHeader?.('Vary', 'Authorization');
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  const action = safeString(request.query?.action, 40);
  const user = await getAuthenticatedUser(request);

  if (request.method === 'GET' && !action) return listListings(request, response);
  if (request.method === 'POST' && action === 'listing-view') return incrementListingView(request, response);

  if (!user?.id) return response.status(401).json({ error: 'unauthorized' });

  if (request.method === 'GET' && action === 'my-verification') return getMyVerification(response, user);
  if (request.method === 'POST' && action === 'conversation') return startConversation(request, response, user);
  if (request.method === 'GET' && action === 'conversations') return listConversations(response, user);
  if (request.method === 'GET' && action === 'messages') return listConversationMessages(request, response, user);
  if (request.method === 'POST' && action === 'message') return sendConversationMessage(request, response, user);
  if (request.method === 'GET' && action === 'notifications') return listNotifications(response, user);
  if (request.method === 'PATCH' && action === 'notification') return markNotificationRead(request, response, user);
  if (request.method === 'PATCH' && action === 'notifications-read-all') return markAllNotificationsRead(response, user);
  if (request.method === 'POST' && action === 'image') return uploadListingImage(request, response, user);
  if (request.method === 'POST' && action === 'listing-interest') return updateListingInterest(request, response, user);
  if (request.method === 'POST' && action === 'listing') return createListing(request, response, user);
  if (request.method === 'PATCH' && action === 'listing') return updateListing(request, response, user);
  if (request.method === 'DELETE' && action === 'listing') return deleteListing(request, response, user);
  if (request.method === 'POST' && action === 'verification') return submitVerification(request, response, user);

  if (!isAdminUser(user)) return response.status(403).json({ error: 'forbidden' });
  if (request.method === 'GET' && action === 'verifications') return listVerifications(response);
  if (request.method === 'PATCH' && action === 'verification') return updateVerification(request, response, user);
  if (request.method === 'DELETE' && action === 'verification') return deleteVerification(request, response);

  return response.status(405).json({ error: 'method_not_allowed' });
}
