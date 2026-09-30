import React, { createContext, useContext } from 'react';

const SheetSurfaceContext = createContext(false);

/** מסמן שתוכן מצויר על רקע שיט. מילוי השיט והכרטיס שבתוכו הוא cardSolid. */
export function SheetSurfaceProvider({ children }: { children: React.ReactNode }) {
  return <SheetSurfaceContext.Provider value={true}>{children}</SheetSurfaceContext.Provider>;
}

export function useSheetSurface(): boolean {
  return useContext(SheetSurfaceContext);
}
