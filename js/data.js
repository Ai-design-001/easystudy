/* 内容库：6 个出国高频场景
   数据结构：
   scenario = {
     id, week, icon, title, titleEn, goal,
     patterns: [{ en, zh, tip }]        万能句型（每题 6 个）
     words:    [{ en, zh, ex }]         场景词（每题 15 个）
     shadow:   [{ en, zh }]             影子跟读句子（6 句）
     dialogue: { title, turns: [ {who:'staff'|'you', en, zh} | {who:'you', options:[...]} ] }
   }
*/
window.APP_DATA = {
  version: 1,

  weeks: {
    1: { title: "第 1 周 · 机场 & 海关", focus: "能独立值机、过安检、回答海关问题" },
    2: { title: "第 2 周 · 酒店", focus: "入住、退房、提出房间问题" },
    3: { title: "第 3 周 · 餐厅", focus: "点餐、忌口、买单" },
    4: { title: "第 4 周 · 交通 & 购物", focus: "问路、买票、退换货" }
  },

  scenarios: [
    /* ---------------- 1. 机场值机 ---------------- */
    {
      id: "airport",
      week: 1,
      icon: "✈️",
      title: "机场值机",
      titleEn: "Airport check-in",
      goal: "办值机、托运行李、问登机口",
      patterns: [
        { en: "I'd like to check in for the flight to New York.", zh: "我要办理去纽约的航班值机。", tip: "check in 连读像 “拆-肯”；I'd like to 比 I want 礼貌。换成你的目的地时，把 New York 替换掉即可" },
        { en: "Here is my passport and ticket.", zh: "这是我的护照和机票。", tip: "递东西时只说 Here you are. 也可以" },
        { en: "I have one bag to check and one carry-on.", zh: "我有一件托运，一件随身。", tip: "check 在这里是“托运”，不是“检查”" },
        { en: "Could I have a window seat, please?", zh: "能给我一个靠窗的座位吗？", tip: "Could I have… 是最安全的请求句式" },
        { en: "What time does boarding start?", zh: "几点开始登机？", tip: "boarding 读 /ˈbɔːrdɪŋ/" },
        { en: "Sorry, I didn't catch that. Could you say it again more slowly?", zh: "抱歉没听清，能再说慢一点吗？", tip: "背熟这句，听不懂时救命用" }
      ],
      words: [
        { en: "boarding pass", zh: "登机牌", ex: "Here is your boarding pass." },
        { en: "check-in counter", zh: "值机柜台", ex: "The check-in counter is over there." },
        { en: "carry-on", zh: "随身行李", ex: "This is my carry-on." },
        { en: "checked baggage", zh: "托运行李", ex: "How much checked baggage can I take?" },
        { en: "gate", zh: "登机口", ex: "Gate 24 is on the left." },
        { en: "boarding time", zh: "登机时间", ex: "Boarding time is 9:30." },
        { en: "delayed", zh: "延误", ex: "The flight is delayed." },
        { en: "on time", zh: "准点", ex: "Your flight is on time." },
        { en: "departure", zh: "出发", ex: "Departure is at 10 a.m." },
        { en: "arrival", zh: "到达", ex: "The arrival time is 2 p.m." },
        { en: "aisle seat", zh: "过道座位", ex: "I prefer an aisle seat." },
        { en: "window seat", zh: "靠窗座位", ex: "A window seat, please." },
        { en: "passport", zh: "护照", ex: "May I see your passport?" },
        { en: "flight number", zh: "航班号", ex: "What is your flight number?" },
        { en: "luggage tag", zh: "行李牌", ex: "Please keep your luggage tag." }
      ],
      shadow: [
        { en: "Good morning. May I see your passport, please?", zh: "早上好，请出示护照。" },
        { en: "How many bags are you checking in?", zh: "您要托运几件行李？" },
        { en: "Would you like a window or an aisle seat?", zh: "您要靠窗还是过道？" },
        { en: "Your flight is on time. Boarding starts at nine thirty.", zh: "您的航班准点，九点半开始登机。" },
        { en: "Please go to Gate 24 after security.", zh: "过安检后请前往 24 号登机口。" },
        { en: "Have a nice flight.", zh: "祝您旅途愉快。" }
      ],
      dialogue: {
        title: "值机柜台 Check-in counter",
        turns: [
          { who: "staff", en: "Good morning. Where are you flying to today?", zh: "早上好，今天飞哪里？" },
          {
            who: "you",
            options: [
              { en: "I'm flying to New York.", zh: "我飞纽约。", ok: true },
              { en: "Yes, I am fine, thank you.", zh: "是的我很好，谢谢。", ok: false, why: "对方在问目的地，不是问你好不好" },
              { en: "I have a ticket.", zh: "我有机票。", ok: false, why: "答非所问，直接回答地名就好" }
            ]
          },
          { who: "staff", en: "May I see your passport, please?", zh: "可以看下您的护照吗？" },
          {
            who: "you",
            options: [
              { en: "Here you are.", zh: "给您。", ok: true },
              { en: "No, thank you.", zh: "不用了，谢谢。", ok: false, why: "对方要护照，不是给你东西" },
              { en: "My name is Li Ming.", zh: "我叫李明。", ok: false, why: "报名字不等于递护照，配合动作说 Here you are 最自然" }
            ]
          },
          { who: "staff", en: "How many bags are you checking in?", zh: "您托运几件行李？" },
          {
            who: "you",
            options: [
              { en: "Just one, and this is my carry-on.", zh: "就一件，这是我的随身行李。", ok: true },
              { en: "Yes, I have a bag.", zh: "是的，我有行李。", ok: false, why: "问的是数量，只答“是”不够" },
              { en: "I don't know.", zh: "我不知道。", ok: false, why: "自己有几件行李应该是知道的" }
            ]
          },
          { who: "staff", en: "Here is your boarding pass. Boarding starts at 9:30 at Gate 24.", zh: "这是您的登机牌，9:30 在 24 号登机口登机。" },
          {
            who: "you",
            options: [
              { en: "Thank you. Which way is security?", zh: "谢谢。安检往哪边走？", ok: true },
              { en: "Thank you. Goodbye.", zh: "谢谢，再见。", ok: false, why: "不算错，但错过了一个问路的机会，值机时问最方便" },
              { en: "Yes, please.", zh: "好的，请。", ok: false, why: "这句在这里没有意义" }
            ]
          }
        ]
      }
    },

    /* ---------------- 2. 海关入境 ---------------- */
    {
      id: "customs",
      week: 1,
      icon: "🛃",
      title: "海关入境",
      titleEn: "Customs & immigration",
      goal: "回答海关的四个必问题，会说“没有要申报的”",
      patterns: [
        { en: "I'm here on vacation for ten days.", zh: "我来旅游，待十天。", tip: "on vacation = 度假；on business = 出差" },
        { en: "I'm staying at the Hilton Hotel.", zh: "我住希尔顿酒店。", tip: "stay at + 酒店名，介词用 at" },
        { en: "I have nothing to declare.", zh: "我没有需要申报的物品。", tip: "declare 读 /dɪˈkler/，海关高频词" },
        { en: "I'm here to visit my friend.", zh: "我来探访朋友。", tip: "I'm here to + 动词，说明目的最直接" },
        { en: "Sorry, could you explain that in simpler words?", zh: "抱歉，能说得简单一点吗？", tip: "simpler words 比 repeat 更有效，对方会换说法" },
        { en: "Is this the right line for foreign visitors?", zh: "外国旅客是排这一队吗？", tip: "foreign visitors = 外国旅客" }
      ],
      words: [
        { en: "customs", zh: "海关", ex: "Go through customs first." },
        { en: "passport control", zh: "护照查验", ex: "Passport control is on the right." },
        { en: "declaration form", zh: "申报单", ex: "Please fill in this declaration form." },
        { en: "nothing to declare", zh: "无申报物品", ex: "I have nothing to declare." },
        { en: "visa", zh: "签证", ex: "Do I need a visa?" },
        { en: "purpose of visit", zh: "访问目的", ex: "What is the purpose of your visit?" },
        { en: "stay", zh: "停留", ex: "How long is your stay?" },
        { en: "return ticket", zh: "回程机票", ex: "Do you have a return ticket?" },
        { en: "luggage", zh: "行李", ex: "Is this all your luggage?" },
        { en: "customs officer", zh: "海关官员", ex: "The customs officer asked me two questions." },
        { en: "baggage claim", zh: "行李提取", ex: "Baggage claim is downstairs." },
        { en: "immigration", zh: "入境处", ex: "Immigration is very busy today." },
        { en: "stamp", zh: "盖章", ex: "They put a stamp in my passport." },
        { en: "forbidden items", zh: "违禁品", ex: "These are forbidden items." },
        { en: "duty-free", zh: "免税", ex: "I bought this at the duty-free shop." }
      ],
      shadow: [
        { en: "What is the purpose of your visit?", zh: "您此行的目的是什么？" },
        { en: "How long are you staying?", zh: "您打算待多久？" },
        { en: "Where will you be staying?", zh: "您住在哪里？" },
        { en: "Do you have anything to declare?", zh: "有需要申报的物品吗？" },
        { en: "Please look at the camera.", zh: "请看镜头。" },
        { en: "Welcome to the United States. Enjoy your stay.", zh: "欢迎来到美国，祝您愉快。" }
      ],
      dialogue: {
        title: "入境检查 Immigration",
        turns: [
          { who: "staff", en: "Passport, please. What is the purpose of your visit?", zh: "请出示护照。您此行的目的是？" },
          {
            who: "you",
            options: [
              { en: "I'm here on vacation for ten days.", zh: "我来旅游，待十天。", ok: true },
              { en: "I like New York very much.", zh: "我很喜欢纽约。", ok: false, why: "没回答“目的”，海关要的是旅游/商务/探亲" },
              { en: "Sorry, I don't speak English.", zh: "抱歉我不会说英语。", ok: false, why: "这句可以救命，但先试着用上面的句型回答" }
            ]
          },
          { who: "staff", en: "How long are you staying?", zh: "您待多久？" },
          {
            who: "you",
            options: [
              { en: "Ten days. I leave on the 15th.", zh: "十天，15 号走。", ok: true },
              { en: "Yes, I am staying.", zh: "是的，我待着。", ok: false, why: "问的是时长，要回答几天" },
              { en: "In a hotel.", zh: "在酒店。", ok: false, why: "这是回答“住哪里”，不是“待多久”" }
            ]
          },
          { who: "staff", en: "Where will you be staying?", zh: "您住在哪里？" },
          {
            who: "you",
            options: [
              { en: "At the Hilton Hotel in the city center.", zh: "市中心的希尔顿酒店。", ok: true },
              { en: "For ten days.", zh: "十天。", ok: false, why: "这是时长，问的是地点" },
              { en: "I don't have one.", zh: "我没有。", ok: false, why: "旅游必须有住宿地址，海关会追问" }
            ]
          },
          { who: "staff", en: "Do you have anything to declare?", zh: "有需要申报的物品吗？" },
          {
            who: "you",
            options: [
              { en: "No, I have nothing to declare.", zh: "没有，我没有需要申报的。", ok: true },
              { en: "No, thank you.", zh: "不用了，谢谢。", ok: false, why: "这不是给你东西，别用 thank you" },
              { en: "Yes, I have a lot of money.", zh: "有，我带了很多钱。", ok: false, why: "除非真的超额，否则别主动这样说" }
            ]
          }
        ]
      }
    },

    /* ---------------- 3. 酒店 ---------------- */
    {
      id: "hotel",
      week: 2,
      icon: "🏨",
      title: "酒店入住",
      titleEn: "Hotel check-in",
      goal: "报预订、问早餐、反馈房间问题",
      patterns: [
        { en: "I have a reservation under the name ___.", zh: "我用 ___ 这个名字订了房。", tip: "under the name 是固定说法" },
        { en: "I'd like to check in, please.", zh: "我要办理入住。", tip: "check out 是退房，别混" },
        { en: "Is breakfast included?", zh: "含早餐吗？", tip: "included 读 /ɪnˈkluːdɪd/" },
        { en: "Could I have a room with a view?", zh: "能给我一间景观房吗？", tip: "with a view = 有景观" },
        { en: "The air conditioner doesn't work.", zh: "空调不工作。", tip: "doesn't work 是万能“坏了”说法" },
        { en: "Could you keep my luggage until this afternoon?", zh: "能帮我把行李保管到今天下午吗？", tip: "退房后寄存行李就靠这句" }
      ],
      words: [
        { en: "reservation", zh: "预订", ex: "I have a reservation for two nights." },
        { en: "check-in", zh: "入住", ex: "Check-in time is 3 p.m." },
        { en: "check-out", zh: "退房", ex: "Check-out is at noon." },
        { en: "front desk", zh: "前台", ex: "Please call the front desk." },
        { en: "room key", zh: "房卡", ex: "Here is your room key." },
        { en: "single room", zh: "单人间", ex: "I booked a single room." },
        { en: "double room", zh: "双人间", ex: "A double room for two nights." },
        { en: "breakfast included", zh: "含早餐", ex: "Is breakfast included?" },
        { en: "Wi-Fi password", zh: "无线网密码", ex: "What is the Wi-Fi password?" },
        { en: "luggage storage", zh: "行李寄存", ex: "Do you have luggage storage?" },
        { en: "extra towel", zh: "额外毛巾", ex: "Could I have an extra towel?" },
        { en: "air conditioner", zh: "空调", ex: "The air conditioner is too cold." },
        { en: "hot water", zh: "热水", ex: "There is no hot water." },
        { en: "wake-up call", zh: "叫醒服务", ex: "I need a wake-up call at six." },
        { en: "room service", zh: "客房服务", ex: "Room service closes at ten." }
      ],
      shadow: [
        { en: "Good evening. Do you have a reservation?", zh: "晚上好，您有预订吗？" },
        { en: "May I have your name, please?", zh: "请问您的名字？" },
        { en: "Your room is on the fifth floor.", zh: "您的房间在五楼。" },
        { en: "Breakfast is from seven to ten.", zh: "早餐是七点到十点。" },
        { en: "Please call the front desk if you need anything.", zh: "有任何需要请打电话给前台。" },
        { en: "Enjoy your stay.", zh: "祝您入住愉快。" }
      ],
      dialogue: {
        title: "前台 Front desk",
        turns: [
          { who: "staff", en: "Good evening. Do you have a reservation?", zh: "晚上好，您有预订吗？" },
          {
            who: "you",
            options: [
              { en: "Yes, I have a reservation under the name Wang.", zh: "有，我用王这个名字订的。", ok: true },
              { en: "Yes, I want a room.", zh: "是的，我要一间房。", ok: false, why: "有预订就直接报名字，不然会被当成现场订房" },
              { en: "No, this is my first time.", zh: "没有，我第一次来。", ok: false, why: "这会让对方以为你要现场开房" }
            ]
          },
          { who: "staff", en: "One moment, please. A double room for two nights?", zh: "请稍等，双人间两晚是吗？" },
          {
            who: "you",
            options: [
              { en: "Yes, that's right.", zh: "对，没错。", ok: true },
              { en: "Yes, I am right.", zh: "是的，我是对的。", ok: false, why: "that's right 是“没错”，I am right 是“我是对的”，意思完全不同" },
              { en: "Two nights, yes.", zh: "两晚，对。", ok: true }
            ]
          },
          { who: "staff", en: "Here is your key. Your room is on the fifth floor.", zh: "这是房卡，房间在五楼。" },
          {
            who: "you",
            options: [
              { en: "Thank you. Is breakfast included?", zh: "谢谢。含早餐吗？", ok: true },
              { en: "Thank you. How much is the breakfast?", zh: "谢谢。早餐多少钱？", ok: true },
              { en: "Thank you. Where is the airport?", zh: "谢谢。机场在哪？", ok: false, why: "刚到酒店问机场太早，先把入住相关问清楚" }
            ]
          },
          { who: "staff", en: "Breakfast is from seven to ten on the ground floor.", zh: "早餐七点到十点，在一楼。" },
          {
            who: "you",
            options: [
              { en: "Great. Could I have a wake-up call at six?", zh: "好的。能六点叫醒我吗？", ok: true },
              { en: "Great. I want to sleep.", zh: "好的，我想睡觉。", ok: false, why: "想表达“我很累”，说 I'm very tired 更自然" },
              { en: "Great. Where is the elevator?", zh: "好的，电梯在哪？", ok: true }
            ]
          }
        ]
      }
    },

    /* ---------------- 4. 餐厅 ---------------- */
    {
      id: "restaurant",
      week: 3,
      icon: "🍽️",
      title: "餐厅点餐",
      titleEn: "At a restaurant",
      goal: "要座位、点菜、说忌口、买单",
      patterns: [
        { en: "A table for two, please.", zh: "两位。", tip: "for + 人数，不用 I want" },
        { en: "Could I see the menu, please?", zh: "能看下菜单吗？", tip: "menu 读 /ˈmenjuː/" },
        { en: "I'd like this one, please.", zh: "我想要这个。", tip: "指着菜单说这句最省事" },
        { en: "I'm allergic to peanuts.", zh: "我对花生过敏。", tip: "allergic to + 东西，过敏关键时刻救命" },
        { en: "Could I have it without onions?", zh: "可以不加洋葱吗？", tip: "without + 食材" },
        { en: "Could we have the bill, please?", zh: "买单。", tip: "美式说 check，英式说 bill，都听得懂" }
      ],
      words: [
        { en: "menu", zh: "菜单", ex: "Could I see the menu?" },
        { en: "order", zh: "点餐", ex: "Are you ready to order?" },
        { en: "bill", zh: "账单", ex: "Could we have the bill?" },
        { en: "tip", zh: "小费", ex: "Is the tip included?" },
        { en: "waiter", zh: "服务员", ex: "The waiter is very friendly." },
        { en: "table for two", zh: "两人桌", ex: "A table for two, please." },
        { en: "spicy", zh: "辣的", ex: "Is this dish spicy?" },
        { en: "allergic", zh: "过敏的", ex: "I'm allergic to nuts." },
        { en: "vegetarian", zh: "素食的", ex: "Do you have vegetarian dishes?" },
        { en: "medium rare", zh: "五分熟", ex: "I'd like my steak medium rare." },
        { en: "drink", zh: "饮料", ex: "What would you like to drink?" },
        { en: "dessert", zh: "甜点", ex: "Would you like dessert?" },
        { en: "takeaway", zh: "外带", ex: "Can I have it takeaway?" },
        { en: "fork", zh: "叉子", ex: "Could I have a fork?" },
        { en: "still water", zh: "不带气的水", ex: "Still water, please." }
      ],
      shadow: [
        { en: "Good evening. A table for how many?", zh: "晚上好，几位？" },
        { en: "Are you ready to order?", zh: "可以点餐了吗？" },
        { en: "Would you like anything to drink?", zh: "要喝点什么吗？" },
        { en: "Is everything all right?", zh: "一切都还好吗？" },
        { en: "Would you like dessert?", zh: "要甜点吗？" },
        { en: "Here is your bill.", zh: "这是您的账单。" }
      ],
      dialogue: {
        title: "餐厅点餐 Ordering",
        turns: [
          { who: "staff", en: "Good evening. A table for how many?", zh: "晚上好，几位？" },
          {
            who: "you",
            options: [
              { en: "A table for two, please.", zh: "两位。", ok: true },
              { en: "I want to eat.", zh: "我想吃饭。", ok: false, why: "对方问人数，答人数就好" },
              { en: "Two people are coming.", zh: "两个人要来。", ok: false, why: "语法没错，但直接说 for two 更自然" }
            ]
          },
          { who: "staff", en: "Are you ready to order?", zh: "可以点餐了吗？" },
          {
            who: "you",
            options: [
              { en: "Yes. I'd like this one, and could I have it without onions?", zh: "可以。我要这个，能不加洋葱吗？", ok: true },
              { en: "Yes. I want food.", zh: "是的，我要食物。", ok: false, why: "太笼统，服务员无法下单" },
              { en: "No. Where is the toilet?", zh: "不，厕所在哪？", ok: false, why: "可以问，但别用 No 挡掉点餐" }
            ]
          },
          { who: "staff", en: "Sure. Anything to drink?", zh: "好的。要喝点什么吗？" },
          {
            who: "you",
            options: [
              { en: "Still water, please.", zh: "不带气的水，谢谢。", ok: true },
              { en: "I don't drink.", zh: "我不喝酒。", ok: false, why: "对方问饮品，不是问喝不喝酒；说 I'd like water, please" },
              { en: "Water is fine, thanks.", zh: "水就行，谢谢。", ok: true }
            ]
          },
          { who: "staff", en: "Is everything all right?", zh: "一切都还好吗？" },
          {
            who: "you",
            options: [
              { en: "Yes, everything is great. Could we have the bill?", zh: "很好。可以买单吗？", ok: true },
              { en: "Yes, I am all right.", zh: "是的，我还好。", ok: false, why: "对方问菜品，不是问你的身体" },
              { en: "No, I am not hungry.", zh: "不，我不饿。", ok: false, why: "已经在吃了，这句会让人困惑" }
            ]
          }
        ]
      }
    },

    /* ---------------- 5. 交通问路 ---------------- */
    {
      id: "transport",
      week: 4,
      icon: "🚇",
      title: "交通问路",
      titleEn: "Transport & directions",
      goal: "问路、买票、确认方向",
      patterns: [
        { en: "How do I get to ___?", zh: "去 ___ 怎么走？", tip: "get to = 到达，最实用问路句" },
        { en: "Is it far from here?", zh: "离这儿远吗？", tip: "far from = 离…远" },
        { en: "Which line should I take?", zh: "我该坐哪条线？", tip: "line = 地铁/公交线路" },
        { en: "Does this bus go to ___?", zh: "这趟公交到 ___ 吗？", tip: "does this bus go to… 直接问司机" },
        { en: "Could you show me on the map?", zh: "能在地图上指给我看吗？", tip: "show me on the map，比听描述更靠谱" },
        { en: "How much is the fare?", zh: "车费多少？", tip: "fare = 交通费，ticket price 也通用" }
      ],
      words: [
        { en: "subway", zh: "地铁", ex: "Take the subway to Central." },
        { en: "bus stop", zh: "公交站", ex: "The bus stop is across the street." },
        { en: "ticket machine", zh: "售票机", ex: "There is a ticket machine over there." },
        { en: "transfer", zh: "换乘", ex: "You need to transfer at the next station." },
        { en: "platform", zh: "站台", ex: "Platform 3, please." },
        { en: "one-way ticket", zh: "单程票", ex: "A one-way ticket to the airport." },
        { en: "round trip", zh: "往返", ex: "Is this a round trip ticket?" },
        { en: "taxi stand", zh: "出租车候车点", ex: "The taxi stand is outside." },
        { en: "fare", zh: "车费", ex: "How much is the fare?" },
        { en: "map", zh: "地图", ex: "Could you show me on the map?" },
        { en: "exit", zh: "出口", ex: "Take exit B." },
        { en: "entrance", zh: "入口", ex: "The entrance is on your right." },
        { en: "downtown", zh: "市中心", ex: "How far is downtown?" },
        { en: "walking distance", zh: "走路能到", ex: "Is it within walking distance?" },
        { en: "traffic light", zh: "红绿灯", ex: "Turn left at the traffic light." }
      ],
      shadow: [
        { en: "Excuse me, where are you going?", zh: "打扰一下，您要去哪里？" },
        { en: "Take the number 5 bus and get off at the third stop.", zh: "坐 5 路公交，第三站下车。" },
        { en: "It's about ten minutes on foot.", zh: "走路大概十分钟。" },
        { en: "Go straight and turn left at the traffic light.", zh: "一直走，红绿灯左转。" },
        { en: "You need to transfer at Central Station.", zh: "您需要在中央车站换乘。" },
        { en: "Have a safe trip.", zh: "一路平安。" }
      ],
      dialogue: {
        title: "问路 Asking for directions",
        turns: [
          { who: "staff", en: "Excuse me, can I help you?", zh: "打扰一下，需要帮忙吗？" },
          {
            who: "you",
            options: [
              { en: "Yes, how do I get to the Central Station?", zh: "是的，请问怎么去中央车站？", ok: true },
              { en: "Yes, I am lost in the city.", zh: "是的，我在城市里迷路了。", ok: false, why: "没提供目的地，对方没法指路" },
              { en: "No, I am fine.", zh: "不用，我很好。", ok: false, why: "你正需要帮忙，说 No 就错失机会了" }
            ]
          },
          { who: "staff", en: "Take the subway. It's three stops.", zh: "坐地铁，三站。" },
          {
            who: "you",
            options: [
              { en: "Which line should I take?", zh: "我该坐哪条线？", ok: true },
              { en: "Where is the ticket machine?", zh: "售票机在哪？", ok: true },
              { en: "Thank you. I will walk.", zh: "谢谢，我走着去。", ok: false, why: "对方刚说坐地铁，说走路会让人以为你没听懂" }
            ]
          },
          { who: "staff", en: "Line 2. The entrance is behind you.", zh: "2 号线，入口在你后面。" },
          {
            who: "you",
            options: [
              { en: "How much is the fare?", zh: "车费多少？", ok: true },
              { en: "Could you show me on the map?", zh: "能在地图上指一下吗？", ok: true },
              { en: "Is it far from here?", zh: "离这远吗？", ok: true }
            ]
          },
          { who: "staff", en: "About three dollars. It takes fifteen minutes.", zh: "大概三美元，十五分钟。" },
          {
            who: "you",
            options: [
              { en: "Thank you very much. Have a nice day.", zh: "非常感谢，祝你今天愉快。", ok: true },
              { en: "OK. Goodbye and thank you for your money.", zh: "好，再见，谢谢你的钱。", ok: false, why: "这句话语序和意思都乱，不要硬凑" },
              { en: "Thanks. One more thing, where can I buy a ticket?", zh: "谢谢。再问一下，哪里买票？", ok: true }
            ]
          }
        ]
      }
    },

    /* ---------------- 6. 购物退换 ---------------- */
    {
      id: "shopping",
      week: 4,
      icon: "🛍️",
      title: "购物退换",
      titleEn: "Shopping & returns",
      goal: "问价、试穿、退货换货",
      patterns: [
        { en: "How much is this?", zh: "这个多少钱？", tip: "this 指着你手里的东西说" },
        { en: "Do you have this in a larger size?", zh: "这个有大一号的吗？", tip: "in a larger size / in a smaller size" },
        { en: "Can I try it on?", zh: "我能试穿吗？", tip: "try on 是试穿，代词放中间：try it on" },
        { en: "I'd like to return this.", zh: "我想退这个。", tip: "return = 退货，exchange = 换货" },
        { en: "Could I have a receipt, please?", zh: "能给我小票吗？", tip: "receipt 的 p 不发音：/rɪˈsiːt/" },
        { en: "Is there a discount?", zh: "有折扣吗？", tip: "on sale = 打折中" }
      ],
      words: [
        { en: "size", zh: "尺码", ex: "What size do you wear?" },
        { en: "try on", zh: "试穿", ex: "Can I try this on?" },
        { en: "fitting room", zh: "试衣间", ex: "The fitting room is over there." },
        { en: "receipt", zh: "小票", ex: "Please keep your receipt." },
        { en: "refund", zh: "退款", ex: "Can I get a refund?" },
        { en: "exchange", zh: "换货", ex: "I'd like to exchange this." },
        { en: "cash", zh: "现金", ex: "Do you take cash?" },
        { en: "credit card", zh: "信用卡", ex: "Can I pay by credit card?" },
        { en: "discount", zh: "折扣", ex: "Is there a discount?" },
        { en: "on sale", zh: "促销中", ex: "These shoes are on sale." },
        { en: "cashier", zh: "收银台", ex: "Please pay at the cashier." },
        { en: "bag", zh: "袋子", ex: "Could I have a bag?" },
        { en: "warranty", zh: "保修", ex: "Does it have a warranty?" },
        { en: "return policy", zh: "退货政策", ex: "What is your return policy?" },
        { en: "change", zh: "零钱", ex: "Here is your change." }
      ],
      shadow: [
        { en: "Can I help you find something?", zh: "需要我帮您找什么吗？" },
        { en: "What size are you looking for?", zh: "您要什么尺码？" },
        { en: "The fitting room is on your left.", zh: "试衣间在您左边。" },
        { en: "It looks good on you.", zh: "您穿这个很好看。" },
        { en: "Would you like to pay by cash or card?", zh: "您付现金还是刷卡？" },
        { en: "Here is your receipt and change.", zh: "这是您的小票和零钱。" }
      ],
      dialogue: {
        title: "试穿与退货 Trying on & returning",
        turns: [
          { who: "staff", en: "Can I help you find something?", zh: "需要帮您找什么吗？" },
          {
            who: "you",
            options: [
              { en: "Yes, do you have this in a larger size?", zh: "有，这个有大一号的吗？", ok: true },
              { en: "Yes, I am just looking.", zh: "有，我只是看看。", ok: false, why: "just looking 表示不用帮忙，和 Yes 矛盾" },
              { en: "No, I want to buy everything.", zh: "不，我想买所有东西。", ok: false, why: "夸张且不自然，对方会不知道怎么接" }
            ]
          },
          { who: "staff", en: "Sure, here is a larger one. The fitting room is over there.", zh: "好的，这是大一号的。试衣间在那边。" },
          {
            who: "you",
            options: [
              { en: "Thank you. Can I try it on?", zh: "谢谢，我能试穿吗？", ok: true },
              { en: "Thank you. Can I try on it?", zh: "谢谢，我能试穿它吗？", ok: false, why: "语序错，应说 try it on（代词放中间）" },
              { en: "Thank you. Where is the cashier?", zh: "谢谢，收银台在哪？", ok: true }
            ]
          },
          { who: "staff", en: "How was it?", zh: "怎么样？" },
          {
            who: "you",
            options: [
              { en: "It's a little too small. Could I try a bigger size?", zh: "有点小，能试大一号吗？", ok: true },
              { en: "It is small.", zh: "它小。", ok: false, why: "意思对但太生硬，加上 a little too small 更自然" },
              { en: "It's perfect. I'll take it.", zh: "很合适，我买了。", ok: true }
            ]
          },
          { who: "staff", en: "Great. Would you like to pay by cash or card?", zh: "好的，您付现金还是刷卡？" },
          {
            who: "you",
            options: [
              { en: "By card, please. Could I have a receipt?", zh: "刷卡。能给我小票吗？", ok: true },
              { en: "Cash, please. Is there a discount?", zh: "现金。有折扣吗？", ok: true },
              { en: "Yes, please. Thank you, money.", zh: "好的，谢谢，钱。", ok: false, why: "没有回答支付方式，最后两个词也不成句" }
            ]
          }
        ]
      }
    }
  ]
};
