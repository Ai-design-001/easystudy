/* 扩展内容 · 第二批：语法体系 + 雅思/托福题型库 */
window.APP_DATA_EXAM = {
  version: 1,

  /* ---------------- 语法：12 个核心点 ---------------- */
  grammar: [
    {
      id: "verb-be", level: "A1", title: "be 动词与一般现在时",
      formula: "主语 + am / is / are + 表语",
      zh: "先解决“是什么、在哪里、怎么样”。第三人称单数动词要加 -s。",
      ex: [
        { en: "I am a student.", zh: "我是学生。" },
        { en: "She works in a hospital.", zh: "她在医院工作。" },
        { en: "They are not from here.", zh: "他们不是本地人。" }
      ]
    },
    {
      id: "past-simple", level: "A1", title: "一般过去时",
      formula: "主语 + 动词过去式（did / was / were）",
      zh: "讲已经发生的事。规则动词加 -ed，不规则的必须单独记（go→went, buy→bought）。",
      ex: [
        { en: "I visited my uncle last week.", zh: "我上周看了我叔叔。" },
        { en: "We went to the beach yesterday.", zh: "我们昨天去了海边。" },
        { en: "He didn't come to the meeting.", zh: "他没来开会。" }
      ]
    },
    {
      id: "present-perfect", level: "A2", title: "现在完成时",
      formula: "have / has + 过去分词",
      zh: "过去的动作对现在有影响，或从过去持续到现在。常配 already / yet / ever / since / for。",
      ex: [
        { en: "I have lived here for five years.", zh: "我在这住了五年。" },
        { en: "She has just finished her homework.", zh: "她刚做完作业。" },
        { en: "Have you ever been to Japan?", zh: "你去过日本吗？" }
      ]
    },
    {
      id: "future", level: "A2", title: "将来表达",
      formula: "will + 动词原形 / be going to + 动词原形",
      zh: "will 多用于临时决定和承诺；be going to 用于已计划的事或有明显迹象的事。",
      ex: [
        { en: "I'll call you tonight.", zh: "我今晚打给你。" },
        { en: "We are going to move next month.", zh: "我们下个月搬家。" },
        { en: "It's going to rain.", zh: "要下雨了。" }
      ]
    },
    {
      id: "modal", level: "A2", title: "情态动词",
      formula: "can / could / must / should / might + 动词原形",
      zh: "表达能力、义务、建议和可能性。礼貌请求用 could，比 can 更委婉。",
      ex: [
        { en: "Could you help me, please?", zh: "能帮我一下吗？" },
        { en: "You should see a doctor.", zh: "你应该去看医生。" },
        { en: "It might be closed today.", zh: "今天可能关门了。" }
      ]
    },
    {
      id: "articles", level: "A2", title: "冠词 a / an / the",
      formula: "首次提到用 a/an；双方都知道的、独一无二的用 the",
      zh: "中文没有冠词，这是最容易漏的地方。泛指复数或不可数名词前通常不加冠词。",
      ex: [
        { en: "I saw a dog. The dog was friendly.", zh: "我看见一只狗，那只狗很友好。" },
        { en: "She is an engineer.", zh: "她是工程师。" },
        { en: "Water is essential for life.", zh: "水对生命必不可少。" }
      ]
    },
    {
      id: "countable", level: "A2", title: "可数与不可数",
      formula: "many / a few + 可数复数；much / a little + 不可数",
      zh: "information、advice、furniture、research 都是不可数，不能加 -s。",
      ex: [
        { en: "How many people came?", zh: "来了多少人？" },
        { en: "How much time do we have?", zh: "我们有多少时间？" },
        { en: "She gave me some useful advice.", zh: "她给了我一些有用的建议。" }
      ]
    },
    {
      id: "comparison", level: "A2", title: "比较级与最高级",
      formula: "-er / more + 形容词；the -est / the most + 形容词",
      zh: "短词加 -er/-est，长词用 more/most。注意 good→better→best。",
      ex: [
        { en: "This room is bigger than that one.", zh: "这间房比那间大。" },
        { en: "It's the most expensive hotel here.", zh: "这是这儿最贵的酒店。" },
        { en: "My English is getting better.", zh: "我的英语在变好。" }
      ]
    },
    {
      id: "passive", level: "B1", title: "被动语态",
      formula: "be + 过去分词（+ by 施动者）",
      zh: "强调动作本身或不知道谁做的，学术写作里非常常用。",
      ex: [
        { en: "The report was written last year.", zh: "这份报告是去年写的。" },
        { en: "English is spoken all over the world.", zh: "全世界都有人说英语。" },
        { en: "The problem has been solved.", zh: "问题已经解决了。" }
      ]
    },
    {
      id: "relative", level: "B1", title: "定语从句",
      formula: "名词 + who / which / that / where + 从句",
      zh: "人用 who，物用 which，地点用 where。口语里 that 更常用。",
      ex: [
        { en: "The man who helped me was very kind.", zh: "帮我的人很友善。" },
        { en: "This is the book that I told you about.", zh: "这就是我跟你说过的那本书。" },
        { en: "The city where I grew up has changed.", zh: "我长大的城市变了。" }
      ]
    },
    {
      id: "conditionals", level: "B1", title: "条件句 if 1 / 2 / 3",
      formula: "if + 现在时 → will；if + 过去时 → would；if + had done → would have done",
      zh: "第一类真实可能，第二类假设，第三类对过去的假设。写作和口语都高频。",
      ex: [
        { en: "If it rains, we will stay home.", zh: "如果下雨，我们就待在家。" },
        { en: "If I had more time, I would travel more.", zh: "如果我时间更多，我会多旅行。" },
        { en: "If I had studied harder, I would have passed.", zh: "如果我当时更努力，就过了。" }
      ]
    },
    {
      id: "connectors", level: "B1", title: "学术写作连接词",
      formula: "递进 moreover / 转折 however / 因果 therefore / 举例 for instance",
      zh: "雅思写作 Task 2 得分点之一。连接词不是越多越好，而是要准确、别重复。",
      ex: [
        { en: "Moreover, the policy is cost-effective.", zh: "此外，这项政策性价比高。" },
        { en: "However, this view has been challenged.", zh: "然而，这一观点受到了质疑。" },
        { en: "Therefore, governments should act now.", zh: "因此，政府应当立即行动。" }
      ]
    }
  ],

  /* ---------------- 考试模块 ---------------- */
  exam: {
    ielts: {
      name: "IELTS 雅思",
      target: "目标 7.0（约需 6000–8000 主动词 + 题型熟练度）",
      writing: [
        {
          task: "Task 1 · 线图",
          structure: ["改写题目（paraphrase）", "总体趋势（overall）", "分段描述数据", "关键对比"],
          frames: [
            { en: "The line graph illustrates the changes in ___ between ___ and ___.", zh: "该折线图展示了 ___ 在 ___ 至 ___ 间的变化。" },
            { en: "Overall, the figure rose steadily, while ___ declined.", zh: "总体而言，该数字稳步上升，而 ___ 下降。" },
            { en: "It is noticeable that ___ peaked in ___.", zh: "值得注意的是 ___ 在 ___ 达到峰值。" }
          ]
        },
        {
          task: "Task 1 · 柱状图 / 饼图",
          structure: ["概述图表内容", "最大项与最小项", "组间比较", "总结差异"],
          frames: [
            { en: "The bar chart compares ___ across ___ categories.", zh: "柱状图比较了 ___ 在 ___ 类别中的情况。" },
            { en: "The largest proportion was ___, accounting for ___%.", zh: "占比最大的是 ___，占 ___%。" },
            { en: "By contrast, ___ made up only ___%.", zh: "相比之下，___ 仅占 ___%。" }
          ]
        },
        {
          task: "Task 1 · 流程 / 地图",
          structure: ["说明对象", "按阶段顺序描述", "使用被动语态", "总结变化"],
          frames: [
            { en: "The diagram shows how ___ is produced.", zh: "该图展示了 ___ 是如何生产的。" },
            { en: "First, ___ is collected and then transported to ___.", zh: "首先 ___ 被收集，然后运到 ___。" },
            { en: "Finally, the product is ready for ___.", zh: "最后，产品可以用于 ___。" }
          ]
        },
        {
          task: "Task 2 · 观点类（agree/disagree）",
          structure: ["引入话题 + 明确立场", "理由一 + 例证", "理由二 + 例证", "让步 + 结论"],
          frames: [
            { en: "While some argue that ___, I believe that ___.", zh: "尽管有人认为 ___，我认为 ___。" },
            { en: "The primary reason is that ___.", zh: "主要原因是 ___。" },
            { en: "Admittedly, ___, but this does not outweigh ___.", zh: "诚然 ___，但这抵不过 ___。" }
          ]
        },
        {
          task: "Task 2 · 讨论类（discuss both views）",
          structure: ["呈现双方观点", "分析观点 A", "分析观点 B", "给出自己立场"],
          frames: [
            { en: "Some people favour ___, whereas others prefer ___.", zh: "一些人支持 ___，而另一些人更倾向 ___。" },
            { en: "Those who support ___ argue that ___.", zh: "支持 ___ 的人认为 ___。" },
            { en: "In my view, the second approach is more convincing because ___.", zh: "在我看来，第二种做法更有说服力，因为 ___。" }
          ]
        },
        {
          task: "Task 2 · 问题解决类",
          structure: ["描述问题", "分析原因", "提出方案", "评估可行性"],
          frames: [
            { en: "___ has become an increasingly serious problem.", zh: "___ 已成为日益严重的问题。" },
            { en: "This is largely caused by ___.", zh: "这主要由 ___ 造成。" },
            { en: "A practical solution would be to ___.", zh: "一个可行的办法是 ___。" }
          ]
        }
      ],
      speaking: {
        part1: [
          "Where are you from?",
          "Do you work or are you a student?",
          "What do you usually do at weekends?",
          "Do you enjoy cooking? Why?",
          "How often do you use public transport?",
          "What kind of music do you like?",
          "Do you prefer mornings or evenings?",
          "Have you changed your hometown much?",
          "Do you read much? What do you read?",
          "What's the weather like where you live?",
          "Do you like taking photos?",
          "How do you usually spend your holidays?",
          "Is there anything you want to learn?",
          "Do you prefer texting or calling?",
          "What do you do to relax?",
          "Do you think you are good at managing time?",
          "Are you interested in art?",
          "How often do you exercise?",
          "Do you like your neighbourhood?",
          "What was your favourite subject at school?"
        ],
        part2: [
          { card: "Describe a place you would like to visit.", points: ["where it is", "how you know about it", "what you would do there", "and explain why you want to go"] },
          { card: "Describe a person who has influenced you.", points: ["who they are", "how you met", "what they did", "and explain the influence"] },
          { card: "Describe a skill you want to learn.", points: ["what it is", "why you need it", "how you would learn", "and explain how it would help"] },
          { card: "Describe a memorable journey.", points: ["where you went", "who you went with", "what happened", "and explain why it was memorable"] },
          { card: "Describe a piece of technology you use daily.", points: ["what it is", "when you got it", "how you use it", "and explain why it matters"] },
          { card: "Describe a difficult decision you made.", points: ["what it was", "why it was difficult", "what you chose", "and explain how you felt"] },
          { card: "Describe a book or film that impressed you.", points: ["what it is", "when you saw it", "what it is about", "and explain why it impressed you"] },
          { card: "Describe a tradition in your country.", points: ["what it is", "when it happens", "who takes part", "and explain its meaning"] },
          { card: "Describe a time you helped someone.", points: ["who you helped", "what the problem was", "what you did", "and explain how you felt"] },
          { card: "Describe a goal you are working towards.", points: ["what it is", "when you started", "what you have done", "and explain why it matters"] }
        ],
        part3: [
          "Why do people like travelling abroad?",
          "How has tourism changed in your country?",
          "Is it important for children to learn a second language?",
          "Do you think technology makes people less social?",
          "Should governments spend more on public transport?",
          "What are the advantages of living in a city?",
          "How can schools make learning more interesting?",
          "Do you think exams are a fair way to measure ability?",
          "Is it better to work for yourself or for a company?",
          "How might work change in the next twenty years?",
          "What role should parents play in education?",
          "Should people be responsible for protecting the environment?"
        ]
      }
    },

    toefl: {
      name: "TOEFL 托福",
      target: "目标 100+（阅读/听力/口语/写作各 25+）",
      writing: [
        { task: "独立写作", prompt: "Do you agree or disagree: students should be required to study a second language at an early age?" },
        { task: "独立写作", prompt: "Some people prefer to work in a team; others prefer to work alone. Which do you prefer?" },
        { task: "独立写作", prompt: "Is it better to spend money on experiences rather than on material things?" },
        { task: "独立写作", prompt: "Should universities focus on practical skills or on academic knowledge?" },
        { task: "独立写作", prompt: "Do social media bring people closer together or make them more isolated?" },
        { task: "综合写作", prompt: "阅读 + 听力材料对同一议题给出相反结论：先用 3 句概括阅读观点，再用听力逐条反驳，不要加入自己的看法。" }
      ],
      speaking: [
        { task: "Task 1 · 独立口语", prompt: "Which do you prefer: studying alone or in a group? Give two reasons.", seconds: 45 },
        { task: "Task 1 · 独立口语", prompt: "Describe a teacher who influenced you and explain why.", seconds: 45 },
        { task: "Task 2 · 校园场景", prompt: "阅读一段校园通知 + 听一段学生评论：先复述通知内容，再说明学生的态度与理由。", seconds: 60 },
        { task: "Task 3 · 学术概念", prompt: "阅读一个学术概念 + 听教授举例：用讲座中的例子解释该概念。", seconds: 60 },
        { task: "Task 4 · 学术讲座", prompt: "听一段讲座：概括主要观点并用讲座中的两个例子说明。", seconds: 60 }
      ]
    }
  }
};
