/** Pastel tones for wireframe blocks, as in the reel */
export const TONES = {
  pink: "#f8c9c6",
  blue: "#c8d7fb",
  lilac: "#efc9f4",
  green: "#cfeccf",
  yellow: "#f8f0c2",
  cyan: "#c8f0f3",
  cream: "#f6ecd8",
  lavender: "#e4dcfb",
  grey: "#e6e3df",
  ink: "#141210",
  red: "#d6362b",
} as const;

export type Tone = keyof typeof TONES;

/** Wireframe primitives in a 160×100 viewBox */
export type Shape =
  | { rect: [number, number, number, number]; fill: Tone; label?: string; size?: number; r?: number }
  | { path: string; fill?: Tone; stroke?: Tone; width?: number; dash?: boolean; label?: string; at?: [number, number]; size?: number }
  | { text: string; at: [number, number]; size?: number; fill?: Tone; start?: boolean };

export type CompositionText = { name: string; how: string; when: string; example?: string };

export type Composition = {
  id: string;
  en: CompositionText;
  name: string;
  /** The pattern's usual English name */
  term: string;
  wire: Shape[];
  how: string;
  when: string;
  /** Where to see it in this lab */
  example?: { label: string; url: string };
  /** Live examples; screenshots in public/refs/compositions/sites/<image>.webp */
  sites?: Site[];
};

/** A live example; reel frames have no public url */
export type Site = { name: string; url?: string; image: string; note: string; noteEn: string };

const NAV: Shape[] = [
  { rect: [4, 2.5, 14, 4], fill: "grey", label: "Лого", size: 2.6 },
  { rect: [58, 2.5, 44, 4], fill: "grey", label: "Меню", size: 2.6 },
  { rect: [140, 2.5, 16, 4], fill: "pink", label: "CTA", size: 2.6 },
];

export const COMPOSITIONS: Composition[] = [
  {
    id: "steps",
    en: { name: "Steps", how: "Background shapes step down from the edges toward the centre and form a valley. Title, subtitle and button sit in its neck — the eye rolls down the steps straight to the CTA.", when: "Dark tech products: the steps easily turn into a chart, an equaliser or light bars." },
    name: "Ступени",
    term: "Stepped valley",
    wire: [
      { rect: [0, 8, 160, 92], fill: "lilac" },
      { path: "M0 8 H160 V40 H140 V52 H120 V64 H100 V76 H60 V64 H40 V52 H20 V40 H0 Z", fill: "blue" },
      { rect: [0, 0, 160, 8], fill: "pink", label: "Навигация" },
      { text: "Заголовок", at: [80, 24], size: 6 },
      { text: "Подзаголовок", at: [80, 31], size: 3.4 },
      { rect: [70, 38, 20, 6], fill: "green", label: "CTA" },
      { text: "Фон", at: [12, 82] },
      { text: "Фон", at: [148, 82] },
    ],
    how: "Фоновые формы спускаются от краёв к центру лесенкой и образуют долину. Заголовок, подзаголовок и кнопка стоят в её горловине, взгляд скатывается по ступеням прямо к CTA.",
    when: "Тёмные технологичные продукты: ступени легко превратить в график, эквалайзер или световые полосы.",
    sites: [
      { name: "Built for real-time decisions", image: "reel-steps", note: "Тёмный SaaS: ступени собраны из световых линий, кнопка — в горловине.", noteEn: "Dark SaaS: the steps are built from light lines, the button sits in the neck." },
    ],
  },
  {
    id: "triptych",
    en: { name: "Three columns", how: "A narrow left column with title, video and copy, a wide centre for the hero object, the right one with an article card, caption and button. The centre object can break out of its column and overlap the text.", when: "A tech product or research: lots of facts, but one hero object." },
    name: "Три колонки",
    term: "Bento triptych",
    wire: [
      { rect: [0, 0, 160, 8], fill: "pink", label: "Навигация" },
      { rect: [4, 12, 40, 38], fill: "blue", label: "Заголовок" },
      { rect: [4, 54, 34, 18], fill: "lilac", label: "Медиа" },
      { rect: [4, 76, 34, 20], fill: "yellow", label: "Текст" },
      { rect: [48, 12, 60, 84], fill: "lilac", label: "Изображение" },
      { rect: [112, 12, 44, 28], fill: "green", label: "Карточка" },
      { rect: [112, 44, 44, 36], fill: "cyan", label: "Текст" },
      { rect: [112, 84, 44, 12], fill: "pink", label: "CTA" },
    ],
    how: "Узкая левая колонка с заголовком, видео и описанием, широкий центр под главный объект, правая — карточка статьи, подпись и кнопка. Объект в центре может вылезать за свою колонку и перекрывать текст.",
    when: "Технологичный продукт или исследование: много фактов, но один герой-объект.",
    sites: [
      { name: "MOXLAB", image: "reel-triptych", note: "Future arm prosthetics with AI: протез в центре перекрывает колонку заголовка.", noteEn: "Future arm prosthetics with AI: the prosthesis in the centre overlaps the title column." },
    ],
  },
  {
    id: "product",
    en: { name: "Product centre stage", how: "One object on stage in close-up. Around it, the utility bits: slider dots on the left, a material preview at the bottom, name, price and buy button in the bottom-right corner.", when: "A single product page, pre-order, drop. Needs a striking 3D render or a cut-out photo." },
    name: "Товар в центре",
    term: "Product stage",
    wire: [
      { rect: [4, 2, 20, 5], fill: "blue", label: "Лого", size: 2.8 },
      { rect: [50, 2, 60, 5], fill: "green", label: "Навигация", size: 2.8 },
      { rect: [120, 2, 12, 5], fill: "yellow", label: "Иконка", size: 2.4 },
      { rect: [136, 2, 20, 5], fill: "pink", label: "CTA", size: 2.8 },
      { rect: [6, 30, 4, 30], fill: "blue", r: 2 },
      { text: "Слайдер", at: [4, 26], size: 2.6, start: true },
      { rect: [52, 12, 46, 84], fill: "lilac", label: "Фото товара" },
      { rect: [14, 64, 34, 32], fill: "green", label: "Медиа" },
      { rect: [104, 48, 20, 7], fill: "pink", label: "Бейдж", r: 3.5, size: 3 },
      { rect: [104, 60, 52, 10], fill: "blue", label: "Название" },
      { rect: [104, 76, 16, 20], fill: "yellow", label: "Цена", size: 3 },
      { rect: [124, 76, 32, 20], fill: "pink", label: "CTA" },
    ],
    how: "Один предмет на сцене крупным планом. Вокруг — служебное: точки слайдера слева, превью материала снизу, название, цена и кнопка покупки в правом нижнем углу.",
    when: "Карточка одного товара, предзаказ, дроп. Нужен эффектный 3D-рендер или фото без фона.",
    sites: [
      { name: "adidas Yeezy Boost 350", image: "reel-product", note: "Кроссовок в лепестках на сцене, цена и предзаказ в правом нижнем углу.", noteEn: "A sneaker among petals on stage, price and pre-order in the bottom-right corner." },
    ],
  },
  {
    id: "cutouts",
    en: { name: "Organic cutouts", how: "The screen is cut into rounded pieces with angled seams, like a puzzle. The text block sits in a corner, two photos wrap around it, and the product squeezes into its own wedge in the bottom corner.", when: "Lifestyle products: show the object and how it's used on one screen." },
    name: "Органические вырезы",
    term: "Cutout shapes",
    wire: [
      { rect: [4, 2, 16, 5], fill: "lilac", label: "Лого", size: 2.8 },
      { rect: [96, 2, 44, 5], fill: "blue", label: "Навигация", size: 2.8 },
      { rect: [143, 2, 13, 5], fill: "pink", label: "CTA", size: 2.8 },
      { rect: [4, 12, 70, 38], fill: "cream", r: 4 },
      { text: "Заголовок", at: [8, 22], size: 6, start: true },
      { rect: [8, 28, 14, 18], fill: "lilac", label: "Превью", size: 2.6, r: 2 },
      { rect: [26, 28, 44, 7], fill: "green", label: "Текст", r: 2 },
      { rect: [26, 39, 20, 6], fill: "pink", label: "Кнопка", size: 2.8, r: 3 },
      { rect: [50, 39, 20, 6], fill: "blue", label: "Кнопка", size: 2.8, r: 3 },
      {
        path: "M84 12 H150 Q156 12 156 18 V54 Q156 60 150 60 H140 Q134 60 130 56 L124 50 Q120 46 114 46 H82 Q78 46 78 40 V18 Q78 12 84 12 Z",
        fill: "blue",
        label: "Изображение",
        at: [117, 30],
      },
      {
        path: "M10 54 H110 Q116 54 120 58 L132 72 Q134 76 132 80 L124 92 Q122 96 116 96 H10 Q4 96 4 90 V60 Q4 54 10 54 Z",
        fill: "green",
        label: "Изображение",
        at: [62, 76],
      },
      {
        path: "M150 64 Q156 64 156 70 V90 Q156 96 150 96 H134 Q128 96 131 91 L144 68 Q146 64 150 64 Z",
        fill: "pink",
        label: "Товар",
        at: [146, 86],
      },
    ],
    how: "Экран разрезан на скруглённые куски со скошенными стыками, как пазл. Текстовый блок в углу, два фото обтекают его, а товар влезает в отдельный клин в нижнем углу.",
    when: "Лайфстайл-товар: показать предмет и сценарий его использования на одном экране.",
    sites: [
      { name: "Wacaco Minipresso GR2", url: "https://www.wacaco.com", image: "reel-cutouts", note: "Фото-вырезы обнимают текстовый блок, кофеварка — в отдельном клине.", noteEn: "Photo cutouts wrap the text block, the coffee maker sits in its own wedge." },
    ],
  },
  {
    id: "arc",
    en: { name: "Arc over the title", how: "A huge semicircle — a glowing arc, a ring, a planet's horizon — embraces a centred title. A classic centred stack, but with an object that holds the composition together.", when: "A minimal brand or app with a strong name-logo. The arc is easy to animate with a glow." },
    name: "Дуга над заголовком",
    term: "Arc halo",
    wire: [
      { path: "M12 9 A68 56 0 0 0 148 9", stroke: "blue", width: 14 },
      { rect: [4, 2, 16, 5], fill: "lavender", label: "Лого", size: 2.8 },
      { rect: [56, 2, 48, 5], fill: "lavender", label: "Навигация", size: 2.8 },
      { rect: [140, 2, 16, 5], fill: "lavender", label: "Иконка", size: 2.8 },
      { text: "Фоновая форма", at: [140, 36], size: 2.6 },
      { rect: [50, 42, 60, 18], fill: "lavender", label: "Заголовок", size: 7 },
      { rect: [52, 63, 56, 5], fill: "grey", label: "Текст", size: 2.8 },
      { rect: [60, 71, 18, 6], fill: "blue", label: "CTA", size: 2.8 },
      { rect: [82, 71, 18, 6], fill: "pink", label: "CTA", size: 2.8 },
      { text: "Текст", at: [80, 90], size: 2.8 },
    ],
    how: "Огромная полукруглая форма — светящаяся дуга, кольцо, горизонт планеты — обнимает центрированный заголовок. Классический центрированный стек, но с объектом, который держит композицию.",
    when: "Лаконичный бренд или приложение, где есть сильное имя-логотип. Дугу легко анимировать свечением.",
    sites: [
      { name: "ZYNO", image: "reel-arc", note: "Светящаяся дуга над словом-логотипом, две кнопки по центру.", noteEn: "A glowing arc above the wordmark, two centred buttons." },
    ],
  },
  {
    id: "centered",
    en: { name: "Centred stack", how: "One centred column: eyebrow, title, subtitle, two buttons, a row of logos.", when: "A simple offer explained in one sentence. The safest and most common option — which is why it's boring." },
    name: "Центрированный стек",
    term: "Centered stack",
    wire: [
      ...NAV,
      { rect: [64, 16, 32, 4], fill: "yellow", label: "Надзаголовок", size: 2.4 },
      { rect: [28, 23, 104, 16], fill: "blue", label: "Заголовок", size: 6 },
      { rect: [44, 43, 72, 5], fill: "grey", label: "Подзаголовок", size: 2.8 },
      { rect: [58, 53, 20, 6], fill: "pink", label: "CTA", size: 2.8 },
      { rect: [82, 53, 20, 6], fill: "blue", label: "Второй", size: 2.8 },
      ...[0, 1, 2, 3, 4, 5].map((i): Shape => ({ rect: [23 + i * 20, 80, 14, 5], fill: "grey" })),
      { text: "Логотипы клиентов", at: [80, 93], size: 2.6 },
    ],
    how: "Одна колонка по центру: надзаголовок, заголовок, подзаголовок, две кнопки, ряд логотипов.",
    when: "Простое предложение, которое объясняется одной фразой. Самый безопасный и самый частый вариант — поэтому скучный.",
    sites: [
      { name: "Notion", url: "https://www.notion.com", image: "notion", note: "Заголовок, две кнопки, скриншот и ряд логотипов — всё по центральной оси.", noteEn: "Title, two buttons, a screenshot and a logo row — all on the central axis." },
      { name: "Raycast", url: "https://www.raycast.com", image: "raycast", note: "Центр на тёмном фоне, за заголовком — красные световые полосы, кнопка скачивания внизу.", noteEn: "Centred on dark, red light streaks behind the title, the download button below." },
    ],
  },
  {
    id: "split",
    en: { name: "Split 60/40", how: "Two unequal columns: copy on one side, image or animation on the other. A 60/40 or 70/30 asymmetry reads as editorial rather than templated.", when: "The product needs both explaining and showing. One strong image and one strong line." },
    name: "Сплит 60/40",
    term: "Split diptych",
    wire: [
      ...NAV,
      { rect: [6, 22, 84, 22], fill: "blue", label: "Заголовок", size: 6 },
      { rect: [6, 48, 70, 8], fill: "grey", label: "Текст" },
      { rect: [6, 62, 22, 7], fill: "pink", label: "CTA" },
      { rect: [98, 10, 58, 90], fill: "lilac", label: "Визуал" },
    ],
    how: "Две неравные колонки: текст с одной стороны, картинка или анимация с другой. Асимметрия 60/40 или 70/30 читается как журнальная, а не шаблонная.",
    when: "Продукт нужно и объяснить, и показать. Одна сильная картинка и одна сильная фраза.",
    sites: [
      { name: "Stripe", url: "https://stripe.com", image: "stripe", note: "Текст слева, справа переливается лента-градиент. Над заголовком — живой счётчик доли мирового ВВП.", noteEn: "Copy on the left, a shimmering gradient ribbon on the right. Above the title, a live counter of the share of global GDP." },
      { name: "Basecamp", url: "https://basecamp.com", image: "basecamp", note: "Зеркальный сплит: скриншот продукта слева, заголовок и список ссылок справа.", noteEn: "Mirrored split: product screenshot on the left, title and a list of links on the right." },
      { name: "The Side Studio", url: "https://www.theside.studio", image: "side", note: "Заголовок и кнопки слева, ноутбук с кейсом справа, внизу строка цифр.", noteEn: "Title and buttons on the left, a laptop with a case study on the right, a row of numbers below." },
    ],
  },
  {
    id: "mockup",
    en: { name: "Product screenshot", how: "A short title on top, below it a screenshot of the interface, cropped by the screen edge and continuing below the fold.", when: "When the interface sells better than words: SaaS, developer tools." },
    name: "Скриншот продукта",
    term: "Product showcase",
    wire: [
      ...NAV,
      { rect: [34, 13, 92, 12], fill: "blue", label: "Заголовок", size: 5 },
      { rect: [50, 28, 60, 4], fill: "grey", label: "Подзаголовок", size: 2.4 },
      { rect: [70, 35, 20, 6], fill: "pink", label: "CTA", size: 2.8 },
      { rect: [18, 48, 124, 56], fill: "cyan", label: "Интерфейс продукта", r: 3 },
      { rect: [18, 48, 124, 5], fill: "grey" },
    ],
    how: "Короткий заголовок сверху, под ним — обрезанный краем экрана скриншот интерфейса, который продолжается ниже сгиба.",
    when: "Когда сам интерфейс продаёт лучше любых слов: SaaS, инструменты разработчика.",
    sites: [
      { name: "Linear", url: "https://linear.app", image: "linear", note: "Заголовок прижат влево, под ним во всю ширину — интерфейс трекера.", noteEn: "Title pushed left, the tracker interface full-width below it." },
      { name: "Cursor", url: "https://cursor.com", image: "cursor", note: "Короткий заголовок, под ним окно редактора с агентом на фоне пейзажа.", noteEn: "A short title, below it an editor window with an agent over a landscape." },
      { name: "Attio", url: "https://attio.com", image: "attio", note: "Заголовок по центру, окно CRM уходит за нижний край экрана.", noteEn: "Centred title, the CRM window runs off the bottom edge." },
    ],
  },
  {
    id: "marquee",
    en: { name: "Oversized type", how: "No images: a full-width headline, small copy and a link instead of a button. The typeface is the visual.", when: "Manifesto, brand, portfolio, launch. Loads instantly but needs strong copy and a good typeface." },
    name: "Огромная типографика",
    term: "Typographic marquee",
    wire: [
      ...NAV,
      { rect: [4, 13, 152, 30], fill: "blue", label: "ОГРОМНЫЙ", size: 11 },
      { rect: [4, 46, 118, 30], fill: "blue", label: "ЗАГОЛОВОК", size: 11 },
      { rect: [4, 86, 44, 5], fill: "grey", label: "Текст", size: 2.8 },
      { rect: [128, 86, 28, 5], fill: "pink", label: "Ссылка", size: 2.8 },
    ],
    how: "Никаких картинок: заголовок на всю ширину экрана, мелкий текст и ссылка вместо кнопки. Шрифт и есть визуал.",
    when: "Манифест, бренд, портфолио, запуск. Грузится мгновенно, но требует сильного текста и хорошего шрифта.",
    sites: [
      { name: "Wise", url: "https://wise.com", image: "wise", note: "Капс на полэкрана: «The international account that saves you money».", noteEn: "Caps across half the screen: “The international account that saves you money”." },
      { name: "Colroy", url: "https://www.colroy.ch", image: "colroy", note: "Сайт шрифта: огромные плашки с буквами и есть весь дизайн.", noteEn: "A typeface site: huge letter blocks are the whole design." },
      { name: "Dash", url: "https://thisisdash.com", image: "dash", note: "«Almost the best tech company» — гротеск на весь экран, одно слово выделено плашкой.", noteEn: "“Almost the best tech company” — a full-screen grotesque, one word highlighted." },
    ],
  },
  {
    id: "fullbleed",
    en: { name: "Full-bleed photo", how: "The whole first screen goes to an image or video; the text is pushed into a corner and doesn't fight the picture.", when: "Mood over explanation: travel, hotels, photographers, film, personal landings.", example: "Light Beam and Mask Reveal" },
    name: "Фото на весь экран",
    term: "Photographic fold",
    wire: [
      { rect: [0, 0, 160, 100], fill: "lilac" },
      { text: "Фото или видео до краёв", at: [80, 40], size: 4 },
      ...NAV,
      { rect: [8, 68, 66, 18], fill: "cream", label: "Заголовок", size: 5 },
      { rect: [116, 84, 38, 6], fill: "grey", label: "Подпись", size: 2.8 },
    ],
    how: "Первый экран целиком отдан изображению или видео, текст прижат в угол и не спорит с картинкой.",
    when: "Настроение важнее объяснений: путешествия, отели, фотографы, кино, личные лендинги.",
    example: { label: "Light Beam и Mask Reveal", url: "/examples/light-beam" },
    sites: [
      { name: "Aman", url: "https://www.aman.com", image: "aman", note: "Горы во весь экран, поверх — только тонкий логотип и кнопка бронирования.", noteEn: "Mountains edge to edge, only a thin logo and a booking button on top." },
      { name: "RRE Ventures", url: "https://www.rre.com", image: "rre", note: "Живописная абстракция до краёв, заголовок прижат в левый нижний угол.", noteEn: "A painterly abstraction to the edges, the title pinned to the bottom-left corner." },
      { name: "Mercury", url: "https://mercury.com", image: "mercury", note: "Сцена со столом над облаками, заголовок и поле почты наверху.", noteEn: "A desk above the clouds, title and email field at the top." },
    ],
  },
  {
    id: "bento",
    en: { name: "Bento grid", how: "Tiles of different sizes packed tight like compartments of a bento box. One tile leads; the rest are features, numbers, testimonials, demos.", when: "Lots of equally important features to show at once, without a long feed." },
    name: "Бенто-сетка",
    term: "Bento grid",
    wire: [
      ...NAV,
      { rect: [4, 12, 78, 50], fill: "blue", label: "Главная плитка", r: 3 },
      { rect: [86, 12, 70, 24], fill: "green", label: "Фича", r: 3 },
      { rect: [86, 40, 33, 22], fill: "yellow", label: "Цифра", r: 3 },
      { rect: [123, 40, 33, 22], fill: "cyan", label: "Отзыв", r: 3 },
      { rect: [4, 66, 40, 30], fill: "lilac", label: "Медиа", r: 3 },
      { rect: [48, 66, 70, 30], fill: "pink", label: "Демо", r: 3 },
      { rect: [122, 66, 34, 30], fill: "cream", label: "Логотипы", r: 3 },
    ],
    how: "Плитки разного размера, плотно уложенные, как отсеки в коробке бенто. Одна плитка главная, остальные — фичи, цифры, отзывы, демо.",
    when: "Много равноценных фич, которые надо показать сразу, без длинной ленты.",
    sites: [
      { name: "Supabase", url: "https://supabase.com", image: "supabase-bento", note: "Сразу под первым экраном — плитки продуктов разного размера: база, авторизация, функции, хранилище.", noteEn: "Right below the hero: product tiles of different sizes — database, auth, functions, storage." },
      { name: "Raycast", url: "https://www.raycast.com", image: "raycast-bento", note: "Тёмная сетка плиток с фичами: сниппеты, быстрые ссылки, горячие клавиши.", noteEn: "A dark grid of feature tiles: snippets, quicklinks, hotkeys." },
    ],
  },
  {
    id: "magazine",
    en: { name: "Magazine cover", how: "Several stories on one screen; importance is set by block size and position, like a newspaper front page.", when: "Media, blogs, archives, studios with lots of projects. The reader picks where to go." },
    name: "Журнальная обложка",
    term: "Editorial / magazine",
    wire: [
      ...NAV,
      { rect: [4, 12, 92, 56], fill: "lilac", label: "Главная история" },
      { rect: [4, 72, 92, 10], fill: "blue", label: "Заголовок" },
      { rect: [4, 86, 80, 4], fill: "grey" },
      { rect: [100, 12, 56, 22], fill: "cream", label: "Материал" },
      { rect: [100, 38, 56, 22], fill: "green", label: "Материал" },
      { rect: [100, 64, 56, 14], fill: "yellow", label: "Материал" },
      { rect: [100, 82, 56, 3], fill: "grey" },
      { rect: [100, 88, 40, 3], fill: "grey" },
    ],
    how: "Несколько историй на одном экране, важность задаётся размером и положением блока, как на первой полосе газеты.",
    when: "Медиа, блоги, архивы, студии с кучей проектов. Читатель сам выбирает, куда зайти.",
    sites: [
      { name: "The Verge", url: "https://www.theverge.com", image: "verge", note: "Вертикальный логотип, главная история с фото, лента новостей справа.", noteEn: "Vertical logo, the lead story with a photo, the news feed on the right." },
      { name: "It's Nice That", url: "https://www.itsnicethat.com", image: "itsnicethat", note: "Шапка-мастхед, строка свежих материалов и большая обложка дня.", noteEn: "Masthead, a strip of fresh stories and a big cover of the day." },
    ],
  },
  {
    id: "z",
    en: { name: "Z-pattern", how: "The eye goes left to right along the top, diagonally down-left, then right again. Logo, menu, copy and button sit at the corners of this Z.", when: "Short single-goal landings with little content." },
    name: "Z-паттерн",
    term: "Z-pattern",
    wire: [
      { path: "M18 8.5 H136 L30 89 H128", stroke: "red", width: 1, dash: true },
      { rect: [4, 4, 22, 9], fill: "grey", label: "Лого" },
      { rect: [128, 4, 28, 9], fill: "pink", label: "Меню, CTA", size: 3 },
      { rect: [44, 30, 72, 36], fill: "lilac", label: "Визуал" },
      { rect: [4, 82, 46, 14], fill: "cream", label: "Текст" },
      { rect: [118, 82, 38, 14], fill: "pink", label: "CTA" },
    ],
    how: "Взгляд идёт слева направо по верху, по диагонали вниз влево и снова вправо. По углам этой «Z» расставлены лого, меню, текст и кнопка.",
    when: "Короткие лендинги с одной целью, где немного контента.",
    sites: [
      { name: "Dropbox", url: "https://www.dropbox.com", image: "dropbox", note: "Лого и меню сверху, текст с кнопкой слева, интерфейс справа — взгляд идёт зигзагом.", noteEn: "Logo and menu on top, copy with a button on the left, the interface on the right — the eye zigzags." },
      { name: "Ramp", url: "https://ramp.com", image: "ramp", note: "Лого слева, кнопки справа, заголовок и поле почты слева, ниже — продукт.", noteEn: "Logo left, buttons right, title and email field on the left, product below." },
    ],
  },
  {
    id: "f",
    en: { name: "F-pattern", how: "Two horizontal sweeps along the top, then the eye slides down the left edge. What matters goes at the start of lines and in the left column.", when: "Long reads: articles, docs, search, catalogues." },
    name: "F-паттерн",
    term: "F-pattern",
    wire: [
      { rect: [4, 6, 152, 10], fill: "blue", label: "Заголовок" },
      { rect: [4, 20, 110, 8], fill: "green", label: "Лид" },
      ...[0, 1, 2, 3, 4, 5].flatMap((i): Shape[] => [
        { rect: [4, 34 + i * 11, 34, 7], fill: "yellow" },
        { rect: [42, 35.5 + i * 11, 70 - i * 8, 3], fill: "grey" },
      ]),
      // Eye path runs through the gaps between blocks
      { path: "M6 18 H150 M6 31 H110 M40 18 V96", stroke: "red", width: 1, dash: true },
    ],
    how: "Две горизонтальные пробежки по верху, потом взгляд сползает вниз по левому краю. Ключевое — в начале строк и в левой колонке.",
    when: "Длинные тексты: статьи, документация, поиск, каталоги.",
    sites: [
      { name: "Hacker News", url: "https://news.ycombinator.com", image: "hn", note: "Чистый F: список ссылок, читается только начало каждой строки.", noteEn: "Pure F: a list of links, you only read the start of each line." },
      { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Graphic_design", image: "wikipedia", note: "Заголовок, первые абзацы и оглавление слева.", noteEn: "Title, opening paragraphs and a table of contents on the left." },
      { name: "MDN", url: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout", image: "mdn", note: "Документация: меню слева, заголовок и абзацы, оглавление справа.", noteEn: "Docs: menu on the left, title and paragraphs, contents on the right." },
    ],
  },
  {
    id: "broken",
    en: { name: "Broken grid", how: "There's a grid underneath, but elements break it: they overlap, text runs over photos, blocks sit off the expected lines.", when: "Fashion, art, studios — when looking bold matters. Without a grid underneath it turns into chaos." },
    name: "Сломанная сетка",
    term: "Broken grid",
    wire: [
      { path: "M40 0 V100 M80 0 V100 M120 0 V100", stroke: "grey", width: 0.6, dash: true },
      { rect: [10, 10, 78, 56], fill: "lilac", label: "Изображение" },
      { rect: [58, 40, 94, 20], fill: "blue", label: "Заголовок поверх", size: 5 },
      { rect: [104, 64, 48, 32], fill: "green", label: "Второе фото" },
      { rect: [14, 74, 52, 16], fill: "cream", label: "Текст" },
    ],
    how: "Под страницей есть сетка, но элементы её нарушают: накладываются, текст наезжает на фото, блоки сдвинуты с ожидаемых линий.",
    when: "Мода, искусство, студии — когда важно выглядеть смело. Без сетки под низом превращается в хаос.",
    sites: [
      { name: "El Palace Barcelona", url: "https://www.hotelpalacebarcelona.com", image: "palace", note: "Фото и текстовые карточки наезжают друг на друга и сдвинуты с линий сетки.", noteEn: "Photos and text cards overlap and sit off the grid lines." },
      { name: "Pinguinweb", url: "https://www.pinguinweb.de", image: "pinguin", note: "Огромное слово WEBDESIGN перерезано чёрным блоком, который вылезает за сетку.", noteEn: "The huge word WEBDESIGN is cut by a black block that breaks out of the grid." },
    ],
  },
  {
    id: "alternating",
    en: { name: "Alternating rows", how: "Image-plus-text rows that swap sides at every step. Creates rhythm and keeps the feed from clumping together.", when: "A feature block below the hero, a step-by-step “how it works”." },
    name: "Чередование",
    term: "Alternating rows",
    wire: [
      { rect: [4, 6, 70, 26], fill: "lilac", label: "Фото" },
      { rect: [82, 11, 74, 8], fill: "blue", label: "Заголовок" },
      { rect: [82, 23, 60, 4], fill: "grey" },
      { rect: [4, 42, 74, 8], fill: "blue", label: "Заголовок" },
      { rect: [4, 54, 60, 4], fill: "grey" },
      { rect: [86, 37, 70, 26], fill: "green", label: "Фото" },
      { rect: [4, 68, 70, 26], fill: "cream", label: "Фото" },
      { rect: [82, 73, 74, 8], fill: "blue", label: "Заголовок" },
      { rect: [82, 85, 60, 4], fill: "grey" },
    ],
    how: "Ряды «картинка + текст», которые на каждом шаге меняются сторонами. Создаёт ритм и не даёт ленте слипнуться.",
    when: "Блок фич под первым экраном, пошаговое «как это работает».",
    sites: [
      { name: "Loom", url: "https://www.loom.com", image: "loom", note: "Ряды фич: картинка слева и текст справа, в следующем ряду — наоборот.", noteEn: "Feature rows: image left and copy right, then the other way round." },
    ],
  },
  {
    id: "stat",
    en: { name: "Stat as hero", how: "A huge number with a short explanation instead of a headline. Next to it, the proof: a chart, a case, a testimonial.", when: "When the product has a measurable benefit: speed, savings, growth." },
    name: "Цифра как герой",
    term: "Stat-led",
    wire: [
      ...NAV,
      { text: "87%", at: [6, 36], size: 28, fill: "ink", start: true },
      { rect: [8, 58, 82, 6], fill: "grey", label: "Что значит эта цифра" },
      { rect: [8, 70, 24, 7], fill: "pink", label: "CTA" },
      { rect: [100, 14, 56, 82], fill: "green", label: "График" },
    ],
    how: "Вместо заголовка — огромное число с короткой расшифровкой. Рядом то, что его доказывает: график, кейс, отзыв.",
    when: "Когда у продукта есть измеримая выгода: скорость, экономия, рост.",
    sites: [
      { name: "Cloudflare", url: "https://www.cloudflare.com", image: "cloudflare", note: "«20% of the Internet» — цифра прямо в заголовке.", noteEn: "“20% of the Internet” — the number right in the headline." },
      { name: "Squarespace", url: "https://www.squarespace.com", image: "squarespace", note: "Сразу под первым экраном: 14M+, $36B+, 200+ крупными цифрами.", noteEn: "Right below the hero: 14M+, $36B+, 200+ in large figures." },
      { name: "Supabase", url: "https://supabase.com", image: "supabase-stat", note: "«Open source from day one» и пиксельный счётчик звёзд на GitHub.", noteEn: "“Open source from day one” and a pixel counter of GitHub stars." },
    ],
  },
  {
    id: "quote",
    en: { name: "Quote", how: "The first screen starts with someone else's words: a large quote, an avatar and a caption, a button below.", when: "Trust matters more than features: services, consulting, education." },
    name: "Цитата",
    term: "Quote-led",
    wire: [
      ...NAV,
      { text: "“", at: [22, 44], size: 34, fill: "red" },
      { rect: [30, 20, 100, 28], fill: "blue", label: "Цитата клиента", size: 5 },
      { rect: [56, 56, 10, 10], fill: "lilac", r: 5 },
      { rect: [70, 58, 34, 6], fill: "grey", label: "Имя, роль", size: 2.8 },
      { rect: [68, 78, 24, 7], fill: "pink", label: "CTA" },
    ],
    how: "Первый экран начинается с чужих слов: крупная цитата, аватар и подпись, кнопка ниже.",
    when: "Доверие решает больше, чем фичи: услуги, консалтинг, обучение.",
    sites: [
      { name: "HEY", url: "https://www.hey.com", image: "hey", note: "Три коротких отзыва со звёздами стоят над заголовком.", noteEn: "Three short starred reviews sit above the headline." },
      { name: "Y Combinator", url: "https://www.ycombinator.com", image: "yc", note: "Под заголовком сноской — цитата Пола Грэма, которая его объясняет.", noteEn: "Under the headline, a Paul Graham quote as a footnote that explains it." },
    ],
  },
  {
    id: "letter",
    en: { name: "Letter", how: "A few first-person paragraphs instead of a headline, in a narrow column like a letter. No images or buttons on the first screen.", when: "Personal pages, invitations, manifesto landings where a human voice matters." },
    name: "Письмо",
    term: "Letter hero",
    wire: [
      ...NAV,
      { rect: [36, 13, 88, 84], fill: "cream", r: 2 },
      { text: "Привет,", at: [42, 23], size: 5, start: true },
      ...[0, 1, 2, 3, 4, 5, 6].map((i): Shape => ({ rect: [42, 30 + i * 7, i % 3 === 2 ? 52 : 76, 3], fill: "grey" })),
      { text: "— подпись", at: [42, 90], size: 3.6, start: true },
    ],
    how: "Вместо заголовка — несколько абзацев от первого лица, узкой колонкой, как письмо. Без картинок и кнопок в первом экране.",
    when: "Личные страницы, приглашения, лендинги-манифесты, где важен человеческий голос.",
    sites: [
      { name: "Robin Sloan", url: "https://www.robinsloan.com", image: "sloan", note: "«I'm the author of…» — первый экран целиком от первого лица, как письмо.", noteEn: "“I'm the author of…” — the whole first screen in the first person, like a letter." },
      { name: "Derek Sivers", url: "https://sive.rs", image: "sivers", note: "«Me in 10 seconds»: узкая колонка текста о себе вместо заголовка.", noteEn: "“Me in 10 seconds”: a narrow column about himself instead of a headline." },
    ],
  },
  {
    id: "horizontal",
    en: { name: "Horizontal scroll", how: "Vertical scrolling moves a strip of panels sideways, like a gallery. A progress bar shows how much is left.", when: "A sequential story: a timeline, a step-by-step case, a collection of works." },
    name: "Горизонтальный скролл",
    term: "Horizontal scroll",
    wire: [
      ...NAV,
      { rect: [4, 14, 64, 70], fill: "lilac", label: "Панель 1", r: 2 },
      { rect: [72, 14, 64, 70], fill: "blue", label: "Панель 2", r: 2 },
      { rect: [140, 14, 64, 70], fill: "green", label: "3", r: 2 },
      { rect: [4, 90, 152, 1.5], fill: "grey" },
      { rect: [4, 90, 50, 1.5], fill: "ink" },
    ],
    how: "Вертикальный скролл двигает ленту панелей вбок, как в галерее. Полоса прогресса показывает, сколько осталось.",
    when: "Последовательная история: таймлайн, кейс по шагам, коллекция работ.",
    sites: [
      { name: "UNDP — The Year Ahead", url: "https://feature.undp.org/2022-year-ahead/", image: "undp", note: "Лонгрид-слайдер: иллюстрированные сцены листаются вбок стрелками.", noteEn: "A longform slider: illustrated scenes flip sideways with arrows." },
      { name: "Venus", url: "https://venus-story.com", image: "venus", note: "История листается вбок по главам, навигация — вертикальной полосой слева.", noteEn: "The story moves sideways chapter by chapter, navigation in a vertical strip on the left." },
    ],
  },
];

/** English for the wireframe labels, keyed by the Russian label */
export const WIRE_EN: Record<string, string> = {
  "Бейдж": "Badge", "Визуал": "Visual", "Второе фото": "Second photo", "Второй": "Second", "Главная история": "Lead story",
  "Главная плитка": "Main tile", "График": "Chart", "Демо": "Demo", "ЗАГОЛОВОК": "HEADLINE", "Заголовок поверх": "Title on top",
  "Заголовок": "Title", "Изображение": "Image", "Иконка": "Icon", "Имя, роль": "Name, role", "Интерфейс продукта": "Product UI",
  "Карточка": "Card", "Кнопка": "Button", "Лид": "Lead", "Лого": "Logo", "Логотипы": "Logos", "Материал": "Story",
  "Медиа": "Media", "Меню": "Menu", "Меню, CTA": "Menu, CTA", "Навигация": "Navigation", "Надзаголовок": "Eyebrow",
  "Название": "Name", "ОГРОМНЫЙ": "OVERSIZED", "Отзыв": "Review", "Панель 1": "Panel 1", "Панель 2": "Panel 2",
  "Подзаголовок": "Subtitle", "Подпись": "Caption", "Превью": "Thumb", "Ссылка": "Link", "Текст": "Text", "Товар": "Product",
  "Фича": "Feature", "Фото товара": "Product photo", "Фото": "Photo", "Цена": "Price", "Цитата клиента": "Client quote",
  "Цифра": "Number", "Что значит эта цифра": "What the number means", "Логотипы клиентов": "Client logos",
  "Привет,": "Hi,", "Слайдер": "Slider", "Фон": "Background", "Фоновая форма": "Background shape",
  "Фото или видео до краёв": "Edge-to-edge photo or video", "— подпись": "— signature",
};

export const SOURCES = [
  { label: "Рилс @marcelodesignxh — Stop designing boring hero sections", labelEn: "Reel by @marcelodesignxh — Stop designing boring hero sections", url: "https://www.instagram.com/reel/DeM4Xlhhkgu/" },
  { label: "Hallmark — архетипы первых экранов H1–H9", labelEn: "Hallmark — hero archetypes H1–H9", url: "https://instagit.com/Nutlope/hallmark/hallmark-hero-archetypes-usage.md" },
  { label: "AI Designer — Website hero section: anatomy, patterns, examples", url: "https://www.aidesigner.ai/blog/website-hero-section" },
  { label: "AI Designer — 15 website layout patterns", url: "https://www.aidesigner.ai/blog/website-layout" },
  { label: "Pravin Kumar — Bento box hero sections", url: "https://www.pravinkumar.co/blog/bento-box-hero-sections-webflow-design-2026" },
  { label: "Pravin Kumar — Editorial layouts replace hero sections", url: "https://www.pravinkumar.co/blog/editorial-layouts-replace-hero-sections-webflow-2026" },
];
