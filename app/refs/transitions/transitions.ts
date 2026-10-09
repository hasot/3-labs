export type TransitionText = { name: string; how: string; web: string; lab?: string };

export type Transition = {
  id: string;
  /** Block of the reel it comes from */
  block: "Camera pull-back" | "Track matte" | "Match cut";
  /** The usual English name */
  term: string;
  name: string;
  how: string;
  /** How to build it on the web */
  web: string;
  /** How it fits this lab, when it does */
  lab?: string;
  en: TransitionText;
  /** Reel frame in public/refs/transitions/<id>.webp */
  frame: string;
};

export const TRANSITIONS: Transition[] = [
  {
    id: "pull",
    block: "Camera pull-back",
    term: "Zoom-out text",
    name: "Камера отъезжает",
    how: "Фраза уменьшается в точку, будто камера резко отъехала, а следующая прилетает из-за камеры с размытием. Три коротких тезиса читаются как один кадр.",
    web: "GSAP: scale 3 → 1 → 0.05 и filter: blur на входе и выходе, easing expo.inOut. В three.js то же самое — камера едет по оси z, а тезисы стоят плоскостями на разной глубине.",
    lab: "Bat-Signal: камера отъезжает от прожектора к городу.",
    en: {
      name: "Camera pull-back",
      how: "A phrase shrinks to a point as if the camera jerked back, and the next one flies in from behind the camera with a blur. Three short claims read as one shot.",
      web: "GSAP: scale 3 → 1 → 0.05 with filter: blur on the way in and out, expo.inOut easing. In three.js it's the same with the camera moving along z and the claims as planes at different depths.",
      lab: "Bat-Signal: the camera pulls back from the searchlight to the city.",
    },
    frame: "pull",
  },
  {
    id: "lid",
    block: "Track matte",
    term: "Eyelid wipe",
    name: "Смыкание век",
    how: "Две светящиеся дуги сверху и снизу смыкаются, как веко или диафрагма, закрывают кадр и раскрывают следующий. Текст в это время стирается слева направо.",
    web: "Два эллипса с border-radius: 50% едут по translateY. Стирание текста — clip-path: inset(0 0 0 X%). Track matte из After Effects в CSS заменяют clip-path и mask.",
    lab: "Bat-Signal: луч сужается в щель и раскрывает следующую секцию.",
    en: {
      name: "Eyelid wipe",
      how: "Two glowing arcs close in from top and bottom like an eyelid or an aperture, shut the frame and open the next one. Meanwhile the text is wiped away left to right.",
      web: "Two ellipses with border-radius: 50% move on translateY. The text wipe is clip-path: inset(0 0 0 X%). In CSS, clip-path and mask do the job of an After Effects track matte.",
      lab: "Bat-Signal: the beam narrows to a slit and opens the next section.",
    },
    frame: "lid",
  },
  {
    id: "iris",
    block: "Track matte",
    term: "Shape reveal · iris wipe",
    name: "Логотип раскрывается кругом",
    how: "Логотип сжимается в точку, из неё расходится круг с размытым краем и открывает следующую сцену.",
    web: "clip-path: circle(0% → 80% at x y) на следующей сцене. Кольцо по краю — отдельный элемент с той же длительностью и easing, чтобы оно шло вместе с маской.",
    lab: "Переход из карточки в галерее проектов в сам эксперимент.",
    en: {
      name: "Logo opens into a circle",
      how: "The logo shrinks to a point, a soft-edged circle spreads out of it and reveals the next scene.",
      web: "clip-path: circle(0% → 80% at x y) on the next scene. The ring on the edge is its own element with the same duration and easing so it travels with the mask.",
      lab: "Going from a card in the projects gallery into the experiment itself.",
    },
    frame: "iris",
  },
  {
    id: "dot",
    block: "Track matte",
    term: "Dot-to-fill · text roller",
    name: "Точка заливает экран",
    how: "Линия графика дорисовывается, точка на её конце вырастает и становится фоном следующей сцены. Слева строки прокручиваются барабаном, в фокусе всегда средняя.",
    web: "stroke-dashoffset у SVG-пути, затем scale точки до размера экрана. Барабан — translateY списка и mask-image: linear-gradient сверху и снизу.",
    lab: "Bat-Signal: пятно света вырастает и становится фоном следующей секции.",
    en: {
      name: "Dot fills the screen",
      how: "A chart line draws itself, the dot at its end grows and becomes the background of the next scene. On the left the lines roll like a drum, the middle one always in focus.",
      web: "stroke-dashoffset on an SVG path, then scale the dot up to the screen size. The drum is a translateY on the list plus mask-image: linear-gradient at top and bottom.",
      lab: "Bat-Signal: the light spot grows into the background of the next section.",
    },
    frame: "dot",
  },
  {
    id: "words",
    block: "Track matte",
    term: "Word-by-word reveal",
    name: "Слова по одному",
    how: "Слова появляются по одному с лёгким размытием. Звёздочка в конце строки едет вслед за текстом, как курсор при наборе.",
    web: "Каждое слово в своём span с задержкой i × 0.3 с. Звёздочка стоит последним inline-элементом, и растущий текст сдвигает её сам. В GSAP — SplitText и stagger.",
    en: {
      name: "Word by word",
      how: "Words appear one at a time with a slight blur. A sparkle at the end of the line rides along with the text like a typing cursor.",
      web: "Each word in its own span delayed by i × 0.3 s. The sparkle is the last inline element, so the growing text pushes it along. In GSAP: SplitText with a stagger.",
    },
    frame: "words",
  },
  {
    id: "star",
    block: "Match cut",
    term: "Shape match cut",
    name: "Матч-кат формой",
    how: "Контурные звёзды пролетают через кадр с вращением, и под их прикрытием меняется слово в центре. Форма связывает кадры, поэтому склейку не замечаешь.",
    web: "SVG-контур с rotate и translate, на быстрой фазе добавить blur. Слово меняется в момент, когда звезда закрывает центр.",
    en: {
      name: "Shape match cut",
      how: "Outline stars spin through the frame, and the word in the centre changes under their cover. The shape ties the shots together, so the cut goes unnoticed.",
      web: "An SVG outline with rotate and translate, plus blur during the fast phase. Swap the word at the moment a star covers the centre.",
    },
    frame: "star",
  },
  {
    id: "cards",
    block: "Match cut",
    term: "Rack focus · depth of field",
    name: "Перевод фокуса",
    how: "Карточки интерфейса висят на разной глубине, и фокус по очереди переходит с одной на другую. Плоский UI выглядит так, будто его сняли на камеру.",
    web: "filter: blur на карточках не в фокусе и лёгкий translateY, чтобы они «дышали». В three.js — DepthOfField из postprocessing.",
    en: {
      name: "Rack focus",
      how: "UI cards hang at different depths and the focus moves from one to the next. A flat interface looks as if it was shot on a camera.",
      web: "filter: blur on the out-of-focus cards and a slight translateY so they breathe. In three.js: DepthOfField from postprocessing.",
    },
    frame: "cards",
  },
  {
    id: "qa",
    block: "Match cut",
    term: "Question → UI reveal",
    name: "Вопрос, потом ответ",
    how: "Сначала крупный вопрос на градиенте. Потом снизу с наклоном выезжает окно с дашбордом, а вопрос уходит вверх и гаснет.",
    web: "perspective на контейнере, окно переходит из translateY(60%) rotateX(28deg) в ноль. На скролле — ScrollTrigger со scrub.",
    en: {
      name: "Question, then answer",
      how: "First a large question on a gradient. Then a dashboard window tilts up from below while the question drifts up and fades.",
      web: "perspective on the container, the window goes from translateY(60%) rotateX(28deg) to zero. On scroll: ScrollTrigger with scrub.",
    },
    frame: "qa",
  },
];

export const SOURCES = [
  {
    label: "Рилс @francois_dvr — 3 transitions to never get stuck in Motion Design",
    labelEn: "Reel by @francois_dvr — 3 transitions to never get stuck in Motion Design",
    url: "https://www.instagram.com/reel/Dcq_NcWvW-K/",
  },
];
