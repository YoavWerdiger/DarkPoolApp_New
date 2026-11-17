/**
 * שיט בחירת מניות (התראות דיווחי רווח וכו') — אותו שיט כמו הוספה לרשימת המעקב
 * (חיפוש, קטגוריות, ~730 מניות + חיפוש בכל השוק). לחיצה על מניה שנבחרה מסירה אותה.
 */
import React, { useMemo } from 'react';
import i18n from '../../lib/i18n';
import { WatchlistAddSheet } from '../../screens/Watchlist/components/WatchlistAddSheet';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  selected: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

export function TickerPickSheet({ isOpen, onClose, title = i18n.t('auto.components__profile__TickerPickSheet.s1'), selected, onAdd, onRemove }: Props) {
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toUpperCase())), [selected]);
  return (
    <WatchlistAddSheet
      visible={isOpen}
      onClose={onClose}
      title={title}
      existingSymbols={selectedSet}
      onAdd={(symbol) => onAdd(symbol.toUpperCase())}
      onRemove={(symbol) => onRemove(symbol.toUpperCase())}
    />
  );
}

export default TickerPickSheet;
