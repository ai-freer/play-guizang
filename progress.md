Original prompt: 制定开发实施计划，然后按 pdca 开始制作 web game, 无需账号登录和持久保存，直接使用浏览器的 cookie 存储，每个人打开自己的浏览器，能保存自己的持续进度就好了

# Progress

## 2026-06-05

- Plan：确定采用 Phaser 3 + TypeScript + Vite。
- Plan：HUD 使用 DOM/CSS，棋盘与特效使用 Phaser canvas。
- Plan：进度只用浏览器 cookie 保存，不做账号、后端或云同步。
- Plan：实施计划已写入 `docs/implementation-plan.md`。
- Do：已初始化 Phaser/Vite/TypeScript 项目。
- Do：已从 `references/02-5x5-meme-matrix.png` 裁切 25 张 tile 到 `public/assets/tiles/`。
- Do：已实现 7x7 棋盘、基础交换、匹配检测、消除、下落补新、分数、步数、目标、刷新/提示道具入口。
- Do：已实现 cookie 进度读写模块 `ProgressStore`。
- Check：`npm run build` 通过；Vite 仅提示 Phaser chunk 较大，MVP 阶段暂不处理。
- Check：Chrome 截图已保存到 `output/web-game/chrome-full.png` 和 `output/web-game/chrome-after-move.png`。
- Check：通过 `window.__xxcs_trySwap` 验证有效交换后分数 `0 -> 180`，步数 `22 -> 21`。
- Check：Chrome console error 已清零；曾有 favicon 404，已通过 `public/favicon.svg` 修复。

## TODO

- Act：补真实点击自动化验证，当前测试钩子可验证规则，但合成 pointer event 没触发 Phaser 输入。
- Act：增加更清晰的交换/消除/下落动画，而不是直接重绘终态。
- Act：实现胜利/失败后的关卡切换完整体验。
- Act：实现“提示”道具的次数扣减和“刷新”道具的次数扣减。
- Act：补 1-10 关选择/推进 UI。
- Do：Task 1 已新增真实点击验证脚本和棋盘可用交换工具，`render_game_to_text()` 输出输入坐标元数据。
- Check：真实点击验证脚本 `npm run verify:gameplay` 通过，截图保存到 `output/web-game/verify-real-click.png`。
- Do：已增加交换、消除 pop、加分飘字动画；当前下落补新仍以终态重绘为主。
- Do：已增加关卡推进 helper 和强制胜利测试钩子，验证脚本覆盖下一关推进与 cookie 存在性。
- Check：胜利弹窗、下一关推进和 `xxcs_progress` cookie 写入通过自动化验证。
- Do：刷新/提示道具已接入库存扣减；HUD 数量和禁用态可见。
- Do：已增加 1-10 关关卡选择条，未解锁关卡不可点击。
- Check：Iteration 02 build and gameplay verification passed.
- Check：Final screenshot saved to `output/web-game/iteration-02-final.png`.
- Act：下一轮建议补更精细的下落路径动画、道具“炸弹/换位”真实功能和音效。
- Do：已按竖屏“优先棋盘面积”原则重排移动端布局，HUD/目标/道具区压缩为辅助信息。
- Do：横屏已改为棋盘与右侧信息栏并排，道具区改成紧凑工具条并移除“可拖到棋盘使用”的误导文案。
- Check：第 3 关双目标场景横竖屏截图已保存到 `output/web-game/layout-landscape-level3.png` 和 `output/web-game/layout-mobile-level3.png`。
- Do：已使用内置 imagegen 生成 4 个游戏感道具 PNG 图标，替换原先简陋 SVG 线图。
- Check：工具图标横竖屏截图已更新到 `output/web-game/layout-landscape.png` 和 `output/web-game/layout-mobile.png`。
- Do：性能优化：新增 tile asset helper，Boot 首屏只预加载当前关卡需要的 tile，关卡切换前按需补加载缺失 tile。
- Do：性能优化：新增 Vite manualChunks，将 Phaser 拆成独立生产 chunk，业务入口 chunk 降到约 22.7KB。
- Do：测试稳定性：`verify:gameplay` 改为等待状态变化，并让测试强制胜利钩子释放动画 busy 状态后再推进。
- Check：`npm run build` 通过；生产产物为业务 JS `22.69KB` 与 Phaser JS `1.2MB` 两个 chunk。
- Check：`npm run verify:gameplay` 通过；生产 preview 首屏 tile 请求为 `tile-01` 到 `tile-05`，截图保存到 `output/web-game/perf-preview-after-lazy-load.png`。
