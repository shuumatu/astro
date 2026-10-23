# UI 主题研究：辇道增七与天之川沙夜

核实日期：2026-10-21。用于本次网站 UI 与配色调整；区分来源事实与界面设计诠释。

## 参考来源与核实结果

- 用户提供的[维基百科「辇道增七」](https://zh.wikipedia.org/wiki/%E8%BC%A6%E9%81%93%E5%A2%9E%E4%B8%83)用于确认中文名称与 Albireo 的对应关系；天文视觉特征另以 NASA 资料核实。
- 用户提供的[萌娘百科「天之川沙夜」](https://zh.moegirl.org.cn/%E5%A4%A9%E4%B9%8B%E5%B7%9D%E6%B2%99%E5%A4%9C)直接抓取受 JavaScript 限制，未把该页未读取的内容当作已核实依据。角色身份、视觉与世界观使用制作方 PULLTOP 原始资料交叉确认。
- [PULLTOP 原版角色页](https://www.pulltop.com/full-of-stars/chara.html)及[全年龄版 Light Signal 角色页](https://pulltop.com/full-of-stars_LS/chara.html)：天ノ川沙夜来自《仰望夜空的星辰》（見上げてごらん、夜空の星を）。[官方介绍图](https://pulltop.com/full-of-stars_LS/images/chara/chara_saya_info01.png)明确描述其双眼为深蓝色与偏黄色的橙色；[官方立绘](https://pulltop.com/full-of-stars_LS/images/chara/chara_saya.png)可见银白长发、海军蓝开衫、蓝色格裙、白衬衫、红领结与青绿色发带/花形发饰。
- [PULLTOP 世界观页](https://pulltop.com/full-of-stars_LS/world.html)：共同观星、童年回忆与秘密天文台构成主题；官方强调清澈凛冽的冬景，并介绍使用 Hipparcos/Tycho-2 星表生成星空的方式。因此界面取安静、清透的夜空气质，避免密集装饰干扰天文内容。
- [NASA：Summer Triangle Corner: Deneb](https://science.nasa.gov/solar-system/skywatching/night-sky-network/summer-triangle-corner-deneb/)明确描述 Albireo 在望远镜中呈现金色与蓝色的目视双星，位于天鹅座鸟喙、夏季大三角内部。**Albireo 不是夏季大三角的顶点**；三颗顶点星为织女星、牛郎星与天津四。
- [Jack 等，A&A 661, A49 (2022)](https://arxiv.org/abs/2203.04222)明确指出 Albireo A、B 是否受引力束缚仍不确定。这里的金蓝双星意象只表达目视配对，不宣称 A、B 存在已确定的互绕轨道；也不混淆 A 分量内部的多星结构。

## 实施配色

| 色彩 | HEX | 界面用途与依据 |
| --- | --- | --- |
| 夜空 | `#090e1b` | 页面深色基底，承接观星主题 |
| 银白 | `#edf1fa` | 主要文字与亮部，呼应银白长发与星光 |
| 金色 | `#e9c582` | 重点、主操作与暖星光，呼应 Albireo 和沙夜暖色瞳 |
| 蓝色 | `#8abcf4` | 次强调、链接与冷星光，与金色组成双重点 |
| 淡紫 | `#b8a9dc` | 克制的辅助层次，调和冷暖色 |
| 表面 | `#10192a` | 卡片、面板背景，与夜空基底形成层级 |

以上 HEX 均为面向网站可读性与层级的**设计诠释**，不是官方角色色值、天体真实色度测量或从图片精确采样所得；淡紫尤其属于补充设计色。

## 明亮主题与切换

明亮主题将银白意象延伸为阅读底色，并加深金蓝强调色，让文字在浅色表面保持清晰。

| 用途 | 黑暗主题 | 明亮主题 |
| --- | --- | --- |
| 页面背景 | `#090e1b` | `#f5f6fa` |
| 卡片表面 | `#10192a` | `#ffffff` |
| 主要文字 | `#edf1fa` | `#202e46` |
| 辅助文字 | `#a6b2c9` | `#52627a` |
| 琥珀金 | `#e9c582` | `#8b621c` |
| 星辰蓝 | `#8abcf4` | `#32669b` |

导航栏的太阳/月亮按钮切换主题；首次访问跟随系统，手动选择后保存到本地并跨标签页同步。主题在页面首次绘制前初始化。星空及三维场景保持真实的夜色背景，界面控件与阅读面板使用主题色；科学图示中的含义色不受主题切换影响。

## 图形与使用边界

只借鉴银白、金蓝、夜空与观星的视觉关系，**不直接使用角色立绘或游戏图片作为网站素材**。金蓝星点与细线使用本地 CSS / SVG 表达；SVG 圆环表示望远镜目镜视野及观察刻度，**不是 Albireo 的轨道示意图**，星点大小和距离也不表示真实比例。

## 星芒色带：CD 反射光栅参考

核实日期：2026-10-22。用户希望星芒接近 CD 反光的彩虹质感，因此将此前青、粉、紫的循环变色改为按波长顺序排列的细色带。

- [哥白尼大学物理教学：CD spectrometer](https://dydaktyka.fizyka.umk.pl/zabawki1/files/optyka/cd_big-en.html)：CD 的密集轨道构成反射光栅，衍射方向与波长及观察角度有关；转动光碟时可见颜色发生变化。设计借鉴同一衍射级次中短波到长波的空间排序，使用蓝、青、绿、黄、橙红的连续过渡。
- [NASA：Webb’s Diffraction Spikes](https://science.nasa.gov/asset/webb/webbs-diffraction-spikes/)：望远镜的星芒受主镜形状、副镜支架等光瞳结构影响。CD 光栅和望远镜星芒都涉及衍射，但并非同一种图样；首页是**受光栅色散启发的艺术化效果，不是望远镜点扩散函数的物理模拟**。
- [NASA APOD：Beautiful Albireo AB](https://science.nasa.gov/image-article/apod-2022-february-24-beautiful-albireo-ab/)：Albireo 的两颗亮分量在望远镜中呈现金蓝差异，其光谱也包含可见范围内的其他波长。保留金蓝光晕及白亮核；移除粉紫循环是设计修正，不表示自然光谱不存在紫光。

黑暗主题中固定色序与色带范围，让彩色细边缓慢淡入淡出；彩色层透明度在 0–0.4 之间变化，两颗星分别以 18 秒和 22 秒为周期。基础星芒及星核位置保持不动。色值是屏幕上的视觉近似，不声称为校准过的光谱色度。明亮主题隐藏全部衍射星芒，仅保留圆形亮核和金蓝光晕；系统选择减少动态效果时保持静态。
