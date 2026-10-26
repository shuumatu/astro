import learningData from './learning-stars.json'
import { connectionLessons, nameLessons, synthesisLessons } from './extensionLessons'
import { neighborLessons } from './neighborLessons'
import { southernLessons } from './southernLessons'
import { chineseLessonDefinitions } from './chineseLessons'

export interface LearningStar {
  id: string
  name: string
  traditionalName?: string
  aliases: string[]
  raDeg: number
  decDeg: number
  magnitude: number
  /** Catalog B−V color index; null means no measured color is available. */
  colorIndex: number | null
  epochYear?: number
}

export interface LearningLesson {
  id: string
  stage: string
  kind: 'orientation' | 'stars'
  title: string
  description: string
  tip: string
  constellationIds: string[]
  asterismIds?: string[]
  starIds: string[]
  targetIds: string[]
  paths: string[][]
  centerRaDeg: number
  centerDecDeg: number
}

export const stars: LearningStar[] = learningData.stars
export const sourceVersion = learningData.sourceVersion
export const sources = learningData.sources
export const coordinateNote = learningData.coordinateNote
export const constellations = learningData.figures.map(({ code, name }) => ({ code, name }))
export const coreConstellations = constellations.slice(0, 21)
export const chineseFigures = learningData.chineseFigures

const starById = new Map(stars.map((star) => [star.id, star]))
const figureByCode = new Map(learningData.figures.map((figure) => [figure.code, figure]))
const chineseFigureById = new Map(chineseFigures.map(figure => [figure.id, figure]))
const hip = (...ids: number[]) => ids.map((id) => `HIP:${id}`)
const dipper = hip(67301, 65378, 62956, 59774, 54061, 53910, 58001, 59774)
const winterTriangle = hip(27989, 32349, 37279, 27989)
const winterHexagon = hip(24436, 32349, 37279, 37826, 24608, 21421, 24436)
const summerTriangle = hip(91262, 102098, 97649, 91262)
const autumnSquare = hip(113963, 113881, 677, 1067, 113963)
const radians = Math.PI / 180

function angularDistance(star: LearningStar, ra: number, dec: number) {
  const cosine = Math.sin(star.decDeg * radians) * Math.sin(dec * radians)
    + Math.cos(star.decDeg * radians) * Math.cos(dec * radians) * Math.cos((star.raDeg - ra) * radians)
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / radians
}

export interface LessonDefinition extends Omit<LearningLesson, 'starIds' | 'paths' | 'kind' | 'centerRaDeg' | 'centerDecDeg'> {
  paths?: string[][]
  extraPaths?: string[][]
  centerRaDeg?: number
  centerDecDeg?: number
}

function defineLesson(definition: LessonDefinition): LearningLesson {
  const { extraPaths = [], ...lesson } = definition
  const paths = [...(definition.paths ?? (definition.asterismIds?.length ? definition.asterismIds.flatMap(id => {
    const figure = chineseFigureById.get(id)
    if (!figure) throw new Error(`Unknown Chinese asterism in learning content: ${id}`)
    return figure.paths
  }) : definition.constellationIds.flatMap((code) => {
    const figure = figureByCode.get(code)
    if (!figure) throw new Error(`Unknown constellation in learning content: ${code}`)
    return figure.paths
  }))), ...extraPaths]
  const requiredIds = new Set([...paths.flat(), ...definition.targetIds])
  const requiredStars = [...requiredIds].map((id) => {
    const star = starById.get(id)
    if (!star) throw new Error(`Missing learning star: ${id}`)
    return star
  })
  if (!requiredStars.length) throw new Error(`Empty learning chart: ${definition.id}`)
  // Average unit vectors, not RA angles: courses can cross 0h or surround a pole.
  const vector = requiredStars.reduce((sum, star) => {
    const ra = star.raDeg * radians
    const dec = star.decDeg * radians
    return { x: sum.x + Math.cos(dec) * Math.cos(ra), y: sum.y + Math.cos(dec) * Math.sin(ra), z: sum.z + Math.sin(dec) }
  }, { x: 0, y: 0, z: 0 })
  const centerRaDeg = definition.centerRaDeg ?? (Math.atan2(vector.y, vector.x) / radians + 360) % 360
  const centerDecDeg = definition.centerDecDeg ?? Math.atan2(vector.z, Math.hypot(vector.x, vector.y)) / radians
  const radius = Math.max(10, ...requiredStars.map(star => angularDistance(star, centerRaDeg, centerDecDeg))) + 3
  // Keep a local field of real bright stars so recall is not limited to a
  // constellation's vertices. Background stars never change the answer set.
  const backgroundIds = stars.filter((star) => star.magnitude <= 4.5
    && angularDistance(star, centerRaDeg, centerDecDeg) <= radius)
    .map((star) => star.id)
  return {
    ...lesson,
    centerRaDeg,
    centerDecDeg,
    kind: lesson.targetIds.length ? 'stars' : 'orientation',
    paths,
    starIds: [...new Set([...requiredIds, ...backgroundIds])],
  }
}

/** Static educational charts: east/north on a chart are not the user's horizon. */
export const lessons: LearningLesson[] = [
  defineLesson({
    id: 'chart-basics', stage: 'foundations', title: '先学会看星图',
    description: '先观察北斗的勺形：斗身四颗星、斗柄三颗星。星点的明暗和大小帮助表现视亮度，连线只是帮助认形的辅助。',
    tip: '这是静态教学星图，不代表你此刻面向的地平线方向；真实天空中没有连线。先试着开关连线，再换个朝向，找回斗身与斗柄。',
    constellationIds: ['UMa'], paths: [dipper], targetIds: [], centerRaDeg: 180, centerDecDeg: 57,
  }),
  defineLesson({
    id: 'dipper-pointers', stage: 'north', title: '北斗：记住斗口两颗星',
    description: '北斗是大熊座中的星群。先记斗口的天璇和天枢，其他五颗星先认位置，稍后再补名字。',
    tip: '寻北时沿天璇朝天枢的方向继续延伸。现在先反复找到这两颗斗口星，旋转后仍以星形关系来判断。',
    constellationIds: ['UMa'], paths: [dipper], targetIds: hip(53910, 54061), centerRaDeg: 180, centerDecDeg: 57,
  }),
  defineLesson({
    id: 'polaris', stage: 'north', title: '小熊座与北方定位',
    description: '北极星位于小熊座的长柄末端，接近北天极。图中同时放入北斗斗口两星，帮助建立寻北关系。',
    tip: '北极星也叫勾陈一，它不是全天最亮的恒星。斗口两星之间的线是参考，寻找北极星时沿天璇到天枢的方向继续延伸。',
    constellationIds: ['UMi'], extraPaths: [hip(53910, 54061)], targetIds: hip(11767), centerRaDeg: 165, centerDecDeg: 75,
  }),
  defineLesson({
    id: 'cassiopeia-shape', stage: 'north', title: '仙后座：认出 W 形',
    description: '先认识五颗主要星组成的折线。随着观察朝向改变，它可能像 W，也可能像 M。',
    tip: '这一课只认形状，无须增加星名。关闭连线后自己找回五颗星，再旋转视图重复；完成导读不代表已通过形状测验。',
    constellationIds: ['Cas'], targetIds: [], centerRaDeg: 20, centerDecDeg: 60,
  }),
  defineLesson({
    id: 'ursa-major-context', stage: 'north', title: '把北斗放回大熊座',
    description: '找出熟悉的北斗，再看它以外的连线。大熊座是一片天区，北斗只是其中容易辨认的星群。',
    tip: '从已知的勺形向外扩展，先记整体位置。较暗的成员可先在教学图中学习，真实可见性还受地点和光害影响。',
    constellationIds: ['UMa'], targetIds: [], centerRaDeg: 155, centerDecDeg: 55,
  }),
  defineLesson({
    id: 'orion', stage: 'winter', title: '猎户座：腰带、肩与脚',
    description: '先找三颗紧邻的腰带星，再向外认识肩部的参宿四和脚部的参宿七。',
    tip: '把名字和腰带两侧的相对位置关联，不要死记屏幕左右。腰带三颗星的名字留到后续课程。',
    constellationIds: ['Ori'], targetIds: hip(27989, 24436), centerRaDeg: 84, centerDecDeg: 0,
  }),
  defineLesson({
    id: 'winter-dogs', stage: 'winter', title: '大犬、小犬与冬季大三角',
    description: '天狼星属于大犬座，南河三属于小犬座；它们与已学的参宿四组成冬季大三角。',
    tip: '三角形跨越三个星座。先找到最亮的天狼星，再沿大三角找到南河三与参宿四，最后观察两只犬的局部连线。',
    constellationIds: ['CMa', 'CMi'], extraPaths: [winterTriangle], targetIds: hip(32349, 37279), centerRaDeg: 105, centerDecDeg: -8,
  }),
  defineLesson({
    id: 'taurus', stage: 'winter', title: '金牛座：V 形与长角',
    description: '先找到毕宿五与附近的 V 形结构，再向两侧追踪金牛座的长角。',
    tip: '毕宿五处于毕宿星团的视线方向，但不是星团的物理成员。此处先练星形与主星，不要求记住周围每颗暗星。',
    constellationIds: ['Tau'], targetIds: hip(21421), centerRaDeg: 65, centerDecDeg: 18,
  }),
  defineLesson({
    id: 'auriga', stage: 'winter', title: '御夫座：五边形骨架',
    description: '以明亮的五车二为起点，沿主要连线认识御夫座的五边形骨架。',
    tip: '先用亮星找到区域，再看图形。五边形靠近金牛的一角涉及共享的传统画法，连线不等于现代星座天区边界。',
    constellationIds: ['Aur'], targetIds: hip(24608), centerRaDeg: 86, centerDecDeg: 40,
  }),
  defineLesson({
    id: 'gemini', stage: 'winter', title: '双子座：分清两颗头部亮星',
    description: '北河二和北河三像双子的头部，两列星向外伸展。先分清这两颗星，再看整体结构。',
    tip: '北河三通常比北河二更亮。旋转视图时仍要沿身体结构识别，不以屏幕上下作为固定答案。',
    constellationIds: ['Gem'], targetIds: hip(36850, 37826), centerRaDeg: 106, centerDecDeg: 23,
  }),
  defineLesson({
    id: 'winter-connections', stage: 'winter', title: '串起冬季六边形',
    description: '按参宿七、天狼星、南河三、北河三、五车二、毕宿五的顺序找一圈，回到参宿七。',
    tip: '参宿四属于冬季大三角，不是这里的六边形顶点。每次换一个起点，尝试先说出下一颗星，再显示名称核对。',
    constellationIds: ['Ori', 'CMa', 'CMi', 'Tau', 'Aur', 'Gem'], paths: [winterHexagon, winterTriangle], targetIds: [], centerRaDeg: 94, centerDecDeg: 12,
  }),
  defineLesson({
    id: 'spring-arc', stage: 'spring', title: '牧夫与室女：春季大弧线',
    description: '沿北斗斗柄的大弧线可寻到牧夫座的大角星，再继续寻找室女座的角宿一。这张局部图重点比较后两者。',
    tip: '先认识牧夫的风筝形，再记室女所在区域。这里没有画出完整北斗弧线；两星之间的区域关系不等于随意连一条直线。',
    constellationIds: ['Boo', 'Vir'], targetIds: hip(69673, 65474), centerRaDeg: 208, centerDecDeg: 10,
  }),
  defineLesson({
    id: 'leo', stage: 'spring', title: '狮子座：镰刀与尾部',
    description: '狮子前部像镰刀或反问号，轩辕十四位于这一带；再向后找尾部的五帝座一。',
    tip: '用前后两块结构区分这两个名字。关闭连线时，先找镰刀，再找尾部的三角结构。',
    constellationIds: ['Leo'], targetIds: hip(49669, 57632), centerRaDeg: 158, centerDecDeg: 18,
  }),
  defineLesson({
    id: 'summer-triangle', stage: 'summer', title: '夏季大三角与三个星座',
    description: '依次认识天琴座的织女一、天鹅座的天津四、天鹰座的河鼓二；三颗亮星组成夏季大三角。',
    tip: '织女一也叫织女星，河鼓二也叫牛郎星。找到三个顶点后，再看天琴的小平行四边形、天鹅的北十字和牛郎星两侧的星点。',
    constellationIds: ['Lyr', 'Cyg', 'Aql'], extraPaths: [summerTriangle], targetIds: hip(91262, 102098, 97649), centerRaDeg: 292, centerDecDeg: 28,
  }),
  defineLesson({
    id: 'scorpius', stage: 'summer', title: '天蝎座：身体与弯钩',
    description: '用心宿二定位天蝎身体，再沿弯曲的星链向尾部追踪。',
    tip: '先认整体弯钩，再找心宿二。部分北方地点看不到完整蝎尾，这张教学图保留完整形状，不表示当地实时可见。',
    constellationIds: ['Sco'], targetIds: hip(80763), centerRaDeg: 252, centerDecDeg: -27,
  }),
  defineLesson({
    id: 'sagittarius-teapot', stage: 'summer', title: '人马座：先认识茶壶',
    description: '先认壶身，再认壶盖、壶嘴和壶把。这是人马座中常用的茶壶星群，帮助定位天蝎附近的另一片区域。',
    tip: '首轮只记形状，不增加一串星名。连线是图形辅助，茶壶并不代表人马座的完整边界。',
    constellationIds: ['Sgr'],
    paths: [hip(89931, 90185, 93506, 92041, 89931), hip(89931, 90496, 92041), hip(89931, 88635, 90185), hip(93506, 93864, 92855, 92041)],
    targetIds: [], centerRaDeg: 280, centerDecDeg: -29,
  }),
  defineLesson({
    id: 'pegasus-square', stage: 'autumn', title: '飞马座：秋季大四边形',
    description: '先识别大四边形，再观察飞马座伸出的主要连线。下一课将从相连的角星走向仙女座。',
    tip: '四边形有三颗角星属于飞马座，另一颗壁宿二属于仙女座。首轮先记结构，四角星名留到以后。',
    constellationIds: ['Peg'], extraPaths: [autumnSquare], targetIds: [], centerRaDeg: 350, centerDecDeg: 20,
  }),
  defineLesson({
    id: 'andromeda-perseus', stage: 'autumn', title: '沿仙女星链走向英仙',
    description: '从飞马四边形相连的壁宿二开始，沿仙女座星链向英仙座的分叉结构扩展。',
    tip: '先分清星链与分叉，再记两片区域的位置。它们还可以与已经学过的仙后、御夫和金牛区域联系起来。',
    constellationIds: ['And', 'Per'], targetIds: [], centerRaDeg: 33, centerDecDeg: 41,
  }),
  defineLesson({
    id: 'fomalhaut', stage: 'autumn', title: '南鱼座：秋季南方的亮星',
    description: '在南鱼座找到北落师门，建立秋季南方的亮星参照。它与飞马四边形、仙女星链共同帮助组织秋季星空。',
    tip: '先找到明亮的北落师门，再看周围较暗的南鱼轮廓。完成这一课后，回到各季课程做隐藏名称的混合复习。',
    constellationIds: ['PsA'], targetIds: hip(113368), centerRaDeg: 344, centerDecDeg: -30,
  }),
  ...connectionLessons.map(defineLesson),
  ...nameLessons.map(defineLesson),
  ...neighborLessons.map(defineLesson),
  ...southernLessons.map(defineLesson),
  ...synthesisLessons.map(defineLesson),
]

export const stages = [
  { id: 'foundations', title: '读图基础', description: '先认识星点、连线与方向约定。' },
  { id: 'north', title: '北方定向', description: '北斗、北极星、小熊与仙后。' },
  { id: 'winter', title: '冬季亮星', description: '从猎户出发，串起冬季六边形。' },
  { id: 'spring', title: '春季导航', description: '大角星、角宿一与狮子座。' },
  { id: 'summer', title: '夏季骨架', description: '大三角、天蝎与人马茶壶。' },
  { id: 'autumn', title: '秋季星链', description: '四边形、仙女、英仙与北落师门。' },
  { id: 'connections', title: '四季连通', description: '跨过季节分组，把熟悉的星区接起来。' },
  { id: 'star-names', title: '第二轮星名', description: '回到已认识的形状，补齐北斗、腰带、四边形与秋季主星。' },
  { id: 'north-neighbors', title: '北方邻区', description: '从仙后和双熊扩展到周围较暗的天区。' },
  { id: 'spring-neighbors', title: '春季邻区', description: '沿牧夫、室女和狮子的周围补全星区，分段认识长蛇。' },
  { id: 'summer-neighbors', title: '夏季邻区', description: '从大三角走向武仙、蛇夫与巨蛇，再找小星座。' },
  { id: 'autumn-neighbors', title: '秋季邻区', description: '用四边形和北落师门，定位黄道附近较暗的星座。' },
  { id: 'winter-neighbors', title: '冬季邻区', description: '补全冬季亮星间的空隙，沿波江向南延伸。' },
  { id: 'southern-cross', title: '南天：十字与半人马', description: '先认识南天亮星，再向周围八个星座扩展。' },
  { id: 'southern-ship', title: '南天：船底、船帆与船尾', description: '用老人星定位船区，区分船帆与南十字。' },
  { id: 'southern-eridanus', title: '南天：波江周围', description: '从波江终点走向凤凰与南天较暗的星座。' },
  { id: 'southern-pole', title: '南天：向南天极收拢', description: '认识天鹤、杜鹃、孔雀及南极周围的小星座。' },
  { id: 'synthesis', title: '全天综合回顾', description: '按局部星区混合回忆已学亮星，再回到薄弱课程。' },
].map((stage) => ({ ...stage, lessonIds: lessons.filter((lesson) => lesson.stage === stage.id).map((lesson) => lesson.id) }))

export const roadmap = [
  { id: 'core', title: '日常认星', constellationCount: 21, status: 'available', description: '图形导读与 20 颗亮星的位置、名称练习。' },
  { id: 'neighbors', title: '邻区补全', constellationCount: 55, status: 'available', description: '四季连通、第二轮星名与 34 个邻区星座。' },
  { id: 'whole-sky', title: '南天与全天', constellationCount: 88, status: 'available', description: '33 个南天星座与分区综合回顾；图形导读不等于认形测验。' },
] as const

/** A separate route and numbering scheme; stable Western lesson IDs stay unchanged. */
export const chineseLessons: LearningLesson[] = chineseLessonDefinitions.map(defineLesson)
export const chineseStages = [
  { id: 'cn-foundations', title: '入门：读懂中国星空', description: '分清星官、星名和天区，认识三垣与四象的整体关系。' },
  { id: 'cn-enclosures', title: '三垣：紫微、太微、天市', description: '先看两侧垣墙，再学习垣内与附近的代表星官。' },
  { id: 'cn-dragon', title: '东方青龙七宿', description: '角、亢、氐、房、心、尾、箕：从龙角走到龙尾。' },
  { id: 'cn-tortoise', title: '北方玄武七宿', description: '斗、牛、女、虚、危、室、壁：逐段认识较暗星区。' },
  { id: 'cn-tiger', title: '西方白虎七宿', description: '奎、娄、胃、昴、毕、觜、参：用紧凑星群和亮星作锚点。' },
  { id: 'cn-bird', title: '南方朱雀七宿', description: '井、鬼、柳、星、张、翼、轸：先分小结构，再串起顺序。' },
  { id: 'cn-asterisms', title: '代表星官：从熟名找回星空', description: '织女、河鼓、天津、五车等星官，与熟悉的亮星建立联系。' },
].map(stage => ({ ...stage, lessonIds: chineseLessons.filter(lesson => lesson.stage === stage.id).map(lesson => lesson.id) }))

export const allLessons = [...lessons, ...chineseLessons]
export const allStages = [...stages, ...chineseStages]
export function isChineseLesson(lesson?: LearningLesson): boolean { return !!lesson?.asterismIds?.length }

/** One physical star can have different preferred labels in each cultural route. */
export function starForLesson(id: string, lesson?: LearningLesson): LearningStar | undefined {
  const star = starById.get(id)
  if (!star || !isChineseLesson(lesson) || !star.traditionalName) return star
  return { ...star, name: star.traditionalName, aliases: [...new Set([star.name, ...star.aliases])].filter(name => name !== star.traditionalName) }
}
