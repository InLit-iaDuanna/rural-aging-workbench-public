# Design QA

## Comparison target

- Primary visual reference: `D:/Dunna/xwechat_files/wxid_xefc314q2sgm22_b0ea/msg/file/2026-09/效果图(1)/效果图/d9d55c733b93e87faaa514273a17753e.png` (1672 × 941 px).
- Scoped removal reference: `C:/Users/duanj/AppData/Local/Temp/codex-clipboard-24e0298f-b660-4c0f-8d24-9f92a85f5f81.png`.
- Implementation: `http://localhost:3000/#archive`, both archive tabs, in the Codex in-app Browser.
- Implementation screenshots were captured inline during this QA run; the browser surface did not expose a persistent filesystem path.
- CSS viewports tested at device scale factor 1: 1366 × 768 and default 1601 × 831 for this iteration; 1920 × 1080 remains covered by the preceding layout pass.
- State: both “基本信息” and “图片库”, with the assistant open and no uploaded project images.

## Full-view comparison evidence

- The image-library page now contains only the existing search control and the three category upload cards beneath the retained “基本信息 / 图片库” switch.
- “空间与现场资料”, its empty state/photo inventory, “现场调研记录”, and the redundant bottom return button are absent from the rendered archive gallery.
- The desktop grid now uses the complete available first track instead of a fractional `0.88fr` track, eliminating the unused right-side strip while keeping the assistant aligned with the workspace edge.
- Both archive tabs now use the same acrylic outer-board token: approximately 2.5% pale fill, a 0.5 px highlight edge, 3 px background blur, and a restrained 8%-opacity cast shadow.
- Background roads, fields, trees, and buildings remain visibly legible through the frame and heading zone; the material reads as a clear plate rather than a fogged panel.
- At every tested viewport, document scroll dimensions equal client dimensions, so the page has no horizontal or vertical overflow.

## Focused region comparison evidence

- At 1366 × 768, the workspace grid spans x=214–1342; the archive surface spans x=214–1021 and the gallery spans x=233–997. The three cards remain in one row at 234 × 432 px each.
- At 1920 × 1080, the grid spans x=232–1890; the archive surface spans x=232–1501 and the gallery spans x=255–1473. The three cards remain in one row at 383 × 687 px each.
- At the default 1601 × 831 Codex viewport, both archive states retain their existing proportions and the countryside background remains visible through their matching outer frames.
- The gallery reports `overflow-y: hidden`, and its `scrollHeight` equals its `clientHeight` at all tested sizes.
- The archive surface contains exactly three `.upload-card` elements and no `.gallery-heading`, `.gallery-empty`, `.field-notes`, or `.next-step` descendants.

## Findings and comparison history

1. Initial P1: the lower photo inventory and field-notes panels made the image-library page vertically draggable and diluted the three-card composition.
2. Initial P1: `minmax(0, 0.88fr)` left an unassigned strip after the assistant column, producing visible whitespace on the right.
3. Initial P1: the outer board used a 27%-opacity dark green layer with 18 px blur, which obscured too much of the countryside background.
4. Fix: removed the two lower modules and redundant return control, converted the inner board to a non-scrolling flex layout, and stretched only the three cards into the available height.
5. Fix: changed the workspace track to `minmax(0, 1fr)` and reduced the outer glass to 8% opacity with 8 px blur and a lighter shadow.
6. Follow-up P2: the 8% fill, 8 px blur, and 1 px edge still read as heavy frosted glass, while the basic-information tab retained the older opaque surface.
7. Follow-up fix: reduced the shared archive surface to approximately 2.5% fill, 3 px blur, and a 0.5 px edge; added the same material class to the basic-information tab and matched both archive headings.
8. Post-fix evidence: at 1366 × 768 both tabs compute the same acrylic values, document dimensions remain 1366 × 768 without overflow, the gallery remains non-scrolling with exactly three cards, and production build plus focused lint pass.

## Required fidelity surfaces

- Fonts and typography: the existing Song-style display headings and compact UI typography remain unchanged.
- Spacing and layout rhythm: the lowered gallery board and full-height basic-information board retain their established geometry while sharing one thin acrylic perimeter.
- Colors and visual tokens: sage, ivory, peach, and clay card treatments remain; both archive surfaces now share the same `rgba(239, 248, 236, 0.025)` acrylic fill and half-pixel highlight edge.
- Image quality and asset fidelity: both generated 1200 × 675 WebP illustrations and the existing 1672 × 941 countryside image load sharply.
- Copy and content: search, group switch, the three category names/descriptions, indices, thumbnails, and upload actions remain intact.

## Follow-up polish

- No remaining material mismatch was found in the requested archive surfaces.

final result: passed

## 2026-09-09 · 图片库卡片组底部落位

- Source state: `C:/Users/duanj/AppData/Local/Temp/codex-clipboard-e46dfa71-706b-4064-b401-b89726e1a921.png`。
- Implementation: `http://localhost:3000/#archive` 的“图片库”状态，1600 × 900 CSS px、device scale factor 1。
- Finding: 搜索框与三张上传卡组成的白色面板紧跟标题，透明工作区上半部留白不足，而底部出现无意义空区，视觉重心悬在中段。
- Fix: 在档案图片库的纵向 flex 容器中将 `.gallery` 设为 `margin-top: auto`，让整块白色面板贴近工作区内容底边；同时恢复两种档案状态共同下移的外框规则。
- Post-fix evidence: 1600 × 900 下，透明工作区 y=124.2–876；白色面板 y=325.5–845.5，底部仅保留约 30.5 px，三张卡 y=402.5–827。标题与白色面板之间形成清晰的背景留白。
- Regression: 卡片尺寸、切换滑块、助手位置及基本信息/图片库外框对齐均保持不变；生产构建和 `npx oxlint app/workspace.tsx` 通过。

final result: passed

## 2026-09-09 · 档案双状态卡片与对齐优化

**Comparison target**

- Source visual truth: `D:/Dunna/Documents/ChatGPT/12345678/效果图/d9d55c733b93e87faaa514273a17753e.png`，1672 × 941 px。
- User-marked current state: `C:/Users/duanj/AppData/Local/Temp/codex-clipboard-c91bce49-e2e6-4f3e-a754-b9d04b0c7364.png`，3200 × 1904 px。
- Implementation: `http://localhost:3000/#archive`，Codex in-app Browser；截图在本轮浏览器 QA 中以内联图像捕获，浏览器未提供持久文件路径。
- Viewports: 1600 × 900 与 1366 × 768 CSS px，device scale factor 1。参考图与实现均按约 16:9 内容区域归一化比较。
- State: “基本信息”与“图片库”互相切换；助手保持展开，项目图片数量为 0。

**Full-view comparison evidence**

- 图片库已从独立的缩短/下沉网格恢复到档案页共用工作区轨道；外层透明边框、标题、切换控件和右侧助手不再随标签切换横向或纵向跳动。
- 三张上传卡不再向下占满外框：1600 × 900 下卡片高度从约 521 px 收至约 425 px，保留更充分的外框留白，接近参考图中“独立卡片组置于透明工作区”的层级。
- 卡片增加轻量上浮、边缘高光和柔和阴影，圆角由 17 px 调整为 20 px；颜色、图片、标题、说明与上传操作保持原样。

**Focused region comparison evidence**

- 1600 × 900：基本信息与图片库外框均为 x=232、y=90、929 × 786；切换控件均为 x=880.5、y=136.4、238 × 43；助手均为 x=1185、y=90、385 × 786。
- 1366 × 768：两页外框均为 x=214、y=90、768 × 654；切换控件均为 x=705.5、y=140.5、238 × 43；助手均为 x=1002、y=90、340 × 654。
- 1366 × 768 图片库三卡均为约 216 × 355 px，并保持单行；文档尺寸等于视口 1366 × 768，无横向或纵向页面溢出。

**Findings and comparison history**

1. P1 resolved: 图片库专用 `:has()` 网格把助手列从 385 px 改成约 352 px，并把主区从 929 px 扩到 962 px，导致两个标签切换时整体横移。
2. P1 resolved: 图片库外框原有顶部偏移与减高规则，使其相对基本信息页下沉约 34 px、高度短约 34 px。
3. P2 resolved: 三张卡片原高约 521 px，纵向占比过大、缺少参考图中的独立卡片感。
4. Fix: 移除图片库专用列宽，统一外框高度、边距和响应式 padding；限制内部卡片板高度为 `clamp(390px, 58vh, 520px)`，并增加克制的 hover elevation。
5. Post-fix evidence: 两种标签在 1600 × 900 与 1366 × 768 下的外框、切换控件和助手矩形完全一致；浏览器控制台无 error/warn，生产构建与 focused lint 通过。

**Required fidelity surfaces**

- Fonts and typography: 保留现有宋体展示标题与紧凑 UI 字体；本轮未改字号、字重和换行规则。
- Spacing and layout rhythm: 双状态的外框、滑块、助手位置完全对齐；卡片组更短并留出稳定负空间。
- Colors and visual tokens: 保留鼠尾草绿、象牙白和暖桃色；新增阴影沿用现有低饱和绿色透明值。
- Image quality and asset fidelity: 三张现有本地 WebP/PNG 图片保持原始裁切与 `object-fit: cover`，无替代或拉伸。
- Copy and content: 搜索、分类名称、说明、编号和上传操作均未改变。

**Follow-up polish**

- 无剩余 P0/P1/P2；更细的卡片位移与阴影强度可作为后续 P3 主观微调。

final result: passed

## 2026-09-09 · 调试页统一工作区修复

- Root cause: `Workspace` 在 `page === 'debug'` 时提前返回独立的 `DebugWorkbench`，绕过了档案与方案共用的顶栏、侧栏、主面板和助手布局。
- Fix: 移除该提前返回与未再使用的导入，恢复项目中原有的统一调试面板渲染路径；空间问题、3D 阶段说明、老人行为脚本和调试任务四个标签仍保留。
- Browser evidence: 在 Codex in-app Browser 中依次打开 `#archive`、`#debug`、`#plans`，三者均使用同一套工作区壳层，导航选中状态、页面标题和助手通道同步切换。
- Verification: `npm run build` 与 `npx oxlint app/workspace.tsx` 均通过。

final result: passed
