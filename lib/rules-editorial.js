// Shared by the /guide/rules page and its pre-rendered HTML.
// Rules: JP comprehensive rules ver.1.2.1 (2026-08-28, https://www.onepiece-cardgame.com/rules/),
// JP play guide (https://www.onepiece-cardgame.com/play-guide/) and the KR rule manual / starter page
// (https://onepiece-cardgame.kr/rules.do, https://onepiece-cardgame.kr/starter.do) checked on reviewedAt.
// Beginner page: each section is one lead sentence plus a single table or short list.
export const RULES_PATH = '/guide/rules';

export const RULES_SEO = {
  title: '원피스카드 룰 정리 - 게임 방법·턴 진행·공격 한눈에 | Card Pone',
  description: '원피스 카드게임 하는법을 공식 룰 기준으로 정리했습니다. 승리 조건과 라이프, 덱 구성(리더 1장·덱 50장·돈!! 10장), 게임 준비, 5단계 턴 진행, 어택·블록·카운터·대미지와 트리거, 카드 종류를 한눈에 봅니다.',
  keywords: '원피스카드 룰, 원피스 카드게임 하는법, 원피스카드 규칙, 원피스 카드게임 룰, 원피스카드 게임 방법, 원피스카드 턴 진행, 원피스카드 카운터, 원피스카드 트리거, 원피스카드 덱 구성'
};

export const RULES_EDITORIAL = {
  heading: '원피스카드 룰 한눈에: 승리 조건, 덱 구성, 턴 진행과 배틀',
  reviewedAt: '2026-10-12',
  dataDate: '2026-10-12',
  paragraphs: [
    '원피스 카드게임은 리더 1장과 덱 50장으로 1대1로 겨룹니다. 처음 대전할 때 필요한 기본 룰만 모았습니다.',
    '2026년 10월 12일 기준 일본 공식 종합 룰(ver.1.2.1)과 한국 공식 룰 매뉴얼을 바탕으로 합니다.'
  ],
  summary: [
    { value: '라이프 0장', label: '이때 리더가 대미지를 받으면 패배' },
    { value: '덱 50장', label: '리더 1장·돈!! 10장은 별도' },
    { value: '5단계', label: '한 턴의 페이즈 (리프레시→엔드)' },
    { value: '최대 10장', label: '돈!! 카드 (매 턴 2장씩 추가)' }
  ],
  sections: [
    {
      heading: '1. 승리 조건과 라이프',
      paragraphs: ['아래 둘 중 하나를 만들면 이깁니다.'],
      items: [
        '상대 라이프가 0장일 때 상대 리더에게 대미지를 주면 이깁니다.',
        '상대 덱이 0장이 되어도 이깁니다.',
        '리더가 대미지를 받으면 라이프 맨 위 카드를 패에 넣습니다.',
        '그 카드에 【트리거】가 있으면 공개하고 대신 효과를 쓸 수 있습니다.'
      ],
      links: [
        { href: 'https://www.onepiece-cardgame.com/rules/', label: '공식 룰 (일본어)' },
        { href: 'https://onepiece-cardgame.kr/rules.do', label: '공식 룰 · Q&A (한국어)' }
      ]
    },
    {
      heading: '2. 덱 구성',
      paragraphs: ['대전에는 카드 세 묶음이 필요합니다.'],
      table: {
        numeric: false,
        columns: ['구분', '규칙'],
        rows: [
          ['리더 카드', '정확히 1장'],
          ['덱', '정확히 50장 (캐릭터·이벤트·스테이지)'],
          ['돈!! 덱', '돈!! 카드 정확히 10장 (한글판 「두웅!!」)'],
          ['같은 카드 번호', '4장까지'],
          ['색', '리더가 가진 색의 카드만']
        ]
      },
      links: [{ href: '/guide/getting-started', label: '입문 가이드 (무엇부터 살지)' }]
    },
    {
      heading: '3. 게임 준비',
      paragraphs: ['게임을 시작하기 전에 아래 순서로 준비합니다.'],
      items: [
        '덱을 섞어 놓고, 리더 카드를 앞면으로 놓습니다.',
        '가위바위보 등에서 이긴 쪽이 선공·후공을 정합니다.',
        '패를 5장 뽑고, 1번만 전부 덱에 되돌려 다시 뽑을 수 있습니다.',
        '리더의 라이프 수만큼 덱 위에서 뒷면으로 라이프에 놓습니다.',
        '선공 플레이어부터 시작합니다.'
      ]
    },
    {
      heading: '4. 턴 진행',
      paragraphs: ['한 턴은 다섯 페이즈를 순서대로 진행합니다.'],
      table: {
        numeric: false,
        columns: ['페이즈', '하는 일'],
        rows: [
          ['리프레시', '레스트 카드를 모두 액티브로, 부여한 돈!!은 코스트 에리어로'],
          ['드로우', '1장 뽑기 (선공 첫 턴은 뽑지 않음)'],
          ['돈!!', '돈!! 2장을 코스트 에리어에 (선공 첫 턴은 1장)'],
          ['메인', '카드 플레이, 효과 발동, 돈!! 부여, 배틀'],
          ['엔드', '턴 종료 효과를 처리하고 턴 교대']
        ]
      }
    },
    {
      heading: '5. 메인 페이즈',
      paragraphs: ['아래 행동을 원하는 순서로 원하는 만큼 합니다.'],
      items: [
        '코스트는 액티브 돈!!을 그 수만큼 레스트해서 냅니다.',
        '캐릭터는 5장, 스테이지는 1장까지 필드에 둘 수 있습니다.',
        '돈!! 부여: 자신의 턴 동안 1장당 파워 +1000입니다.',
        '선공·후공 모두 자기 첫 번째 턴에는 어택할 수 없습니다.',
        '등장한 턴의 캐릭터는 효과가 없으면 어택할 수 없습니다.'
      ]
    },
    {
      heading: '6. 배틀 순서',
      paragraphs: ['어택 한 번은 다섯 단계로 처리합니다.'],
      table: {
        numeric: false,
        columns: ['단계', '내용'],
        rows: [
          ['어택', '액티브 리더·캐릭터를 레스트하고 상대 리더나 레스트 캐릭터를 고름'],
          ['블록', '어택받은 쪽이 【블로커】를 레스트해 대신 받을 수 있음'],
          ['카운터', '어택받은 쪽이 패의 카운터 카드나 【카운터】 이벤트를 씀'],
          ['대미지', '어택 쪽 파워가 같거나 크면 승리: 리더는 1 대미지, 캐릭터는 KO'],
          ['배틀 종료', '배틀 종료 효과를 처리하고 메인 페이즈로 돌아감']
        ]
      }
    },
    {
      heading: '7. 카드 종류',
      paragraphs: ['카드는 다섯 종류이며, 놓는 곳이 정해져 있습니다.'],
      table: {
        numeric: false,
        columns: ['종류', '역할', '놓는 곳'],
        rows: [
          ['리더', '라이프 수를 정하고 어택도 함', '리더 에리어'],
          ['캐릭터', '돈!!을 내고 등장해 어택·블록', '캐릭터 에리어 (5장까지)'],
          ['이벤트', '코스트를 내고 트래시에 놓아 효과를 씀', '패 → 트래시'],
          ['스테이지', '필드에 놓여 리더·캐릭터를 도움', '스테이지 에리어 (1장까지)'],
          ['돈!!', '코스트 지불, 부여하면 파워 +1000', '코스트 에리어']
        ]
      },
      links: [
        { href: '/guide/glossary', label: '용어 사전' },
        { href: '/guide/card-types', label: '카드 종류와 레어도' }
      ]
    }
  ],
  checklist: [
    '덱 50장·같은 번호 4장 이하 확인',
    '선공 첫 턴 드로우·돈!! 수 기억',
    '애매한 효과는 공식 Q&A로 확인'
  ]
};

// FAQ under the article (the main session merges it into lib/guide-article-faq.js).
export const RULES_FAQ = [
  ['원피스카드 선공은 첫 턴에 무엇이 다른가요?', '선공 플레이어는 첫 턴 드로우 페이즈에 카드를 뽑지 않고, 돈!! 페이즈에도 1장만 놓습니다. 후공은 첫 턴부터 1장을 뽑고 돈!! 2장을 놓지만, 양쪽 다 자기 첫 번째 턴에는 어택하지 못합니다.'],
  ['원피스카드 카운터는 어떻게 쓰나요?', '상대가 어택해 온 배틀의 카운터 스텝에 씁니다. 카운터 수치가 있는 캐릭터 카드를 패에서 트래시에 놓으면 그 배틀 동안 자신의 리더나 캐릭터 1장의 파워가 그 수치만큼 오르고, 【카운터】 이벤트는 코스트를 내고 발동합니다. 횟수 제한 없이 여러 장 쓸 수 있습니다.']
];
