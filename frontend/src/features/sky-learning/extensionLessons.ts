import type { LessonDefinition } from './content'

const hip = (...ids: number[]) => ids.map(id => `HIP:${id}`)
const dipper = hip(67301, 65378, 62956, 59774, 54061, 53910, 58001, 59774)
const square = hip(113963, 113881, 677, 1067, 113963)

export const connectionLessons: LessonDefinition[] = [
  {
    id: 'connect-autumn-winter', stage: 'connections', title: '从英仙连接御夫与金牛',
    description: '先找英仙的分叉，再辨认御夫的五边形与金牛的长角。三片区域连起来，秋季和冬季的分组就不再是互不相干的星图。',
    tip: '依次从五车二、毕宿五两个不同起点找回英仙。关掉连线后，只说出三片星区的位置；季节名称是学习分组，不表示它们只在该季节可见。',
    constellationIds: ['Per', 'Aur', 'Tau'], targetIds: [],
  },
  {
    id: 'connect-winter-spring', stage: 'connections', title: '从双子走向狮子',
    description: '先找北河二、北河三，再在另一片区域找狮子的镰刀和尾部。观察两个大图形之间的距离，为后续学习中间较暗的巨蟹座留出位置。',
    tip: '这课只画双子和狮子的主要连线，不把两者硬连成新图形。换个朝向后，依靠双子头部双星和狮子镰刀区分两片区域。',
    constellationIds: ['Gem', 'Leo'], targetIds: [],
  },
  {
    id: 'connect-spring-summer', stage: 'connections', title: '从室女走向天蝎',
    description: '用角宿一定位室女，用心宿二定位天蝎，再比较室女舒展的骨架和天蝎弯曲的尾部。两者之间的天秤区域将在邻区课中补上。',
    tip: '分别从两颗亮星向外追踪本座连线，避免把相邻星座混成一条星链。关掉名称后说出两个锚点，再开名称核对。',
    constellationIds: ['Vir', 'Sco'], targetIds: [],
  },
  {
    id: 'connect-summer-autumn', stage: 'connections', title: '从天鹰走向飞马四边形',
    description: '找回河鼓二与两侧的星点，再比较飞马大四边形。先记两个明显锚点之间的区域关系，后面再填入海豚、小马等小星座。',
    tip: '这张图跨越较大的天区，图形看起来会比单课小。先关线辨认两组骨架，再回到各自课程检查细节，不把屏幕边缘方向当成实际地平线方向。',
    constellationIds: ['Aql', 'Peg'], extraPaths: [square], targetIds: [],
  },
]

export const nameLessons: LessonDefinition[] = [
  {
    id: 'dipper-bowl-names', stage: 'star-names', title: '北斗第二遍：天玑与天权',
    description: '斗口的天枢、天璇已经熟悉，现在补上斗身另两颗星：天玑和天权。沿天枢、天璇、天玑、天权绕斗身一周。',
    tip: '天权位于斗身与斗柄相接处；天玑紧邻天璇。先用熟悉的斗口定位，再辨认新名字，别只按亮度猜测。',
    constellationIds: ['UMa'], paths: [dipper], targetIds: hip(58001, 59774),
  },
  {
    id: 'dipper-handle-names', stage: 'star-names', title: '北斗第二遍：斗柄三星',
    description: '从斗身的天权向外，斗柄依次是玉衡、开阳、摇光。把三个名字与弯曲的顺序关联，至此补齐北斗七星。',
    tip: '先从斗身向柄端说一次，再从摇光反向说回玉衡。换朝向后顺序不变；本课以开阳的目录星点为目标，不要求分辨它附近的辅星。',
    constellationIds: ['UMa'], paths: [dipper], targetIds: hip(62956, 65378, 67301),
  },
  {
    id: 'orion-belt-names', stage: 'star-names', title: '猎户第二遍：腰带三星',
    description: '腰带依次是参宿一、参宿二、参宿三。先固定中间的参宿二，再用参宿四和参宿七所在的猎户骨架区分两端。',
    tip: '中间是参宿二；两端要借助整个猎户轮廓辨认，不能只凭三颗近似排成直线的星点。先在默认朝向记住位置，再逐次转动星图并核对。',
    constellationIds: ['Ori'], targetIds: hip(26727, 26311, 25930),
  },
  {
    id: 'square-west-names', stage: 'star-names', title: '秋季四边形：室宿一与室宿二',
    description: '先把大四边形认完整，再记西侧的一对角星：室宿一、室宿二。它们都属于飞马座，室宿二的赤纬更高。',
    tip: '此处西侧和赤纬描述的是天球关系，不是屏幕固定左右。室宿二所在的角还伸出飞马的支线；观察支线与相邻边，再关名称找回两颗星。',
    constellationIds: ['Peg'], extraPaths: [square], targetIds: hip(113963, 113881),
  },
  {
    id: 'square-east-names', stage: 'star-names', title: '秋季四边形：壁宿一与壁宿二',
    description: '补上四边形东侧的两个角：壁宿一属于飞马座，壁宿二属于仙女座。壁宿二是从四边形进入仙女星链的起点。',
    tip: '沿四边形绕一圈，说出四颗角星的名字。再从连接仙女星链的角找到壁宿二，以连线关系区分它和壁宿一。',
    constellationIds: ['Peg', 'And'], extraPaths: [square], targetIds: hip(1067, 677),
  },
  {
    id: 'andromeda-perseus-names', stage: 'star-names', title: '仙女与英仙：补上三颗主星',
    description: '在仙女星链中找到奎宿九，再到英仙寻找天船三和大陵五。先把三颗星各自放回星链或分支，再记名称。',
    tip: '奎宿九是仙女的锚点；天船三位于英仙的主要星链，大陵五在旁侧分支。大陵五是变星，这张静态图不演示它的亮度变化。',
    constellationIds: ['And', 'Per'], targetIds: hip(5447, 15863, 14576),
  },
]

export const synthesisLessons: LessonDefinition[] = [
  {
    id: 'synthesis-north', stage: 'synthesis', title: '综合回顾：从斗口到北天',
    description: '在双熊与仙后同框的星区中，混合回忆天枢、摇光和北极星。先从大图形判断星区，再找目标位置。',
    tip: '从斗口找天枢，从斗柄末端找摇光，再找小熊柄端的北极星。完成后回到天龙、仙王等邻区课程，尝试不看连线复述周围的排列。',
    constellationIds: ['UMa', 'UMi', 'Cas'], targetIds: hip(54061, 67301, 11767),
  },
  {
    id: 'synthesis-winter-spring', stage: 'synthesis', title: '综合回顾：冬春之间的亮星',
    description: '把五车二、北河三和轩辕十四放在同一片较宽的星区里回忆。由亮星找到御夫、双子和狮子，练习从不同起点认路。',
    tip: '五边形、双星头部和镰刀是三个结构提示。完成后回到巨蟹、天猫、小狮等邻区课程，检查能否说出它们与亮星骨架的关系。',
    constellationIds: ['Aur', 'Gem', 'Leo'], targetIds: hip(24608, 37826, 49669),
  },
  {
    id: 'synthesis-summer-autumn', stage: 'synthesis', title: '综合回顾：大三角走向四边形',
    description: '在天鹰、天鹅与飞马相连的区域中，混合回忆河鼓二、天津四和室宿一。比较亮星旁的局部结构，而不只凭亮度判断。',
    tip: '先区分河鼓二两侧的星点、天鹅的长轴和四边形的角。完成后回到海豚、天箭、小马、蝎虎课程，按相邻关系补全这片星空。',
    constellationIds: ['Aql', 'Cyg', 'Peg'], extraPaths: [square], targetIds: hip(97649, 102098, 113963),
  },
  {
    id: 'synthesis-south', stage: 'synthesis', title: '综合回顾：南天亮星与整条路线',
    description: '以老人星、十字架二和南门二回顾船区、南十字与半人马。这是南天局部的混合练习，随后可按目录重访波江周围和南天极附近的课程。',
    tip: '尝试先隐藏名称和连线，再恢复提示核对。全天 88 星座分布在整个天球，不会在同一时刻、同一地点全部出现；完成导读也不等于通过了全部星座的认形测验。',
    constellationIds: ['Car', 'Cru', 'Cen'], targetIds: hip(30438, 60718, 71683),
  },
]
