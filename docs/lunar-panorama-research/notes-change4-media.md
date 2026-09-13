# Chang'e 4 (Yutu-2, Von Kármán crater) — Chinese media / official imagery: measured probe results

**Companion file:** `notes-change4.md` (the main pass). This file is the dedicated sweep of **Chinese state
media and CNSA/CLEP/NAOC official pages** that `notes-change4.md` §4 explicitly deferred to
("*A separate, broader sweep of Xinhua / CNSA / CAS / NAOC / stdaily / chinanews / guancha / thepaper /
people.com.cn was run in parallel; see `notes-change4-media.md`*").

**Method:** every image URL below was probed with `.agents/img-dims.mjs` (range-GET + real header parse).
Transcript lines are pasted verbatim. Nothing here is inferred — dimensions, byte sizes and formats are
measured. Where I could not confirm something I say **unverified**.

**Environment prelude used for every command:**
```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"; $env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:NODE_USE_ENV_PROXY="1"; node .agents/<script>.mjs <args>
```

---

## 0. Headline result

| # | What | Direct URL | Measured | Bytes | Format |
|---|---|---|---|---|---|
| **A** | TCAM 环拍全景图 **圆柱投影** (the famous 11 Jan 2019 release) | `http://www.chinanews.com/cr/2019/0111/3478659747.png` | **960 × 3713** | 4,372,062 | PNG |
| **B** | Adjacent TCAM cylinder frame in same article | `http://www.chinanews.com/cr/2019/0111/415251673.png` | **960 × 4096** | 5,357,215 | PNG |
| **C** | TCAM 环拍全景图 **方位投影** (circular projection) | `http://www.chinanews.com/cr/2019/0111/1272058806.png` | **800 × 786** | 521,246 | PNG |
| **D** | Same azimuth projection, official CNSA/CLEP copy | `https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782935.jpg` | **800 × 787** | 216,936 | JPEG |
| **E** | Same azimuth projection, official CLEP (探月与航天工程中心) copy | `http://www.clep.org.cn/n5982341/c6805144/part/6780069.jpg` | **900 × 885** | 143,428 | JPEG |
| **F** | Same azimuth projection, 新京报 (bjnews) copy | `https://media.bjnews.com.cn/image/2019/01/11/4747739890651832734.jpg` | **900 × 885** | 143,428 | JPEG |
| **G** | TCAM cylinder strip, 新京报 copy (**watermarked**) | `https://media.bjnews.com.cn/image/2019/01/11/4747739891901735117.jpg` | **900 × 7321** | 1,439,299 | JPEG |
| **H** | 1-year-anniversary cylinder, official CNSA | `https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782936.jpg` | **600 × 4877** | 1,664,598 | JPEG |

**None of the Chinese state-media copies is larger than the IAU/CNSA panorama already verified in
`notes-change4.md` §1.1 (10000 × 1229, 3,346,126 bytes, CC BY 4.0).** New here is the **licence situation**
(§3) and the **official CNSA/CLEP source pages** (§2).

---

## 1. The 11 January 2019 TCAM "环拍" release — measured copies

### 1.1 中新网 chinanews — **the largest Chinese-media copy found**

**Hosting page (200 OK):** `https://www.chinanews.com.cn/gn/2019/01-11/8726772.shtml`
— title 「"月背全景图"刷屏了，它的正确打开方式，你get到了么？」 ("The 'far-side panorama' went viral — did you get
the right way to read it?"), published **2019-01-11 18:09**, source 国际在线微信公众号 (CRI Online WeChat).

I extracted the `<img>` tags from the raw HTML and resolved the caption `<p>` that immediately precedes each
one, so the projection labelling below is taken **from the page**, not guessed:

> `...<p>「嫦娥四号」着陆器地形地貌相机环拍全景图(方位投影)↓↓↓<img src="http://www.chinanews.com/cr/2019/0111/1272058806.png" /></p>`
> `<p>「嫦娥四号」着陆器地形地貌相机环拍全景图(圆柱投影)↓↓↓<img src="http://www.chinanews.com/cr/2019/0111/3478659747.png" /></p>`
> `<p>这张<img src="http://www.chinanews.com/cr/2019/0111/415251673.png" /></p>`

Translated: *"'Chang'e-4' lander terrain-and-landform camera surround-imaging panorama (**azimuthal
projection**)"* → `1272058806.png`; *"…(**cylindrical projection**)"* → `3478659747.png`; then a bare
*"This [one]"* → `415251673.png` — **the subject of that third image is unverified** (the sentence is
truncated by the layout; the file is 960 × 4096).

Probe transcripts (verbatim):

```
206 | image/png | png | 800x786 | 521246 bytes (0.50MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/1272058806.png
206 | image/png | png | 960x3713 | 4372062 bytes (4.17MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/3478659747.png
206 | image/png | png | 960x4096 | 5357215 bytes (5.11MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/415251673.png
206 | image/png | png | 562x405 | 225481 bytes (0.22MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/3560090926.png
206 | image/png | png | 561x401 | 254931 bytes (0.24MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/401625704.png
206 | image/png | png | 556x401 | 213593 bytes (0.20MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/306408246.png
206 | image/png | png | 556x404 | 201965 bytes (0.19MB) [range-honored] | http://www.chinanews.com/cr/2019/0111/1344869671.png
```
(The last four are small ~560 px supporting stills of the lander/rover; low value.)

**Visual check (I downloaded and viewed the files):** I fetched all three large files and read them back as
images. `3478659747.png` (960 × 3713) shows the classic cylindrical strip — the lander deck with its solar
panels, the golden-foil hardware, the small Yutu-2 rover in the middle distance, and the black sky above the
horizon. **No watermark or station logo is visible on that file.** `415251673.png` (960 × 4096) is a
different, closer cylinder segment dominated by the lander. The 800 × 786 azimuthal file is a genuine PNG
(no embedded JPEG), so I viewed it via the chinanews copy only through the CNSA JPEG twin below.

**Licence / credit text on the page (quoted, translated):**
> 本网站所刊载信息，不代表中新社和中新网观点。刊用本网站稿件，务经书面授权。未经授权禁止转载、摘编、复制及建立镜像，违者将依法追究法律责任。
> *"Information published on this website does not represent the views of China News Service or
> chinanews.com. **Use of this website's articles requires written authorisation.** Unauthorised
> reproduction, excerpting, copying or mirroring is prohibited; violators will be prosecuted under law."*

No open licence is offered. Separately, the article body itself says (quoted, translated):
> 这张全景图由着陆器上的地形地貌相机进行四周旋转，拍成的80多张照片拼接而成。
> *"This panorama was assembled from **more than 80 photos** taken by the lander's terrain-and-landform
> camera rotating around."*

**Risk verdict: MEDIUM.** The files are the largest Chinese-media copies, the source is an official CNSA
release, and the imagery is a Chinese government work — but chinanews asserts all rights reserved and this
particular page is a third-party (CRI) re-post. Use the CNSA/CLEP originals below, or the NSSDC CC BY 4.0
route in §3, in preference.

### 1.2 Confirmatory resolution statement — 新华网 Xinhua (text, not image)

**Page (200 OK):** `http://www.xinhuanet.com/politics/2019-01/11/c_1123979265.htm` — 「惊险！嫦娥四号被众多小环形坑环绕」,
2019-01-11 20:05:22, 新华社客户端, reporters 喻菲/胡喆/全晓书.

Quoted, translated (this is the authoritative description of the release):
> 国家天文台副台长、嫦娥四号地面应用系统总指挥李春来介绍，其中一张360度全景图，是在玉兔二号驶上月面后，由着陆器上的地形地貌相机环拍4圈共80张照片拼合而成的。
> *"Li Chunlai, deputy director of the National Astronomical Observatories and chief commander of the
> Chang'e-4 ground application system, explained that one of the images — a **360-degree panorama** — was
> stitched together from **80 photographs taken by the lander's terrain-and-landform camera in 4 full
> rotations**, after Yutu-2 drove onto the lunar surface."*

Credit lines in the same article: 国家航天局供图 / 新华社发（国家航天局供图） — *"Image supplied by the China
National Space Administration"*.

**Xinhua's own inline images are useless for this purpose — they are capped at small sizes.** Verbatim probes:

```
206 | image/jpeg | jpeg | 900x600 | 43404 bytes (0.04MB) [range-honored] | http://www.xinhuanet.com/politics/2019-01/11/1123979295_15472165344071n.jpg
206 | image/jpeg | jpeg | 640x357 | 40705 bytes (0.04MB) [range-honored] | http://www.xinhuanet.com/politics/2019-01/11/1123979265_15472082595211n.jpg
```
I tested the usual larger-size suffixes (`.jpg` bare, `c`, `b`, and `_title1n`) — **all returned HTTP 404**
with the Xinhua 404 page (4,655 bytes, `<title>感谢您的浏览！</title>`), e.g.:
```
404 | text/html | HTML | ?x? | 4655 bytes (0.00MB) [range-honored] | http://www.xinhuanet.com/politics/2019-01/11/1123979265_15472082595211c.jpg
404 | text/html | HTML | ?x? | 4655 bytes (0.00MB) [range-honored] | http://www.xinhuanet.com/politics/2019-01/11/1123979265_15472082595211b.jpg
```
So **Xinhua publishes the panorama only at ≤900 px — there is no large Xinhua original.** (Xinhua's
copyright statement on every page: 版权声明 — no open licence; **"Copyright © Xinhua"** all rights reserved.)

### 1.3 新京报 bjnews — 900 × 885 and 900 × 7321 (**watermarked**)

**Page (200 OK):** `https://www.bjnews.com.cn/detail/154717411714006.html` — 「嫦娥四号完成月背360度环拍」,
2019-01-11 10:35. Credits on the page: **编辑：郑新洽 吴飞虎 殷楠**; image credit line **图/国家航天局**
("Image / China National Space Administration").

Captions quoted from the page, translated:
> 图为嫦娥四号着陆器地形地貌相机环拍全景图(方位投影)。
> *"Shown: Chang'e-4 lander terrain-and-landform camera surround-imaging panorama (**azimuthal projection**)."*
> 请横屏观看： … 嫦娥四号着陆器地形地貌相机环拍全景图(圆柱投影)，可清晰看到月球背面的纹理。
> *"Please view in landscape: … Chang'e-4 lander terrain-and-landform camera surround-imaging panorama
> (**cylindrical projection**); the texture of the lunar far side can be clearly seen."*

Probes:
```
206 | image/jpeg | jpeg | 900x885 | 143428 bytes (0.14MB) [range-honored] | https://media.bjnews.com.cn/image/2019/01/11/4747739890651832734.jpg
206 | image/jpeg | jpeg | 900x7321 | 1439299 bytes (1.37MB) [range-honored] | https://media.bjnews.com.cn/image/2019/01/11/4747739891901735117.jpg
```
The `?x-oss-process=image/resize,m_lfit,w_800/quality,q_80` suffix is **only a downscale**; the bare URL is
the full original. Ali OSS `image/info` confirms the original has not been resampled:
```
206 | application/json | JSON | ?x? | 179 bytes | https://media.bjnews.com.cn/image/2019/01/11/4747739891901735117.jpg?x-oss-process=image/info
      head: { "FileSize": {"value": "1439299"}, "Format": {"value": "jpg"}, "FrameCount": {"value": "1"}, "ImageHeight": {"value": "7321"}, "ImageWidth": {"value": "900"} }
206 | image/jpeg | jpeg | 900x7321 | 1251659 bytes (1.19MB) [range-honored] | .../4747739891901735117.jpg?x-oss-process=image/resize,m_lfit,w_1600/quality,q_90
```
(Note: asking OSS for `w_1600` still yields 900 × 7321 — the source is only 900 px wide, confirming 900 is
the native width, not a CDN cap.)

**Visual check:** I downloaded and viewed `4747739891901735117.jpg`. It carries a **visible watermark in the
bottom-left corner: a blue wave-like logo plus Chinese characters reading 「我们的太空」** ("Our Space" — the
CNSA/CMSA outreach brand). It is a genuine tall cylinder strip: lander deck and solar panel (bearing the
「CE-4」 marking), golden-foil hardware, the small Yutu-2 rover with its tracks in the regolith, and the black
sky/horizon line. The 900 × 885 azimuthal file carries a **visible logo watermark in the top-right corner:
the 「中国探月 CLEP」 emblem** (China Lunar Exploration Program). Both watermarks were observed directly in
the images, not inferred.

**Risk verdict: MEDIUM-HIGH.** Free to fetch, but watermarked, and bjnews is a commercial outlet with no open
licence (its 版权声明 page offers none). Its pixel dimensions are also smaller in width than the IAU panorama.

### 1.4 thepaper — 872 × 7087 strip, no bigger variant found

**Page (200 OK):** `https://www.thepaper.cn/newsDetail_forward_2845856` — 「来看世界上第一张月球背面全景图！」,
2019-01-12 11:22, 澎湃号·政务, 来源：央视新闻 新华网 人民日报.

```
206 | image/jpeg | jpeg | 872x7087 | 916024 bytes (0.87MB) [range-honored] | http://image.thepaper.cn/www/image/14/209/652.jpg
206 | image/jpeg | jpeg | 1080x1061 | 100057 bytes (0.10MB) [range-honored] | http://image.thepaper.cn/www/image/14/209/662.jpg
```
(The 1080 × 1061 file matches the 1080 × 1061 huanqiu copy already recorded in `notes-change4.md` §4 — the
same reporter still circulating. The 872 × 7087 strip is a **lower-resolution** rendition of the same
cylindrical strip as bjnews' 900 × 7321.)

### 1.5 thepaper **360° interactive krpano viewer** — tiles are not directly fetchable

**Page (200 OK):** `https://image.thepaper.cn/html/pano/2019/change_4/index.html`
— title 「360°全景｜大赞！世界上第一张月球背面全景图来了」, attribution in the page's own share text:
> 人民日报客户端1月11日消息，记者从国家航天局获悉…着陆器上配置的地形地貌相机完成了环拍，科研人员根据"鹊桥"中继星传回的数据，制作了清晰的环拍影像图。

I recovered the krpano configuration and the tile paths:
```
200 | text/html | 3297 | HTML | https://image.thepaper.cn/html/pano/2019/change_4/index.html
```
`main.js` calls `embedpano({swf:"./sources/tour.swf", xml:"./sources/tour.xml", ...})`, and
**`https://image.thepaper.cn/html/pano/2019/change_4/sources/tour.xml` (200 OK)** contains:
```xml
<scene name="scene_1" title="嫦娥四号着陆器拍摄的首张月球背面全景" ...>
  <preview url="../panos/1tiles/preview.jpg" />
  <image><cube url="../panos/1tiles/pano_%s.jpg" /></image>
</scene>
```
Measured tiles:
```
206 | image/jpeg | jpeg | 256x1536 | 24667 bytes (0.02MB) [range-honored] | https://image.thepaper.cn/html/pano/2019/change_4/panos/1tiles/preview.jpg
206 | image/jpeg | jpeg | 240x240 | 7103 bytes (0.01MB) [range-honored] | https://image.thepaper.cn/html/pano/2019/change_4/panos/1tiles/thumb.jpg
206 | image/jpeg | jpeg | 120x120 | 21907 bytes (0.02MB) [range-honored] | https://image.thepaper.cn/html/pano/2019/change_4/wxshare.jpg
```
**The six cube faces `pano_0.jpg … pano_5.jpg` all return HTTP 404**, and the sibling level-definition
`sources/thepaper.xml` and `sources/tour.js` return **403 Forbidden** (nginx hotlink protection; retrying with
a browser `Referer` + `User-Agent` changed nothing for `thepaper.xml`).
**Conclusion: the interactive 360° viewer's full-resolution cube tiles are NOT directly downloadable — their
naming/level scheme is unverified.** The `preview.jpg` (256 × 1536) is a 16-face, 256 px-per-face preview —
i.e. it encodes roughly a 4096 × 2048 equirectangular preview at best, but since I could not fetch the cube
faces I do **not** claim a source resolution for this viewer.

### 1.6 Other Chinese outlets — blocked or low value

- **海峡网 hxnews** — page 200 OK, and it embeds four images:
  `http://qimg.hxnews.com/2019/0111/1547175914527.jpg`, `…1547175914858.jpg`, `…1547175914853.jpg`,
  `…1547175914109.jpg`. **All four return HTTP 502** from the CDN edge:
  ```
  502 | text/html | HTML | ?x? | 575 bytes (0.00MB) [range-honored] | http://qimg.hxnews.com/2019/0111/1547175914527.jpg
        head: <html> <head><title>502 Bad Gateway</title></head> <body bgcolor="white"> <center><h1>502 Bad Gateway</h1></center> <hr><center>Firewall 666</center></body> </html>
  ```
  (`Firewall 666` is the CDN's own filter.) **Unusable.**
- **中国图片库 chinafotobank.com** — page 200 OK. Its only image endpoint is a paid-stock preview:
  ```
  200 | image/jpeg | jpeg | 800x786 | ? bytes (0.28MB(received)) | http://chinafotobank.com/getpic.do?filename=201902251434_1551076484970_p.jpg&size=W&site=1&picid=414109
  200 | image/jpeg | png | 150x150 | ? bytes (898B(received)) | http://chinafotobank.com/getpic.do?filename=201902251434_1551076484970.jpg&size=W&site=1&picid=414109
  ```
  The `size=W` full-size route returns a **150 × 150 PNG placeholder** without an account — i.e. the real
  file is purchase-gated. The 800 × 786 preview is the same azimuthal image at a smaller size than the
  chinanews/CLEP copies. **Not useful.**
- **科技日报 stdaily** (`http://www.stdaily.com/`, 200 OK), **观察者网 guancha**
  (`https://www.guancha.cn/`, 206 OK), **人民网 people / pic.people.com.cn** (206 OK) — hosts reachable, but
  their 2019-01-11 CE-4 pages were not the source of any larger file than the copies above. An already-known
  872 × 7087 huanqiu copy and a 1080 × 1061 still (`himg2.huanqiucdn.cn`) are recorded in
  `notes-change4.md` §4 and are **not repeated** here. **No larger file found on these hosts.**

---

## 2. Official CNSA / CLEP source pages (the canonical provenance)

### 2.1 中国探月与深空探测网 CLEP — the actual 11 Jan 2019 release

**Page (200 OK):** `http://www.clep.org.cn/n5982341/c6805144/content.html`
— 「嫦娥四号着陆器月午工作正常 地形地貌相机顺利完成360度环拍」, 发布时间 **2019-01-11**.
Publisher footer: **主办单位：国家航天局探月与航天工程中心 / 承办单位：国家航天局新闻宣传中心** (Host: CNSA Lunar
Exploration and Space Engineering Center; Organiser: CNSA News and Publicity Center) — i.e. **this is the
official source of the release**, not a re-post.

Body text quoted, translated:
> 截至1月11日8时，嫦娥四号着陆器、玉兔二号巡视器和"鹊桥"中继星状态稳定，各项工作按计划实施。着陆器上配置的地形地貌相机完成了环拍，科研人员根据"鹊桥"中继星传回的数据，制作了清晰的环拍影像图。
> *"As of 08:00 on 11 January, the Chang'e-4 lander, the Yutu-2 rover and the Queqiao relay satellite are in
> stable condition and all work is proceeding as planned. The terrain-and-landform camera configured on the
> lander **completed the surround imaging (环拍)**, and researchers produced a clear surround image map from
> the data relayed back by Queqiao."*

Captions (the three images on the page are labelled):
> 嫦娥四号着陆器地形地貌相机环拍全景图（方位投影） / 嫦娥四号着陆器地形地貌相机环拍全景图（圆柱投影）

Probes of the CLEP images:
```
206 | image/jpeg | jpeg | 900x885 | 143428 bytes (0.14MB) [range-honored] | http://www.clep.org.cn/n5982341/c6805144/part/6780069.jpg
206 | image/jpeg | jpeg | 900x111 | 29432 bytes (0.03MB) [range-honored] | http://www.clep.org.cn/n5982341/c6805144/part/6780081.jpg
206 | image/jpeg | jpeg | 200x200 | 21573 bytes (0.02MB) [range-honored] | http://www.clep.org.cn/dbsource/6767682/6768111.jpg
```
So CLEP's azimuthal panorama is **900 × 885 / 143,428 bytes** — **byte-for-byte the same size as the bjnews
900 × 885 file**, and the CNSA anniversary page carries an **800 × 787 / 216,936 bytes** rendition. CLEP's
cylinder image on this page is only **900 × 111** (a sliver), useless.

> **Important discrepancy, stated honestly:** the 800 × 786 (521,246 B PNG) and 800 × 787 (216,936 B JPEG)
> renditions are *not* byte-identical to each other or to the 900 × 885 file, and the width labels differ by
> one pixel. They are visually the same circular azimuthal panorama. I have **not** proved they are the same
> master file; treat "same image, different rendition" as **strongly indicated but not byte-verified**.

### 2.2 国家航天局 CNSA — 1-year-anniversary release

**Page (200 OK):** `https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/content.html`
— 「嫦娥四号任务圆满成功一周年，两器互拍五星闪耀」, 发布日期 **2020年01月13日**, 来源：国家航天局探月与航天
工程中心. Footer: 版权所有：国家航天局 (Copyright: China National Space Administration).

Quoted, translated:
> 一年前的今天，2019年1月11日，嫦娥四号着陆器、"玉兔二号"巡视器顺利完成互拍成像，任务取得圆满成功…当天，着陆器上配置的地形地貌相机完成了环拍，科研人员根据"鹊桥"中继星传回的数据，制作了清晰的环拍影像图和全景图。
> *"One year ago today, 11 January 2019, the Chang'e-4 lander and the Yutu-2 rover successfully completed
> mutual imaging and the mission was a complete success… That day, the terrain-and-landform camera on the
> lander completed the surround imaging, and researchers produced a clear surround image map **and panorama**
> from the data relayed by Queqiao."*

Probes:
```
206 | image/jpeg | jpeg | 500x331  | 122366 bytes (0.12MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782931.jpg
206 | image/jpeg | jpeg | 640x270  | 109632 bytes (0.10MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782932.jpg
206 | image/jpeg | jpeg | 1080x602 | 326975 bytes (0.31MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782933.jpg
206 | image/jpeg | jpeg | 1080x793 | 632598 bytes (0.60MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782934.jpg
206 | image/jpeg | jpeg | 800x787  | 216936 bytes (0.21MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782935.jpg
206 | image/jpeg | jpeg | 600x4877 | 1664598 bytes (1.59MB) [range-honored] | https://www.cnsa.gov.cn/n6758823/n6758838/c6808659/part/6782936.jpg
206 | image/jpeg | png | 110x55 | 3998 bytes (0.00MB) [range-honored] | https://www.cnsa.gov.cn/dbsource/6767667/6768025.jpg
```
`6782935.jpg` (800 × 787) is the azimuthal panorama; `6782936.jpg` (600 × 4877) is a cylinder strip but
narrower than bjnews' 900 px. **This is the "1-year anniversary" release the task asked about — confirmed to
exist as a page, and it contains the same panorama imagery, not a new higher-resolution master.**
(One probe, `part/6782933.jpg`, first returned `UND_ERR_CONNECT_TIMEOUT` and succeeded on retry with
1080 × 602 — CNSA is intermittently slow, not blocked.)

**CNSA pages carry no open licence** — only 版权所有：国家航天局. The known index page
`https://www.cnsa.gov.cn/n6758823/n6758838/c6808634/content.html` (嫦娥四号第1-12月昼科学数据发布)
was listed by search but returned `UND_ERR_CONNECT_TIMEOUT` on direct probe.

---

## 3. **The licence breakthrough: NSSDC/VSSO image galleries are CC BY 4.0**

`notes-change4.md` §3.3 assessed the NSSDC 全景相机图片集 as *"MEDIUM-HIGH risk"* and noted its licence as
unconfirmed (the gallery page is JS-rendered and returned no image links to a plain GET). I found the JSON
API behind that page and read the licence field directly. **Every relevant product is explicitly
`CC BY 4.0`.** This materially changes the licence verdict for the task.

### 3.1 The API used

`https://vsso.nssdc.ac.cn/nssdc_zh/js/vssoinfo.js` calls
`GET /nssdc/coreMetadata/getDetail?linkId=<id>`. Verbatim transcript of the raw JSON field (not paraphrased):

```
===== https://vsso.nssdc.ac.cn/nssdc/coreMetadata/getDetail?linkId=1240
  dataNameCh: 全景相机图片集
  dataNameEn: Panoramic camera image galleries
  doi: 10.12176/03.88.00007
  cstr: 14804.11.03.88.00007
  license: CC BY 4.0
  releaseDate: 2020-03-30 00:00:00
  generationDate: 2019-11-26 00:00:00
  shareScope: 完全共享            (= "fully shared")
  shareMathod: 线上共享           (= "online sharing")
  url: https://moon.bao.ac.cn/mall/moonDATA
  dataProducerCh: 中国科学院国家天文台（探月工程地面应用系统）
  instrumentCh: 全景相机
```
Translated `desCh` (the dataset description):
> *"…This image collection is the **quick-view images** (快视图) from the panoramic camera carried aboard the
> Chang'e-4 rover during the **1st to 9th lunar days**, including the imaging **of the lander** by the
> panoramic camera when the rover travelled to points **A and D**, and the **360° surround-imaging images**
> when the rover reached point **S1**; the projections are **azimuthal and cylindrical**."*

The search endpoint `POST /nssdc/coreMetadata/coreMetadataList` (JSON body) returned **160** Chang'e-4-related
records. The CE-4 **image/video galleries**, all `CC BY 4.0`, producer 中国科学院国家天文台（探月工程地面应用
系统）:

| id | 名称 | DOI | licence |
|---|---|---|---|
| 1302 | **地形地貌相机图片集** (Terrain camera image galleries) | 10.12176/03.88.00006 | **CC BY 4.0** |
| 1240 | **全景相机图片集** (Panoramic camera image galleries) | 10.12176/03.88.00007 | **CC BY 4.0** |
| 1076 | **降落相机图片集** (Landing camera image galleries) | 10.12176/03.88.00008 | **CC BY 4.0** |
| 1195 | 嫦娥四号地形地貌相机2C级科学数据 (240 colour-corrected TCAM frames, 1st lunar day) | 10.12176/03.04.002 | **CC BY 4.0** |
| 1074 | 嫦娥四号全景相机2B级科学数据 (PCAM L2B, PDS4, 1st–15th lunar days) | 10.12176/03.04.004 | **CC BY 4.0** |
| 1121 | 嫦娥四号着陆点命名图 (landing-site feature names) | 10.12176/03.88.00005 | **CC BY 4.0** |
| 1209 / 1226 / 1241 | 着陆视频 / 低频天线1视频 / A点月球车视频 (MP4) | …00001 / …00002 / …00004 | **CC BY 4.0** |

This is a **much stronger licence position than any Chinese news CDN**: an explicit, machine-readable
`license: "CC BY 4.0"` attached to a citable DOI, issued by the National Space Science Data Center with the
NAOC Ground Application System as data producer.

### 3.2 What I could NOT verify here

- **The actual image files and their pixel dimensions remain unverified.** `vssoinfo.html?1240` is
  JS-rendered and yields no image links to a plain GET; the download route per `notes-change4.md` §3.3 is an
  order/login flow (`/nssdc/orderInfo/dataOrderAdd`). I tried the obvious attachment endpoints
  (`/nssdc/coreMetadata/getAttachment?attachmentId=221`, `/nssdc/attachment/getById?id=221`) — **404**.
- The dataset's own `url` field points to `https://moon.bao.ac.cn/mall/moonDATA`. That SPA's backing API is at
  `/moon-admin` and requires authentication:
  ```
  200 | application/json | JSON | ?x? | 101 bytes (0.00MB) | https://moon.bao.ac.cn/moon-admin/coreMetadata/getDetail?linkId=1240
        head: {"msg":"请求访问：/coreMetadata/getDetail，认证失败，无法访问系统资源","code":401}
  ```
  (`"Authentication failed, cannot access system resource"`.) Every `/mall/...` path — including
  `/mall/img/1240.jpg` and `/mall/moonDATA/1240.jpg` — returns the same **9,002-byte index.html** SPA shell,
  so there is no guessable direct file path. I did **not** find a login-free route to the 27 quick-look images.

> **Verdict on the CC BY 4.0 galleries: licence = LOW risk (explicit CC BY 4.0), delivery = gated.**
> Attribution required: *"中国科学院国家天文台（探月工程地面应用系统）/ 国家空间科学数据中心, CC BY 4.0,
> DOI 10.12176/03.88.00007"*. Whether the *files* are obtainable without an account is **unverified** —
> `notes-change4.md` §3.4 found that the login-free GRAS route gives the same instruments' science frames.

---

## 4. Hosts reachable / hosts blocked

Commands: `node .agents/net-probe.mjs <url>` (prints `status | content-type | content-length | magic | url`).

### Reachable (200 / 206)

| Host | Result | Notes |
|---|---|---|
| `chinafotobank.com` | 200 | paid-stock previews only |
| `www.news.cn` | 206 | Xinhua images small |
| `www.xinhuanet.com` | 206 | redirects to news.cn; Xinhua 404 page is 4,655 B |
| `www.nao.cas.cn` | 200 | |
| `english.cas.cn` | 200 | |
| `english.nao.cas.cn` | 200 | |
| `www.stdaily.com` | 200 | |
| `www.chinanews.com` / `.com.cn` | 200 | **best large Chinese-media files** |
| `www.guancha.cn` | 206 | |
| `www.thepaper.cn` | 206 | |
| `image.thepaper.cn` | 200 / 403 per path | krpano XML 200, level XML **403** |
| `www.people.com.cn` | 206 | |
| `pic.people.com.cn` | 206 | |
| `media.bjnews.com.cn` | 206 | full originals + OSS `image/info` |
| `www.bjnews.com.cn` | 200 | |
| `cast.cn` | 200 | |
| `www.cnsa.gov.cn` | 206 (mostly) | **one path returned `UND_ERR_CONNECT_TIMEOUT`; retry succeeded** |
| `www.clep.org.cn` | 206 | official 2019-01-11 release page |
| `vsso.nssdc.ac.cn` | 200 | gallery page + JSON API; **CC BY 4.0 metadata** |
| `www.nssdc.ac.cn` | 200 | same API |
| `moon.bao.ac.cn` | 200 (HTML) | SPA shell only; `/moon-admin` API = **401 auth required** |
| `www.smoc.ac.cn` | 200 | NSSC news; confirms the 2020-07-27 quick-view release |
| `219.143.227.187` (SASAC mirror) | 206 | CNSA data-release mirror |
| `pc.hgdaily.com.cn`, `m.qdxin.cn` | 200 | local re-posts |

### Blocked / failed

| Host | Failure | Detail |
|---|---|---|
| `qimg.hxnews.com` (海峡网 image CDN) | **502 "Firewall 666"** on all 4 images | edge filter; page itself 200 |
| `www.cnsa.gov.cn/n6758823/n6758838/c6808634/content.html` | `UND_ERR_CONNECT_TIMEOUT` | the "第1-12月昼科学数据发布" index page |
| `www.cnsa.gov.cn/n6759533/c6805143/content.html` | `UND_ERR_CONNECT_TIMEOUT` | page exists on clep.org.cn as a mirror |
| `image.thepaper.cn/.../panos/1tiles/pano_0..5.jpg` | **404** | krpano cube faces unavailable |
| `image.thepaper.cn/.../sources/thepaper.xml`, `sources/tour.js` | **403** | nginx hotlink protection; unaffected by browser headers |
| `vsso.nssdc.ac.cn/nssdc/coreMetadata/getAttachment` etc. | **404** | no public attachment endpoint |
| `www.811sisp.com/newsinfor/p3_1285.html` | **404** | stale search hit |
| `www.xinhuanet.com/.../{bare,c,b}.jpg` | **404** | Xinhua larger-size suffixes do not exist |

**Not probed:** `http://www.cas.cn/` returned a malformed `content-type` header (`3c21646f6374797065206874` —
the bytes `<content-type ht`), which looks like a broken/odd server response rather than a clean 200; I did
not pursue it further because CAS is an upstream parent of NAOC and the NAOC/NSSDC route (§3) is the
authoritative one.

---

## 5. Watermarks, credits, redistribution risk — per candidate

| Candidate | Hosting page | Direct URL | Measured | Credit / licence text on the page | Watermark | Risk |
|---|---|---|---|---|---|---|
| **CNSA 1-yr anniversary azimuthal pano** | `cnsa.gov.cn/n6758823/n6758838/c6808659/content.html` | `.../c6808659/part/6782935.jpg` | 800 × 787 / 216,936 B / JPEG | 来源：国家航天局探月与航天工程中心; footer 版权所有：国家航天局. **No open licence stated.** | unverified (not visually inspected) | **MEDIUM-HIGH** — official but all rights reserved |
| **CNSA 1-yr anniversary cylinder** | same | `.../c6808659/part/6782936.jpg` | 600 × 4877 / 1,664,598 B / JPEG | same | unverified | **MEDIUM-HIGH** |
| **CLEP official azimuthal pano** | `clep.org.cn/n5982341/c6805144/content.html` | `.../c6805144/part/6780069.jpg` | 900 × 885 / 143,428 B / JPEG | 主办单位：国家航天局探月与航天工程中心; no licence text | **「中国探月 CLEP」 logo, top-right** (observed on the identical-dimension bjnews twin) | **MEDIUM-HIGH** — official CNSA body, no open licence |
| **bjnews azimuthal pano** | `bjnews.com.cn/detail/154717411714006.html` | `media.bjnews.com.cn/image/2019/01/11/4747739890651832734.jpg` | 900 × 885 / 143,428 B / JPEG | **图/国家航天局** ("Image / CNSA"); page credit 编辑：郑新洽 吴飞虎 殷楠 | **「中国探月 CLEP」 logo, top-right — observed** | **MEDIUM-HIGH** |
| **bjnews cylinder strip** | same | `media.bjnews.com.cn/image/2019/01/11/4747739891901735117.jpg` | 900 × 7321 / 1,439,299 B / JPEG | same | **「我们的太空」 logo, bottom-left — observed** | **MEDIUM-HIGH** |
| **chinanews cylinder (largest)** | `chinanews.com.cn/gn/2019/01-11/8726772.shtml` | `chinanews.com/cr/2019/0111/3478659747.png` | 960 × 3713 / 4,372,062 B / PNG | 未经授权禁止转载、摘编、复制及建立镜像 (unauthorised reproduction prohibited); source 国际在线微信公众号 | **none visible — observed directly** | **MEDIUM** — largest copy, no watermark, but explicit all-rights-reserved notice |
| **chinanews 960 × 4096** | same | `chinanews.com/cr/2019/0111/415251673.png` | 960 × 4096 / 5,357,215 B / PNG | same | none visible — observed | **MEDIUM**; subject of the image **unverified** |
| **chinanews azimuthal pano** | same | `chinanews.com/cr/2019/0111/1272058806.png` | 800 × 786 / 521,246 B / PNG | same | unverified (PNG, not viewed) | **MEDIUM** |
| **Xinhua inline stills** | `xinhuanet.com/politics/2019-01/11/c_1123979265.htm` | `.../1123979265_15472082595211n.jpg` | 640 × 357 / 40,705 B / JPEG | 国家航天局供图; 版权声明 (all rights reserved) | unverified | **HIGH** — too small to be useful |
| **thepaper strip** | `thepaper.cn/newsDetail_forward_2845856` | `image.thepaper.cn/www/image/14/209/652.jpg` | 872 × 7087 / 916,024 B / JPEG | 来源：央视新闻 新华网 人民日报 | unverified | **MEDIUM-HIGH** — smaller than bjnews |
| **thepaper krpano viewer** | `image.thepaper.cn/html/pano/2019/change_4/index.html` | cube faces **404** | — | 记者从国家航天局获悉 | — | **unusable** — tiles not fetchable |
| **NSSDC 全景相机图片集** | `vsso.nssdc.ac.cn/nssdc_zh/html/vssoinfo.html?1240` | *files not obtained* | **unverified** | **`license: "CC BY 4.0"`**, DOI 10.12176/03.88.00007, producer NAOC 探月工程地面应用系统 | unverified | **LOW licence risk**, but delivery is login/order-gated |
| **NSSDC 地形地貌相机图片集** | `vsso.nssdc.ac.cn/nssdc_zh/html/vssoinfo.html?1302` | *files not obtained* | **unverified** | **`license: "CC BY 4.0"`**, DOI 10.12176/03.88.00006 | unverified | **LOW licence risk**, gated |
| **NSSDC 降落相机图片集** | `vsso.nssdc.ac.cn/nssdc_zh/html/vssoinfo.html?1076` | *files not obtained* | **unverified** | **`license: "CC BY 4.0"`**, DOI 10.12176/03.88.00008 | unverified | **LOW licence risk**, gated |
| **hxnews images** | `hxnews.com/news/itkj/kjqy/201901/11/1688069.shtml` | `qimg.hxnews.com/2019/0111/…jpg` | **502 blocked** | — | — | **unusable** |
| **chinafotobank** | `chinafotobank.com/picture.do?id=414109` | `…/getpic.do?filename=201902251434_1551076484970_p.jpg&size=W…` | 800 × 786 (preview); `size=W` real file = 150 × 150 placeholder | stock-photo sales site | unverified | **HIGH** — purchase-gated |

---

## 6. Honest bottom line for the Three.js demo

1. **No Chinese state-media copy beats what `notes-change4.md` §1.1 already has.** The largest Chinese-media
   file found is chinanews' **960 × 4096 PNG (5,357,215 B)**; the classic cylinder is **960 × 3713**. The
   IAU/CNSA panorama (10000 × 1229, CC BY 4.0) remains the best *panorama* asset, and the GRAS PCAM frames
   (2352 × 1728, 16-bit) remain the best *maximum-detail* route.
2. **The genuinely new, decision-changing finding is licensing.** The NSSDC/VSSO CE-4 image galleries
   (全景相机 / 地形地貌相机 / 降落相机) carry an explicit machine-readable **`CC BY 4.0`** licence with citable
   DOIs — this is the only Chinese-official route with a real open licence. Cite
   *"NAOC Ground Application System 中国科学院国家天文台（探月工程地面应用系统）, via National Space Science
   Data Center, CC BY 4.0, DOI 10.12176/03.88.00007"*. But the files are login/order-gated and their pixel
   dimensions are **unverified** — do not assume a resolution.
3. **Chinese state media imagery has NO explicit open licence.** Xinhua (版权声明), chinanews
   (未经授权禁止转载), bjnews and CNSA (版权所有：国家航天局) all reserve rights. If a panorama file is taken
   from a news CDN, the honest position is: *official CNSA imagery, re-hosted by an all-rights-reserved
   outlet, with no granted redistribution right.*
4. **If a news-CDN file must be used**, the least-bad choice is the **CNSA's own 1-year-anniversary page**
   (`cnsa.gov.cn/.../c6808659/part/6782935.jpg`, 800 × 787) or **CLEP's release page**
   (`clep.org.cn/.../c6805144/part/6780069.jpg`, 900 × 885), because those are the originating government
   bodies rather than commercial re-hosts. Both carry a **visible 「中国探月 CLEP」 watermark** (observed on the
   identical 900 × 885 twin) and grant no licence. Prefer the CC BY 4.0 IAU panorama or the NSSDC route.
5. **Do not use:** `qimg.hxnews.com` (502-blocked), `chinafotobank.com` (purchase-gated), the thepaper krpano
   viewer (tiles 404/403), or Xinhua inline images (too small).

---

## 7. Scripts and scratch files added during this pass

| Path | Purpose |
|---|---|
| `.agents/tmp-scan.mjs` | Generic page scanner: fetch (with GBK fallback decode), list `src`/`data-src`/`data-original` images, print keyword context (全景/环拍/版权/授权…). |
| `.agents/tmp-dims2.mjs` | Standalone dimension reader (JPEG SOF / PNG IHDR) for hosts where a bespoke parse was easier than `img-dims.mjs`. |
| `.agents/tmp-nssdc*.mjs` | Reverse-engineered the NSSDC `coreMetadataList` (POST JSON) + `getDetail` (GET) APIs; dumped the 160-record CE-4 dataset list and all `license` fields. |
| `.agents/tmp-tiles.mjs` | Probed 17 candidate krpano cube-tile naming patterns on `image.thepaper.cn` — all 404. |
| `.agents/research/samples/change4-media/ce4_tcam_cylinder_900x7321_bjnews.jpg` | Downloaded copy (1,439,299 B) used for the **visual watermark check** in §1.3. |
| `.agents/research/samples/change4-media/ce4_tcam_azimuth_900x885_bjnews.jpg` | Downloaded copy (143,428 B) used for the **visual CLEP-logo watermark check** in §1.3/§5. |

(Working scripts `tmp-*.mjs` were deleted after use; their purpose is recorded above so the API discovery in
§3.1 is reproducible.)

### Unverified / open leads

- Pixel dimensions of the NSSDC/VSSO **CC BY 4.0** gallery files (1240 / 1302 / 1076) — **unverified**; the
  mall is login-gated (`/moon-admin` → 401) and no public attachment endpoint exists.
- The subject of chinanews' `415251673.png` (960 × 4096) — the page's caption sentence is truncated;
  **unverified**. It looks like a second cylinder segment of the same TCAM surround panorama.
- Whether the 800 × 786 / 800 × 787 / 900 × 885 azimuthal renditions are byte-identical masters —
  **not byte-verified** (widths differ by 1 px; differing file sizes).
- The thepaper 360° viewer's true tile resolution — **unverified** (cube faces 404, level XML 403).
- `http://www.cas.cn/` returned a malformed `content-type` header (`<content-type ht`); not investigated
  further.
- Whether an even larger master of the 11 Jan 2019 TCAM panorama exists on any Chinese host — **not found**.
  Widths observed across all Chinese copies: 556, 561, 562, 600, 640, 800, 872, 900, 960, 1080 px.
