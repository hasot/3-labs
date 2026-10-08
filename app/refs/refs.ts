export type RefText = {
  meta: string[];
  description: string;
  /** What to take from it for our pages */
  takeaway: string;
};

export type Ref = RefText & {
  id: string;
  name: string;
  url: string;
  /** Screenshot in public/refs/<id>.webp */
  image: string;
  en: RefText;
};

export type RefGroup = {
  id: string;
  title: string;
  note: string;
  en: { title: string; note: string };
  refs: Ref[];
};

export const REF_GROUPS: RefGroup[] = [
  {
    id: "archives",
    title: "Странный дизайн странных стран",
    note: "Архивы вернакулярной графики — то, что дома считали мусором. Подборка из поста @iiiulllaiii.",
    en: {
      title: "Strange design from strange countries",
      note: "Archives of vernacular graphics — the stuff people at home called trash. Picked from a post by @iiiulllaiii.",
    },
    refs: [
      {
        id: "eaga",
        name: "East Asian Graphics Archive",
        url: "https://eastasiangraphicsarchive.com",
        image: "eaga",
        meta: ["Азия: от Токио до Пхеньяна", "1930-е — сегодня", "постеры, упаковка, айдентика"],
        description:
          "Графика Китая, Японии, обеих Корей, Тайваня, Вьетнама и Таиланда. Есть упаковка из Северной Кореи: обёртки конфет, спички, сахарные пакетики из 90-х — например, пакетик соли Air Koryo около 1990 года. Работы фильтруются по языку: китайский, японский, корейский, тайский, вьетнамский.",
        takeaway:
          "Иероглифы, хангыль и латиница в одной сетке; кислотные цвета ризографа; карточка экспоната «название · автор · год · город» как шаблон для своих коллекций.",
        en: {
          meta: ["Asia: Tokyo to Pyongyang", "1930s — today", "posters, packaging, identity"],
          description:
            "Graphics from China, Japan, both Koreas, Taiwan, Vietnam and Thailand. There's North Korean packaging too: candy wrappers, matchboxes, sugar sachets from the '90s — like an Air Koryo salt packet from around 1990. Works can be filtered by script: Chinese, Japanese, Korean, Thai, Vietnamese.",
          takeaway:
            "Hanzi, hangul and Latin in one grid; acid riso colours; the exhibit card “title · author · year · city” as a template for your own collections.",
        },
      },
      {
        id: "grafis",
        name: "Grafis Nusantara",
        url: "https://grafisnusantara.com",
        image: "grafis",
        meta: ["Индонезия", "с 70-х", "≈300 наклеек и этикеток"],
        description:
          "Наклейки и этикетки с индонезийских рынков: чай, табак, ткани, лекарства, мультяшные и религиозные стикеры. Дома их считали мусором, пока дизайнер Rakhmat Jaka Perkasa не начал архив. Пополняется сообща, а не силами музея.",
        takeaway:
          "Рукописные надписи и наивная иллюстрация. Главная — огромная антиква с фигурками лучников на чёрном: архив, который выглядит как афиша.",
        en: {
          meta: ["Indonesia", "since the '70s", "≈300 stickers and labels"],
          description:
            "Stickers and labels from Indonesian markets: tea, tobacco, textiles, medicine, cartoon and religious stickers. People at home saw them as trash until designer Rakhmat Jaka Perkasa started the archive. It grows through social curation, not a museum.",
          takeaway:
            "Hand-lettering and naive illustration. The home page — a huge serif with archer figures on black — is an archive that looks like a poster.",
        },
      },
      {
        id: "casca",
        name: "CASCA Archive",
        url: "https://casca-archive.org",
        image: "casca",
        meta: ["северо-восток Бразилии", "1950-е — сегодня", "8 000+ единиц"],
        description:
          "Кордель — народные брошюры с обложками-гравюрами, — а ещё ксилографии, вывески, плакаты, обложки книг и пластинок, упаковка. Основатель — Victor Yves. Их слоган: дизайн — это не только Баухаус. При архиве есть блог с эссе «Textures & Memory».",
        takeaway:
          "Ксилография и грубая печать как текстура; горизонтальная лента статей над плотной мозаикой обложек разной высоты.",
        en: {
          meta: ["Northeast Brazil", "1950s — today", "8,000+ items"],
          description:
            "Cordel — folk chapbooks with woodcut covers — plus woodcuts, signs, posters, book and record covers, packaging. Founded by Victor Yves. Their motto: design is more than Bauhaus. The archive runs an essay blog, “Textures & Memory”.",
          takeaway:
            "Woodcut and rough print as texture; a horizontal strip of essays above a dense mosaic of covers of different heights.",
        },
      },
    ],
  },
  {
    id: "galleries",
    title: "Галереи и инструменты",
    note: "Куда идти за референсом, когда собираешь новую страницу в лабе.",
    en: {
      title: "Galleries and tools",
      note: "Where to go for a reference when building a new page in the lab.",
    },
    refs: [
      {
        id: "recent",
        name: "Recent",
        url: "https://recent.design",
        image: "recent",
        meta: ["галерея", "бывший Godly", "обновляется каждый день"],
        description:
          "Ежедневная подборка веба, айдентики, моушена, 3D, типографики и полиграфии. Фильтры по дисциплинам, отдельно — скриншоты приложений и OG-картинки.",
        takeaway: "Первая остановка, когда нужно поймать свежий визуальный тон.",
        en: {
          meta: ["gallery", "formerly Godly", "updated daily"],
          description:
            "A daily pick of web, identity, motion, 3D, type and print. Filters by discipline, plus app screenshots and OG images.",
          takeaway: "First stop when you need to catch a fresh visual tone.",
        },
      },
      {
        id: "supahero",
        name: "Supahero",
        url: "https://www.supahero.io",
        image: "supahero",
        meta: ["первые экраны", "теперь часть screensdesign"],
        description:
          "Библиотека hero-блоков: сотни первых экранов сайтов, студий и портфолио, только верх страницы и ничего лишнего.",
        takeaway:
          "Смотреть перед каждым новым экспериментом-лендингом, как Tiger, Light Beam или Shave: что держит взгляд в первые три секунды.",
        en: {
          meta: ["hero sections", "now part of screensdesign"],
          description:
            "A library of hero sections: hundreds of first screens from sites, studios and portfolios — just the top of the page, nothing else.",
          takeaway:
            "Check it before every new landing experiment like Tiger, Light Beam or Shave: what holds the eye in the first three seconds.",
        },
      },
      {
        id: "pafolios",
        name: "Pafolios",
        url: "https://www.pafolios.com",
        image: "pafolios",
        meta: ["портфолио", "800+ сайтов", "фильтр по роли"],
        description:
          "Портфолио и кейсы: продуктовые дизайнеры, разработчики, дизайн-инженеры, бренд-дизайнеры, студии. Есть отметки Staff Pick.",
        takeaway: "Для личного лендинга: как коротко сказать, кто ты, и выложить кейсы.",
        en: {
          meta: ["portfolios", "800+ sites", "filter by role"],
          description:
            "Portfolios and case studies: product designers, developers, design engineers, brand designers, studios. Staff Picks are marked.",
          takeaway: "For a personal landing: how to say who you are in one line and lay out the cases.",
        },
      },
      {
        id: "searchsystem",
        name: "SearchSystem™",
        url: "https://searchsystem.co",
        image: "searchsystem",
        meta: ["референсы", "куратор Julien Van Havere"],
        description:
          "Растущая коллекция референсов и инструментов для дизайнеров: архив, индекс, случайный проект. Подписи набраны капсом моноширинным шрифтом.",
        takeaway: "Швейцарская строгость и подпись-реестр «студия / клиент / тип / год» под каждой работой.",
        en: {
          meta: ["references", "curated by Julien Van Havere"],
          description:
            "A growing collection of references and tools for designers: archive, index, random project. Captions are set in monospaced caps.",
          takeaway: "Swiss rigour and a register-style caption “studio / client / type / year” under every work.",
        },
      },
      {
        id: "refero",
        name: "Refero Styles",
        url: "https://styles.refero.design",
        image: "refero",
        meta: ["DESIGN.md", "2 000+ дизайн-систем"],
        description:
          "Дизайн-системы реальных продуктов — Apple, Notion, Figma, OpenAI — разобраны на цвета, шрифты, отступы и компоненты и упакованы в DESIGN.md для ИИ-агентов.",
        takeaway: "Скормить DESIGN.md в Claude Code, чтобы страница вышла «как у Linear», а не «как у нейросети».",
        en: {
          meta: ["DESIGN.md", "2,000+ design systems"],
          description:
            "Design systems of real products — Apple, Notion, Figma, OpenAI — broken down into colours, type, spacing and components and packaged as DESIGN.md for AI agents.",
          takeaway: "Feed a DESIGN.md to Claude Code so the page comes out “like Linear”, not “like an AI”.",
        },
      },
      {
        id: "framer",
        name: "Framer Marketplace",
        url: "https://www.framer.com/marketplace/components/",
        image: "framer",
        meta: ["компоненты", "бесплатные и платные"],
        description: "Компоненты сообщества: текстовые эффекты, карусели, курсоры, фоны, кнопки, лоадеры.",
        takeaway: "Подсмотреть микровзаимодействие и повторить его в коде, без Framer.",
        en: {
          meta: ["components", "free and paid"],
          description: "Community components: text effects, carousels, cursors, backgrounds, buttons, loaders.",
          takeaway: "Spot a micro-interaction and rebuild it in code, without Framer.",
        },
      },
      {
        id: "faustina",
        name: "Faustina",
        url: "https://fonts.google.com/specimen/Faustina",
        image: "faustina",
        meta: ["шрифт", "Omnibus-Type", "SIL OFL"],
        description:
          "Антиква с шотландскими корнями для книг, газет и журналов. Вариативная, бесплатная для любых проектов.",
        takeaway: "Уже подключена в лабе как font-display — бери для заголовков с книжным характером.",
        en: {
          meta: ["typeface", "Omnibus-Type", "SIL OFL"],
          description: "A serif with Scotch roots for books, newspapers and magazines. Variable and free for any project.",
          takeaway: "Already loaded in the lab as font-display — use it for headings with a bookish feel.",
        },
      },
    ],
  },
];
