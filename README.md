# 基金季报 PWA · 国内监管数据 + Cloudflare KV

当前风险架构已经切换为：

```text
国内定时任务
    ↓
抓取证监会/地方证监局公开列表
    ↓
实体匹配 + 去重
    ↓
Cloudflare KV
    ↓
Worker /api/risk 只读 KV
    ↓
PWA 风险页
```

## 为什么不再让 Worker 直接抓证监会

线上 Worker 运行在海外边缘节点，直接访问部分中国大陆监管网站可能出现超时、限流或网络策略问题。因此 V23 起，Worker **不再在用户请求路径中直接 fetch csrc.gov.cn**。

官方监管数据由国内环境运行的 `crawler/csrc_kv_crawler.py` 抓取后写入 Cloudflare KV。这样用户查询基金时只读取 KV，不会因为证监会官网瞬时超时而把“查不到”误判成“没有风险”。

## Cloudflare KV

在 Cloudflare 创建一个 KV namespace，然后准备：

- Account ID
- KV Namespace ID
- 一个具有 KV 写权限的 API Token（只放在国内爬虫机器的环境变量中，不要提交到 Git）

`wrangler.toml` 中的 `RISK_KV` 绑定需要你把真实 Namespace ID 填进去后再部署 Worker。仓库不会硬编码 Token。

## 国内爬虫：第一阶段北京证监局

文件：

```text
crawler/csrc_kv_crawler.py
```

当前第一阶段只抓北京证监局监管措施列表，默认关注：

- 华夏基金管理有限公司
- 易方达基金管理有限公司
- 南方基金管理股份有限公司
- 广发基金管理有限公司
- 富国基金管理有限公司
- 嘉实基金管理有限公司
- 汇添富基金管理股份有限公司

爬虫会：

1. 请求北京证监局公开列表页。
2. 解析标题和链接，并尝试提取日期。
3. 用正式名称 + 别名匹配管理人。
4. 使用排除词避免把“华夏银行、华夏证券、华夏保险”等误归到华夏基金。
5. 读取 KV 中已有数据并合并去重。
6. 写入 `risk:manager:<管理人全称>`。
7. 写入 `risk:meta:crawl` 记录抓取状态。

### 安装依赖

```bash
python3 -m pip install requests
```

### 配置环境变量

Linux/macOS：

```bash
export CF_ACCOUNT_ID="你的 Cloudflare Account ID"
export CF_KV_NAMESPACE_ID="你的 KV Namespace ID"
export CF_API_TOKEN="你的 KV API Token"
```

可选：覆盖北京证监局列表 URL：

```bash
export CSRC_BEIJING_URL="https://www.csrc.gov.cn/csrc/c100045/common_list_gd.shtml"
```

可选：只跑某几个管理人：

```bash
export MANAGERS="华夏基金管理有限公司,易方达基金管理有限公司"
```

### 手动运行

```bash
python3 crawler/csrc_kv_crawler.py
```

成功后，KV 中会出现类似：

```text
risk:manager:华夏基金管理有限公司
risk:manager:易方达基金管理有限公司
risk:meta:crawl
```

### 每天自动运行

国内 VPS 可以用 cron，例如每天凌晨 3 点运行：

```cron
0 3 * * * cd /path/to/fund_report_pwa && /usr/bin/python3 crawler/csrc_kv_crawler.py >> /var/log/fund-risk-crawler.log 2>&1
```

先手动跑通一次，再设置定时任务。不要一开始高频抓取。

## Worker 风险 API

`GET /api/risk?code=000001&name=华夏成长`：

- 自动根据基金代码/名称识别管理人。
- 只读 `risk:manager:<manager>`。
- 有记录：`status: success` 并评分。
- 无记录：`status: no_data`、`score: null`、`level: 数据不足`。
- 已标记同步失败：`status: failed`、`score: null`。
- 不再存在“0 条记录 = 95 分低风险”。

`force=1` 现在只用于返回 KV/debug 状态，**不会再次触发中国证监会官网实时抓取**。

用户补充风险记录仍然保留：

- `POST /api/risk/submit`
- `GET /api/risk/pending`
- `POST /api/risk/approve`

用户提交默认进入 pending，审核通过后写入正式 `risk:manager:<manager>`，并参与风险评分。

## KV 数据结构

正式管理人数据：

```text
risk:manager:华夏基金管理有限公司
```

示意：

```json
{
  "manager": "华夏基金管理有限公司",
  "aliases": ["华夏基金管理有限公司", "华夏基金"],
  "exclude": ["华夏银行", "华夏证券", "华夏保险"],
  "records": [],
  "lastCrawledAt": "...",
  "lastSuccessAt": "...",
  "latestDate": "...",
  "status": "ok"
}
```

抓取总状态：

```text
risk:meta:crawl
```

Worker 自身检查状态：

```text
risk:meta:worker
```

## 部署

安装并登录 Wrangler：

```bash
npm install -g wrangler
wrangler login
```

在 `wrangler.toml` 配置真实 KV Namespace ID 后：

```bash
wrangler deploy
```

Worker 和 `site/` 静态资源会一起部署。

## 重要说明

风险记录来自公开监管信息的程序化整理，不构成对基金管理人、基金经理或基金产品违法违规的法律结论。管理人或人员被监管，也不等于具体基金产品本身违法。

部分记录可能因为官方页面结构变化、国内网络环境或解析规则暂时遗漏，因此页面应优先把“数据不足”与“低风险”严格区分。
