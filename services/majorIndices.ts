// Major Indices Symbols
// רשימת מניות מהאינדקסים הגדולים: S&P 500, NASDAQ, Dow Jones

export const SP500_SYMBOLS = [
  // Technology
  "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US",
  "NFLX.US", "CRM.US", "ADBE.US", "ORCL.US", "CSCO.US", "INTC.US", "AMD.US",
  "QCOM.US", "TXN.US", "AVGO.US", "NOW.US", "INTU.US", "PANW.US", "SNOW.US",
  
  // Financial
  "JPM.US", "BAC.US", "WFC.US", "GS.US", "MS.US", "C.US", "BLK.US", "SCHW.US",
  "AXP.US", "USB.US", "PNC.US", "TFC.US", "COF.US", "CB.US", "MMC.US",
  
  // Healthcare
  "JNJ.US", "UNH.US", "PFE.US", "ABBV.US", "MRK.US", "LLY.US", "TMO.US",
  "ABT.US", "DHR.US", "BMY.US", "AMGN.US", "GILD.US", "CVS.US", "CI.US",
  
  // Consumer
  "PG.US", "KO.US", "PEP.US", "WMT.US", "COST.US", "HD.US", "MCD.US",
  "SBUX.US", "NKE.US", "DIS.US", "CMCSA.US", "VZ.US", "T.US", "TMUS.US",
  
  // Industrial
  "BA.US", "CAT.US", "GE.US", "HON.US", "UPS.US", "FDX.US", "LMT.US",
  "RTX.US", "DE.US", "EMR.US", "ETN.US", "MMM.US", "NOC.US", "GD.US",
  
  // Energy
  "XOM.US", "CVX.US", "COP.US", "EOG.US", "SLB.US", "MPC.US", "PSX.US",
  "VLO.US", "PXD.US", "KMI.US", "OKE.US", "WMB.US", "EPD.US", "ET.US",
  
  // Materials
  "LIN.US", "APD.US", "SHW.US", "ECL.US", "DD.US", "DOW.US", "FCX.US",
  "NEM.US", "PPG.US", "IFF.US", "LYB.US", "EMN.US", "ALB.US", "VMC.US",
  
  // Utilities
  "NEE.US", "DUK.US", "SO.US", "D.US", "EXC.US", "AEP.US", "XEL.US",
  "PPL.US", "ES.US", "AWK.US", "ED.US", "EIX.US", "WEC.US", "FE.US",
  
  // Real Estate
  "AMT.US", "PLD.US", "CCI.US", "EQIX.US", "SPG.US", "PSA.US", "O.US",
  "EXR.US", "AVB.US", "EQR.US", "MAA.US", "UDR.US", "ESS.US", "CPT.US",
  
  // Communication
  "GOOG.US", "META.US", "NFLX.US", "DIS.US", "CMCSA.US", "VZ.US", "T.US",
  "TMUS.US", "CHTR.US", "DISH.US", "LUMN.US", "VZ.US", "T.US", "TMUS.US"
];

export const NASDAQ_SYMBOLS = [
  // Major NASDAQ companies
  "AAPL.US", "MSFT.US", "GOOGL.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US",
  "NFLX.US", "CRM.US", "ADBE.US", "ORCL.US", "CSCO.US", "INTC.US", "AMD.US",
  "QCOM.US", "TXN.US", "AVGO.US", "NOW.US", "INTU.US", "PANW.US", "SNOW.US",
  "ZM.US", "ROKU.US", "PTON.US", "SPOT.US", "UBER.US", "LYFT.US", "SQ.US",
  "PYPL.US", "SHOP.US", "TWLO.US", "OKTA.US", "CRWD.US", "ZS.US", "NET.US",
  "DOCU.US", "TEAM.US", "WDAY.US", "VEEV.US", "MDB.US", "DDOG.US", "PLTR.US"
];

export const DOW_JONES_SYMBOLS = [
  "AAPL.US", "MSFT.US", "UNH.US", "GS.US", "HD.US", "CAT.US", "AMGN.US",
  "BA.US", "CRM.US", "V.US", "JPM.US", "WMT.US", "PG.US", "JNJ.US",
  "MCD.US", "NKE.US", "DIS.US", "AXP.US", "CVX.US", "IBM.US", "MRK.US",
  "TRV.US", "KO.US", "DOW.US", "WBA.US", "MMM.US", "INTC.US", "CSCO.US",
  "VZ.US", "T.US"
];

// רשימה מאוחדת של כל המניות מהאינדקסים הגדולים
export const MAJOR_INDICES_SYMBOLS = [
  ...new Set([...SP500_SYMBOLS, ...NASDAQ_SYMBOLS, ...DOW_JONES_SYMBOLS])
];

// פונקציה לבדיקה אם מניה נמצאת באינדקסים הגדולים
export const isMajorIndexStock = (symbol: string): boolean => {
  return MAJOR_INDICES_SYMBOLS.includes(symbol);
};

// פונקציה לסינון רשימת דיווחים למניות מהאינדקסים הגדולים
export const filterMajorIndexStocks = <T extends { code: string }>(reports: T[]): T[] => {
  return reports.filter(report => isMajorIndexStock(report.code));
};
