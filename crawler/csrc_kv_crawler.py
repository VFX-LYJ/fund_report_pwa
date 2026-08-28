#!/usr/bin/env python3
"""国内环境运行的证监会监管列表 -> Cloudflare KV 最小爬虫。

第一阶段只抓北京证监局监管措施列表，并把匹配到的管理人记录写入：
    risk:manager:<管理人全称>

环境变量：
    CF_ACCOUNT_ID
    CF_KV_NAMESPACE_ID
    CF_API_TOKEN

可选：
    CSRC_BEIJING_URL   覆盖北京证监局列表页
    MANAGERS           逗号分隔的管理人全称；默认先跑华夏、易方达、南方、广发、富国、嘉实、汇添富

API Token 只需要 Cloudflare KV 写权限，不要写进代码或 Git。
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

DEFAULT_BEIJING_URL = "https://www.csrc.gov.cn/csrc/c100045/common_list_gd.shtml"
CF_KV_API = "https://api.cloudflare.com/client/v4/accounts/{account}/storage/kv/namespaces/{namespace}/values/{key}"

MANAGERS = {
    "华夏基金管理有限公司": {
        "aliases": ["华夏基金", "华夏基金管理"],
        "exclude": ["华夏银行", "华夏证券", "华夏保险", "华夏人寿"],
    },
    "易方达基金管理有限公司": {
        "aliases": ["易方达基金", "易方达"],
        "exclude": ["易方达证券"],
    },
    "南方基金管理股份有限公司": {
        "aliases": ["南方基金"],
        "exclude": ["南方航空", "南方电网", "南方证券"],
    },
    "广发基金管理有限公司": {
        "aliases": ["广发基金"],
        "exclude": ["广发银行", "广发证券", "广发期货"],
    },
    "富国基金管理有限公司": {
        "aliases": ["富国基金"],
        "exclude": ["富国银行", "富国证券"],
    },
    "嘉实基金管理有限公司": {
        "aliases": ["嘉实基金"],
        "exclude": [],
    },
    "汇添富基金管理股份有限公司": {
        "aliases": ["汇添富基金", "汇添富"],
        "exclude": [],
    },
}

RISK_TITLE = re.compile(
    r"行政处罚决定书|行政处罚事先告知书|行政处罚|市场禁入决定书|证券市场禁入|"
    r"警示函|监管措施决定书|行政监管措施|采取.*监管措施|责令改正|监管谈话|"
    r"纪律处分决定书|纪律处分|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责",
    re.I,
)
NON_RISK = re.compile(
    r"证监会发布|证监会优化|证监会组织|证监会召开|培训|会议|致辞|讲话|新闻|政策解读|"
    r"行业标准|工作方案|工作会议|公告|通知|答记者问|新闻发布会|活动|论坛|研讨|座谈|"
    r"征求意见|意见稿|制度建设|数据模型",
    re.I,
)


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(text):
    return re.sub(r"[（）()\s\u3000]", "", str(text or "")).lower()


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def extract_date(text):
    match = re.search(r"(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})", text)
    if not match:
        return ""
    return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def classify_type(text):
    if re.search(r"市场禁入|证券市场禁入", text):
        return "市场禁入"
    if "行政处罚" in text:
        return "行政处罚"
    if "纪律处分" in text:
        return "纪律处分"
    if "警示函" in text:
        return "警示函"
    if re.search(r"监管措施|责令改正|监管谈话|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责", text):
        return "监管措施"
    return "其他"


def confidence(title, manager):
    if not manager_matches(title, manager):
        return "low"
    if re.search(r"行政处罚|市场禁入", title):
        return "high"
    if RISK_TITLE.search(title):
        return "medium"
    return "low"


def manager_matches(text, manager):
    n = normalize(text)
    meta = MANAGERS[manager]
    if any(normalize(x) in n for x in meta["exclude"]):
        return False
    return normalize(manager) in n or any(normalize(x) in n for x in meta["aliases"])


class LinkParser(HTMLParser):
    def __init__(self, base_url):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.current_href = None
        self.current_text = []
        self.current_context = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        attrs = dict(attrs)
        href = attrs.get("href")
        if href:
            self.current_href = urljoin(self.base_url, href)
            self.current_text = []
            self.current_context = []

    def handle_data(self, data):
        if self.current_href:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() != "a" or not self.current_href:
            return
        title = clean(" ".join(self.current_text))
        if len(title) >= 5:
            self.items.append({"url": self.current_href, "title": title})
        self.current_href = None
        self.current_text = []


def fetch(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
        "Referer": "https://www.csrc.gov.cn/",
    }
    response = requests.get(url, headers=headers, timeout=(15, 45))
    response.raise_for_status()
    response.encoding = response.apparent_encoding or response.encoding
    return response.text


def fetch_json(url, token):
    response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    response.raise_for_status()
    return response.json()


def kv_get(account, namespace, token, key):
    url = CF_KV_API.format(account=account, namespace=namespace, key=key)
    response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


def kv_put(account, namespace, token, key, value):
    url = CF_KV_API.format(account=account, namespace=namespace, key=key)
    response = requests.put(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(value, ensure_ascii=False),
        timeout=30,
    )
    response.raise_for_status()


def make_record(item, manager, agency="北京证监局"):
    title = item["title"]
    conf = confidence(title, manager)
    if conf == "low":
        return None
    record_type = classify_type(title)
    return {
        "key": f"{item['url']}|{title}",
        "title": title,
        "url": item["url"],
        "date": item.get("date") or extract_date(title),
        "type": record_type,
        "level": "high" if record_type in ("行政处罚", "市场禁入") else "medium",
        "agency": agency,
        "subject": manager,
        "relation": "manager",
        "confidence": conf,
        "source": "official_list",
        "updatedAt": utc_now(),
    }


def main():
    account = os.environ.get("CF_ACCOUNT_ID")
    namespace = os.environ.get("CF_KV_NAMESPACE_ID")
    token = os.environ.get("CF_API_TOKEN")
    if not all([account, namespace, token]):
        print("缺少 CF_ACCOUNT_ID / CF_KV_NAMESPACE_ID / CF_API_TOKEN", file=sys.stderr)
        return 2

    url = os.environ.get("CSRC_BEIJING_URL", DEFAULT_BEIJING_URL)
    selected = [x.strip() for x in os.environ.get("MANAGERS", ",".join(MANAGERS)).split(",") if x.strip()]
    selected = [x for x in selected if x in MANAGERS]
    if not selected:
        print("没有有效管理人", file=sys.stderr)
        return 2

    print(f"抓取：{url}")
    html = fetch(url)
    parser = LinkParser(url)
    parser.feed(html)
    links = parser.items
    print(f"列表链接：{len(links)}")

    parsed = [x for x in links if RISK_TITLE.search(x["title"]) and not NON_RISK.search(x["title"])]
    print(f"监管候选：{len(parsed)}")

    now = utc_now()
    source_stats = {"fetched": True, "items": len(links), "parsed": len(parsed), "matched": 0}
    total_records = 0

    for manager in selected:
        key = f"risk:manager:{manager}"
        old = kv_get(account, namespace, token, key) or {
            "manager": manager,
            "aliases": [manager, *MANAGERS[manager]["aliases"]],
            "exclude": MANAGERS[manager]["exclude"],
            "records": [],
        }

        records = old.get("records", [])
        new_records = []
        for item in parsed:
            if not manager_matches(item["title"], manager):
                continue
            source_stats["matched"] += 1
            record = make_record(item, manager)
            if record:
                new_records.append(record)

        merged = {str(r.get("key") or f"{r.get('url','')}|{r.get('title','')}"): r for r in records}
        for record in new_records:
            merged[record["key"]] = record
        merged_records = sorted(merged.values(), key=lambda r: str(r.get("date") or ""), reverse=True)

        value = {
            **old,
            "manager": manager,
            "aliases": [manager, *MANAGERS[manager]["aliases"]],
            "exclude": MANAGERS[manager]["exclude"],
            "records": merged_records,
            "lastCrawledAt": now,
            "lastSuccessAt": now,
            "latestDate": merged_records[0].get("date") if merged_records else old.get("latestDate"),
            "status": "ok",
            "source": "国内爬虫：北京证监局监管措施列表",
        }
        kv_put(account, namespace, token, key, value)
        total_records += len(new_records)
        print(f"{manager}: 新增/更新 {len(new_records)} 条，正式库共 {len(merged_records)} 条")
        time.sleep(0.5)

    meta = {
        "lastRunAt": now,
        "ok": True,
        "sources": {"beijing": {**source_stats, "newRecords": total_records}},
        "crawler": "crawler/csrc_kv_crawler.py",
    }
    kv_put(account, namespace, token, "risk:meta:crawl", meta)
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
