import React, { useEffect, useMemo, useState } from 'react';
import {
  addCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPosts,
  incrementCommunityPostView,
  toggleCommunityPostLike
} from './api/community';

const COMMUNITY_BOARDS = [
  { id: 'all', kr: '전체', en: 'All', jp: 'すべて' },
  { id: 'question', kr: '질문', en: 'Questions', jp: '質問' },
  { id: 'showoff', kr: '개봉·자랑', en: 'Pulls', jp: '開封・自慢' },
  { id: 'market-talk', kr: '시세·수집', en: 'Market & collection', jp: '相場・コレクション' },
  { id: 'beginner', kr: '입문', en: 'Beginner', jp: '初心者' },
  { id: 'free', kr: '자유', en: 'General', jp: 'フリー' }
];

function localeText(uiLang, kr, en, jp) {
  if (uiLang === 'JP') return jp || en || kr;
  if (uiLang === 'EN') return en || kr;
  return kr;
}

function getBoard(boardId) {
  return COMMUNITY_BOARDS.find((board) => board.id === boardId) || COMMUNITY_BOARDS.at(-1);
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

function getPopularScore(post, windowMs) {
  const age = Math.max(0, Date.now() - new Date(post.createdAt).getTime());
  const freshness = Math.max(0, 1 - age / windowMs) * 4;
  return Number(post.likes || 0) * 3
    + Number(post.commentCount || 0) * 5
    + Math.min(Number(post.views || 0), 1000) * 0.15
    + freshness;
}

function getCommunityPreviewPosts() {
  const now = Date.now();
  return [
    ['preview-1', 'question', '신규 프로모 카드 시세가 궁금합니다', 14, 9, 230, 1],
    ['preview-2', 'showoff', '오늘 개봉한 박스 결과 공유합니다', 11, 6, 182, 3],
    ['preview-3', 'market-talk', 'PSA10 수집 기준을 어떻게 잡으시나요?', 8, 12, 154, 6],
    ['preview-4', 'beginner', '입문용 스타트 덱 추천 부탁드립니다', 5, 4, 96, 30],
    ['preview-5', 'free', '이번 주 카드샵 방문 후기', 3, 2, 61, 70]
  ].map(([id, boardId, title, likes, commentCount, views, hours]) => ({
    id,
    boardId,
    nickname: 'UI 미리보기',
    title,
    content: '커뮤니티 화면 검토를 위한 로컬 전용 샘플 게시글입니다.',
    cardName: '',
    imageUrl: '',
    likes,
    commentCount,
    views,
    createdAt: new Date(now - hours * 60 * 60 * 1000).toISOString(),
    likedByMe: false,
    canEdit: false,
    preview: true
  }));
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
  const [imageUrl, setImageUrl] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useCommunityModalScrollLock(composerOpen);

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
        setPosts(getCommunityPreviewPosts());
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

  const categoryPosts = useMemo(() => posts.filter((post) => {
      if (post.adminOnly || post.boardId === 'feedback') return false;
      return activeBoard === 'all' || (post.boardId || 'free') === activeBoard;
    }), [posts, activeBoard]);

  const visiblePosts = useMemo(() => [...categoryPosts]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)), [categoryPosts]);

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
    if (!authUser) {
      onRequireLogin?.();
      return;
    }
    setComposerOpen(true);
  };

  const closeComposer = (force = false) => {
    if (saving && !force) return;
    setComposerOpen(false);
    setTitle('');
    setCardName('');
    setImageUrl('');
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
    setSaving(true);
    setMessage('');
    try {
      const post = await createCommunityPost({
        boardId: composerBoard,
        nickname: displayName,
        title: safeTitle,
        cardName: cardName.trim(),
        imageUrl: imageUrl.trim(),
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
    if (post.preview) return;
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
    <main className="renew-subpage renew-community-main">
      <section className="renew-panel renew-community-panel">
        <header className="renew-community-head">
          <h1>COMMUNITY</h1>
          <button type="button" className="renew-community-write" onClick={openComposer}>＋ {localeText(uiLang, '글쓰기', 'New post', '投稿')}</button>
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

        {!selectedPost && !loading && !loadFailed ? (
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
            <p>{localeText(uiLang, '첫 번째 카드 이야기를 남겨보세요.', 'Start the first card conversation.', '最初のカードトークを始めましょう。')}</p>
            <button type="button" onClick={openComposer}>{localeText(uiLang, '글쓰기', 'New post', '投稿')}</button>
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
              {COMMUNITY_BOARDS.filter((board) => board.id !== 'all').map((board) => (
                <button key={board.id} type="button" className={composerBoard === board.id ? 'is-active' : ''} onClick={() => setComposerBoard(board.id)}>
                  {localeText(uiLang, board.kr, board.en, board.jp)}
                </button>
              ))}
            </div>
            <label><span>{localeText(uiLang, '제목', 'Title', 'タイトル')}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
            <label><span>{localeText(uiLang, '관련 카드', 'Related card', '関連カード')} <small>{localeText(uiLang, '선택', 'Optional', '任意')}</small></span><input value={cardName} onChange={(event) => setCardName(event.target.value)} maxLength={80} placeholder="OP05-119" /></label>
            <label><span>{localeText(uiLang, '이미지 주소', 'Image URL', '画像URL')} <small>{localeText(uiLang, '선택', 'Optional', '任意')}</small></span><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} maxLength={1000} placeholder="https://" /></label>
            <label><span>{localeText(uiLang, '내용', 'Content', '本文')}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={8} required /></label>
            <footer><button type="button" onClick={closeComposer}>{localeText(uiLang, '취소', 'Cancel', 'キャンセル')}</button><button type="submit" disabled={saving || !title.trim() || !content.trim()}>{saving ? localeText(uiLang, '등록 중', 'Publishing', '投稿中') : localeText(uiLang, '게시하기', 'Publish', '投稿する')}</button></footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
