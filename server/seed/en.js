// Seed data for the English (en) immersive language learning course.
// Pure CommonJS data module -- requires nothing.

module.exports = {
  language: {
    code: 'en',
    name: '英语',
    name_native: 'English',
    flag: '🇬🇧',
    voice: 'en-US',
    intro: '在真实场景中沉浸式学习英语，轻松开口说地道口语。'
  },
  courses: [
    {
      level: 'A1',
      level_order: 1,
      title: '英语入门',
      subtitle: 'English Starter',
      description: '从零开始学英语，掌握问候、数字、时间与基本表达。',
      icon: '🌱',
      lessons: [
        {
          title: '基础问候',
          module: 'vocabulary',
          order_index: 1,
          xp: 15,
          duration_min: 6,
          description: '学习日常问候和道别的常用英语表达。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'Which greeting is usually used in the morning?',
              prompt_translation: '早上通常使用哪个问候语？',
              audio: null,
              options: ['Good morning', 'Good night', 'Good evening'],
              answer: 'Good morning',
              explanation: 'Good morning 用于早晨问候；Good night 用于睡前道别。',
              hint: 'morning 指上午。'
            },
            {
              type: 'mcq',
              prompt: "Someone says 'Thank you.' What is the best reply?",
              prompt_translation: "'Thank you.' 最合适的回答是什么？",
              audio: null,
              options: ["You're welcome.", 'Goodbye.', 'See you.'],
              answer: "You're welcome.",
              explanation: "对方道谢时通常回答 You're welcome，意为'不客气'。",
              hint: 'welcome 表示不客气。'
            },
            {
              type: 'fill',
              prompt: 'Hello, how ____ you?',
              prompt_translation: '你好，你好吗？',
              audio: null,
              options: null,
              answer: 'are',
              explanation: '主语 you 后接 be 动词 are。',
              hint: '注意 be 动词与主语的搭配。'
            },
            {
              type: 'fill',
              prompt: 'Nice to ____ you.',
              prompt_translation: '很高兴见到你。',
              audio: null,
              options: null,
              answer: 'meet',
              explanation: "Nice to meet you 是固定搭配，意为'很高兴见到你'。",
              hint: '初次见面常用的表达。'
            },
            {
              type: 'mcq',
              prompt: "Which word means '再见'?",
              prompt_translation: "哪个单词意思是'再见'？",
              audio: null,
              options: ['Goodbye', 'Hello', 'Please'],
              answer: 'Goodbye',
              explanation: 'Goodbye 意为再见，用于告别；Hello 是打招呼。',
              hint: '告别时说的词。'
            }
          ]
        },
        {
          title: '数字与时间',
          module: 'vocabulary',
          order_index: 2,
          xp: 15,
          duration_min: 6,
          description: '学习数字、星期和时间的常见说法。',
          exercises: [
            {
              type: 'mcq',
              prompt: "What number is 'seven'?",
              prompt_translation: "'seven' 表示数字几？",
              audio: null,
              options: ['7', '6', '9'],
              answer: '7',
              explanation: "seven 意为数字 7。",
              hint: 'six 是 6，seven 比它多一个。'
            },
            {
              type: 'fill',
              prompt: 'There are ____ days in a week.',
              prompt_translation: '一周有____天。',
              audio: null,
              options: null,
              answer: 'seven',
              explanation: '一周有七天，用 seven 表示。',
              hint: '从周一到周日。'
            },
            {
              type: 'mcq',
              prompt: 'Which one is a month of the year?',
              prompt_translation: '哪一个表示月份？',
              audio: null,
              options: ['Monday', 'March', 'Morning'],
              answer: 'March',
              explanation: 'March 是三月；Monday 是星期一，Morning 是早晨。',
              hint: '注意区分星期、月份和时段。'
            },
            {
              type: 'fill',
              prompt: "I get up at six ____ in the morning.",
              prompt_translation: '我早上六点起床。',
              audio: null,
              options: null,
              answer: "o'clock",
              explanation: "o'clock 用于表示整点。",
              hint: '表示整点的单词。'
            },
            {
              type: 'mcq',
              prompt: "It's ____ now.",
              prompt_translation: '现在两点半。',
              audio: null,
              options: ['half past two', 'two half', 'two past'],
              answer: 'half past two',
              explanation: 'half past two 意为两点半。',
              hint: 'half past + 小时 = 几点半。'
            }
          ]
        },
        {
          title: '一般现在时',
          module: 'grammar',
          order_index: 3,
          xp: 20,
          duration_min: 8,
          description: '学习一般现在时的基本用法和第三人称单数变化。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'She ____ to school every day.',
              prompt_translation: '她每天去上学。',
              audio: null,
              options: ['go', 'goes', 'going'],
              answer: 'goes',
              explanation: '主语是第三人称单数，动词要加 -es。',
              hint: 'she 是第三人称单数。'
            },
            {
              type: 'fill',
              prompt: 'He ____ football on Sundays.',
              prompt_translation: '他周日踢足球。',
              audio: null,
              options: null,
              answer: 'plays',
              explanation: '一般现在时中第三人称单数动词用 plays。',
              hint: '注意第三人称单数。'
            },
            {
              type: 'mcq',
              prompt: '____ you like coffee?',
              prompt_translation: '你喜欢咖啡吗？',
              audio: null,
              options: ['Do', 'Does', 'Are'],
              answer: 'Do',
              explanation: '主语 you 用助动词 Do 构成一般疑问句。',
              hint: '主语是 you。'
            },
            {
              type: 'fill',
              prompt: 'My father ____ not like tea.',
              prompt_translation: '我父亲不喜欢茶。',
              audio: null,
              options: null,
              answer: 'does',
              explanation: '第三人称单数的否定用 does not。',
              hint: '第三人称单数否定。'
            },
            {
              type: 'mcq',
              prompt: 'They ____ in Beijing.',
              prompt_translation: '他们住在北京。',
              audio: null,
              options: ['live', 'lives', 'living'],
              answer: 'live',
              explanation: '主语 they 是复数，动词用原形 live。',
              hint: '主语是复数。'
            }
          ]
        },
        {
          title: '自我介绍',
          module: 'speaking',
          order_index: 4,
          xp: 20,
          duration_min: 8,
          description: '练习用英语介绍自己的姓名、年龄和来自哪里。',
          exercises: [
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '我叫安娜。',
              audio: 'My name is Anna.',
              options: null,
              answer: 'My name is Anna.',
              explanation: '介绍姓名常用 My name is...。',
              hint: '自报姓名。'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '我来自中国。',
              audio: 'I am from China.',
              options: null,
              answer: 'I am from China.',
              explanation: '介绍来自哪里用 I am from...。',
              hint: '来自某地用 from。'
            },
            {
              type: 'mcq',
              prompt: 'Which sentence introduces your age?',
              prompt_translation: '哪一句介绍了你的年龄？',
              audio: null,
              options: ['I am twelve years old.', 'I am from China.', 'My name is Anna.'],
              answer: 'I am twelve years old.',
              explanation: 'years old 用来介绍年龄。',
              hint: '注意关键词 years old。'
            },
            {
              type: 'fill',
              prompt: 'I ____ from Japan.',
              prompt_translation: '我来自日本。',
              audio: null,
              options: null,
              answer: 'am',
              explanation: '主语 I 后接 be 动词 am。',
              hint: '主语是 I。'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '我也很高兴见到你。',
              audio: 'Nice to meet you, too.',
              options: null,
              answer: 'Nice to meet you, too.',
              explanation: "回应 Nice to meet you 常说 Nice to meet you, too。",
              hint: '回应对方的问候。'
            }
          ]
        },
        {
          title: '听懂简单问路',
          module: 'listening',
          order_index: 5,
          xp: 25,
          duration_min: 10,
          description: '听懂简单的问路和指路的英语表达。',
          exercises: [
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: 'Go straight and turn left.',
              options: ['Go straight and turn left.', 'Go straight and turn right.', 'Go back and turn left.'],
              answer: 'Go straight and turn left.',
              explanation: '听到的是 Go straight and turn left，注意 left 和 right 的区别。',
              hint: '注意向左还是向右。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'Turn right at the corner.',
              options: null,
              answer: 'Turn right at the corner.',
              explanation: 'at the corner 意为在拐角处。',
              hint: '注意介词 at。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: 'The bank is next to the park.',
              options: ['The bank is next to the park.', 'The bank is near the school.', 'The park is next to the bank.'],
              answer: 'The bank is next to the park.',
              explanation: '听到的是 The bank is next to the park，注意主语和宾语的位置。',
              hint: '注意 bank 和 park 的顺序。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'Where is the bus stop?',
              options: null,
              answer: 'Where is the bus stop?',
              explanation: 'bus stop 意为公交车站。',
              hint: '这是一句问路的句子。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: "It's about ten minutes on foot.",
              options: ["It's about ten minutes on foot.", "It's about ten minutes by bus.", "It's about twenty minutes on foot."],
              answer: "It's about ten minutes on foot.",
              explanation: "on foot 意为步行，注意数字 ten 和 twenty 的区别。",
              hint: '注意步行方式和时间。'
            }
          ]
        }
      ]
    },
    {
      level: 'A2',
      level_order: 2,
      title: '日常英语',
      subtitle: 'Everyday English',
      description: '面向日常交流，学会购物、点餐、出行等实用表达。',
      icon: '☕',
      lessons: [
        {
          title: '购物用语',
          module: 'vocabulary',
          order_index: 1,
          xp: 15,
          duration_min: 6,
          description: '学习在商店购物时常用的英语表达。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'How much does this bag ____?',
              prompt_translation: '这个包多少钱？',
              audio: null,
              options: ['cost', 'costs', 'costing'],
              answer: 'cost',
              explanation: '助动词 does 后接动词原形 cost。',
              hint: '注意助动词后的动词形式。'
            },
            {
              type: 'mcq',
              prompt: "I'd like to ____ this shirt.",
              prompt_translation: '我想试穿这件衬衫。',
              audio: null,
              options: ['try on', 'try in', 'try out'],
              answer: 'try on',
              explanation: 'try on 意为试穿衣物。',
              hint: '试穿衣服的短语。'
            },
            {
              type: 'fill',
              prompt: 'Can I pay by ____?',
              prompt_translation: '我可以刷卡付款吗？',
              audio: null,
              options: null,
              answer: 'card',
              explanation: 'pay by card 意为刷卡付款。',
              hint: '付款方式之一。'
            },
            {
              type: 'fill',
              prompt: "This dress is on ____. It's cheaper now.",
              prompt_translation: '这条连衣裙在打折，现在更便宜。',
              audio: null,
              options: null,
              answer: 'sale',
              explanation: 'on sale 意为打折促销。',
              hint: '表示促销的短语。'
            },
            {
              type: 'mcq',
              prompt: 'Do you have this in a smaller ____?',
              prompt_translation: '这款有更小的尺码吗？',
              audio: null,
              options: ['size', 'side', 'sign'],
              answer: 'size',
              explanation: 'size 意为尺码；side 是旁边，sign 是标志。',
              hint: '衣服的尺码。'
            }
          ]
        },
        {
          title: '天气与季节',
          module: 'vocabulary',
          order_index: 2,
          xp: 15,
          duration_min: 6,
          description: '学习描述天气和四季的常见英语词汇。',
          exercises: [
            {
              type: 'mcq',
              prompt: "It's ____ today. Take an umbrella.",
              prompt_translation: '今天下雨，带上雨伞。',
              audio: null,
              options: ['rainy', 'sunny', 'windy'],
              answer: 'rainy',
              explanation: 'rainy 意为下雨的，需要带伞。',
              hint: '需要打伞的天气。'
            },
            {
              type: 'fill',
              prompt: "It's very ____ in summer here.",
              prompt_translation: '这里夏天很热。',
              audio: null,
              options: null,
              answer: 'hot',
              explanation: 'hot 意为炎热的。',
              hint: '夏天的气温特点。'
            },
            {
              type: 'mcq',
              prompt: 'Which season comes after winter?',
              prompt_translation: '冬天之后是哪个季节？',
              audio: null,
              options: ['spring', 'summer', 'autumn'],
              answer: 'spring',
              explanation: '四季顺序是 spring, summer, autumn, winter。',
              hint: '冬天过后的季节。'
            },
            {
              type: 'fill',
              prompt: 'The ____ is shining brightly.',
              prompt_translation: '太阳明亮地照耀着。',
              audio: null,
              options: null,
              answer: 'sun',
              explanation: 'the sun 意为太阳。',
              hint: '天空中发光的天体。'
            },
            {
              type: 'mcq',
              prompt: "It's ____ outside. Wear a coat.",
              prompt_translation: '外面很冷，穿件外套。',
              audio: null,
              options: ['cold', 'cool', 'warm'],
              answer: 'cold',
              explanation: 'cold 意为寒冷；cool 是凉爽，warm 是温暖。',
              hint: '需要穿外套的温度。'
            }
          ]
        },
        {
          title: '一般过去时',
          module: 'grammar',
          order_index: 3,
          xp: 20,
          duration_min: 8,
          description: '学习一般过去时的构成和常见动词过去式。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'I ____ to the cinema yesterday.',
              prompt_translation: '我昨天去了电影院。',
              audio: null,
              options: ['go', 'went', 'gone'],
              answer: 'went',
              explanation: '一般过去时用 go 的过去式 went。',
              hint: 'yesterday 表示过去。'
            },
            {
              type: 'fill',
              prompt: 'She ____ her homework last night.',
              prompt_translation: '她昨晚做了作业。',
              audio: null,
              options: null,
              answer: 'did',
              explanation: 'do 的过去式是 did。',
              hint: 'do 的过去式。'
            },
            {
              type: 'mcq',
              prompt: 'They ____ at home last weekend.',
              prompt_translation: '他们上周末待在家里。',
              audio: null,
              options: ['was', 'were', 'are'],
              answer: 'were',
              explanation: '主语 they 是复数，过去时用 were。',
              hint: '注意 be 动词的人称变化。'
            },
            {
              type: 'fill',
              prompt: 'He ____ a new bike last month.',
              prompt_translation: '他上个月买了一辆新自行车。',
              audio: null,
              options: null,
              answer: 'bought',
              explanation: 'buy 的过去式是 bought。',
              hint: 'buy 的过去式。'
            },
            {
              type: 'mcq',
              prompt: '____ you see the film last night?',
              prompt_translation: '你昨晚看那部电影了吗？',
              audio: null,
              options: ['Did', 'Do', 'Were'],
              answer: 'Did',
              explanation: '一般过去时的疑问句用助动词 Did。',
              hint: '过去时的助动词。'
            }
          ]
        },
        {
          title: '餐厅点餐',
          module: 'speaking',
          order_index: 4,
          xp: 20,
          duration_min: 8,
          description: '练习在餐厅点餐和礼貌请求的口语表达。',
          exercises: [
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '我想要一张两人桌。',
              audio: "I'd like a table for two, please.",
              options: null,
              answer: "I'd like a table for two, please.",
              explanation: "订位常用 I'd like a table for...。",
              hint: '在餐厅订位。'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '请给我菜单好吗？',
              audio: 'Could I have the menu, please?',
              options: null,
              answer: 'Could I have the menu, please?',
              explanation: '礼貌请求常用 Could I have...。',
              hint: '礼貌地请求。'
            },
            {
              type: 'mcq',
              prompt: 'Which sentence is used to order food?',
              prompt_translation: '哪一句用来点菜？',
              audio: null,
              options: ["I'll have the chicken, please.", "I'll go to the chicken.", "I'll be the chicken."],
              answer: "I'll have the chicken, please.",
              explanation: "点菜常用 I'll have...。",
              hint: '点菜时用的句型。'
            },
            {
              type: 'fill',
              prompt: 'Can I have the ____, please?',
              prompt_translation: '请给我账单好吗？',
              audio: null,
              options: null,
              answer: 'bill',
              explanation: 'bill 意为账单。',
              hint: '结账时要的东西。'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '食物很美味。',
              audio: 'The food is delicious.',
              options: null,
              answer: 'The food is delicious.',
              explanation: '评价食物常用 delicious。',
              hint: '夸奖食物好吃。'
            }
          ]
        },
        {
          title: '听懂购物对话',
          module: 'listening',
          order_index: 5,
          xp: 25,
          duration_min: 10,
          description: '听懂常见的购物场景对话。',
          exercises: [
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: "I'm just looking, thanks.",
              options: ["I'm just looking, thanks.", "I'm just cooking, thanks.", "I'm just booking, thanks."],
              answer: "I'm just looking, thanks.",
              explanation: '导购询问时常回答 I\'m just looking，意为只是随便看看。',
              hint: '语气关键词 looking。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'Do you have this in blue?',
              options: null,
              answer: 'Do you have this in blue?',
              explanation: '询问是否有其他颜色的表达。',
              hint: '询问颜色。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: "It's too expensive for me.",
              options: ["It's too expensive for me.", "It's too cheap for me.", "It's too early for me."],
              answer: "It's too expensive for me.",
              explanation: 'expensive 意为昂贵，注意区分 cheap 和 early。',
              hint: '价格太高的表达。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'Can I try it on?',
              options: null,
              answer: 'Can I try it on?',
              explanation: 'try it on 意为试穿它。',
              hint: '询问能否试穿。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: "I'll take it, thank you.",
              options: ["I'll take it, thank you.", "I'll make it, thank you.", "I'll bake it, thank you."],
              answer: "I'll take it, thank you.",
              explanation: "take it 意为买下它，注意动词的搭配。",
              hint: '决定购买时说的话。'
            }
          ]
        }
      ]
    },
    {
      level: 'B1',
      level_order: 3,
      title: '进阶英语',
      subtitle: 'Intermediate English',
      description: '提升职场与学术英语，掌握复杂语法与流畅表达。',
      icon: '🚀',
      lessons: [
        {
          title: '职场词汇',
          module: 'vocabulary',
          order_index: 1,
          xp: 15,
          duration_min: 6,
          description: '学习职场沟通中常见的英语词汇。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'We need to ____ the deadline.',
              prompt_translation: '我们需要赶上截止日期。',
              audio: null,
              options: ['meet', 'make', 'take'],
              answer: 'meet',
              explanation: 'meet the deadline 意为赶上截止日期。',
              hint: '与 deadline 搭配的动词。'
            },
            {
              type: 'fill',
              prompt: 'Please ____ the report by Friday.',
              prompt_translation: '请在周五前提交报告。',
              audio: null,
              options: null,
              answer: 'submit',
              explanation: 'submit 意为提交（报告等）。',
              hint: '提交文件用的动词。'
            },
            {
              type: 'mcq',
              prompt: 'She was ____ to manager last year.',
              prompt_translation: '她去年被提升为经理。',
              audio: null,
              options: ['promoted', 'promotion', 'promoting'],
              answer: 'promoted',
              explanation: 'be promoted to 意为被提升为；promotion 是名词。',
              hint: '注意词性，需用过去分词。'
            },
            {
              type: 'fill',
              prompt: 'We should ____ a meeting to discuss the plan.',
              prompt_translation: '我们应该安排一次会议来讨论这个计划。',
              audio: null,
              options: null,
              answer: 'arrange',
              explanation: 'arrange a meeting 意为安排会议。',
              hint: '安排会议用的动词。'
            },
            {
              type: 'mcq',
              prompt: 'He has a lot of work ____.',
              prompt_translation: '他有很多工作经验。',
              audio: null,
              options: ['experience', 'experiment', 'expense'],
              answer: 'experience',
              explanation: 'work experience 意为工作经验。',
              hint: '和 work 搭配表示经验的名词。'
            }
          ]
        },
        {
          title: '旅行与交通',
          module: 'vocabulary',
          order_index: 2,
          xp: 15,
          duration_min: 6,
          description: '学习旅行和交通场景中的进阶词汇。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'We should ____ a hotel before the trip.',
              prompt_translation: '旅行前我们应该预订酒店。',
              audio: null,
              options: ['book', 'cook', 'look'],
              answer: 'book',
              explanation: 'book a hotel 意为预订酒店。',
              hint: '预订酒店用的动词。'
            },
            {
              type: 'fill',
              prompt: 'The flight was ____ because of the storm.',
              prompt_translation: '由于暴风雨，航班被取消了。',
              audio: null,
              options: null,
              answer: 'cancelled',
              explanation: 'cancel 意为取消，这里用被动语态 cancelled。',
              hint: '航班因故不能起飞。'
            },
            {
              type: 'mcq',
              prompt: "I'd like a window ____, please.",
              prompt_translation: '我想要一个靠窗的座位。',
              audio: null,
              options: ['seat', 'sit', 'set'],
              answer: 'seat',
              explanation: 'seat 是名词，意为座位；sit 是动词坐。',
              hint: '注意词性。'
            },
            {
              type: 'fill',
              prompt: 'We arrived at the ____ two hours late.',
              prompt_translation: '我们晚点两小时到达目的地。',
              audio: null,
              options: null,
              answer: 'destination',
              explanation: 'destination 意为目的地。',
              hint: '到达的地点。'
            },
            {
              type: 'mcq',
              prompt: 'The train was ____, so we took a taxi.',
              prompt_translation: '火车晚点了，所以我们坐出租车。',
              audio: null,
              options: ['delayed', 'relaid', 'replayed'],
              answer: 'delayed',
              explanation: 'delayed 意为延误的。',
              hint: '交通晚点的表达。'
            }
          ]
        },
        {
          title: '现在完成时',
          module: 'grammar',
          order_index: 3,
          xp: 20,
          duration_min: 8,
          description: '学习现在完成时的构成与常见用法。',
          exercises: [
            {
              type: 'mcq',
              prompt: 'I ____ lived here for ten years.',
              prompt_translation: '我在这里住了十年了。',
              audio: null,
              options: ['have', 'has', 'had'],
              answer: 'have',
              explanation: '主语 I 用 have，现在完成时表示持续到现在。',
              hint: '主语是 I。'
            },
            {
              type: 'fill',
              prompt: 'She ____ finished her work.',
              prompt_translation: '她已经完成了工作。',
              audio: null,
              options: null,
              answer: 'has',
              explanation: '第三人称单数用 has 构成现在完成时。',
              hint: '主语是 she。'
            },
            {
              type: 'mcq',
              prompt: 'They ____ already seen this film.',
              prompt_translation: '他们已经看过这部电影。',
              audio: null,
              options: ['have', 'has', 'had'],
              answer: 'have',
              explanation: '主语 they 用 have。',
              hint: '主语是复数。'
            },
            {
              type: 'fill',
              prompt: 'I have never ____ to Japan.',
              prompt_translation: '我从未去过日本。',
              audio: null,
              options: null,
              answer: 'been',
              explanation: 'have been to 意为曾经去过某地。',
              hint: 'be 的过去分词。'
            },
            {
              type: 'mcq',
              prompt: '____ you ever been to London?',
              prompt_translation: '你去过伦敦吗？',
              audio: null,
              options: ['Have', 'Has', 'Had'],
              answer: 'Have',
              explanation: '主语 you 用 Have 构成现在完成时疑问句。',
              hint: '主语是 you。'
            }
          ]
        },
        {
          title: '表达观点',
          module: 'speaking',
          order_index: 4,
          xp: 20,
          duration_min: 8,
          description: '练习用英语表达和论证自己的观点。',
          exercises: [
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '在我看来，这是个好主意。',
              audio: 'In my opinion, this is a great idea.',
              options: null,
              answer: 'In my opinion, this is a great idea.',
              explanation: '表达观点常用 In my opinion。',
              hint: '表达个人观点。'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '我坚信我们应该尝试。',
              audio: 'I strongly believe that we should try.',
              options: null,
              answer: 'I strongly believe that we should try.',
              explanation: 'strongly believe 表示强烈地相信。',
              hint: '强烈地表达相信。'
            },
            {
              type: 'mcq',
              prompt: 'Which phrase politely disagrees?',
              prompt_translation: '哪一句礼貌地表达反对？',
              audio: null,
              options: ["I'm afraid I disagree.", 'I hate it.', 'You are wrong.'],
              answer: "I'm afraid I disagree.",
              explanation: "I'm afraid I disagree 是礼貌的反对表达。",
              hint: '礼貌表达不同意见。'
            },
            {
              type: 'fill',
              prompt: 'From my point of ____, this plan works.',
              prompt_translation: '在我看来，这个方案可行。',
              audio: null,
              options: null,
              answer: 'view',
              explanation: 'from my point of view 意为在我看来。',
              hint: 'point of + ?'
            },
            {
              type: 'speak',
              prompt: '跟读这句话。',
              prompt_translation: '说得有道理，但我看法不同。',
              audio: "That's a good point, but I see it differently.",
              options: null,
              answer: "That's a good point, but I see it differently.",
              explanation: '礼貌地回应不同意见的表达。',
              hint: '先肯定再表达不同。'
            }
          ]
        },
        {
          title: '听懂新闻片段',
          module: 'listening',
          order_index: 5,
          xp: 25,
          duration_min: 10,
          description: '听懂简短的英语新闻片段和信息。',
          exercises: [
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: 'The company announced a new policy today.',
              options: ['The company announced a new policy today.', 'The company announced a new police today.', 'The company enjoyed a new policy today.'],
              answer: 'The company announced a new policy today.',
              explanation: 'announced 意为宣布，注意区分 police（警察）等近音词。',
              hint: '注意关键词 announced。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'The meeting has been postponed until Friday.',
              options: null,
              answer: 'The meeting has been postponed until Friday.',
              explanation: 'postpone 意为推迟，此处用现在完成时被动语态。',
              hint: '会议被推迟了。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: 'Economists expect the market to recover soon.',
              options: ['Economists expect the market to recover soon.', 'Economists expect the market to recover slow.', 'Economists accept the market to record soon.'],
              answer: 'Economists expect the market to recover soon.',
              explanation: 'economist 意为经济学家，recover 意为复苏。',
              hint: '注意主语 economists。'
            },
            {
              type: 'listen_type',
              prompt: '听写你听到的句子。',
              prompt_translation: '听并写出完整句子。',
              audio: 'The report will be released next week.',
              options: null,
              answer: 'The report will be released next week.',
              explanation: 'be released 意为被发布/公布。',
              hint: '报告将被公布。'
            },
            {
              type: 'listen_choice',
              prompt: '听音频，选择你听到的内容。',
              prompt_translation: '听音频，选择正确的句子。',
              audio: 'Residents are concerned about the rising cost of living.',
              options: ['Residents are concerned about the rising cost of living.', 'Residents are concerned about the raising cost of living.', 'Residents are connected about the rising cost of living.'],
              answer: 'Residents are concerned about the rising cost of living.',
              explanation: 'be concerned about 意为担心，rising 意为上涨的。',
              hint: '注意固定搭配 be concerned about。'
            }
          ]
        }
      ]
    }
  ],
  words: [
    { level: 'A1', word: 'hello', reading: '', meaning: '你好；喂', pos: '感叹词', example: 'Hello, how are you?', example_translation: '你好，你好吗？' },
    { level: 'A1', word: 'morning', reading: '', meaning: '早晨；上午', pos: '名词', example: 'I go running every morning.', example_translation: '我每天早上都去跑步。' },
    { level: 'A1', word: 'family', reading: '', meaning: '家庭；家人', pos: '名词', example: 'I love my family very much.', example_translation: '我非常爱我的家人。' },
    { level: 'A1', word: 'water', reading: '', meaning: '水', pos: '名词', example: 'Please drink more water every day.', example_translation: '请每天多喝水。' },
    { level: 'A1', word: 'book', reading: '', meaning: '书；书本', pos: '名词', example: 'This book is very interesting.', example_translation: '这本书非常有趣。' },
    { level: 'A1', word: 'friend', reading: '', meaning: '朋友', pos: '名词', example: 'She is my best friend.', example_translation: '她是我最好的朋友。' },
    { level: 'A1', word: 'school', reading: '', meaning: '学校', pos: '名词', example: 'We go to school by bus.', example_translation: '我们坐公交车去上学。' },
    { level: 'A1', word: 'happy', reading: '', meaning: '快乐的；高兴的', pos: '形容词', example: 'I am happy to see you.', example_translation: '见到你我很高兴。' },
    { level: 'A1', word: 'house', reading: '', meaning: '房子；住宅', pos: '名词', example: 'They live in a big house.', example_translation: '他们住在一栋大房子里。' },
    { level: 'A1', word: 'food', reading: '', meaning: '食物', pos: '名词', example: 'The food here is delicious.', example_translation: '这里的食物很美味。' },
    { level: 'A1', word: 'day', reading: '', meaning: '天；白天', pos: '名词', example: 'Have a nice day!', example_translation: '祝你今天愉快！' },
    { level: 'A1', word: 'city', reading: '', meaning: '城市', pos: '名词', example: 'Beijing is a beautiful city.', example_translation: '北京是一座美丽的城市。' },
    { level: 'A1', word: 'car', reading: '', meaning: '汽车', pos: '名词', example: 'He drives a red car.', example_translation: '他开一辆红色的车。' },
    { level: 'A1', word: 'time', reading: '', meaning: '时间；次数', pos: '名词', example: 'What time is it now?', example_translation: '现在几点了？' },
    { level: 'A1', word: 'love', reading: '', meaning: '爱；喜爱', pos: '动词', example: 'I love reading books.', example_translation: '我喜欢读书。' },
    { level: 'A2', word: 'travel', reading: '', meaning: '旅行', pos: '动词；名词', example: 'I want to travel around the world.', example_translation: '我想环游世界。' },
    { level: 'A2', word: 'weather', reading: '', meaning: '天气', pos: '名词', example: 'The weather is nice today.', example_translation: '今天天气很好。' },
    { level: 'A2', word: 'holiday', reading: '', meaning: '假日；节日', pos: '名词', example: 'We had a wonderful holiday.', example_translation: '我们度过了一个愉快的假期。' },
    { level: 'A2', word: 'restaurant', reading: '', meaning: '餐馆', pos: '名词', example: 'We had dinner at a nice restaurant.', example_translation: '我们在一家不错的餐馆吃了晚饭。' },
    { level: 'A2', word: 'shopping', reading: '', meaning: '购物', pos: '名词', example: 'She goes shopping every weekend.', example_translation: '她每个周末都去购物。' },
    { level: 'A2', word: 'healthy', reading: '', meaning: '健康的', pos: '形容词', example: 'Eating vegetables keeps you healthy.', example_translation: '吃蔬菜使你保持健康。' },
    { level: 'A2', word: 'weekend', reading: '', meaning: '周末', pos: '名词', example: 'We often relax on the weekend.', example_translation: '我们经常在周末放松。' },
    { level: 'A2', word: 'language', reading: '', meaning: '语言', pos: '名词', example: 'English is an important language.', example_translation: '英语是一门重要的语言。' },
    { level: 'A2', word: 'culture', reading: '', meaning: '文化', pos: '名词', example: 'I am interested in Chinese culture.', example_translation: '我对中国文化很感兴趣。' },
    { level: 'A2', word: 'money', reading: '', meaning: '钱；货币', pos: '名词', example: 'He saves money every month.', example_translation: '他每个月都存钱。' },
    { level: 'A2', word: 'exercise', reading: '', meaning: '锻炼；练习', pos: '名词；动词', example: 'Regular exercise is good for you.', example_translation: '规律的锻炼对你有好处。' },
    { level: 'A2', word: 'neighbor', reading: '', meaning: '邻居', pos: '名词', example: 'My neighbor is very friendly.', example_translation: '我的邻居非常友好。' },
    { level: 'A2', word: 'promise', reading: '', meaning: '承诺；答应', pos: '动词；名词', example: 'He always keeps his promise.', example_translation: '他总是信守承诺。' },
    { level: 'A2', word: 'hobby', reading: '', meaning: '爱好', pos: '名词', example: 'My hobby is playing the guitar.', example_translation: '我的爱好是弹吉他。' },
    { level: 'A2', word: 'machine', reading: '', meaning: '机器', pos: '名词', example: 'This machine is easy to use.', example_translation: '这台机器很容易使用。' },
    { level: 'B1', word: 'opportunity', reading: '', meaning: '机会', pos: '名词', example: 'This is a great opportunity for us.', example_translation: '这对我们来说是个好机会。' },
    { level: 'B1', word: 'environment', reading: '', meaning: '环境', pos: '名词', example: 'We should protect the environment.', example_translation: '我们应该保护环境。' },
    { level: 'B1', word: 'technology', reading: '', meaning: '科技；技术', pos: '名词', example: 'Technology is changing our lives.', example_translation: '科技正在改变我们的生活。' },
    { level: 'B1', word: 'government', reading: '', meaning: '政府', pos: '名词', example: 'The government announced new rules.', example_translation: '政府宣布了新规定。' },
    { level: 'B1', word: 'communicate', reading: '', meaning: '交流；沟通', pos: '动词', example: 'We communicate with each other by email.', example_translation: '我们通过电子邮件互相交流。' },
    { level: 'B1', word: 'experience', reading: '', meaning: '经验；经历', pos: '名词；动词', example: 'She has a lot of work experience.', example_translation: '她有很多工作经验。' },
    { level: 'B1', word: 'responsibility', reading: '', meaning: '责任', pos: '名词', example: 'Everyone has a responsibility to help.', example_translation: '每个人都有责任去帮助。' },
    { level: 'B1', word: 'education', reading: '', meaning: '教育', pos: '名词', example: 'Education is important for children.', example_translation: '教育对孩子很重要。' },
    { level: 'B1', word: 'community', reading: '', meaning: '社区；群体', pos: '名词', example: 'The whole community joined the event.', example_translation: '整个社区都参加了活动。' },
    { level: 'B1', word: 'strategy', reading: '', meaning: '策略；战略', pos: '名词', example: 'We need a better marketing strategy.', example_translation: '我们需要更好的营销策略。' },
    { level: 'B1', word: 'achievement', reading: '', meaning: '成就', pos: '名词', example: 'Winning the prize was a great achievement.', example_translation: '赢得这个奖项是一项巨大的成就。' },
    { level: 'B1', word: 'independent', reading: '', meaning: '独立的', pos: '形容词', example: 'She is an independent young woman.', example_translation: '她是一个独立的年轻女性。' },
    { level: 'B1', word: 'significant', reading: '', meaning: '重要的；显著的', pos: '形容词', example: 'This is a significant change.', example_translation: '这是一个重大的变化。' },
    { level: 'B1', word: 'professional', reading: '', meaning: '专业的；职业的', pos: '形容词', example: 'He looks very professional.', example_translation: '他看起来非常专业。' },
    { level: 'B1', word: 'generation', reading: '', meaning: '一代人；代', pos: '名词', example: 'The younger generation loves new tech.', example_translation: '年轻一代喜爱新科技。' }
  ]
};
