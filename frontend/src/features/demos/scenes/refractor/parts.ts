/**
 * Shape-and-position classification for the refractor source model.
 *
 * The source uses generated node names and fallback materials, so neither is useful evidence.
 * Classification instead follows the assembled geometry: the large-aperture end carries two convex
 * objective elements, the small viewing end carries the drawtube, diagonal and eyepiece, a parallel
 * off-axis optical tube is the finder, and everything below the tube separates into rings/saddle,
 * equatorial head, counterweight assembly and tripod.
 */
export const REFRACTOR_PARTS = [
  {
    id: 'opticalTube',
    label: '主镜筒与遮光罩',
    highlight: 0x2fd0c8,
    kind: 'mechanical',
    description: '沿主光轴延伸约 643 mm 的连续筒壳。大直径前段包围物镜并起遮光罩作用，中段是主镜筒，后段收窄后连接调焦座。',
  },
  {
    id: 'objectiveCell',
    label: '物镜座与压圈',
    highlight: 0xffb648,
    kind: 'mechanical',
    description: '位于主镜筒物镜端、紧贴两片大口径镜片外缘的同轴阶梯圆筒，用于承托、居中和压紧物镜组。',
  },
  {
    id: 'objectiveLens',
    label: '物镜组',
    highlight: 0x35c6ff,
    kind: 'optical',
    description: '物镜端的两片大口径凸面光学件，完全共轴并填满镜室通光口；形状与位置对应消色差折射镜常见的双片物镜组。光路模式另叠加理想球面近似用于演示折射。',
  },
  {
    id: 'tubeRings',
    label: '镜筒环与燕尾板',
    highlight: 0xf4c95d,
    kind: 'mechanical',
    description: '环抱主镜筒的两只开口圆环、下方弧形托座和沿镜筒方向延伸的安装板；它们把镜筒固定到赤道仪鞍座。',
  },
  {
    id: 'fasteners',
    label: '螺钉、螺帽与紧固旋钮',
    highlight: 0xff5f6d,
    kind: 'mechanical',
    description: '分布在寻星镜、调焦座、镜筒环、赤道仪、配重和三脚架上的螺钉、螺帽式紧固件、夹紧旋钮与锁紧扳手，共同负责校准、夹持和锁止。',
  },
  {
    id: 'finderScope',
    label: '寻星镜与支架',
    highlight: 0x7ee08f,
    kind: 'optical',
    description: '位于主镜筒上方、与主光轴平行的小口径镜筒总成，包括前后小镜片、镜筒、安装座和三颗校准螺钉。',
  },
  {
    id: 'focuser',
    label: '调焦座与调焦筒',
    highlight: 0xff9142,
    kind: 'mechanical',
    description: '位于主镜筒目镜端的同轴后座、可移动抽拉筒和成对调焦手轮；转动手轮可改变目镜相对焦平面的位置。',
  },
  {
    id: 'diagonal',
    label: '天顶镜',
    highlight: 0xff7ad1,
    kind: 'optical',
    description: '位于调焦筒与目镜之间的转角壳体、插筒和内部斜置反射面，把主光路折转到便于观测的方向。',
  },
  {
    id: 'eyepieceLensGroup',
    label: '目镜',
    highlight: 0x9b7bff,
    kind: 'optical',
    description: '天顶镜末端的小口径目镜镜片与外部黑色目镜筒，位于主光路的观测端。镜片用于放大物镜在焦平面形成的像，镜筒负责承托与遮光；光路模式使用理想化目镜近似。',
  },
  {
    id: 'mount',
    label: '赤道仪本体与控制件',
    highlight: 0x6f9cff,
    kind: 'mechanical',
    description: '镜筒下方的赤经轴、赤纬轴、极轴座及其锁紧和微调旋钮；这些相交的旋转轴支承镜筒并用于指向与跟踪。',
  },
  {
    id: 'counterweight',
    label: '配重与配重杆',
    highlight: 0xf08a5d,
    kind: 'mechanical',
    description: '从赤纬轴向镜筒反方向伸出的长杆、杆端锁止件和圆盘形配重，用于平衡镜筒对赤道仪产生的力矩。',
  },
  {
    id: 'tripod',
    label: '三脚架与撑条',
    highlight: 0x66d9c8,
    kind: 'mechanical',
    description: '赤道仪下方的三根两段式支腿、脚垫、伸缩锁扣、三根水平撑条及中央连接座，共同提供落地支承并限制支腿张开。',
  },
] as const

export type PartId = typeof REFRACTOR_PARTS[number]['id']
export type PartKind = typeof REFRACTOR_PARTS[number]['kind']

export function isPartId(value: unknown): value is PartId {
  return typeof value === 'string' && REFRACTOR_PARTS.some((part) => part.id === value)
}

export function partDefinition(id: PartId) {
  return REFRACTOR_PARTS.find((part) => part.id === id)!
}
