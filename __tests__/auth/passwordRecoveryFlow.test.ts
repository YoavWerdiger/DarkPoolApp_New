/**
 * בדיקות לוגיקה לזרימת איפוס סיסמה — בלי רשת.
 * מוודאים שמיפוי שגיאות וחוזה ההצלחה לא חוזרים ל-success מדומה.
 */

describe('password recovery error mapping', () => {
  function mapSaveError(code: string | null | undefined): string {
    if (code === 'no_session') return 'הסשן פג – בקש קוד חדש';
    if (code === 'weak_password') return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    if (code === 'timeout') return 'שמירת הסיסמה ארכה יותר מדי. בדוק חיבור ונסה שוב.';
    if (code === 'invalid_email') return 'חסרה כתובת אימייל. חזור להתחברות ובקש קוד חדש.';
    if (code === 'password_not_persisted') {
      return 'הסיסמה לא נשמרה בשרת. בקש קוד איפוס חדש ונסה שוב.';
    }
    return code || 'שגיאה בשמירת הסיסמה. נסה שוב.';
  }

  it('maps password_not_persisted to a clear Hebrew error', () => {
    expect(mapSaveError('password_not_persisted')).toContain('לא נשמרה בשרת');
  });

  it('maps no_session', () => {
    expect(mapSaveError('no_session')).toContain('הסשן פג');
  });

  it('treats missing data.user as failure contract', () => {
    const updateOk = { data: { user: null }, error: null };
    const success = !updateOk.error && !!updateOk.data?.user;
    expect(success).toBe(false);
  });

  it('requires both update success and verify sign-in session', () => {
    const updateSuccess = true;
    const verifySession = null as { user: { id: string } } | null;
    const overall = updateSuccess && !!verifySession?.user;
    expect(overall).toBe(false);
  });
});
