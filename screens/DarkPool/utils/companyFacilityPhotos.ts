/**
 * תמונת המטה (HQ) של החברה — מותאמת ידנית (סטטית) לכל חברה, מוצגת חלש ברקע מתחת ללוגו.
 * Wikimedia Commons בלבד (רישיון חופשי), כל קישור נבדק (200), 2026-10-30.
 * בלי תמונת מטה ודאית (JNJ, MRK, REGN, SNY, SFTBY) — רק רקע צבע המותג.
 */
const HQ: Record<string, string> = {
  AMD: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/2485_Augustine_Drive_headquarters_in_Santa_Clara%2C_California.jpg/960px-2485_Augustine_Drive_headquarters_in_Santa_Clara%2C_California.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // 2485 Augustine Drive headquarters in Santa Clara, California.jpg
  AMZN: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Amazon_Spheres_2018.jpg/960px-Amazon_Spheres_2018.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Amazon Spheres 2018.jpg
  BABA: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/TaobaoCity_Alibaba_Xixi_Park.jpg/960px-TaobaoCity_Alibaba_Xixi_Park.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // TaobaoCity Alibaba Xixi Park.jpg
  CSCO: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Cisco_Systems_Headquarters_%28Building_10%29%2C_Cisco_San_Jose_Main_Campus.jpg/960px-Cisco_Systems_Headquarters_%28Building_10%29%2C_Cisco_San_Jose_Main_Campus.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Cisco Systems Headquarters (Building 10), Cisco San Jose Main Campus.jpg
  GE: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/GE_Aerospace_Headquarters_Complex_Evendale_Ohio_2023.JPG/960px-GE_Aerospace_Headquarters_Complex_Evendale_Ohio_2023.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // GE Aerospace Headquarters Complex Evendale Ohio 2023.JPG
  GILD: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Gilead_Sciences_headquarters_%28Foster_City%2C_CA%29_-_2.jpg/960px-Gilead_Sciences_headquarters_%28Foster_City%2C_CA%29_-_2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Gilead Sciences headquarters (Foster City, CA) - 2.jpg
  GOOGL: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Googleplex_with_Pride_colors_2015.gk.jpg/960px-Googleplex_with_Pride_colors_2015.gk.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Googleplex with Pride colors 2015.gk.jpg
  INTC: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Intel_Headquarters_in_2023.jpg/960px-Intel_Headquarters_in_2023.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Intel Headquarters in 2023.jpg
  NTES: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/NetEaseHangzhouOffice.jpg/960px-NetEaseHangzhouOffice.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // NetEaseHangzhouOffice.jpg
  NVDA: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/NVIDIA_Headquarters.jpg/960px-NVIDIA_Headquarters.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // NVIDIA Headquarters.jpg
  PFE: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/The_Spiral_005.jpg/960px-The_Spiral_005.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // The Spiral 005.jpg
  TM: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Toyota_Headquarter_Toyota_City.jpg/960px-Toyota_Headquarter_Toyota_City.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Toyota Headquarter Toyota City.jpg
  UBER: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Uber_offices%2C_Mission_Bay_%28July_2020%29_-2.jpg/960px-Uber_offices%2C_Mission_Bay_%28July_2020%29_-2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Uber offices, Mission Bay (July 2020) -2.jpg
  WMT: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Walmart_Home_Office_Bentonville%2C_Arkansas.jpg/960px-Walmart_Home_Office_Bentonville%2C_Arkansas.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Walmart Home Office Bentonville, Arkansas.jpg
};

export function companyFacilityPhotoUrl(ticker: string | null | undefined): string | null {
  const t = ticker?.trim().toUpperCase();
  return t ? HQ[t] ?? null : null;
}
