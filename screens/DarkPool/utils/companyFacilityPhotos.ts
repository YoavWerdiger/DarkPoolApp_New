/**
 * תמונת מתקן של החברה (מטה / קמפוס / מפעל) — מוצגת חלש מאוד מאחורי הלוגו בכרטיס ובכותרת.
 * Wikimedia Commons בלבד (רישיון חופשי), נבדקו ב-HEAD (200), נבדק 2026-10-30.
 * בלי תמונה ודאית (JNJ — נמצא בניין של חברה אחרת, REGN — לא ודאי, SFTBY — לא נמצא) — רק רקע המותג.
 */
const FACILITY: Record<string, string> = {
  AMD: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/2485_Augustine_Drive_headquarters_in_Santa_Clara%2C_California.jpg/960px-2485_Augustine_Drive_headquarters_in_Santa_Clara%2C_California.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // 2485 Augustine Drive headquarters in Santa Clara, California.jpg
  AMZN: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Amazon_spheres_W.jpg/960px-Amazon_spheres_W.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Amazon spheres W.jpg
  BABA: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Alibaba_Binjiang_Park.jpg/960px-Alibaba_Binjiang_Park.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Alibaba Binjiang Park.jpg
  CSCO: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Cisco_Office_Garching.jpg/960px-Cisco_Office_Garching.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Cisco Office Garching.jpg
  GE: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/GE_Aerospace_Headquarters_Complex_Evendale_Ohio_2023.JPG/960px-GE_Aerospace_Headquarters_Complex_Evendale_Ohio_2023.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // GE Aerospace Headquarters Complex Evendale Ohio 2023.JPG
  GILD: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Gilead_Sciences_headquarter_%28Foster_City%2C_CA%29_-_1.jpg/960px-Gilead_Sciences_headquarter_%28Foster_City%2C_CA%29_-_1.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Gilead Sciences headquarter (Foster City, CA) - 1.jpg
  GOOGL: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Google_Campus%2C_Mountain_View%2C_CA.jpg/960px-Google_Campus%2C_Mountain_View%2C_CA.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Google Campus, Mountain View, CA.jpg
  INTC: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Intel_Headquarters_in_2023.jpg/960px-Intel_Headquarters_in_2023.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Intel Headquarters in 2023.jpg
  MRK: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Merck_office_Upper_Gwynedd_Township_Montgomery_County.jpg/960px-Merck_office_Upper_Gwynedd_Township_Montgomery_County.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Merck office Upper Gwynedd Township Montgomery County.jpg
  NTES: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/NetEaseHangzhouOffice.jpg/960px-NetEaseHangzhouOffice.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // NetEaseHangzhouOffice.jpg
  NVDA: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/NVIDIA_Headquarters.jpg/960px-NVIDIA_Headquarters.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // NVIDIA Headquarters.jpg
  PFE: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Pfizer_World_Headquarters_%2851921996957%29.jpg/960px-Pfizer_World_Headquarters_%2851921996957%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Pfizer World Headquarters (51921996957).jpg
  SNY: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/A_Sanofi_pharmaceutical_plant_in_Chattanooga%2C_Tennessee_04.jpg/960px-A_Sanofi_pharmaceutical_plant_in_Chattanooga%2C_Tennessee_04.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // A Sanofi pharmaceutical plant in Chattanooga, Tennessee 04.jpg
  TM: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Headquarter_of_Toyota_Motor_Corporation_4.JPG/960px-Headquarter_of_Toyota_Motor_Corporation_4.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Headquarter of Toyota Motor Corporation 4.JPG
  UBER: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Uber_offices%2C_Mission_Bay_%28July_2020%29_-2.jpg/960px-Uber_offices%2C_Mission_Bay_%28July_2020%29_-2.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Uber offices, Mission Bay (July 2020) -2.jpg
  WMT: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Walmart_Home_Office_Bentonville%2C_Arkansas.jpg/960px-Walmart_Home_Office_Bentonville%2C_Arkansas.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail', // Walmart Home Office Bentonville, Arkansas.jpg
};

export function companyFacilityPhotoUrl(ticker: string | null | undefined): string | null {
  const t = ticker?.trim().toUpperCase();
  return t ? FACILITY[t] ?? null : null;
}
