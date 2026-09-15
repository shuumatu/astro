/**
 * Reviewed part taxonomy for the refractor demo.
 *
 * Every id was assigned by `tools/refractor-classify.py` from measurements only: each source
 * fragment's axial band and radial band about the measured optical axis, its offset from that axis
 * and its mean world height. No node name and no material name took part - every node in the source
 * is called `Obj3d66-632255-*` and every material is `fallback Material`, and the source carries no
 * textures, no images and no text geometry at all.
 *
 * The measured layout, with s along the tube from the objective end (negative) to the eyepiece end
 * (positive), in millimetres:
 *
 *     -339 .. +305   the 643 mm tube shell, exactly coaxial, r 23.6 mm at -s to 59.5 mm at +s
 *     -294 .. -272   two solid discs spanning the whole 108.8 mm bore, exactly coaxial
 *     -443 .. +442   the coaxial train of narrow rings along the axis
 *     -113 ..  +12   the focuser, 61..74 mm off the axis at height 1.10..1.15 m
 *        +8 .. +103  the finder, 64..85 mm off the axis at height 1.20..1.23 m
 *     +272 .. +294   the front cell and the rings that retain its lens
 *     +116 .. +667   the mount castings and linkage, 119..410 mm off the axis
 *     +622 .. +1215  the counterweight drum and the tripod legs
 *
 * `highlight` is only ever used for the selection glow and the list swatch; the model's own colour
 * comes from the classified GLB, which the builder paints to match the reference photograph.
 *
 * `objectiveLens` and `eyepieceLensGroup` are teaching additions. The source contains no lens
 * geometry at all - it has no spherical surface anywhere - so they are marked separately in the
 * interface rather than presented as recovered parts.
 */
export const REFRACTOR_PARTS = [
  {
    id: 'objectiveCell',
    label: '物镜座（前端镜室）',
    highlight: 0xffb648,
    kind: 'mechanical',
    description: '镜筒前端开口（s +272…+294 mm）处的同轴支承与镜片座：一组阶梯环，外径 63…196 mm、偏离光轴 31.5…98.3 mm，另有一只 200 mm 的接圈（s +406.5…+448.7 mm）。它们夹持并居中前端的镜片，本身不是镜片。',
  },
  {
    id: 'lensRetainer',
    label: '镜片压圈',
    highlight: 0xe05c7a,
    kind: 'mechanical',
    description: '压在物镜上的几圈环：内孔 75…119 mm 与 51…94 mm，比镜室孔径小，因此是压圈；另有 s −295.2…−271.1 mm 与 s −443.5…−412.5 mm 两处的同轴边环。',
  },
  {
    id: 'opticalTube',
    label: '主镜筒',
    highlight: 0x2fd0c8,
    kind: 'mechanical',
    description: '全长 643 mm 的单一壳体：94.5% 面积是绕同一轴的圆柱壁，同心半径实测 23.6 / 41.2 / 48.9 / 59.5 mm，一端收窄到 47.2 mm 喉口、另一端外扩。这是全模型唯一既这么长又与实测光轴完全同轴（偏心 0.0 mm）的零件，本演示的光轴即取自它。',
  },
  {
    id: 'dewShield',
    label: '遮光罩 / 内部挡板',
    highlight: 0x59c2ff,
    kind: 'mechanical',
    description: '两片横跨整个内孔的实心圆盘（直径 108.8 mm、厚 7…8 mm，完全同轴，位于 s −294.2…−272.5 mm）。圆盘是实心的，会挡住光轴，因此更像遮光挡板或端盖，而不是光学件。',
  },
  {
    id: 'objectiveLens',
    label: '物镜（教学补建双胶合）',
    highlight: 0x35c6ff,
    kind: 'teaching',
    description: '本项目新增的教学光学元件：球面冕牌 + 火石双胶合，有前后表面与侧壁厚度，镜坯直径 35 mm、中心厚 10 mm，位于实测前端喉口内。原始模型没有任何镜片几何，这是补建件，不是厂家镜片处方。',
  },
  {
    id: 'eyepieceLensGroup',
    label: '目镜镜片组（教学补建）',
    highlight: 0x9b7bff,
    kind: 'teaching',
    description: '本项目新增的教学光学元件：位于实测同轴筒件内的双凸目镜，直径 26 mm、中心厚 3.5 mm，焦距 30 mm，其前焦点与物镜焦平面重合，出射光因此接近平行。原始模型没有目镜镜片。',
  },
  {
    id: 'eyepieceHolder',
    label: '目镜座与同轴筒件',
    highlight: 0xff7ad1,
    kind: 'mechanical',
    description: '沿光轴的一串同轴筒件：内孔 18.2 mm、94.3% 面积为圆柱壁的抽拉筒（s +367.4…+407.0 mm），以及 23.0…24.6 mm、30…39 mm 的接圈。它们与光轴夹角 0.0°、偏心 0.3 mm 以内，是安放目镜的位置。',
  },
  {
    id: 'focuser',
    label: '调焦机构',
    highlight: 0xff9142,
    kind: 'mechanical',
    description: '装在镜筒侧面的调焦机构，偏离光轴 60.6…73.7 mm、跨 s −12.9…+112.6 mm、高度 1.10…1.15 m：两对滚花手轮（外径 106…143 mm 与 122…153 mm）与一只与镜筒同轴的外壳（半径 56.1…67.4 mm）。',
  },
  {
    id: 'finderScope',
    label: '寻星镜',
    highlight: 0x7ee08f,
    kind: 'mechanical',
    description: '骑在镜筒上侧的一套小总成：偏离光轴 64.2…84.7 mm、跨 s −6.2…+110.9 mm、高度 1.20…1.23 m（比调焦机构更高）。它不在光轴上，不参与主光路。',
  },
  {
    id: 'mount',
    label: '赤道仪立柱与本体',
    highlight: 0x6f9cff,
    kind: 'mechanical',
    description: '镜筒下方的铸件与连杆，偏离光轴 119…410 mm：6412 面的立柱（半径 208.7…426.0 mm）、本体铸件（半径 87.6…280.1 mm）、第二只铸件、若干接圈及其连杆。',
  },
  {
    id: 'counterweight',
    label: '配重与配重杆',
    highlight: 0xf08a5d,
    kind: 'mechanical',
    description: '远离光轴的平衡件：半径 892…930 mm 的配重鼓（s −596.7…−536.9 mm）与半径 622…791 mm 的配重杆组（s −279.5…−243.7 mm）。',
  },
  {
    id: 'tripod',
    label: '三脚架与撑条',
    highlight: 0x66d9c8,
    kind: 'mechanical',
    description: '落地端：多根长构件，自身圆柱拟合半径 376…1190 mm，跨 s −761.0…−189.0 mm，外加端部尖脚与 X 形撑条。',
  },
  {
    id: 'hardware',
    label: '小型接件',
    highlight: 0xa8b6c8,
    kind: 'mechanical',
    description: '测量结果无法归入上述任一组件的小型接件：偏离光轴 106…147 mm、跨 s +299.7…+309.2 mm，单件都不足 400 面。按位置归类，不把它们当作完整的功能组件。',
  },
  {
    id: 'unknown',
    label: '未确认机械件',
    highlight: 0x8a94a6,
    kind: 'unresolved',
    description: '全模型最大的单个零件（6412 面），偏离光轴 321 mm、位于高度 0.73…0.93 m，内孔与镜筒内径不一致。测量能确定它的位置和形状，但不足以确定它的功能，因此保留为未确认，不编造用途。',
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
