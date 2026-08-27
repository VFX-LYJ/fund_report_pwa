/*
 * 基金风险数据库（静态版）
 * 直接随 Cloudflare Pages 部署，不需要 Functions / Worker。
 * 每次更新这个文件后重新部署即可。
 * 来源仅收录中国证监会公开文件；“关联记录”不等同于基金产品违法。
 */
window.RISK_DB = {
  updated: '2026-08-27',
  funds: {
    '019549': {
      manager: '华夏基金管理有限公司',
      records: []
    }
  },
  managers: {
    '华夏基金管理有限公司': [
      {
        date: '2023-03-28',
        type: '行政处罚',
        subject: '赵航（时任华夏基金管理有限公司基金经理）',
        title: '中国证监会行政处罚决定书（赵航）',
        summary: '证监会认定赵航利用内幕信息交易西藏药业股票；涉案期间其负责两只公募基金的权益类资产投资。',
        result: '罚款500万元',
        relation: '基金经理关联记录',
        url: 'https://www.csrc.gov.cn/csrc/c101928/c7400149/content.shtml'
      }
    ]
  }
};
