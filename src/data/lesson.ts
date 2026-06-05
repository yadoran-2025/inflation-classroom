import type { ChoiceOption, LessonScene } from '../types'

export const newsOptions: ChoiceOption[] = [
  { id: 'demand-pull', label: '경제 전체의 수요 증가' },
  { id: 'cost-push', label: '비용 상승' },
  { id: 'money-supply', label: '통화량 증가' },
]

export const newsItems = [
  {
    id: 'support-spending',
    text: '정부가 대규모 지원금을 지급해서, 사람들의 소비가 크게 늘었다.',
    answer: 'demand-pull',
    hint: '다시 생각해보세요.',
  },
  {
    id: 'money-flood',
    text: '정부가 이자율을 낮추자 사람들이 돈을 많이 빌렸고, 시중에 돈이 많이 풀리면서 화폐 가치가 떨어졌다',
    answer: 'money-supply',
    hint: '다시 생각해보세요',
  },
  {
    id: 'oil-shock',
    text: '국제 유가가 급등해 운송비와 생산비가 올랐다.',
    answer: 'cost-push',
    hint: '다시 생각해보세요.',
  },
] as const

export const lessonChoiceItems = [
  {
    id: 'merchant-silver-choice',
    title: '',
    sceneId: 'scene-1',
    options: [
      { id: 'keep-one-coin', label: '그냥 지금처럼 은화 하나 받고 준다.' },
      { id: 'ask-three-coins', label: '은화에 은이 없는데 그게 은화냐? \n 난 3개는 받아야겠다.' },
    ],
    answer: 'ask-three-coins',
  },
  {
    id: 'money-value-price-direction',
    title: '화폐가치가 떨어지면 물가는 어떻게 될까요?',
    sceneId: 'scene-2',
    options: [
      { id: 'price-rise', label: '물가가 상승한다' },
      { id: 'price-fall', label: '물가가 하락한다' },
    ],
    answer: 'price-rise',
  },
] as const

export const peopleOptions: ChoiceOption[] = [
  { id: 'benefit', label: '웃는다 / 유리하다' },
  { id: 'harm', label: '운다 / 불리하다' },
]

export const peopleCards = [
  {
    id: 'fixed-salary',
    title: '같은 월급을 받는 직장인',
    line: '저는 월급을 받는 직장인이에요. 월급은 1년 단위로 계약을 하기 때문에, 한 번 정하면 올릴 수 없어요.',
    expected: 'harm',
    explanation: '물가는 오르는데 월급이 그대로라면, 같은 돈으로 살 수 있는 물건이 줄어듭니다.',
    hint: '월급은 그대로인데 물건값이 오르면 생활이 쉬워질까요?',
  },
  {
    id: 'deposit',
    title: '은행 예금 500만 원을 가진 사람',
    line: '저는 은행 예금에 500만 원을 넣어놨어요. 예금은 그냥 은행에 돈을 맡기고 정해진 이자만 받는 금융상품이에요.',
    expected: 'harm',
    explanation: '예금에 넣어둔 돈으로 살 수 있는 물건의 양이 줄어듭니다.',
    hint: '통장에 적힌 금액보다 그 돈으로 살 수 있는 물건이 중요해요.',
  },
  {
    id: 'exporter',
    title: '한국의 물건을 수출하는 사람',
    line: '우리나라만 물가가 계속 오르네요. 일본에서 한국 물건을 팔고 있는데, 앞으로 어떻게 될 지 모르겠어요.',
    expected: 'harm',
    explanation: '물가가 오르면 외국 사람들이 한국 물건을 비싸게 느끼게 돼요. 그러면 예전보다 한국 물건이 덜 팔릴 수 있어요.',
    hint: '우리나라 물건이 비싸졌다면, 외국 사람들이 어떻게 행동할까요?',
  },
  {
    id: 'importer',
    title: '밀을 수입하는 기업',
    line: '저는 밀을 수입해서 파는데, 한국 물가가 계속 오르면서 한국 밀값이 크게 올랐어요.',
    expected: 'benefit',
    explanation: '한국 물가가 비싸지면, 상대적으로 외국산 물건은 저렴해지는 것처럼 느껴집니다.',
    hint: '한국 물가가 비싸지면, 상대적으로 외국산 물건은 어떻게 느껴질까요?',
  },
  {
    id: 'future-debtor',
    title: '돈을 빌려서 10년 뒤에 갚기로 한 채무자',
    line: '내 집 마련을 위해 10억을 땡겼어요. 30년 뒤에 갚기로 했습니다.',
    expected: 'benefit',
    explanation: '지금의 10억과 30년 뒤의 10억은 살 수 있는 물건이 달라요.',
    hint: '30년 뒤에도 10억만 내면 되는데, 누가 이득을 봤을까요?',
  },
  {
    id: 'future-creditor',
    title: '돈을 빌려주고 30년 뒤에 받기로 한 채권자',
    line: '아까 걔가 집을 산다길래 10억을 빌려줬어요. 10년 뒤에 10억으로 그대로 받기로 했어요.',
    expected: 'harm',
    explanation: '명목상으로는 똑같은 10억을 돌려받지만, 그 돈으로 살 수 있는 물건의 양은 줄어들어요.',
    hint: '10년 뒤에 돌려받는 10억으로 지금과 같은 물건을 살 수 있을까요?',
  },
  {
    id: 'real-assets',
    title: '금이나 부동산을 가진 사람',
    line: '저는 금이나 부동산 같은 실물자산을 가진 사람이에요.',
    expected: 'benefit',
    explanation: '인플레이션 시기에는 실물자산 가격이 함께 올라서, 화폐가치의 하락을 피해갈 수 있어요.',
    hint: '돈의 가치가 흔들릴 때, 금이나 부동산 가격은 어떻게 움직였나요?',
  },
] as const

export const centralBankOptions: ChoiceOption[] = [
  { id: 'raise', label: '금리 인상' },
  { id: 'hold', label: '유지' },
  { id: 'cut', label: '금리 인하' },
]

export const centralBankScenarios = [
  {
    id: 'high-unemployment-low-inflation',
    title: '일자리가 사라지고 있습니다',
    context: [
      '최근 기업들이 투자를 줄이고 있습니다.',
      '공장 가동률이 낮아지고, 청년 실업률도 높아졌습니다.',
      '물가는 크게 오르지 않고 있습니다.',
      '하지만 사람들은 “일자리를 구하기 어렵다”고 말합니다.',
    ],
    indicators: {
      inflation: '낮음',
      unemployment: '높음',
      investment: '감소',
    },
    gauge: { prices: 30, jobs: 78 },
    diagnosis: {
      expected: 'unemployment',
      feedback: '이 상황에서는 물가보다 실업 문제가 더 심각해 보입니다. 물가는 안정되어 있지만, 기업 투자가 줄고 일자리가 사라지고 있기 때문입니다.',
    },
    policy: {
      recommended: 'cut',
      feedback: '금리를 낮추면 기업과 사람들이 돈을 빌리기 쉬워집니다. 기업 투자가 늘고 소비가 회복되면 일자리가 늘어날 수 있습니다.',
    },
    policyGauges: {
      raise: { prices: 22, jobs: 88 },
      hold: { prices: 30, jobs: 78 },
      cut: { prices: 52, jobs: 55 },
    },
    sideEffect: {
      expected: 'inflation',
      feedback: '금리를 낮추면 시중에 돈이 더 많이 돌 수 있습니다. 경기는 살아날 수 있지만 물가 상승 압력도 커질 수 있습니다.',
    },
    finalMessage: '당신은 고용 회복을 우선한 선택을 했습니다. 실업 문제를 줄이는 데 도움이 될 수 있지만, 물가가 다시 오를 위험을 계속 살펴야 합니다.',
  },
  {
    id: 'high-inflation-low-unemployment',
    title: '장바구니 물가가 무섭게 오르고 있습니다',
    context: [
      '최근 외식비, 식료품, 교통비가 빠르게 오르고 있습니다.',
      '사람들은 월급은 그대로인데 생활비가 너무 많이 늘었다고 말합니다.',
      '반면 기업들은 아직 사람을 꽤 많이 뽑고 있고, 실업률은 낮은 편입니다.',
    ],
    indicators: {
      inflation: '높음',
      unemployment: '낮음',
      consumption: '활발',
    },
    gauge: { prices: 82, jobs: 30 },
    diagnosis: {
      expected: 'inflation',
      feedback: '이 상황에서는 실업보다 물가 상승이 더 심각해 보입니다. 일자리는 비교적 유지되고 있지만, 생활비 상승으로 사람들의 구매력이 줄고 있기 때문입니다.',
    },
    policy: {
      recommended: 'raise',
      feedback: '금리를 올리면 돈을 빌리기 어려워지고 소비와 투자가 줄어듭니다. 그러면 물가 상승 압력이 낮아질 수 있습니다.',
    },
    policyGauges: {
      raise: { prices: 48, jobs: 45 },
      hold: { prices: 82, jobs: 30 },
      cut: { prices: 92, jobs: 25 },
    },
    sideEffect: {
      expected: 'unemployment',
      alternativeExpected: 'investment-slowdown',
      feedback: '금리를 올리면 기업의 대출 부담이 커집니다. 기업이 투자를 줄이면 생산과 고용이 위축되어 실업이 늘어날 수 있습니다.',
    },
    finalMessage: '당신은 물가 안정을 우선한 선택을 했습니다. 생활비 상승을 막는 데 도움이 될 수 있지만, 기업 투자와 일자리가 줄어들 위험을 살펴야 합니다.',
  },
  {
    id: 'stagflation',
    title: '물가도 오르고 일자리도 줄고 있습니다',
    context: [
      '국제 유가와 원자재 가격이 크게 올랐습니다.',
      '기업들은 생산 비용이 늘어나 제품 가격을 올리고 있습니다.',
      '그런데 가격이 오르자 소비는 줄고, 기업들은 고용까지 줄이기 시작했습니다.',
    ],
    indicators: {
      inflation: '높음',
      unemployment: '높음',
      productionCost: '증가',
    },
    gauge: { prices: 82, jobs: 76 },
    diagnosis: {
      expected: 'both',
      feedback: '이 상황은 가장 어렵습니다. 물가도 높고 실업도 높기 때문에, 어느 한쪽만 보고 결정하기 어렵습니다.',
    },
    policy: {
      recommended: 'none',
      feedbackByChoice: {
        raise: '당신은 물가 안정을 우선했습니다. 금리를 올리면 물가 상승 압력을 낮추는 데 도움이 될 수 있습니다. 하지만 기업 투자와 소비가 더 줄어 실업이 심해질 수 있습니다.',
        hold: '당신은 급격한 충격을 피하는 선택을 했습니다. 금리를 유지하면 갑작스러운 경기 위축은 피할 수 있습니다. 하지만 물가와 실업 문제를 빠르게 해결하기는 어렵습니다.',
        cut: '당신은 경기와 고용 회복을 우선했습니다. 금리를 낮추면 경기가 살아날 수 있습니다. 하지만 이미 높은 물가가 더 오를 위험이 있습니다.',
      },
    },
    policyGauges: {
      raise: { prices: 42, jobs: 94 },
      hold: { prices: 82, jobs: 76 },
      cut: { prices: 98, jobs: 42 },
    },
    sideEffectByPolicy: {
      raise: 'unemployment',
      hold: 'investment-slowdown',
      cut: 'inflation',
    },
    finalMessage: '이 상황에는 완벽한 선택이 없습니다. 물가를 잡으려 하면 실업이 걱정되고, 실업을 줄이려 하면 물가가 걱정됩니다.',
  },
] as const

export const lessonScenes: LessonScene[] = [
  {
    id: 'scene-0',
    number: 0,
    title: '금리 문제, 대체 왜 이렇게 싸우는가?',
    beats: [
      {
        id: 's0-b1',
        title: '금리 문제, 대체 왜 이렇게 싸우는가?',
        visual: 'rate-conflict',
        image: {
          src: '/lesson/munhwa-rate-conflict.jpg',
          alt: '문화일보 금리 인하 신경전 기사 이미지',
        },
        body: [
          '뉴스를 보면 사람들은 늘 금리를 두고 싸웁니다.',
          '누군가는 금리를 낮춰야 한다고 말합니다.',
          '누군가는 금리를 낮추면 큰일 난다고 말합니다.',
          '대체 왜 이렇게 싸우는 걸까요?',
        ],
        buttonLabel: '두 주장을 들어보자',
      },
      {
        id: 's0-b2',
        title: '금리 낮춰라 vs 못 낮춘다',
        visual: 'debate',
        body: [
          '한쪽은 말합니다.',
          '“지금 실업자 수 안 보이냐? 금리를 낮춰서 기업의 투자를 촉진하고 고용을 늘려야 한다.”',
          '다른 쪽은 말합니다.',
          '“지금 물가 상황 안 보이냐? 여기서 돈이 더 풀리면 물가 상승이 지나치게 커질 것이다.”',
          '이 싸움을 이해하려면 먼저 물가와 인플레이션이 무엇인지 알아야 합니다.',
        ],
        buttonLabel: '물가란 무엇인지 알아보기',
      },
      {
        id: 's0-b3',
        title: '물가란 무엇일까?',
        body: [
          '우리가 매일 쓰는 물건들의 가격은 제각각 다르게 움직입니다.',
          '물가는 개별 상품의 가격이 아니라, 상품과 서비스 전체를 종합한 **평균적인 가격 수준**입니다.',
          '[[simulator]]',
        ],
        simulator: { type: 'price-basket' },
        buttonLabel: '그럼 물가는 어떻게 잴까?',
      },
      {
        id: 's0-b4',
        title: '물가지수는 왜 필요할까?',
        body: [
          '수많은 상품의 가격 변화를 하나하나 따로 보면 물가 흐름을 알기 어렵습니다.',
          '그래서 물가의 변화를 하나의 대표적인 숫자로 나타내는데, 이를 **물가지수**라고 합니다.',
        ],
        image: {
          src: '/lesson/s0-b4.png',
          alt: '물가지수 그래프',
        },
        buttonLabel: '물가지수 계산 원리 보기',
      },
      {
        id: 's0-b5',
        title: '기준 시점 100의 의미',
        body: [
          '물가지수를 만들 때는 먼저 기준이 되는 시점을 정하고 그때의 물가를 **100**으로 정합니다.',
          '그 후 장바구니 가격이 어떻게 변했는지를 비교하여 % 상승률을 계산합니다.',
          '[[simulator]]',
        ],
        simulator: { type: 'price-index-base' },
        buttonLabel: '그런데 무엇을 기준으로 삼을까?',
      },
      {
        id: 's0-b6',
        title: '물가지수는 목적에 따라 달라진다',
        body: [
          '물가지수를 만들 때 장바구니에 무엇을 담을지는 목적에 따라 완전히 달라집니다.',
          '가정에서 주로 소비하는 상품을 담을지, 기업 간 거래하는 원자재를 담을지 결정해야 합니다.',
          '이것이 바로 **소비자 물가지수(CPI)**와 **생산자 물가지수(PPI)**로 나뉘는 이유입니다.',
          '[[simulator]]',
        ],
        simulator: { type: 'basket-cpi-ppi' },
        buttonLabel: '준비 끝, 이제 인플레이션의 세계로',
      },
    ],
  },
  {
    id: 'scene-1',
    number: 1,
    title: '1544년으로부터의 교훈',
    beats: [
      {
        id: 's1-b1',
        title: '1544년으로부터의 교훈',
        image: {
          src: '/lesson/henry-viii-holbein.jpg',
          alt: '헨리 8세 초상화',
        },
        body: [
          '옛날옛적… 세금을 더 걷고 싶어하는 왕이 있었습니다. \n 하지만 세금을 올려서 얻게 될 반발은 불 보듯 뻔했죠. 왕은 민심을 잃고싶지 않았습니다.',
          '그래서 왕은 꾀를 하나 냅니다. 남들 모르게 세금을 더 걷을 수 있는, 그런 꾀 말이죠…',
          '백성의 창고를 도적질하는 게 아니라면, 어떻게 그런 일이 가능할까요?',
          '하지만 다 방법이 있습니다.',
        ],
        buttonLabel: '그 방법은 바로…',
      },
      {
        id: 's1-b2',
        title: '두 개의 동전',
        image: {
          src: '/lesson/henry-viii-testoon.jpg',
          alt: '헨리 8세 시대의 testoon 은화',
        },
        body: [
          '여기 두 개의 동전이 있습니다.',
          '하나는 1544년 이전의 은화입니다. 92.5%가 은으로 이루어져 있습니다.',
          '또 하나는 헨리 8세가 발행한 은화입니다. \n 같은 무게이지만, 25%만 은이고 나머지는 싸구려 금속을 채워넣었죠.',
          '바로 그것입니다. 헨리 8세가 부린 마법 말입니다.',
          '직관적으로 이해하면, 남은 은의 가치를 왕이 가져간 겁니다.',
          '이 마법을 THE GREAT DEBASEMENT, 대악화 정책이라고 부릅니다.',
        ],
        buttonLabel: '이 작은 장난질이 초래한 문제는…',
      },
      {
        id: 's1-b3',
        title: '상인이라면 어떻게 할까요?',
        visual: 'merchant',
        body: [
          '여러분이 상인이라고 생각해봅시다.',
          '자신이 만든 칼 하나를 은화 1닢에 팔던 상인이라면, 이 상황에 어떤 생각을 했을까요?',
        ],
        choice: lessonChoiceItems[0],
      },
      {
        id: 's1-b4',
        title: '물가가 상승했다',
        visual: 'inflation-flow',
        body: [
          '당시의 상인들도 그렇게 생각했습니다.',
          '화폐에 들어 있는 은의 함량, 즉 **화폐의 가치**가 떨어지니 상인들은 같은 물건에 더 많은 은화를 요구했습니다.',
          '[[simulator]]',
          '모든 상인들이 그랬습니다. 모든 물건의 가격이 올라간 겁니다.',
        ],
        simulator: {
          type: 'currency-value',
        },
        concept: {
          title: '개념 정리',
          lines: [
            '우리는 그것을 “__물가__가 상승했다” 고 표현합니다.',
            '즉, 화폐가치의 __하락__이 곧 __물가의 상승__입니다.',
          ],
        },
      },
      {
        id: 's1-b5',
        title: '정리',
        visual: 'inflation-flow',
        body: [
          '정리를 한 번 하고 갑시다.',
          '**화폐가치가 하락하면 물가가 오른다**.',
          '그리고, 물가가 계속 오르는 것을 **인플레이션**이라고 한다.',
        ],
      },
    ],
  },
  {
    id: 'scene-2',
    number: 2,
    title: '흔해지면 싸지고, 귀해지면 비싸진다',
    beats: [
      {
        id: 's2-b1',
        title: '흔해지면 싸지고, 귀해지면 오른다',
        visual: 'paper-money',
        body: [
          '하지만 현대사회에서는 더 이상 은화를 쓰지 않습니다.',
          '비싼 금속으로 동전을 만들지 않으니, 더 이상 이런 식의 사기를 당할 일은 없죠.',
          '그렇다면 우리는 이 교묘한 도둑질에서 해방된 걸까요?',
        ],
        buttonLabel: '정말..?',
      },
      {
        id: 's2-b2',
        title: '지폐',
        image: {
          src: '/lesson/banknote-press-room.jpg',
          alt: '지폐 인쇄실 사진',
        },
        body: [
          '안타깝게도 아닙니다.',
          '우리는 오히려 화폐가치 훼손이 더 쉬워진 시대에 살고 있습니다.',
          '왜냐하면, 우리가 사용하는 **지폐**는 말 그대로 종이 화폐라서, \n 이제는 **은(silver)**이 없어도 찍어낼 수 있기 때문입니다. (인쇄기만 있으면 된다!)',
        ],
        concept: {
          title: '개념 정리',
          lines: ['지폐를 찍어낸다는 걸 달리 말하면, 화폐의 양__(통화량)__이 증가한다는 것입니다.'],
        },
      },
      {
        id: 's2-b3',
        title: '중앙은행',
        body: [
          '모든 물건은, 흔해지면 가치가 떨어집니다.',
          '통화량이 증가하면 화폐는 **흔해지고**.',
          '화폐가 흔해지면 화폐가치가 떨어집니다.',
          '화폐가치가 떨어지면 어떻게 된다고 했죠?',
        ],
        choice: lessonChoiceItems[0],
      },
      {
        id: 's2-b4',
        title: '중앙은행-2',
        body: [
          '그 **통화량**을 조절하는 기관이 바로 **중앙은행**입니다.',
          '중앙은행은 기준금리라는 수단을 통해, 통화량을 조절합니다.',
          '통화량을 조절하면 무엇이 어떻게 변할까요?',
          '[[simulator]]',
        ],
        simulator: {
          type: 'interest-rate',
        },
      },
    ],
  },
  {
    id: 'scene-3',
    number: 3,
    title: '물가 상승의 다른 원인',
    beats: [
      {
        id: 's3-b1',
        title: '물가 상승의 다른 원인',
        visual: 'supply-demand',
        body: [
          '그러면 우리 물가가 상승하는 것은 중앙정부가 통화량을 늘렸기 때문일까요?',
          '반드시 그런 것은 아닐 수도 있습니다.',
          '물가 또한 가격이기 때문에 수요와 공급의 영향을 받습니다.',
          '모종의 이유로 경제 전체의 수요가 증가하거나 (정부의 돈을 풀어 물건을 삼 = 재정정책 등)',
          '생산 비용이 증가하여 경제 전체의 공급이 감소하면 인플레이션이 일어납니다.',
        ],
        concept: {
          title: '개념 정리',
          lines: [
            '인플레이션의 원인은 크게 세 가지로 볼 수 있습니다.',
            '1. __통화량__ 증가',
            '2. 경제 전체의 __수요__ 증가',
            '3. 생산 __비용__ 증가',
          ],
        },
        buttonLabel: '뉴스 분류하기',
      },
      {
        id: 's3-b2',
        title: '뉴스 분류',
        visual: 'news',
        body: ['아래의 뉴스를 살펴보고, 인플레이션의 원인을 찾아봅시다.'],
        activity: 'news',
        buttonLabel: '정리로 이동',
      }
    ],
  },
  {
    id: 'scene-4',
    number: 4,
    title: '인플레이션에 울고 웃는 사람들',
    beats: [
      {
        id: 's4-b1',
        title: '누가 울고 누가 웃을까요?',
        visual: 'people',
        body: [
          '이 사람들은 모두 현실경제에 존재하는 사람들입니다.',
          '물가가 오르고 화폐가치가 하락할 때, 누가 울고 누가 웃게 될까요?',
        ],
        activity: 'people',
      },
    ],
  },
  {
    id: 'scene-5',
    number: 5,
    title: '인플레이션에서 살아남기',
    beats: [
      {
        id: 's5-b1',
        title: '인플레이션에서 살아남기',
        image: {
          src: '/lesson/bank-of-korea-main-office.jpg',
          alt: '한국은행 본점 건물',
        },
        body: [
          '앞에서 보았듯, 인플레이션은 국가가 국민에게 걷어가는 세금이기도 하지만,',
          '이를 방치하는 것은 누군가의 돈을 빼앗아 다른 사람의 지갑에 넣어주는 일입니다.',
          '그래서 우리는 중앙은행을 두고, 그들이 물가를 관리하도록 합니다.',
          '중앙은행은 기준금리라는, 기준이 되는 이자율을 정함으로써 통화량을 관리합니다.',
        ],
      },
      {
        id: 's5-b2',
        title: '물가와 실업',
        image: {
          src: '/lesson/SCR-20260603-uaou.png',
          alt: '물가와 실업 이미지',
        },
        body: [
          '중앙은행의 가장 중요한 임무는 두 가지입니다.',
          '바로 최대고용과 물가안정.',
          '어? 이거 어디선가 들어보지 않았나요?',
        ],
        buttonLabel: '어디서 들어봤더라…',
      },
      {
        id: 's5-b3',
        title: '물가와 실업',
        visual: 'central-bank',
        body: [
          '맞습니다. 이 소단원의 제목입니다.',
          '경기가 침체되면 물가가 내리지만 실업이 늘어납니다.',
          '이를 막기 위해 이자율을 낮추면, 실업은 줄어들 수 있지만',
          '시중에 돈이 많아져 물가 상승 속도가 빨라질 수 있습니다.',
          '어떤 것을 선택해야 할까요?',
        ],
        activity: 'central-bank',
      },
      {
        id: 's5-b4',
        title: '관리의 대상',
        image: {
          src: '/lesson/SCR-20260603-uhbn.png',
          alt: '물가와 실업 이미지',
        },
        body: [
          '인플레이션은 퇴치의 대상이 아니라 관리의 대상입니다.',
          '물가 상승을 완전히 없앨 수는 없습니다.',
          '하지만 물가 상승의 속도, 즉 상승률을 관리할 수는 있습니다.',
          '그래서 중앙은행은, 오늘도 물가와 실업 사이에서 어려운 선택을 이어가고 있습니다.',
        ],
      },
    ],
  },
]
