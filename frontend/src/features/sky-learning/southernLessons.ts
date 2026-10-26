import type { LessonDefinition } from './content'

const hip = (...ids: number[]) => ids.map((id) => `HIP:${id}`)
const southernCross = [hip(61084, 60718), hip(62434, 59747)]
const centaurPointers = hip(71683, 68702)
const southernTriangle = hip(82273, 74946, 77952, 82273)
const riverMouth = hip(7588, 9007, 10602)
const canopusBranch = hip(30438, 41037)

/** Southern extensions follow the documented first-introduction order.
 * Reference paths are excerpts of the existing Western sky-culture figures.
 */
export const southernLessons: LessonDefinition[] = [
  {
    id: 'southern-crux', stage: 'southern-cross', title: '南十字座：先分清长轴与短轴',
    description: '用四颗主要星找出紧凑的十字，先记长轴两端的十字架一与十字架二。南天学习从这块小而清楚的骨架开始。',
    tip: '旋转后比较两条轴的长度，仍从长轴找回两颗名字。十字架二更亮；十字本身不在南天极上，不能把它当成南极星。',
    constellationIds: ['Cru'], targetIds: hip(61084, 60718),
  },
  {
    id: 'southern-centaurus', stage: 'southern-cross', title: '半人马座：用双亮星找回南十字',
    description: '南门二和马腹一是半人马座中很醒目的两颗星。本图同时保留南十字，先记双亮星与十字的关系，再沿半人马的长骨架扩展。',
    tip: '南门二较亮，马腹一更靠近南十字。不要把这两颗指引星算进南十字座；关闭连线后，先找双星，再找十字。',
    constellationIds: ['Cen'], extraPaths: southernCross, targetIds: hip(71683, 68702),
  },
  {
    id: 'southern-musca', stage: 'southern-cross', title: '苍蝇座：南十字旁的小四边形',
    description: '从图中熟悉的南十字出发，寻找更靠南天极一侧的小四边形。苍蝇座的亮星没有南十字那么抢眼，先记它与十字的距离和相对位置。',
    tip: '先认十字，再找闭合的四边形；关掉连线，比较四个角的间距。不要因为同样有四颗主要星就把它认成第二个十字。',
    constellationIds: ['Mus'], extraPaths: southernCross, targetIds: [],
  },
  {
    id: 'southern-triangulum-australe', stage: 'southern-cross', title: '南三角座：一眼记住三个角',
    description: '本图用南门二与马腹一作参照，再找三个主要顶点组成的南三角。先认完整三角，再比较最亮顶点与另外两角。',
    tip: '换一个朝向，仍按三条边和亮度辨认。南三角座与已经学过的三角座是两片不同天区，名字相似不代表位置相邻。',
    constellationIds: ['TrA'], extraPaths: [centaurPointers], targetIds: [],
  },
  {
    id: 'southern-circinus', stage: 'southern-cross', title: '圆规座：双亮星旁的窄开口',
    description: '圆规座的教学骨架像两条细长的规脚，汇合在同一颗星。本图保留南门二与马腹一，帮助把这块较暗的小星形放回已知区域。',
    tip: '先找到两条线共用的顶点，再分别追到两个端点。先用清晰认星模式核对结构，随后切回自然星空，体会它与邻近亮星的差别。',
    constellationIds: ['Cir'], extraPaths: [centaurPointers], targetIds: [],
  },
  {
    id: 'southern-lupus', stage: 'southern-cross', title: '豺狼座：从天蝎头部向外扩展',
    description: '本图保留心宿二及天蝎头部的两条短线，作为进入豺狼区域的参照。豺狼的连线分支较多，先抓住小三角，再分段接到其余亮星。',
    tip: '不要一次背完整轮廓：先找闭合三角，随后记一处分叉。最后关掉连线，说出豺狼星形与心宿二的相对位置。',
    constellationIds: ['Lup'], extraPaths: [hip(78401, 80763, 78265)], targetIds: [],
  },
  {
    id: 'southern-ara', stage: 'southern-cross', title: '天坛座：蝎尾之外的闭合星形',
    description: '先找图中熟悉的天蝎尾部弯钩，再看它旁边的天坛座。沿教学连线绕一圈，认识天坛较长的闭合轮廓和靠得较近的两个顶点。',
    tip: '把弯钩和闭合轮廓分成两块来记，避免把天坛接成蝎子的尾巴。旋转后先恢复这两块结构的关系，再找暗一些的成员。',
    constellationIds: ['Ara'], extraPaths: [hip(85927, 86670, 87073, 86228, 84143)], targetIds: [],
  },
  {
    id: 'southern-norma', stage: 'southern-cross', title: '矩尺座：大三角旁的小折角',
    description: '矩尺座的几颗主要星组成一块紧凑、带内部折线的图形。本图保留已学的南三角，用大小对照来记住较暗的矩尺。',
    tip: '先找南三角的三个角，再找旁边更小的折角。认出局部位置就可以继续；不需要强迫真实天空里的暗星看起来像一把完整的尺子。',
    constellationIds: ['Nor'], extraPaths: [southernTriangle], targetIds: [],
  },
  {
    id: 'southern-carina', stage: 'southern-ship', title: '船底座：从老人星走向南船',
    description: '先记住非常明亮的老人星，再沿船底座的长骨架一段段向外走。不要把最亮的一颗星误认为就在整个星形中央。',
    tip: '先看老人星所在的端部，再分段追踪另一侧的折线。船底、船帆与船尾是三个现代星座；这张图先认识船底，不必一次记住整艘南船。',
    constellationIds: ['Car'], targetIds: hip(30438),
  },
  {
    id: 'southern-vela', stage: 'southern-ship', title: '船帆座：把大轮廓分成几段',
    description: '船帆座的教学连线围成较宽的闭合轮廓。本图保留船底的一小段作参照，从最明显的几个转角开始，逐步补全整圈。',
    tip: '不要只看某四颗星像不像十字就下结论；先用这张图确认船帆与船底的整体结构，再与前面的南十字课程对照。',
    constellationIds: ['Vel'], extraPaths: [hip(45238, 50099, 52419)], targetIds: [],
  },
  {
    id: 'southern-puppis', stage: 'southern-ship', title: '船尾座：在老人星旁接上另一片船身',
    description: '本图保留老人星所在的一段船底连线，再认识船尾的长形轮廓。先找跨度较大的两端，再按转折分成两三段记忆。',
    tip: '对照前两课，说出船底、船帆和船尾各是哪一块。部分传统连线会借用邻座的星作端点，连线画法不等于现代星座边界。',
    constellationIds: ['Pup'], extraPaths: [canopusBranch], targetIds: [],
  },
  {
    id: 'southern-pyxis', stage: 'southern-ship', title: '罗盘座：船尾旁的三颗排星',
    description: '罗盘座的教学骨架只有三颗依次相连的主要星。先借图中船尾的一段确定区域，再找这条短而较暗的星链。',
    tip: '分别比较两段间隔，闭眼回想哪一段更长，再打开连线核对。罗盘座和之前的圆规座不同，这里记的是南船旁的短星链。',
    constellationIds: ['Pyx'], extraPaths: [hip(39757, 38146, 35264)], targetIds: [],
  },
  {
    id: 'southern-antlia', stage: 'southern-ship', title: '唧筒座：先记位置，再记短线',
    description: '唧筒座在这套教学画法中只用两颗星连成短线。本图保留船帆的一段，帮助记住这条不起眼的线位于哪一片邻区。',
    tip: '两颗星本身很难构成独特轮廓，因此把它们与船帆的距离、朝向一起记。关线后先找参照，再找目标，不凭一条线猜星座。',
    constellationIds: ['Ant'], extraPaths: [hip(45941, 48774, 52727)], targetIds: [],
  },
  {
    id: 'southern-volans', stage: 'southern-ship', title: '飞鱼座：两个相接的小三角',
    description: '飞鱼座的教学连线中有两块相接的三角结构和一条伸出的短枝。本图以船底的一段作参照，先把两块三角分开找。',
    tip: '先认共用的连接点，再比较两块三角的大小和开口。不要把飞鱼与北落师门所在的南鱼座混淆，它们是不同天区。',
    constellationIds: ['Vol'], extraPaths: [hip(45238, 50099, 52419)], targetIds: [],
  },
  {
    id: 'southern-pictor', stage: 'southern-ship', title: '绘架座：老人星旁的一道折线',
    description: '图中老人星及其相邻的一段船底连线提供定位。绘架座的主要骨架是一道由三颗星组成的折线，先找它的转折点。',
    tip: '先找老人星，再凭三颗星的间距找回折线。它不像画架也没有关系：稳定记住位置、两段长度与转折，比硬套物体外形更有用。',
    constellationIds: ['Pic'], extraPaths: [canopusBranch], targetIds: [],
  },
  {
    id: 'southern-phoenix', stage: 'southern-eridanus', title: '凤凰座：从波江河口认出分支',
    description: '从已经学过的水委一回到波江座的南端，本图保留河口一小段。附近的凤凰座有几个相连的三角与分支，先认主要转折，再补较暗的端点。',
    tip: '先指认水委一，再转向凤凰的连线区域。每次只记一块闭合结构，最后把分支接起来，不把波江河口接进凤凰的图形。',
    constellationIds: ['Phe'], extraPaths: [riverMouth], targetIds: [],
  },
  {
    id: 'southern-sculptor', stage: 'southern-eridanus', title: '玉夫座：北落师门旁的宽三角',
    description: '本图保留北落师门及相邻的一段南鱼连线作参照。玉夫座的教学骨架是跨度较大的三角，先记三个端点之间不等的距离。',
    tip: '先找到北落师门，再找到较暗、较宽的三角。三角只是这套画法的记忆骨架，不代表玉夫座的天区只有三颗恒星。',
    constellationIds: ['Scl'], extraPaths: [hip(113368, 111954)], targetIds: [],
  },
  {
    id: 'southern-fornax', stage: 'southern-eridanus', title: '天炉座：在波江弯曲旁找短线',
    description: '天炉座的教学骨架用两颗主要星表示。本图加入波江座附近的一段弯曲，先用长河作参照，再记这条独立短线。',
    tip: '先沿波江的连续折线走一遍，再找没有接在河上的两颗星。小星座不一定有鲜明图案，这课重点是它与邻区的相对位置。',
    constellationIds: ['For'], extraPaths: [hip(14146, 12843, 13701, 15197)], targetIds: [],
  },
  {
    id: 'southern-horologium', stage: 'southern-eridanus', title: '时钟座：记住长折线的转角',
    description: '时钟座的三颗主要星组成一条长折线。本图用水委一所在的波江末段作参照，先认两段线的汇合处，再比较两端。',
    tip: '先记转角与两段长短，不必寻找真实的钟面。换个朝向后仍从水委一和折线的相对关系找回这片较暗的天区。',
    constellationIds: ['Hor'], extraPaths: [riverMouth], targetIds: [],
  },
  {
    id: 'southern-caelum', stage: 'southern-eridanus', title: '雕具座：分辨相邻的两道折线',
    description: '雕具座也是三颗星组成的短折线。本图保留已学的绘架骨架作比较，观察两者的间距、长短和弯折方式。',
    tip: '先认较熟悉的绘架，再找另一道更短的折线。把相邻但不同的星形放在一起比，比单独背一个像刀具的轮廓更容易记牢。',
    constellationIds: ['Cae'], extraPaths: [hip(32607, 27530, 27321)], targetIds: [],
  },
  {
    id: 'southern-reticulum', stage: 'southern-eridanus', title: '网罟座：四颗星围成的小网格',
    description: '网罟座的四颗主要星围成紧凑的四边形。本图保留时钟的折线作参照，先从熟悉的长形结构转向这个小闭环。',
    tip: '沿四个顶点绕一圈，比较最长和最短的一边。关线后重新数出四颗星，避免把附近的背景星误加成第五个角。',
    constellationIds: ['Ret'], extraPaths: [hip(19747, 12484, 14240)], targetIds: [],
  },
  {
    id: 'southern-dorado', stage: 'southern-eridanus', title: '剑鱼座：小三角接上一条长枝',
    description: '剑鱼座的骨架可以拆成一个小三角和从一角伸出的长枝。本图保留已学的网罟四边形，帮助比较两块相邻而不同的星形。',
    tip: '先找三角，再沿接出的两段线走到末端。这里练的是恒星位置；不要把照片里的大片亮斑或星云当作这张星点图上的顶点。',
    constellationIds: ['Dor'], extraPaths: [hip(19780, 19921, 18597, 17440, 19780)], targetIds: [],
  },
  {
    id: 'southern-hydrus', stage: 'southern-eridanus', title: '水蛇座：极区附近的弯折星链',
    description: '本图保留水委一所在的波江河口，再向更靠南天极的区域认识水蛇座。先抓住相距较远的主要星，再沿较短的折线补全一端。',
    tip: '水蛇座不是春季那条长蛇座，也不是绕着蛇夫的巨蛇座。先说出三者各自的邻区，再关掉连线找回水蛇的几个主要节点。',
    constellationIds: ['Hyi'], extraPaths: [riverMouth], targetIds: [],
  },
  {
    id: 'southern-grus', stage: 'southern-pole', title: '天鹤座：从鹤一找到长颈与分支',
    description: '以较亮的鹤一为起点，先找一侧延伸出的长星链，再观察另一侧的闭合轮廓和分支。用这些部分之间的关系记住天鹤。',
    tip: '先认鹤一的位置，再决定哪一端是长链，哪一端分支较多。旋转后不要固定屏幕上的上方作为鹤的头部。',
    constellationIds: ['Gru'], targetIds: hip(109268),
  },
  {
    id: 'southern-tucana', stage: 'southern-pole', title: '杜鹃座：三叉骨架连接两侧',
    description: '杜鹃座的主要连线在一颗星处分出三个方向。本图保留波江河口，先找到水委一，再比较邻近的三叉结构和各段间距。',
    tip: '用共用的分叉点认形，不必想象完整鸟身。这里只练恒星；小麦哲伦云是星系，不能拿它充当杜鹃骨架上的一颗恒星。',
    constellationIds: ['Tuc'], extraPaths: [riverMouth], targetIds: [],
  },
  {
    id: 'southern-pavo', stage: 'southern-pole', title: '孔雀座：亮星带出一串相连结构',
    description: '先记住孔雀十一这颗显眼的亮星，再沿相连的几块多边形向外展开。图形较长，先学亮星所在的一块，再补其余分支。',
    tip: '“十一”是传统星名的一部分，不表示它是这片天区第十一亮的星。先定位这颗亮星，再沿连接点逐块恢复整个轮廓。',
    constellationIds: ['Pav'], targetIds: hip(100751),
  },
  {
    id: 'southern-indus', stage: 'southern-pole', title: '印第安座：孔雀旁的独立三角',
    description: '本图保留孔雀十一所在的一条边，再认识印第安座的三角骨架。比较三个角的亮度与边长，把它记成独立的一块。',
    tip: '先找孔雀十一，再找旁边的三角；不要把这三颗星接成孔雀的又一片尾羽。对照南三角，说明两者的参照星为什么不同。',
    constellationIds: ['Ind'], extraPaths: [hip(100751, 105858)], targetIds: [],
  },
  {
    id: 'southern-microscopium', stage: 'southern-pole', title: '显微镜座：借天鹤认出暗折线',
    description: '显微镜座的教学骨架是一条三颗星组成的折线。本图保留鹤一向长颈延伸的一段，先用亮星确定区域，再转向较暗的折线。',
    tip: '先在清晰认星模式找到三个顶点，再用自然星空模式复认。不要因为一时看不全暗星，就把更亮的背景星替换进骨架。',
    constellationIds: ['Mic'], extraPaths: [hip(109268, 109111, 108085)], targetIds: [],
  },
  {
    id: 'southern-telescopium', stage: 'southern-pole', title: '望远镜座：南冕旁的一条短线',
    description: '本图保留南冕的弧形片段，再找附近代表望远镜座的两颗主要星。把短线与熟悉的弧形一起记，避免孤立背两颗暗星。',
    tip: '先找弧形，再找独立短线；关线后比较它们之间的空隙。显微镜与望远镜是两个不同星座，名称接近不意味着星形相同。',
    constellationIds: ['Tel'], extraPaths: [hip(91875, 92989, 93174, 93825, 94114)], targetIds: [],
  },
  {
    id: 'southern-apus', stage: 'southern-pole', title: '天燕座：南三角之外的短星链',
    description: '本图保留南三角，再认识更靠近南天极一侧的天燕短链。先记长短不同的两段，然后比较它与三角的相对位置。',
    tip: '用三角确定参照，按端点—转折—端点找回天燕。靠近极区时图形朝向变化很明显，不要把屏幕上下当作固定天空方向。',
    constellationIds: ['Aps'], extraPaths: [southernTriangle], targetIds: [],
  },
  {
    id: 'southern-chamaeleon', stage: 'southern-pole', title: '蝘蜓座：苍蝇旁的细长折线',
    description: '蝘蜓座的教学骨架用三颗主要星形成细长折线。本图保留苍蝇的小四边形，比较两者在极区附近的位置和形状。',
    tip: '先找苍蝇的闭环，再找蝘蜓的开放折线。名字指的是变色龙，但记忆时只需抓住几个星点的实际分布，不必强求动物外形。',
    constellationIds: ['Cha'], extraPaths: [hip(62322, 57363, 61199, 61585, 62322)], targetIds: [],
  },
  {
    id: 'southern-octans', stage: 'southern-pole', title: '南极座：认识没有亮极星的区域',
    description: '南天极位于南极座的天区内，但附近没有像北极星那样醒目的恒星。先认识本图三颗主要星形成的宽三角，不把任一顶点当成南天极。',
    tip: '这三条教学连线没有标出南天极的准确位置。定位极区时应回想南十字和半人马的关系；本课只练南极座骨架，不用暗星猜一个亮极星。',
    constellationIds: ['Oct'], targetIds: [],
  },
  {
    id: 'southern-mensa', stage: 'southern-pole', title: '山案座：完成最暗区域的位置拼图',
    description: '山案座在这套教学画法中以两颗主要星的短线表示。本图保留剑鱼末端的小三角，借邻区记住这块靠近南天极的暗星区域。',
    tip: '先找剑鱼的小三角，再看相邻的短线。完成这一课表示读过全天 88 星座的路线；仍可回到不熟悉的邻区反复关线认形，不必一次背完所有暗星。',
    constellationIds: ['Men'], extraPaths: [hip(27100, 27890, 26069, 27100)], targetIds: [],
  },
]
