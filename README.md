# 基金季报 PWA v12 iPhone · 自动风险数据库

这版把 v10 的稳定 PWA 保留下来，并增加独立 Cloudflare Worker API，实现真正的动态风险检索。

## v12 核心变化
- PWA 继续保留：搜索、自选、基金详情、持仓、定期报告、当前页面内来源查看器。
- 「历史风险」不再读取写死的华夏数据库。
- 搜索任意基金后，风险页把基金代码交给 Worker。
- Worker 自动从基金资料页识别基金管理人。
- 再向中国证监会公开站内搜索检索管理人及基金名称相关记录。
- 自动分类：行政处罚、监管措施、市场禁入、其他。
- 自动去重、按日期倒序、保留官方原文链接。
- Worker 使用 Cloudflare Cache 缓存 6 小时，之后自动重新检索，不需要手工更新风险数据库。
- 不使用 Pages Functions，不需要 D1/KV，也不需要额外绑定。

## 部署方式（推荐）
这一版建议使用 **Cloudflare Workers + Static Assets**，不要再用旧的 Pages Functions。
Cloudflare 官方现在支持 Worker 同时提供静态资产和 Worker API；`wrangler.toml` 已经配置好。

1. 安装 Wrangler：`npm install -g wrangler`
2. 登录：`wrangler login`
3. 进入本目录：`cd pwa12`
4. 部署：`wrangler deploy`
5. 部署后 Worker 会同时提供 PWA 和 `/api/risk`。

如果想保留原来的 Worker 名称，把 `wrangler.toml` 里的 `name` 改成你现在的项目名，再部署。

## 重要说明
证监会公开检索页面可能因为上游限流、验证码、网络策略等原因暂时失败；App 会显示“自动风险检索暂时失败”，不会把失败误报成“没有风险”。

风险记录属于公开信息整理，不构成“基金违法”的法律结论。管理人或基金经理被监管，不等于本基金产品本身违法。
