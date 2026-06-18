/** מצב production מסחרי — DB + SEC/Form4 בלבד, בלי feed חי מ-UW/Quiver. */
export function isSecProductionMode(): boolean {
  return (Deno.env.get('DARK_POOL_DATA_MODE') || '').trim().toLowerCase() === 'sec_production';
}
