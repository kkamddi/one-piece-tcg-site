import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addCommunityComment,
  checkInCommunityAttendance,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityAttendance,
  fetchCommunityComments,
  fetchCommunityPosts,
  incrementCommunityPostView,
  toggleCommunityPostLike,
  uploadCommunityImage
} from './api/community';

const COMMUNITY_BOARDS = [
  { id: 'all', kr: '전체', en: 'All', jp: 'すべて' },
  { id: 'question', kr: '질문', en: 'Questions', jp: '質問' },
  { id: 'free', kr: '자유', en: 'General', jp: 'フリー' },
  { id: 'event', kr: '이벤트', en: 'Events', jp: 'イベント' }
];
const COMMUNITY_IMAGE_CONSENT_KEY = 'card-pone-community-image-consent-v1';

function localeText(uiLang, kr, en, jp) {
  if (uiLang === 'JP') return jp || en || kr;
  if (uiLang === 'EN') return en || kr;
  return kr;
}

function getBoard(boardId) {
  return COMMUNITY_BOARDS.find((board) => board.id === boardId)
    || COMMUNITY_BOARDS.find((board) => board.id === 'free');
}

function formatCommunityDate(value, uiLang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(uiLang === 'JP' ? 'ja-JP' : uiLang === 'EN' ? 'en-US' : 'ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressCommunityImage(file) {
  const source = await readFileAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const maxSide = 1200;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  let compressedBlob = null;
  for (const quality of [0.82, 0.68, 0.52]) {
    compressedBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (compressedBlob && compressedBlob.size <= 880 * 1024) break;
  }
  if (!compressedBlob) throw new Error('image_compression_failed');
  const dataUrl = await readFileAsDataUrl(compressedBlob);
  return {
    data: dataUrl.replace(/^data:[^;]+;base64,/, ''),
    mimeType: compressedBlob.type || 'image/webp'
  };
}

function getPopularScore(post, windowMs) {
  const age = Math.max(0, Date.now() - new Date(post.createdAt).getTime());
  const freshness = Math.max(0, 1 - age / windowMs) * 4;
  return Number(post.likes || 0) * 3
    + Number(post.commentCount || 0) * 5
    + Math.min(Number(post.views || 0), 1000) * 0.15
    + freshness;
}

function useCommunityModalScrollLock(active) {
  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const body = document.body;
    const doc = document.documentElement;
    const lockCount = Number(body.dataset.renewModalLockCount || 0);
    const scrollY = lockCount ? Number(body.dataset.renewModalScrollY || 0) : window.scrollY || doc.scrollTop || 0;
    if (!lockCount) {
      body.dataset.renewModalScrollY = String(scrollY);
      body.dataset.renewModalPrevPosition = body.style.position || '';
      body.dataset.renewModalPrevTop = body.style.top || '';
      body.dataset.renewModalPrevWidth = body.style.width || '';
      body.dataset.renewModalPrevOverflow = body.style.overflow || '';
      body.dataset.renewModalPrevHtmlOverflow = doc.style.overflow || '';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      doc.style.overflow = 'hidden';
    }
    body.dataset.renewModalLockCount = String(lockCount + 1);
    return () => {
      const nextCount = Math.max(0, Number(body.dataset.renewModalLockCount || 1) - 1);
      body.dataset.renewModalLockCount = String(nextCount);
      if (nextCount) return;
      const restoreY = Number(body.dataset.renewModalScrollY || 0);
      body.style.position = body.dataset.renewModalPrevPosition || '';
      body.style.top = body.dataset.renewModalPrevTop || '';
      body.style.width = body.dataset.renewModalPrevWidth || '';
      body.style.overflow = body.dataset.renewModalPrevOverflow || '';
      doc.style.overflow = body.dataset.renewModalPrevHtmlOverflow || '';
      delete body.dataset.renewModalLockCount;
      delete body.dataset.renewModalScrollY;
      delete body.dataset.renewModalPrevPosition;
      delete body.dataset.renewModalPrevTop;
      delete body.dataset.renewModalPrevWidth;
      delete body.dataset.renewModalPrevOverflow;
      delete body.dataset.renewModalPrevHtmlOverflow;
      window.scrollTo(0, restoreY);
    };
  }, [active]);
}

export default function CommunityPage({ authUser, displayName, uiLang = 'KR', onRequireLogin }) {
  const viewerToken = authUser?.id || '';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [activeBoard, setActiveBoard] = useState('all');
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBoard, setComposerBoard] = useState('question');
  const [title, setTitle] = useState('');
  const [cardName, setCardName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageConsentOpen, setImageConsentOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const imageInputRef = useRef(null);

  useCommunityModalScrollLock(composerOpen);
  useCommunityModalScrollLock(imageConsentOpen);

  useEffect(() => () => {
    if (imagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  const loadPosts = async () => {
    setLoading(true);
    setLoadFailed(false);
    setMessage('');
    try {
      const response = await fetchCommunityPosts(viewerToken);
      setPosts(Array.isArray(response?.posts) ? response.posts : []);
    } catch (error) {
      const isLocalPreview = import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
      if (isLocalPreview) {
        setPosts([]);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
        setMessage(localeText(uiLang, '게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not load posts. Please try again.', '投稿を読み込めませんでした。'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [viewerToken]);

  useEffect(() => {
    if (!authUser?.id) {
      setAttendance(null);
      return undefined;
    }
    let cancelled = false;
    setAttendanceLoading(true);
    fetchCommunityAttendance()
      .then((status) => {
        if (!cancelled) setAttendance(status || null);
      })
      .catch(() => {
        if (!cancelled) setAttendance(null);
      })
      .finally(() => {
        if (!cancelled) setAttendanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const categoryPosts = useMemo(() => posts.filter((post) => {
      if (post.adminOnly || post.boardId === 'feedback') return false;
      return activeBoard === 'all' || getBoard(post.boardId).id === activeBoard;
    }), [posts, activeBoard]);

  const visiblePosts = useMemo(() => [...categoryPosts]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)), [categoryPosts]);
  const isEventBoard = activeBoard === 'event';

  const popularPosts = useMemo(() => {
    const now = Date.now();
    const rankWithin = (windowMs) => categoryPosts
      .filter((post) => now - new Date(post.createdAt).getTime() <= windowMs)
      .sort((left, right) => getPopularScore(right, windowMs) - getPopularScore(left, windowMs))
      .slice(0, 3);
    return {
      daily: rankWithin(24 * 60 * 60 * 1000),
      weekly: rankWithin(7 * 24 * 60 * 60 * 1000)
    };
  }, [categoryPosts]);

  const openComposer = () => {
    if (isEventBoard) {
      setMessage(localeText(uiLang, '이벤트 게시판은 공지 전용입니다.', 'The events board is reserved for notices.', 'イベント掲示板はお知らせ専用です。'));
      return;
    }
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    setComposerOpen(true);
  };

  const checkInToday = async () => {
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    if (attendanceLoading || attendance?.checkedToday) return;
    setAttendanceLoading(true);
    setMessage('');
    try {
      const status = await checkInCommunityAttendance();
      setAttendance(status || null);
      if (status?.awarded) {
        setMessage(localeText(uiLang, '오늘 출석이 완료되었습니다. 1P가 적립됐습니다.', 'Daily check-in complete. You earned 1 point.', '本日の出席が完了しました。1P獲得しました。'));
      }
    } catch {
      setMessage(localeText(uiLang, '출석을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not complete check-in. Please try again.', '出席を処理できませんでした。'));
    } finally {
      setAttendanceLoading(false);
    }
  };

  const clearSelectedImage = () => {
    setImageFile(null);
    setImagePreviewUrl('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage(localeText(uiLang, 'JPG, PNG, WEBP 이미지만 올릴 수 있습니다.', 'Only JPG, PNG, and WEBP images are supported.', 'JPG・PNG・WEBP画像のみアップロードできます。'));
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage(localeText(uiLang, '이미지는 10MB 이하만 선택할 수 있습니다.', 'Choose an image smaller than 10 MB.', '10MB以下の画像を選択してください。'));
      event.target.value = '';
      return;
    }
    setMessage('');
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const openDeviceImagePicker = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
      imageInputRef.current.click();
    }
  };

  const requestImagePicker = () => {
    try {
      if (window.localStorage.getItem(COMMUNITY_IMAGE_CONSENT_KEY) === '1') {
        openDeviceImagePicker();
        return;
      }
    } catch {}
    setImageConsentOpen(true);
  };

  const confirmImageConsent = () => {
    try {
      window.localStorage.setItem(COMMUNITY_IMAGE_CONSENT_KEY, '1');
    } catch {}
    setImageConsentOpen(false);
    openDeviceImagePicker();
  };

  const closeComposer = (force = false) => {
    if (saving && !force) return;
    setComposerOpen(false);
    setImageConsentOpen(false);
    setTitle('');
    setCardName('');
    clearSelectedImage();
    setContent('');
  };

  const submitPost = async (event) => {
    event.preventDefault();
    if (!authUser || !viewerToken) {
      onRequireLogin?.();
      return;
    }
    const safeTitle = title.trim();
    const safeContent = content.trim();
    if (!safeTitle || !safeContent) return;
    if (composerBoard === 'event') {
      setMessage(localeText(uiLang, '이벤트 게시판은 공지 전용입니다.', 'The events board is reserved for notices.', 'イベント掲示板はお知らせ専用です。'));
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      let uploadedImageUrl = '';
      if (imageFile) {
        const compressedImage = await compressCommunityImage(imageFile);
        const uploaded = await uploadCommunityImage(compressedImage);
        uploadedImageUrl = uploaded?.imageUrl || '';
        if (!uploadedImageUrl) throw new Error('image_upload_failed');
      }
      const post = await createCommunityPost({
        boardId: composerBoard,
        nickname: displayName,
        title: safeTitle,
        cardName: cardName.trim(),
        imageUrl: uploadedImageUrl,
        content: safeContent
      }, viewerToken);
      setPosts((items) => [post, ...items]);
      setActiveBoard('all');
      closeComposer(true);
    } catch {
      setMessage(localeText(uiLang, '게시글을 등록하지 못했습니다.', 'Could not publish the post.', '投稿できませんでした。'));
    } finally {
      setSaving(false);
    }
  };

  const openPost = async (post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const [updatedPost, response] = await Promise.all([
        incrementCommunityPostView(post.id, viewerToken),
        fetchCommunityComments(post.id, viewerToken)
      ]);
      setSelectedPost(updatedPost || post);
      setPosts((items) => items.map((item) => item.id === post.id ? (updatedPost || item) : item));
      setComments(Array.isArray(response?.comments) ? response.comments : []);
    } catch {
      setMessage(localeText(uiLang, '게시글 내용을 불러오지 못했습니다.', 'Could not load the post.', '投稿を読み込めませんでした。'));
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleLike = async (postId) => {
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    try {
      const updated = await toggleCommunityPostLike(postId, viewerToken);
      setPosts((items) => items.map((item) => item.id === postId ? updated : item));
      if (selectedPost?.id === postId) setSelectedPost(updated);
    } catch {
      setMessage(localeText(uiLang, '좋아요를 반영하지 못했습니다.', 'Could not update the like.', 'いいねを更新できませんでした。'));
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    const safeContent = commentContent.trim();
    if (!selectedPost || !safeContent) return;
    setCommentsLoading(true);
    try {
      const comment = await addCommunityComment(selectedPost.id, { nickname: displayName, content: safeContent }, viewerToken);
      setComments((items) => [...items, comment]);
      setCommentContent('');
      const nextPost = { ...selectedPost, commentCount: Number(selectedPost.commentCount || 0) + 1 };
      setSelectedPost(nextPost);
      setPosts((items) => items.map((item) => item.id === nextPost.id ? nextPost : item));
    } catch {
      setMessage(localeText(uiLang, '댓글을 등록하지 못했습니다.', 'Could not publish the comment.', 'コメントを投稿できませんでした。'));
    } finally {
      setCommentsLoading(false);
    }
  };

  const removePost = async () => {
    if (!selectedPost?.canEdit || !window.confirm(localeText(uiLang, '게시글을 삭제할까요?', 'Delete this post?', 'この投稿を削除しますか？'))) return;
    try {
      await deleteCommunityPost(selectedPost.id, viewerToken);
      setPosts((items) => items.filter((item) => item.id !== selectedPost.id));
      setSelectedPost(null);
    } catch {
      setMessage(localeText(uiLang, '게시글을 삭제하지 못했습니다.', 'Could not delete the post.', '投稿を削除できませんでした。'));
    }
  };

  return (
    <main className={`renew-subpage renew-community-main${composerOpen || imageConsentOpen ? ' is-community-modal-open' : ''}`}>
      <section className="renew-panel renew-community-panel">
        <header className="renew-community-head">
          <div className="renew-community-head-actions">
            <button
              type="button"
              className={`renew-community-checkin${attendance?.checkedToday ? ' is-complete' : ''}`}
              onClick={checkInToday}
              disabled={attendanceLoading || Boolean(attendance?.checkedToday)}
              title={authUser && attendance
                ? localeText(uiLang, `연속 ${attendance.streak || 0}일 · ${Number(attendance.totalPoints || 0).toLocaleString('ko-KR')}P`, `${attendance.streak || 0}-day streak · ${Number(attendance.totalPoints || 0).toLocaleString('en-US')}P`, `${attendance.streak || 0}日連続 · ${Number(attendance.totalPoints || 0).toLocaleString('ja-JP')}P`)
                : undefined}
            >
              <span>{attendanceLoading
                ? localeText(uiLang, '확인 중', 'Checking', '確認中')
                : attendance?.checkedToday
                  ? localeText(uiLang, '출석완료', 'Checked in', '出席完了')
                  : localeText(uiLang, '출석체크', 'Check in', '出席')}</span>
              <small>{authUser && attendance
                ? `${Number(attendance.totalPoints || 0).toLocaleString(uiLang === 'en' ? 'en-US' : uiLang === 'jp' ? 'ja-JP' : 'ko-KR')}P`
                : '+1P'}</small>
            </button>
            {!isEventBoard ? <button type="button" className="renew-community-write" onClick={openComposer}>＋ {localeText(uiLang, '글쓰기', 'New post', '投稿')}</button> : null}
          </div>
        </header>

        <div className="renew-community-toolbar">
          <div className="renew-community-boards" role="tablist" aria-label={localeText(uiLang, '게시판 분류', 'Categories', 'カテゴリー')}>
            {COMMUNITY_BOARDS.map((board) => (
              <button key={board.id} type="button" className={activeBoard === board.id ? 'is-active' : ''} onClick={() => setActiveBoard(board.id)}>
                {localeText(uiLang, board.kr, board.en, board.jp)}
              </button>
            ))}
          </div>
        </div>

        {message && !loadFailed ? <p className="renew-community-message" role="status">{message}</p> : null}

        {isEventBoard ? (
          <aside className="renew-community-event-notice" aria-label={localeText(uiLang, '이벤트 게시판 안내', 'Events board notice', 'イベント掲示板のお知らせ')}>
            <span className="renew-community-event-notice-icon" aria-hidden="true">📡</span>
            <div>
              <div className="renew-community-event-notice-meta"><span>NOTICE</span><b>{localeText(uiLang, '상단 고정', 'Pinned', '固定')}</b></div>
              <strong>{localeText(uiLang, '이벤트 게시판 안내', 'Events board notice', 'イベント掲示板のお知らせ')}</strong>
              <p>{localeText(uiLang, '이벤트 게시판은 추후 공지 예정입니다. 출석과 활동으로 모은 포인트에는 추후 회원 혜택이 제공될 예정입니다.', 'Events will be announced here soon. Points earned through check-ins and activity will bring future member benefits.', 'イベントは今後こちらでお知らせします。出席・活動で貯めたポイントには、今後会員特典を予定しています。')}</p>
            </div>
          </aside>
        ) : null}

        {!selectedPost && !loading && !loadFailed && (popularPosts.daily.length || popularPosts.weekly.length) ? (
          <div className="renew-community-popular-grid">
            {[
              { id: 'daily', eyebrow: 'TODAY', title: localeText(uiLang, '인기글', 'Popular posts', '人気投稿') },
              { id: 'weekly', eyebrow: 'WEEKLY', title: localeText(uiLang, '주간 인기글', 'Weekly popular', '週間人気投稿') }
            ].map((group) => (
              <section key={group.id} className="renew-community-popular-box">
                <header><span>{group.eyebrow}</span><strong>{group.title}</strong></header>
                {popularPosts[group.id].length ? popularPosts[group.id].map((post, index) => (
                  <button key={post.id} type="button" onClick={() => openPost(post)}>
                    <b>{index + 1}</b>
                    <span><strong>{post.title}</strong><small>♡ {post.likes || 0} · {localeText(uiLang, '댓글', 'Comments', 'コメント')} {post.commentCount || 0}</small></span>
                  </button>
                )) : <p>{localeText(uiLang, '아직 인기글이 없습니다.', 'No popular posts yet.', '人気投稿はまだありません。')}</p>}
              </section>
            ))}
          </div>
        ) : null}

        {selectedPost ? (
          <article className="renew-community-detail">
            <button type="button" className="renew-community-back" onClick={() => setSelectedPost(null)}>‹ {localeText(uiLang, '목록으로', 'Back to posts', '一覧へ')}</button>
            <header>
              <div className="renew-community-post-meta">
                <span>{localeText(uiLang, getBoard(selectedPost.boardId).kr, getBoard(selectedPost.boardId).en, getBoard(selectedPost.boardId).jp)}</span>
                <b>{selectedPost.nickname}</b>
                <time>{formatCommunityDate(selectedPost.createdAt, uiLang)}</time>
              </div>
              <h2>{selectedPost.title}</h2>
              {selectedPost.cardName ? <strong className="renew-community-card-tag">CARD · {selectedPost.cardName}</strong> : null}
            </header>
            {selectedPost.imageUrl ? <img className="renew-community-detail-image" src={selectedPost.imageUrl} alt="" loading="lazy" /> : null}
            <p className="renew-community-detail-content">{selectedPost.content}</p>
            <div className="renew-community-detail-actions">
              <button type="button" className={selectedPost.likedByMe ? 'is-active' : ''} onClick={() => toggleLike(selectedPost.id)}>♡ {localeText(uiLang, '좋아요', 'Like', 'いいね')} {selectedPost.likes || 0}</button>
              <span>{localeText(uiLang, '조회', 'Views', '閲覧')} {selectedPost.views || 0}</span>
              {selectedPost.canEdit ? <button type="button" className="is-danger" onClick={removePost}>{localeText(uiLang, '삭제', 'Delete', '削除')}</button> : null}
            </div>
            <section className="renew-community-comments">
              <header><strong>{localeText(uiLang, '댓글', 'Comments', 'コメント')} {selectedPost.commentCount || comments.length}</strong></header>
              {comments.map((comment) => (
                <article key={comment.id}>
                  <div><b>{comment.nickname}</b><time>{formatCommunityDate(comment.createdAt, uiLang)}</time></div>
                  <p>{comment.content}</p>
                </article>
              ))}
              {!commentsLoading && !comments.length ? <p className="renew-community-empty-comment">{localeText(uiLang, '첫 댓글을 남겨보세요.', 'Start the conversation.', '最初のコメントを投稿しましょう。')}</p> : null}
              <form onSubmit={submitComment}>
                <textarea value={commentContent} onChange={(event) => setCommentContent(event.target.value)} maxLength={500} rows={3} placeholder={authUser ? localeText(uiLang, '댓글을 입력하세요.', 'Write a comment.', 'コメントを入力してください。') : localeText(uiLang, '로그인 후 댓글을 작성할 수 있습니다.', 'Sign in to comment.', 'ログインするとコメントできます。')} onFocus={() => { if (!authUser) onRequireLogin?.(); }} />
                <button type="submit" disabled={commentsLoading || !commentContent.trim()}>{localeText(uiLang, '댓글 등록', 'Post comment', 'コメント投稿')}</button>
              </form>
            </section>
          </article>
        ) : loading ? (
          <div className="renew-community-empty">{localeText(uiLang, '게시글을 불러오는 중입니다.', 'Loading posts.', '投稿を読み込んでいます。')}</div>
        ) : loadFailed ? (
          <div className="renew-community-empty">
            <strong>{localeText(uiLang, '게시판에 연결하지 못했습니다.', 'Could not connect to the board.', '掲示板に接続できませんでした。')}</strong>
            <button type="button" onClick={loadPosts}>{localeText(uiLang, '다시 시도', 'Try again', '再試行')}</button>
          </div>
        ) : visiblePosts.length ? (
          <div className="renew-community-list">
            {visiblePosts.map((post) => {
              const board = getBoard(post.boardId);
              return (
                <article key={post.id} className="renew-community-post">
                  <button type="button" className="renew-community-post-main" onClick={() => openPost(post)}>
                    <div className="renew-community-post-meta">
                      <span>{localeText(uiLang, board.kr, board.en, board.jp)}</span>
                      <b>{post.nickname}</b>
                      <time>{formatCommunityDate(post.createdAt, uiLang)}</time>
                    </div>
                    <h2>{post.title}</h2>
                    <p>{post.content}</p>
                    {post.cardName ? <strong className="renew-community-card-tag">CARD · {post.cardName}</strong> : null}
                  </button>
                  {post.imageUrl ? <button type="button" className="renew-community-post-image" onClick={() => openPost(post)} aria-label={post.title}><img src={post.imageUrl} alt="" loading="lazy" /></button> : null}
                  <div className="renew-community-post-stats">
                    <button type="button" className={post.likedByMe ? 'is-active' : ''} onClick={() => toggleLike(post.id)}>♡ {post.likes || 0}</button>
                    <span>▢ {post.commentCount || 0}</span>
                    <span>{localeText(uiLang, '조회', 'Views', '閲覧')} {post.views || 0}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="renew-community-empty">
            <strong>{localeText(uiLang, '아직 게시글이 없습니다.', 'No posts yet.', 'まだ投稿がありません。')}</strong>
            <p>{isEventBoard
              ? localeText(uiLang, '새 이벤트 소식은 이곳에 안내됩니다.', 'New event announcements will appear here.', '新しいイベントのお知らせはここに掲載されます。')
              : localeText(uiLang, '첫 번째 카드 이야기를 남겨보세요.', 'Start the first card conversation.', '最初のカードトークを始めましょう。')}</p>
            {!isEventBoard ? <button type="button" onClick={openComposer}>{localeText(uiLang, '글쓰기', 'New post', '投稿')}</button> : null}
          </div>
        )}
      </section>

      {composerOpen ? (
        <div className="renew-modal-backdrop renew-community-composer-backdrop" onClick={closeComposer}>
          <form className="renew-info-modal renew-community-composer" onSubmit={submitPost} onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>NEW POST</span><strong>{localeText(uiLang, '카드 이야기 작성', 'Create a post', '投稿を作成')}</strong></div>
              <button type="button" onClick={closeComposer} aria-label={localeText(uiLang, '닫기', 'Close', '閉じる')}>×</button>
            </header>
            <div className="renew-community-composer-boards">
              {COMMUNITY_BOARDS.filter((board) => board.id !== 'all' && board.id !== 'event').map((board) => (
                <button key={board.id} type="button" className={composerBoard === board.id ? 'is-active' : ''} onClick={() => setComposerBoard(board.id)}>
                  {localeText(uiLang, board.kr, board.en, board.jp)}
                </button>
              ))}
            </div>
            <label><span>{localeText(uiLang, '제목', 'Title', 'タイトル')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
            <label><span>{localeText(uiLang, '관련 카드', 'Related card', '関連カード')} <small>{localeText(uiLang, '선택', 'Optional', '任意')}</small></span><input value={cardName} onChange={(event) => setCardName(event.target.value)} maxLength={80} placeholder="OP05-119" /></label>
            <div className="renew-community-image-picker">
              <div>
                <span>{localeText(uiLang, '이미지', 'Image', '画像')} <small>{localeText(uiLang, '선택', 'Optional', '任意')}</small></span>
                <button type="button" onClick={requestImagePicker}>{imageFile ? localeText(uiLang, '다른 사진 선택', 'Choose another', '別の写真を選択') : localeText(uiLang, '기기에서 사진 선택', 'Choose from device', '端末から選択')}</button>
              </div>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} hidden />
              {imagePreviewUrl ? (
                <div className="renew-community-image-preview">
                  <img src={imagePreviewUrl} alt={localeText(uiLang, '선택한 이미지 미리보기', 'Selected image preview', '選択した画像のプレビュー')} />
                  <button type="button" onClick={clearSelectedImage} aria-label={localeText(uiLang, '이미지 삭제', 'Remove image', '画像を削除')}>×</button>
                </div>
              ) : null}
              <small>{localeText(uiLang, 'JPG, PNG, WEBP · 최대 10MB', 'JPG, PNG, WEBP · up to 10 MB', 'JPG・PNG・WEBP · 最大10MB')}</small>
            </div>
            <label><span>{localeText(uiLang, '내용', 'Content', '本文')}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={8} required /></label>
            <footer><button type="button" onClick={closeComposer}>{localeText(uiLang, '취소', 'Cancel', 'キャンセル')}</button><button type="submit" disabled={saving || !title.trim() || !content.trim()}>{saving ? localeText(uiLang, '등록 중', 'Publishing', '投稿中') : localeText(uiLang, '게시하기', 'Publish', '投稿する')}</button></footer>
          </form>
        </div>
      ) : null}

      {imageConsentOpen ? (
        <div className="renew-modal-backdrop renew-community-image-consent-backdrop" onClick={() => setImageConsentOpen(false)}>
          <section className="renew-info-modal renew-community-image-consent" role="dialog" aria-modal="true" aria-labelledby="community-image-consent-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>PHOTO ACCESS</span><strong id="community-image-consent-title">{localeText(uiLang, '사진 선택 안내', 'Photo access', '写真選択のご案内')}</strong></div>
              <button type="button" onClick={() => setImageConsentOpen(false)} aria-label={localeText(uiLang, '닫기', 'Close', '閉じる')}>×</button>
            </header>
            <p>{localeText(uiLang, 'Card Pone은 사용자가 직접 선택한 사진 1장만 게시글 업로드에 사용합니다. 계속을 누르면 기기의 사진 선택창이 열립니다.', 'Card Pone only uses the single photo you choose for this post. Continue to open your device photo picker.', 'Card Poneは、この投稿のために選択した写真1枚のみを使用します。続行すると端末の写真選択画面が開きます。')}</p>
            <footer>
              <button type="button" onClick={() => setImageConsentOpen(false)}>{localeText(uiLang, '취소', 'Cancel', 'キャンセル')}</button>
              <button type="button" onClick={confirmImageConsent}>{localeText(uiLang, '허용하고 계속', 'Allow and continue', '許可して続行')}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
