module.exports = {
  language: {
    code: 'ko',
    name: '韩语',
    name_native: '한국어',
    flag: '🇰🇷',
    voice: 'ko-KR',
    intro: '掌握韩语，打开沉浸式了解韩国文化与生活的大门。'
  },
  courses: [
    {
      level: 'A1',
      level_order: 1,
      title: '韩语入门',
      subtitle: '한국어 첫걸음',
      description: '从问候语与基础助词开始，打好韩语发音与日常表达的基础。',
      icon: '🌷',
      lessons: [
        {
          title: '问候与自我介绍',
          module: 'vocabulary',
          order_index: 1,
          xp: 15,
          duration_min: 6,
          description: '学习基础问候语与自我介绍中常用的词汇。',
          exercises: [
            {
              type: 'mcq',
              prompt: '다음 중 "你好"에 해당하는 인사는?',
              prompt_translation: '下列哪个是表示“你好”的问候语？',
              audio: null,
              options: ['안녕하세요', '감사합니다', '죄송합니다'],
              answer: '안녕하세요',
              explanation: '"안녕하세요" 是最常用的问候语，用于见面时问好；"감사합니다" 是“谢谢”，"죄송합니다" 是“对不起”。',
              hint: '见面时最常用的问候语。'
            },
            {
              type: 'mcq',
              prompt: '처음 만났을 때 하는 인사는?',
              prompt_translation: '初次见面时说的问候语是？',
              audio: null,
              options: ['만나서 반갑습니다', '안녕히 가세요', '잘 먹겠습니다'],
              answer: '만나서 반갑습니다',
              explanation: '"만나서 반갑습니다" 意为“很高兴见到你”，是初次见面时的礼貌用语。',
              hint: '与“初次见面”相关的表达。'
            },
            {
              type: 'fill',
              prompt: '저____ 학생입니다. （请填入正确的助词）',
              prompt_translation: '我是学生。',
              audio: null,
              options: null,
              answer: '는',
              explanation: '主语话题助词 "은/는" 用于辅音结尾的名词后接 "은"，"저" 后应填 "는"。',
              hint: '注意 "저" 的收尾音。'
            },
            {
              type: 'mcq',
              prompt: '"안녕히 가세요"의 뜻은?',
              prompt_translation: '"안녕히 가세요" 是什么意思？',
              audio: null,
              options: ['再见（对离开的人说）', '你好', '谢谢'],
              answer: '再见（对离开的人说）',
              explanation: '"안녕히 가세요" 是对离开的人说的“再见”，对留下的人则说 "안녕히 계세요"。',
              hint: '这是道别用语。'
            },
            {
              type: 'fill',
              prompt: '"만나서 반갑습니다" 中 "만나서" 的原形动词是 "____".',
              prompt_translation: '“만나서 반갑습니다” 中“만나서”的原形是哪個动词？',
              audio: null,
              options: null,
              answer: '만나다',
              explanation: '"만나서" 由动词 "만나다"（见面）加连接词尾 "-아서/어서" 变化而来。',
              hint: '表示“见面”的动词。'
            }
          ]
        },
        {
          title: '数字与日常物品',
          module: 'vocabulary',
          order_index: 2,
          xp: 15,
          duration_min: 6,
          description: '学习数字与日常生活中常见物品的韩语说法。',
          exercises: [
            {
              type: 'mcq',
              prompt: '"感谢"에 해당하는 말은?',
              prompt_translation: '表示“感谢”的说法是？',
              audio: null,
              options: ['감사합니다', '사랑합니다', '축하합니다'],
              answer: '감사합니다',
              explanation: '"감사합니다" 意为“谢谢”；"사랑합니다" 是“我爱你”，"축하합니다" 是“祝贺”。',
              hint: '表达谢意时使用。'
            },
            {
              type: 'fill',
              prompt: '"____ 주세요." （请给我水。）',
              prompt_translation: '请给我水。',
              audio: null,
              options: null,
              answer: '물',
              explanation: '"물" 意为“水”，"물 주세요" 即“请给我水”。',
              hint: '一种日常饮品，日常生活中最常见。'
            },
            {
              type: 'mcq',
              prompt: '숫자 3에 해당하는 한국어는?',
              prompt_translation: '数字 3 对应的韩语是？',
              audio: null,
              options: ['삼', '사', '이'],
              answer: '삼',
              explanation: '韩语中文数字 "삼" 表示 3，"사" 是 4，"이" 是 2。',
              hint: '汉字词数字的第三位。'
            },
            {
              type: 'mcq',
              prompt: '"사과"는 무슨 뜻이에요?',
              prompt_translation: '"사과" 是什么意思？',
              audio: null,
              options: ['苹果', '香蕉', '橘子'],
              answer: '苹果',
              explanation: '"사과" 意为“苹果”，是日常常见的水果。',
              hint: '一种常见水果。'
            },
            {
              type: 'fill',
              prompt: '이것은 ____입니다. （这是书。）',
              prompt_translation: '这是书。',
              audio: null,
              options: null,
              answer: '책',
              explanation: '"책" 意为“书”，"이것은 책입니다" 即“这是书”。',
              hint: '用来阅读的东西。'
            }
          ]
        },
        {
          title: '助词 은/는 与 이/가',
          module: 'grammar',
          order_index: 3,
          xp: 20,
          duration_min: 8,
          description: '掌握话题助词 은/는 与主格助词 이/가 的用法区别。',
          exercises: [
            {
              type: 'mcq',
              prompt: '저____ 학생입니다. （应填入哪个助词？）',
              prompt_translation: '我是学生。（应填入哪个助词？）',
              audio: null,
              options: ['는', '가', '를'],
              answer: '는',
              explanation: '"저" 为元音结尾，"은/는" 中应选 "는"；"는" 作话题助词，用于提出话题。',
              hint: '话题助词的元音形式。'
            },
            {
              type: 'mcq',
              prompt: '话题助词是下列哪一个？',
              prompt_translation: '下列哪个是话题助词？',
              audio: null,
              options: ['은/는', '이/가', '을/를'],
              answer: '은/는',
              explanation: '"은/는" 是话题助词，用来提示句子的主题；"이/가" 是主格助词，"을/를" 是宾格助词。',
              hint: '用来提示句子主题的助词。'
            },
            {
              type: 'fill',
              prompt: '이름____ 뭐예요? （应填入哪个助词？）',
              prompt_translation: '名字是什么？（应填入哪个助词？）',
              audio: null,
              options: null,
              answer: '이',
              explanation: '"이름" 以辅音收尾，主格助词 "이/가" 中应选 "이"，"이름이 뭐예요" 意为“名字是什么”。',
              hint: '辅音结尾名词后的主格助词。'
            },
            {
              type: 'mcq',
              prompt: '동생____ 학교에 갑니다. （弟弟去学校，主语助词用哪个？）',
              prompt_translation: '弟弟去学校，主语助词用哪个？',
              audio: null,
              options: ['이', '가', '는'],
              answer: '이',
              explanation: '"동생" 以辅音收尾，主格助词应选 "이"；"동생이 학교에 갑니다" 意为“弟弟去学校”。',
              hint: '注意 "동생" 的收尾音。'
            },
            {
              type: 'mcq',
              prompt: '用于辅音结尾名词后的主格助词是?',
              prompt_translation: '用于辅音结尾名词后的主格助词是哪个？',
              audio: null,
              options: ['이', '가', '을'],
              answer: '이',
              explanation: '主格助词 "이/가" 有收音（辅音）时用 "이"，无收音（元音）时用 "가"。',
              hint: '主格助词中用于辅音结尾形式的那一个。'
            }
          ]
        },
        {
          title: '自我介绍与问候',
          module: 'speaking',
          order_index: 4,
          xp: 25,
          duration_min: 10,
          description: '练习自我介绍与日常问候的口语表达。',
          exercises: [
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '你好，很高兴见到你。',
              audio: '안녕하세요, 만나서 반갑습니다.',
              options: null,
              answer: '안녕하세요, 만나서 반갑습니다.',
              explanation: '这句话用于初次见面，注意 "안녕하세요" 的敬语语尾和 "만나서 반갑습니다" 的固定搭配。',
              hint: '注意 "안녕하세요" 的发音。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '我是学生。',
              audio: '저는 학생입니다.',
              options: null,
              answer: '저는 학생입니다.',
              explanation: '"저는" 是话题句，"학생입니다" 用敬语终结词尾 "-ㅂ니다" 结尾。',
              hint: '注意 "입니다" 的发音。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '谢谢。',
              audio: '감사합니다.',
              options: null,
              answer: '감사합니다.',
              explanation: '"감사합니다" 是表达的敬语形式，词干 "감사하-" 后接 "-ㅂ니다"。',
              hint: '表达谢意。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '请给我水。',
              audio: '물 주세요.',
              options: null,
              answer: '물 주세요.',
              explanation: '"주세요" 是敬语请求表达，意为“请给我……”，前面接名词。',
              hint: '点单或请求时使用。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '再见。',
              audio: '안녕히 가세요.',
              options: null,
              answer: '안녕히 가세요.',
              explanation: '对离开的人说 "안녕히 가세요"，对留下的人说 "안녕히 계세요"。',
              hint: '对离开的人道别。'
            }
          ]
        },
        {
          title: '听懂基础对话',
          module: 'listening',
          order_index: 5,
          xp: 25,
          duration_min: 10,
          description: '通过听力练习巩固基础问候与介绍用语。',
          exercises: [
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '저는 학생입니다.',
              options: ['저는 학생입니다.', '저는 선생님입니다.', '저는 의사입니다.'],
              answer: '저는 학생입니다.',
              explanation: '音频说的是 "저는 학생입니다"（我是学生），注意区分 "학생"（学生）与 "선생님"（老师）、"의사"（医生）。',
              hint: '注意听 "학생" 这个词。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '만나서 반갑습니다.',
              options: ['만나서 반갑습니다.', '안녕히 가세요.', '감사합니다.'],
              answer: '만나서 반갑습니다.',
              explanation: '音频说的是初次见面用语 "만나서 반갑습니다"（很高兴见到你）。',
              hint: '注意 "반갑습니다" 这一句。'
            },
            {
              type: 'listen_type',
              prompt: '听音频，写出你听到的句子。',
              prompt_translation: '听音频，写出你听到的句子。',
              audio: '물 주세요.',
              options: null,
              answer: '물 주세요.',
              explanation: '音频为 "물 주세요"（请给我水），听写时注意 "주세요" 的拼写。',
              hint: '注意 "주세요" 的写法。'
            },
            {
              type: 'listen_type',
              prompt: '听音频，写出你听到的单词。',
              prompt_translation: '听音频，写出你听到的单词。',
              audio: '감사합니다',
              options: null,
              answer: '감사합니다',
              explanation: '音频单词为 "감사합니다"（谢谢），注意 "감사" 与敬语词尾 "-ㅂ니다" 的组合。',
              hint: '听清开头的 "감사"。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '안녕히 가세요.',
              options: ['안녕히 가세요.', '안녕히 계세요.', '안녕하세요.'],
              answer: '안녕히 가세요.',
              explanation: '音频为对离开者说的 "안녕히 가세요"（再见），与对留下者说的 "안녕히 계세요" 需区分。',
              hint: '注意 "가세요" 与 "계세요" 的区别。'
            }
          ]
        }
      ]
    },
    {
      level: 'A2',
      level_order: 2,
      title: '韩语进阶',
      subtitle: '한국어 한 걸음 더',
      description: '在 A1 基础上学习时间、饮食、敬语与日常场景表达。',
      icon: '🌻',
      lessons: [
        {
          title: '时间与天气',
          module: 'vocabulary',
          order_index: 1,
          xp: 18,
          duration_min: 8,
          description: '学习时间与天气相关的常用词汇和表达。',
          exercises: [
            {
              type: 'mcq',
              prompt: '"明天"에 해당하는 말은?',
              prompt_translation: '表示“明天”的说法是？',
              audio: null,
              options: ['내일', '어제', '오늘'],
              answer: '내일',
              explanation: '"내일" 意为“明天”；"어제" 是“昨天”，"오늘" 是“今天”。',
              hint: '与“今天、昨天”同序列。'
            },
            {
              type: 'fill',
              prompt: '오늘 날씨____ 좋아요. （今天天气好。）',
              prompt_translation: '今天天气好。',
              audio: null,
              options: null,
              answer: '가',
              explanation: '"날씨" 以元音收尾，主格助词 "이/가" 应选 "가"，"날씨가 좋아요" 意为“天气好”。',
              hint: '注意 "날씨" 的收尾音。'
            },
            {
              type: 'mcq',
              prompt: '"춥다"의 반대말은?',
              prompt_translation: '"춥다"（冷）的反义词是？',
              audio: null,
              options: ['덥다', '맵다', '짜다'],
              answer: '덥다',
              explanation: '"춥다" 意为“冷”，其反义词是 "덥다"（热）。',
              hint: '与“冷”相反的感觉。'
            },
            {
              type: 'mcq',
              prompt: '"비"는 무슨 뜻이에요?',
              prompt_translation: '"비" 是什么意思？',
              audio: null,
              options: ['雨', '雪', '风'],
              answer: '雨',
              explanation: '"비" 意为“雨”，"눈" 是“雪”，"바람" 是“风”。',
              hint: '天气现象之一。'
            },
            {
              type: 'fill',
              prompt: '3시____ 만나요. （三点见。）',
              prompt_translation: '三点见。',
              audio: null,
              options: null,
              answer: '에',
              explanation: '"에" 是时间助词，用于具体时间后表示时间点，"3시에 만나요" 意为“三点见”。',
              hint: '表示时间点的助词。'
            }
          ]
        },
        {
          title: '饮食与购物',
          module: 'vocabulary',
          order_index: 2,
          xp: 18,
          duration_min: 8,
          description: '学习饮食与购物场景中的常用词汇和表达。',
          exercises: [
            {
              type: 'mcq',
              prompt: '"먹다"는 무슨 뜻이에요?',
              prompt_translation: '"먹다" 是什么意思？',
              audio: null,
              options: ['吃', '喝', '买'],
              answer: '吃',
              explanation: '"먹다" 意为“吃”；"마시다" 是“喝”，"사다" 是“买”。',
              hint: '与吃饭有关。'
            },
            {
              type: 'fill',
              prompt: '밥____ 먹어요. （吃饭。）',
              prompt_translation: '吃饭。',
              audio: null,
              options: null,
              answer: '을',
              explanation: '"밥" 以辅音收尾，宾格助词 "을/를" 应选 "을"，"밥을 먹어요" 意为“吃饭”。',
              hint: '注意 "밥" 的收尾音。'
            },
            {
              type: 'mcq',
              prompt: '"맛있다"는 무슨 뜻이에요?',
              prompt_translation: '"맛있다" 是什么意思？',
              audio: null,
              options: ['好吃', '好喝', '好累'],
              answer: '好吃',
              explanation: '"맛있다" 意为“好吃”，多用于形容食物味道好。',
              hint: '形容食物味道。'
            },
            {
              type: 'mcq',
              prompt: '"얼마예요?"는 언제 써요?',
              prompt_translation: '“얼마예요?” 什么时候使用？',
              audio: null,
              options: ['询问价格时', '询问时间时', '询问名字时'],
              answer: '询问价格时',
              explanation: '"얼마예요?" 意为“多少钱？”，用于询问价格。',
              hint: '与“钱”有关。'
            },
            {
              type: 'fill',
              prompt: '커피____ 주세요. （请给我咖啡。）',
              prompt_translation: '请给我咖啡。',
              audio: null,
              options: null,
              answer: '를',
              explanation: '"커피" 以元音收尾，宾格助词 "을/를" 应选 "를"，"커피를 주세요" 意为“请给我咖啡”。',
              hint: '注意 "커피" 的收尾音。'
            }
          ]
        },
        {
          title: '过去时与敬语',
          module: 'grammar',
          order_index: 3,
          xp: 22,
          duration_min: 10,
          description: '学习动词过去时构成与日常敬语表达。',
          exercises: [
            {
              type: 'mcq',
              prompt: '"먹다"의 과거형은?',
              prompt_translation: '"먹다" 的过去式是？',
              audio: null,
              options: ['먹었어요', '먹어요', '먹을 거예요'],
              answer: '먹었어요',
              explanation: '动词词干 "먹-" 加过去时先语末 "-었-" 再加 "-어요"，构成 "먹었어요"（吃了）。',
              hint: '过去时先语末 "-었-"。'
            },
            {
              type: 'fill',
              prompt: '어제 영화____ 봤어요. （昨天看了电影。）',
              prompt_translation: '昨天看了电影。',
              audio: null,
              options: null,
              answer: '를',
              explanation: '"영화" 以元音收尾，宾格助词 "을/를" 应选 "를"，"영화를 봤어요" 意为“看了电影”。',
              hint: '注意 "영화" 的收尾音。'
            },
            {
              type: 'mcq',
              prompt: '"보다"의 과거형은?',
              prompt_translation: '"보다" 的过去式是？',
              audio: null,
              options: ['봤어요', '보아요', '볼게요'],
              answer: '봤어요',
              explanation: '"보다" 的过去式为 "봤어요"，词干 "보-" 与 "-았-" 缩合成 "봤-"。',
              hint: '注意 "보다" 的缩合。'
            },
            {
              type: 'mcq',
              prompt: '다음 중 높임말（敬语）에 해당하는 것은?',
              prompt_translation: '下列哪一个是敬语表达？',
              audio: null,
              options: ['계세요', '있어요', '없어요'],
              answer: '계세요',
              explanation: '"계시다" 是 "있다"（在）的敬语形式，用于长辈或上级；"있어요" 为一般形式。',
              hint: '用于老师、长辈的“在”。'
            },
            {
              type: 'fill',
              prompt: '선생님, 안녕하____ . （老师，您好。）',
              prompt_translation: '老师，您好。',
              audio: null,
              options: null,
              answer: '세요',
              explanation: '"안녕하세요" 是完整的敬语问候形式，句中应填 "세요"。',
              hint: '完整问候语 "안녕하세요"。'
            }
          ]
        },
        {
          title: '点餐与问路',
          module: 'speaking',
          order_index: 4,
          xp: 25,
          duration_min: 10,
          description: '练习点餐与问路场景中的口语句子。',
          exercises: [
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '请给我一份拌饭。',
              audio: '비빔밥 하나 주세요.',
              options: null,
              answer: '비빔밥 하나 주세요.',
              explanation: '"하나" 是“一个”，"주세요" 表示请求，整句意为“请给我一份拌饭”。',
              hint: '注意 "하나 주세요" 的连读。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '这附近有地铁站吗？',
              audio: '이 근처에 지하철역이 있어요?',
              options: null,
              answer: '이 근처에 지하철역이 있어요?',
              explanation: '问路常用句式 "이 근처에 ~이 있어요?" 意为“这附近有……吗？”，"지하철역" 是“地铁站”。',
              hint: '注意 "지하철역" 的发音。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '请往右走。',
              audio: '오른쪽으로 가세요.',
              options: null,
              answer: '오른쪽으로 가세요.',
              explanation: '"오른쪽" 是“右边”，"-(으)로" 表示方向，整句意为“请往右走”。',
              hint: '注意 "오른쪽" 的方向助词。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '一共多少钱？',
              audio: '모두 얼마예요?',
              options: null,
              answer: '모두 얼마예요?',
              explanation: '"모두" 是“一共、全部”，"얼마예요?" 是询问价格，合起来意为“一共多少钱？”。',
              hint: '注意 "얼마예요" 的语调。'
            },
            {
              type: 'speak',
              prompt: '请跟读这句话。',
              prompt_translation: '请直走。',
              audio: '직진하세요.',
              options: null,
              answer: '직진하세요.',
              explanation: '"직진" 是“直行”，"하세요" 是敬语命令式，整句意为“请直走”。',
              hint: '注意 "직진하세요" 的发音。'
            }
          ]
        },
        {
          title: '听懂日常场景',
          module: 'listening',
          order_index: 5,
          xp: 28,
          duration_min: 12,
          description: '在真实日常场景中练习听力理解。',
          exercises: [
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '오늘 날씨가 좋아요.',
              options: ['오늘 날씨가 좋아요.', '오늘 날씨가 나빠요.', '오늘 날씨가 추워요.'],
              answer: '오늘 날씨가 좋아요.',
              explanation: '音频说的是 "오늘 날씨가 좋아요"（今天天气好），注意 "좋아요"（好）与 "나빠요"（坏）、"추워요"（冷）的区别。',
              hint: '注意听 "좋아요" 这个词。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '비빔밥 하나 주세요.',
              options: ['비빔밥 하나 주세요.', '김밥 하나 주세요.', '라면 하나 주세요.'],
              answer: '비빔밥 하나 주세요.',
              explanation: '音频说的是点餐用语 "비빔밥 하나 주세요"（请给我一份拌饭），注意区分 "비빔밥"、"김밥"、"라면"。',
              hint: '注意听 "비빔밥" 这个词。'
            },
            {
              type: 'listen_type',
              prompt: '听音频，写出你听到的句子。',
              prompt_translation: '听音频，写出你听到的句子。',
              audio: '어제 영화를 봤어요.',
              options: null,
              answer: '어제 영화를 봤어요.',
              explanation: '音频为过去时句子 "어제 영화를 봤어요"（昨天看了电影），注意宾格助词 "를" 和过去时 "봤어요"。',
              hint: '注意 "봤어요" 的拼写。'
            },
            {
              type: 'listen_type',
              prompt: '听音频，写出你听到的单词。',
              prompt_translation: '听音频，写出你听到的单词。',
              audio: '지하철역',
              options: null,
              answer: '지하철역',
              explanation: '音频单词为 "지하철역"（地铁站），注意 "지하철" 与 "역" 的连写形式。',
              hint: '听清开头的 "지하철"。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择你听到的内容。',
              audio: '오른쪽으로 가세요.',
              options: ['오른쪽으로 가세요.', '왼쪽으로 가세요.', '직진하세요.'],
              answer: '오른쪽으로 가세요.',
              explanation: '音频说的是问路指引 "오른쪽으로 가세요"（请往右走），注意区分 "오른쪽"（右）与 "왼쪽"（左）。',
              hint: '注意方向词 "오른쪽"。'
            }
          ]
        }
      ]
    }
  ],
  words: [
    { level: 'A1', word: '안녕하세요', reading: 'annyeonghaseyo', meaning: '你好', pos: '寒暄语', example: '안녕하세요, 만나서 반갑습니다.', example_translation: '你好，很高兴见到你。' },
    { level: 'A1', word: '감사합니다', reading: 'gamsahamnida', meaning: '谢谢', pos: '寒暄语', example: '도와주셔서 감사합니다.', example_translation: '谢谢您的帮助。' },
    { level: 'A1', word: '죄송합니다', reading: 'joesonghamnida', meaning: '对不起', pos: '寒暄语', example: '늦어서 죄송합니다.', example_translation: '对不起，我迟到了。' },
    { level: 'A1', word: '학생', reading: 'haksaeng', meaning: '学生', pos: '名词', example: '저는 학생입니다.', example_translation: '我是学生。' },
    { level: 'A1', word: '선생님', reading: 'seonsaengnim', meaning: '老师', pos: '名词', example: '선생님, 안녕하세요.', example_translation: '老师，您好。' },
    { level: 'A1', word: '친구', reading: 'chingu', meaning: '朋友', pos: '名词', example: '친구를 만나요.', example_translation: '我去见朋友。' },
    { level: 'A1', word: '물', reading: 'mul', meaning: '水', pos: '名词', example: '물 한 잔 주세요.', example_translation: '请给我一杯水。' },
    { level: 'A1', word: '밥', reading: 'bap', meaning: '饭', pos: '名词', example: '밥을 먹어요.', example_translation: '我吃饭。' },
    { level: 'A1', word: '책', reading: 'chaek', meaning: '书', pos: '名词', example: '책을 읽어요.', example_translation: '我读书。' },
    { level: 'A1', word: '학교', reading: 'hakgyo', meaning: '学校', pos: '名词', example: '학교에 가요.', example_translation: '我去学校。' },
    { level: 'A1', word: '집', reading: 'jip', meaning: '家', pos: '名词', example: '지금 집에 있어요.', example_translation: '我现在在家。' },
    { level: 'A1', word: '사람', reading: 'saram', meaning: '人', pos: '名词', example: '저 사람은 누구예요?', example_translation: '那个人是谁？' },
    { level: 'A1', word: '이름', reading: 'ireum', meaning: '名字', pos: '名词', example: '제 이름은 민수입니다.', example_translation: '我的名字是民秀。' },
    { level: 'A1', word: '오늘', reading: 'oneul', meaning: '今天', pos: '名词', example: '오늘은 바빠요.', example_translation: '今天很忙。' },
    { level: 'A1', word: '내일', reading: 'naeil', meaning: '明天', pos: '名词', example: '내일 만나요.', example_translation: '明天见。' },
    { level: 'A1', word: '먹다', reading: 'meokda', meaning: '吃', pos: '动词', example: '저는 밥을 먹어요.', example_translation: '我吃饭。' },
    { level: 'A1', word: '가다', reading: 'gada', meaning: '去', pos: '动词', example: '학교에 가요.', example_translation: '我去学校。' },
    { level: 'A1', word: '좋다', reading: 'jota', meaning: '好', pos: '形容词', example: '날씨가 좋아요.', example_translation: '天气很好。' },
    { level: 'A2', word: '어제', reading: 'eoje', meaning: '昨天', pos: '名词', example: '어제 영화를 봤어요.', example_translation: '昨天看了电影。' },
    { level: 'A2', word: '시간', reading: 'sigan', meaning: '时间', pos: '名词', example: '내일 시간이 있어요?', example_translation: '你明天有时间吗？' },
    { level: 'A2', word: '날씨', reading: 'nalssi', meaning: '天气', pos: '名词', example: '오늘 날씨가 좋아요.', example_translation: '今天天气很好。' },
    { level: 'A2', word: '비', reading: 'bi', meaning: '雨', pos: '名词', example: '비가 와요.', example_translation: '下雨了。' },
    { level: 'A2', word: '눈', reading: 'nun', meaning: '雪', pos: '名词', example: '눈이 많이 와요.', example_translation: '雪下得很大。' },
    { level: 'A2', word: '맛있다', reading: 'masitta', meaning: '好吃', pos: '形容词', example: '이 음식은 정말 맛있어요.', example_translation: '这个食物真好吃。' },
    { level: 'A2', word: '맵다', reading: 'maepda', meaning: '辣', pos: '形容词', example: '이 음식은 너무 매워요.', example_translation: '这个食物太辣了。' },
    { level: 'A2', word: '주말', reading: 'jumal', meaning: '周末', pos: '名词', example: '주말에 뭐 해요?', example_translation: '周末做什么？' },
    { level: 'A2', word: '만나다', reading: 'mannada', meaning: '见面', pos: '动词', example: '내일 친구를 만나요.', example_translation: '明天见朋友。' },
    { level: 'A2', word: '지하철', reading: 'jihacheol', meaning: '地铁', pos: '名词', example: '지하철을 타요.', example_translation: '我坐地铁。' },
    { level: 'A2', word: '역', reading: 'yeok', meaning: '车站', pos: '名词', example: '역에서 만나요.', example_translation: '在车站见吧。' },
    { level: 'A2', word: '가게', reading: 'gage', meaning: '商店', pos: '名词', example: '가게에서 과일을 사요.', example_translation: '我在商店买水果。' },
    { level: 'A2', word: '사다', reading: 'sada', meaning: '买', pos: '动词', example: '과일을 사요.', example_translation: '我买水果。' },
    { level: 'A2', word: '팔다', reading: 'palda', meaning: '卖', pos: '动词', example: '여기서 뭘 팔아요?', example_translation: '这里卖什么？' },
    { level: 'A2', word: '계시다', reading: 'gyesida', meaning: '在（敬语）', pos: '动词', example: '선생님 계세요?', example_translation: '老师在吗？' },
    { level: 'A2', word: '드리다', reading: 'deurida', meaning: '给（谦语）', pos: '动词', example: '선물을 드려요.', example_translation: '我送礼物。' },
    { level: 'A2', word: '주문하다', reading: 'jumunhada', meaning: '点餐', pos: '动词', example: '커피를 주문해요.', example_translation: '我点咖啡。' },
    { level: 'A2', word: '길', reading: 'gil', meaning: '路', pos: '名词', example: '길을 물어봐요.', example_translation: '我问路。' }
  ]
};
