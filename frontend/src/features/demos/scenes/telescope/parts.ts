/** Reviewed against tools/audit-telescope.py atlases, then stored on each GLB node as extras.partId. */
export const TELESCOPE_PARTS = [
  { id: 'tube', label: '镜筒与前口环', color: 0x6ed6d8, description: '容纳光学系统的圆筒外壳与前端口环。寻星镜、蜘蛛架、抱箍和支架已从原来的合并网格中分离。' },
  { id: 'spider', label: '蜘蛛架与副镜支座', color: 0xceafff, description: '镜筒前端的十字支臂及中心支座，用于支撑副镜；不是调焦旋钮。' },
  { id: 'mirrorCell', label: '后端支撑环与支座', color: 0xe6bc76, description: '位于镜筒后端的圆环、十字支撑与中心座。后端支撑不同于前端蜘蛛架，也不能据此认定存在面形正确的主镜。' },
  { id: 'internalDisk', label: '筒内带孔圆盘', color: 0xe4b59d, description: '镜筒中段的厚圆盘，中央有孔。形状和位置可以确认，但没有依据把它认定为主镜；它会遮挡这里的牛反光束，光路教学中将其隐藏。' },
  { id: 'primaryMirror', label: '主镜（抛物面）', color: 0xffc56e, description: '新增的可选中光学几何：凹面抛物镜，位于镜筒后端，承担集光和物镜作用。尺寸为教学模型参数。' },
  { id: 'secondaryMirror', label: '副镜（平面椭圆）', color: 0x8fe7ff, description: '新增的可选中光学几何：约 45° 放置的平面椭圆镜，把会聚光束折向侧面调焦座。尺寸为教学模型参数。' },
  { id: 'finder', label: '寻星镜与支座', color: 0x91dfaa, description: '主镜筒上方独立的小型望远镜与支撑杆，用于寻找目标，不属于主望远镜的成像光路。' },
  { id: 'focuser', label: '调焦座、手轮与目镜筒', color: 0xf6a6d8, description: '镜筒前部侧面的套筒、双手轮和目镜外壳，用于移动目镜位置完成调焦。' },
  { id: 'rings', label: '镜筒抱箍与安装座', color: 0xf7d675, description: '环抱镜筒的两个圆环及下方安装座，把镜筒连接到赤道仪。' },
  { id: 'mount', label: '赤道仪与调节机构', color: 0x93b6ff, description: '镜筒下方的转轴外壳、底座和调节手柄，控制望远镜指向；不包括镜筒和配重。' },
  { id: 'counterweight', label: '配重片与配重杆', color: 0xf19f79, description: '赤道仪下方倾斜长杆及其末端的圆形配重片，用来平衡镜筒重量。' },
  { id: 'tripod', label: '三脚架与中央拉杆', color: 0x8de4d4, description: '三根长支腿及中央拉杆，提供落地支撑。附件托盘单独分类。' },
  { id: 'tray', label: '附件托盘与撑条', color: 0xcea6ed, description: '三脚架之间带圆孔的托盘及三条撑条，可放置目镜并限制支腿张开。' },
  { id: 'hardware', label: '螺钉、螺帽与紧固旋钮', color: 0xb9c9dd, description: '分布在各机构上的六角件、螺钉头和手拧紧固件。按形状归类，不把它们当成完整调焦或光学组件。' },
] as const
export type PartId = typeof TELESCOPE_PARTS[number]['id']
export function isPartId(value: unknown): value is PartId {
  return TELESCOPE_PARTS.some((part) => part.id === value)
}
