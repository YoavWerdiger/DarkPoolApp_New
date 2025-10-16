// Market Cap Filters
// רשימות טיקרים לפי קטגוריות Market Cap

// Large Cap - Market Cap מעל 200B
export const LARGE_CAP_SYMBOLS = [
  'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'NVDA.US',
  'TSLA.US', 'META.US', 'BRK-B.US', 'AVGO.US', 'JPM.US',
  'UNH.US', 'V.US', 'XOM.US', 'PG.US', 'JNJ.US',
  'HD.US', 'MA.US', 'CVX.US', 'PFE.US', 'ABBV.US',
  'BAC.US', 'LLY.US', 'KO.US', 'PEP.US', 'COST.US',
  'WMT.US', 'DHR.US', 'MRK.US', 'ACN.US', 'TMO.US',
  'VZ.US', 'ADBE.US', 'CRM.US', 'NFLX.US', 'CMCSA.US',
  'INTC.US', 'AMD.US', 'TXN.US', 'QCOM.US', 'HON.US'
];

// Mid Cap - Market Cap בין 10B ל-200B
export const MID_CAP_SYMBOLS = [
  'ZM.US', 'DOCU.US', 'SNOW.US', 'PLTR.US', 'RBLX.US',
  'SHOP.US', 'SQ.US', 'PYPL.US', 'UBER.US', 'LYFT.US',
  'ABNB.US', 'PTON.US', 'PELOTON.US', 'SPOT.US', 'TWTR.US',
  'SNAP.US', 'PINS.US', 'ROKU.US', 'CRWD.US', 'OKTA.US',
  'DDOG.US', 'NET.US', 'MDB.US', 'ESTC.US', 'ZS.US',
  'TEAM.US', 'WDAY.US', 'SPLK.US', 'NOW.US', 'VEEV.US',
  'AYX.US', 'TTD.US', 'TRMB.US', 'FTNT.US', 'PANW.US',
  'CHKP.US', 'CYBR.US', 'QLYS.US', 'AKAM.US', 'FFIV.US'
];

// Small Cap - Market Cap מתחת ל-10B
export const SMALL_CAP_SYMBOLS = [
  'GME.US', 'AMC.US', 'BB.US', 'NOK.US', 'SPCE.US',
  'CLOV.US', 'WISH.US', 'CLNE.US', 'WKHS.US', 'NIO.US',
  'XPEV.US', 'LI.US', 'BABA.US', 'JD.US', 'PDD.US',
  'BILI.US', 'VIPS.US', 'TME.US', 'BIDU.US', 'NTES.US',
  'WB.US', 'YMM.US', 'TAL.US', 'EDU.US', 'COE.US',
  'ATHM.US', 'CTRP.US', 'QUNR.US', 'WUBA.US', 'JOBS.US',
  'MOMO.US', 'YY.US', 'DOYU.US', 'HUYA.US', 'IQ.US',
  'WB.US', 'YQ.US', 'ZTO.US', 'YMM.US', 'VIPS.US'
];

// Growth Stocks - מניות צמיחה
export const GROWTH_STOCKS = [
  'TSLA.US', 'NVDA.US', 'AMD.US', 'MRNA.US', 'BNTX.US',
  'ZM.US', 'DOCU.US', 'SNOW.US', 'PLTR.US', 'RBLX.US',
  'SHOP.US', 'SQ.US', 'PYPL.US', 'UBER.US', 'ABNB.US',
  'CRWD.US', 'OKTA.US', 'DDOG.US', 'NET.US', 'MDB.US',
  'ESTC.US', 'ZS.US', 'TTD.US', 'AYX.US', 'VEEV.US',
  'NOW.US', 'TEAM.US', 'WDAY.US', 'SPLK.US', 'FTNT.US',
  'PANW.US', 'CHKP.US', 'CYBR.US', 'QLYS.US', 'AKAM.US'
];

// Value Stocks - מניות ערך
export const VALUE_STOCKS = [
  'BRK-B.US', 'JPM.US', 'BAC.US', 'WFC.US', 'C.US',
  'XOM.US', 'CVX.US', 'COP.US', 'EOG.US', 'SLB.US',
  'KO.US', 'PEP.US', 'PG.US', 'JNJ.US', 'PFE.US',
  'MRK.US', 'ABBV.US', 'LLY.US', 'UNH.US', 'ANTM.US',
  'WMT.US', 'COST.US', 'HD.US', 'LOW.US', 'TGT.US',
  'MCD.US', 'SBUX.US', 'YUM.US', 'CMG.US', 'NKE.US'
];

// Tech Giants - ענקיות טכנולוגיה
export const TECH_GIANTS = [
  'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'META.US',
  'NVDA.US', 'TSLA.US', 'AVGO.US', 'ADBE.US', 'CRM.US',
  'ORCL.US', 'INTC.US', 'AMD.US', 'TXN.US', 'QCOM.US',
  'CSCO.US', 'IBM.US', 'NOW.US', 'TEAM.US', 'WDAY.US',
  'SPLK.US', 'VEEV.US', 'AYX.US', 'TTD.US', 'FTNT.US',
  'PANW.US', 'CHKP.US', 'CYBR.US', 'QLYS.US', 'AKAM.US'
];

// Helper function to get symbols by category
export const getSymbolsByCategory = (category: 'large' | 'mid' | 'small' | 'growth' | 'value' | 'tech'): string[] => {
  switch (category) {
    case 'large':
      return LARGE_CAP_SYMBOLS;
    case 'mid':
      return MID_CAP_SYMBOLS;
    case 'small':
      return SMALL_CAP_SYMBOLS;
    case 'growth':
      return GROWTH_STOCKS;
    case 'value':
      return VALUE_STOCKS;
    case 'tech':
      return TECH_GIANTS;
    default:
      return LARGE_CAP_SYMBOLS;
  }
};

// Helper function to get category name
export const getCategoryName = (category: 'large' | 'mid' | 'small' | 'growth' | 'value' | 'tech'): string => {
  switch (category) {
    case 'large':
      return 'Large Cap (>$200B)';
    case 'mid':
      return 'Mid Cap ($10B-$200B)';
    case 'small':
      return 'Small Cap (<$10B)';
    case 'growth':
      return 'Growth Stocks';
    case 'value':
      return 'Value Stocks';
    case 'tech':
      return 'Tech Giants';
    default:
      return 'Large Cap';
  }
};
