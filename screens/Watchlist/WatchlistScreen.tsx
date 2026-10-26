import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import ReorderableList, {
  reorderItems,
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { runOnJS } from 'react-native-reanimated';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { ROW_PAD_H } from './watchlistTheme';
import { appCaptionStyle } from '../../components/ui/appType';
import { WatchlistRow } from './components/WatchlistRow';
import { WatchlistRowSkeleton } from './components/WatchlistRowSkeleton';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert, showAppConfirm, showAppDialog } from '../../utils/appDialog';
import { useWatchlist } from '../../hooks/useWatchlist';
import { SymbolSearchModal } from '../Portfolios/components/SymbolSearchModal';
import type { SymbolSearchResult } from '../../services/portfolios/portfolioPriceFeed';
import { SUGGESTED_WATCHLIST_SYMBOLS, type WatchlistRowData } from '../../services/watchlist/watchlistTypes';
import { WatchlistColumnHeader } from './components/WatchlistColumnHeader';
import { WatchlistEmpty } from './components/WatchlistEmpty';
import { WatchlistListNameSheet } from './components/WatchlistFormSheet';
import { WatchlistSymbolSheet } from './components/WatchlistSymbolSheet';
import { MarketsErrorBoundary } from '../Markets/MarketsErrorBoundary';
import { PortfolioSwitcher } from '../Portfolios/components/PortfolioSwitcher';
import UIButton from '../../components/ui/UIButton';

function hapticDragStart() {
  void HapticFeedback.medium();
}

function hapticDragStep() {
  void HapticFeedback.selection();
}

const ReorderableWatchlistRow = React.memo(function ReorderableWatchlistRow({
  row,
  index,
  onPress,
}: {
  row: WatchlistRowData;
  index: number;
  onPress: (row: WatchlistRowData) => void;
}) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  return (
    <WatchlistRow
      row={row}
      index={index}
      isActive={isActive}
      onDrag={drag}
      onPress={() => onPress(row)}
    />
  );
});

function RowDivider() {
  const tokens = useDesignTokens();
  return (
    <View
      style={{
        height: 1,
        marginHorizontal: ROW_PAD_H,
        backgroundColor: tokens.colors.border.divider,
      }}
    />
  );
}

export default function WatchlistScreen() {
  const navigation = useNavigation();
  const tokens = useDesignTokens();
  const mainTabsHeight = useMainTabsHeight();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  // הוספה מהירה (רשימה ריקה): בחירה מרובה + כפתור אישור צף בתחתית
  const [quickPicked, setQuickPicked] = useState<string[]>([]);
  const [quickAdding, setQuickAdding] = useState(false);
  const toggleQuickPick = useCallback((symbol: string) => {
    void HapticFeedback.selection();
    setQuickPicked((prev) => (prev.includes(symbol) ? prev.filter((x) => x !== symbol) : [...prev, symbol]));
  }, []);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const [newListName, setNewListName] = useState('');
  const [notesTarget, setNotesTarget] = useState<WatchlistRowData | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const notesDraftRef = useRef('');
  notesDraftRef.current = notesDraft;

  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    rows,
    sortMode,
    setSortMode,
    isLoading,
    isFetchingQuotes,
    isRefreshing,
    refreshAll,
    addSymbol,
    addSymbols,
    removeSymbol,
    setNotes,
    patchItem,
    reorderSymbols,
    addList,
    renameList,
    removeList,
  } = useWatchlist();

  // מעבר רשימה מאפס את הבחירה המהירה
  useEffect(() => {
    setQuickPicked([]);
  }, [activeWatchlistId]);

  const finishQuickAdd = useCallback(async () => {
    if (!quickPicked.length || quickAdding) return;
    setQuickAdding(true);
    try {
      const items = quickPicked
        .map((sym) => SUGGESTED_WATCHLIST_SYMBOLS.find((x) => x.symbol === sym))
        .filter((x): x is (typeof SUGGESTED_WATCHLIST_SYMBOLS)[number] => !!x);
      await addSymbols(items.map((i) => ({ symbol: i.symbol, companyName: i.name })));
      void HapticFeedback.success();
      setQuickPicked([]);
    } catch {
      legacyAlert('שגיאה', 'לא ניתן להוסיף את המניות');
    } finally {
      setQuickAdding(false);
    }
  }, [quickPicked, quickAdding, addSymbols]);

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const handleSelectSymbol = useCallback(
    async (result: SymbolSearchResult) => {
      setSearchOpen(false);
      try {
        await addSymbol(result.symbol, result.description);
        void HapticFeedback.success();
      } catch {
        legacyAlert('שגיאה', 'לא ניתן להוסיף את הסימבול');
      }
    },
    [addSymbol]
  );

  const handleRemove = useCallback(
    async (symbol: string) => {
      const ok = await showAppConfirm('הסרה מהרשימה', `להסיר את ${symbol}?`, {
        confirmText: 'הסר',
        cancelText: 'ביטול',
        destructive: true,
      });
      if (!ok) return;
      try {
        await removeSymbol(symbol);
        void HapticFeedback.success();
      } catch {
        legacyAlert('שגיאה', 'לא ניתן להסיר את הסימבול');
      }
    },
    [removeSymbol]
  );

  const handleRowPress = useCallback((row: WatchlistRowData) => {
    setNotesTarget(row);
    setNotesDraft(row.item.notes ?? '');
  }, []);

  // רענון מחיר בשיט הפתוח בלי לולאת setState
  const notesTargetId = notesTarget?.item?.id;
  useEffect(() => {
    if (!notesTargetId) return;
    const live = rows.find((r) => r.item.id === notesTargetId);
    if (!live) return;
    setNotesTarget((prev) => {
      if (!prev || prev.item.id !== live.item.id) return prev;
      if (
        prev.price === live.price &&
        prev.changePct === live.changePct &&
        prev.item === live.item
      ) {
        return prev;
      }
      // הערה שהתעדכנה בשרת (cache ישן → רענון) — רק אם המשתמש עוד לא ערך אותה
      if (
        prev.item.notes !== live.item.notes &&
        notesDraftRef.current === (prev.item.notes ?? '')
      ) {
        setNotesDraft(live.item.notes ?? '');
      }
      return live;
    });
  }, [rows, notesTargetId]);

  const saveNotes = useCallback(async () => {
    const itemId = notesTarget?.item?.id;
    if (!itemId) return;
    // בלי שינוי — לא כותבים (לא לדרוס הערה עדכנית יותר בשרת)
    if ((notesTarget?.item?.notes ?? '').trim() === notesDraft.trim()) return;
    try {
      await setNotes(itemId, notesDraft);
    } catch {
      legacyAlert('שגיאה', 'לא ניתן לשמור הערה');
      throw new Error('notes_save_failed');
    }
  }, [notesDraft, notesTarget, setNotes]);

  const removeFromSheet = useCallback(() => {
    const symbol = notesTarget?.item?.symbol;
    if (!symbol) return;
    setNotesTarget(null);
    void handleRemove(symbol);
  }, [handleRemove, notesTarget]);

  const goAddTrade = useCallback(
    (payload: {
      symbol: string;
      entryPrice?: number | null;
      notes?: string | null;
    }) => {
      setNotesTarget(null);
      try {
        navigation.dispatch(
          CommonActions.navigate({
            name: 'Journal',
            params: {
              screen: 'AddTrade',
              params: {
                initialSymbol: payload.symbol,
                ...(payload.entryPrice != null && Number.isFinite(payload.entryPrice)
                  ? { initialEntryPrice: payload.entryPrice }
                  : {}),
                ...(payload.notes?.trim()
                  ? { initialNotes: payload.notes.trim() }
                  : {}),
              },
            },
          })
        );
      } catch {
        legacyAlert('ניווט', 'לא ניתן לפתוח את היומן כרגע');
      }
    },
    [navigation]
  );

  const closeListNameSheet = useCallback(() => {
    setCreateListOpen(false);
    setRenameTarget(null);
    setNewListName('');
  }, []);

  const handleCreateList = useCallback(async () => {
    try {
      await addList(newListName.trim() || 'רשימה חדשה');
      closeListNameSheet();
      void HapticFeedback.success();
    } catch {
      legacyAlert('שגיאה', 'לא ניתן ליצור רשימה');
    }
  }, [addList, newListName, closeListNameSheet]);

  const handleRenameList = useCallback(async () => {
    if (!renameTarget) return;
    try {
      await renameList(renameTarget.id, newListName.trim() || renameTarget.name);
      closeListNameSheet();
      void HapticFeedback.success();
    } catch {
      legacyAlert('שגיאה', 'לא ניתן לשנות שם');
    }
  }, [renameList, renameTarget, newListName, closeListNameSheet]);

  const activeList = watchlists.find((w) => w.id === activeWatchlistId);

  const liveListData = useMemo(
    () => rows.filter((r) => !!r?.item?.symbol),
    [rows]
  );

  // בזמן גרירה הרשימה «קפואה»: מחירים חיים (כל ~250ms) ומיון לפי שינוי היו מחליפים
  // את data מתחת לאצבע — והגרירה נשברה / קפצה למקום אחר. משחררים אחרי השמירה.
  const [dragFrozen, setDragFrozen] = useState(false);
  const frozenDataRef = useRef<WatchlistRowData[]>(liveListData);
  if (!dragFrozen) frozenDataRef.current = liveListData;
  const listData = dragFrozen ? frozenDataRef.current : liveListData;
  const unfreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const freezeForDrag = useCallback(() => {
    if (unfreezeTimerRef.current) clearTimeout(unfreezeTimerRef.current);
    unfreezeTimerRef.current = null;
    hapticDragStart();
    setDragFrozen(true);
  }, []);

  const releaseAfterDrag = useCallback((from: number, to: number) => {
    if (unfreezeTimerRef.current) clearTimeout(unfreezeTimerRef.current);
    // בלי שינוי מקום אין onReorder — משחררים מיד; אחרת onReorder משחרר (גיבוי בטיימר)
    unfreezeTimerRef.current = setTimeout(
      () => {
        unfreezeTimerRef.current = null;
        setDragFrozen(false);
      },
      from === to ? 0 : 1500
    );
  }, []);

  useEffect(
    () => () => {
      if (unfreezeTimerRef.current) clearTimeout(unfreezeTimerRef.current);
    },
    []
  );

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      if (from === to) {
        setDragFrozen(false);
        return;
      }
      void HapticFeedback.impactLight();
      const data = reorderItems(frozenDataRef.current, from, to);
      // העדכון האופטימיסטי ב-cache נכנס לפני השחרור — בלי הבהוב לסדר הישן
      reorderSymbols(data.map((r) => r.item.symbol))
        .catch(() => {
          legacyAlert('שגיאה', 'לא ניתן לשמור את הסדר');
        });
      if (unfreezeTimerRef.current) clearTimeout(unfreezeTimerRef.current);
      unfreezeTimerRef.current = null;
      setDragFrozen(false);
    },
    [reorderSymbols]
  );

  const handleDragStart = useCallback(() => {
    'worklet';
    runOnJS(freezeForDrag)();
  }, [freezeForDrag]);

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      'worklet';
      runOnJS(releaseAfterDrag)(from, to);
    },
    [releaseAfterDrag]
  );

  const handleIndexChange = useCallback(() => {
    'worklet';
    runOnJS(hapticDragStep)();
  }, []);

  const renderWatchlistItem = useCallback(
    ({ item, index }: { item: WatchlistRowData; index: number }) => {
      if (!item?.item?.symbol) return null;
      return (
        <ReorderableWatchlistRow
          row={item}
          index={index}
          onPress={handleRowPress}
        />
      );
    },
    [handleRowPress]
  );

  const openListActions = useCallback(
    (id: string, name: string, isDefault: boolean) => {
      void HapticFeedback.medium();
      const buttons = [
        {
          text: 'שינוי שם',
          style: 'default' as const,
          onPress: () => {
            setNewListName(name);
            setRenameTarget({ id, name });
          },
        },
        ...(!isDefault
          ? [
              {
                text: 'מחק רשימה',
                style: 'destructive' as const,
                onPress: () => {
                  void (async () => {
                    const ok = await showAppConfirm(
                      'מחיקת רשימה',
                      `למחוק את "${name}"?`,
                      {
                        confirmText: 'מחק',
                        cancelText: 'ביטול',
                        destructive: true,
                      }
                    );
                    if (ok) {
                      try {
                        await removeList(id);
                      } catch {
                        legacyAlert('שגיאה', 'לא ניתן למחוק את הרשימה');
                      }
                    }
                  })();
                },
              },
            ]
          : []),
        { text: 'ביטול', style: 'cancel' as const },
      ];
      void showAppDialog({
        title: name,
        message: 'פעולות על הרשימה',
        type: 'info',
        buttons,
      });
    },
    [removeList]
  );



  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1 },
        // הרשימה על המסך עצמו (בלי כרטיס) — ריפוד אופקי בשורות (ROW_PAD_H = ריפוד מסך)
        body: {
          flex: 1,
          minHeight: 0,
          paddingTop: APP_LAYOUT.stackGapSmall,
        },
        panel: {
          flex: 1,
          minHeight: 0,
          width: '100%',
          alignSelf: 'stretch',
        },
        skeletonList: { width: '100%' },
        listWrap: { flex: 1, minHeight: 0, width: '100%' },
        list: { flex: 1 },
        listContent: { flexGrow: 1, paddingBottom: APP_LAYOUT.stackGapSmall },
        // מקום לכפתור האישור הצף
        listContentEmpty: { flexGrow: 1, paddingBottom: 88 },
        quickAddBar: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: APP_LAYOUT.stackGapSmall,
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        },
        updatingRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: APP_LAYOUT.stackGapSmall,
          paddingVertical: APP_LAYOUT.stackGapSmall,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        },
        updatingText: {
          ...appCaptionStyle,
          width: undefined,
          color: tokens.colors.text.secondary,
        },
      }),
    [tokens]
  );

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.safe} edges={['top']}>
        <MainDrawerScreenHeader
          title="רשימת מעקב"
          onMenuPress={openMainDrawer}
          // בורר רשימות — כמו בורר התיקים ביומן המסחר
          sectionContainerStyle={{
            paddingTop: 0,
            marginTop: APP_LAYOUT.stackGapSmall - APP_LAYOUT.cardPadding,
          }}
          section={
            watchlists.length > 0 ? (
              <PortfolioSwitcher
                portfolios={watchlists}
                selectedId={activeWatchlistId ?? ''}
                onSelect={(id) => setActiveWatchlistId(id)}
                onCreate={() => {
                  setNewListName('');
                  setCreateListOpen(true);
                }}
                onActivePress={(id) => {
                  const list = watchlists.find((w) => w.id === id);
                  if (list) openListActions(list.id, list.name, list.is_default);
                }}
                sheetTitle="הרשימות שלי"
                createLabel="רשימה חדשה"
              />
            ) : undefined
          }
          rightAccessory={
            <DayNavBlurButton
              onPress={() => {
                void HapticFeedback.selection();
                setSearchOpen(true);
              }}
              glassIntensity="subtle"
              size={DRAWER_MENU_BUTTON_SIZE}
              accessibilityLabel="הוספת סימבול"
            >
              <Ionicons name="add" size={24} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          }
        />
        <View style={[styles.body, { marginBottom: Math.max(0, mainTabsHeight - 12) }]}>
          <MarketsErrorBoundary>
            {isLoading && rows.length === 0 ? (
              <View style={styles.panel}>
                <View style={styles.skeletonList}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <React.Fragment key={i}>
                      {i > 0 ? <RowDivider /> : null}
                      <WatchlistRowSkeleton delay={i * 50} index={i} />
                    </React.Fragment>
                  ))}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.panel}>
                  {isFetchingQuotes && listData.length === 0 ? (
                    <View style={styles.updatingRow}>
                      <ActivityIndicator
                        size="small"
                        color={tokens.colors.primary.main}
                      />
                      <Text style={styles.updatingText}>מעדכן מחירים…</Text>
                    </View>
                  ) : null}
                  {rows.length > 0 ? (
                    <WatchlistColumnHeader
                      sortMode={sortMode}
                      onSortChange={setSortMode}
                    />
                  ) : null}

                  <View style={styles.listWrap}>
                    <ReorderableList
                      data={listData}
                      onReorder={handleReorder}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onIndexChange={handleIndexChange}
                      shouldUpdateActiveItem
                      keyExtractor={(item) =>
                        item?.item?.id ?? String(item?.item?.symbol)
                      }
                      style={styles.list}
                      contentContainerStyle={
                        listData.length === 0
                          ? styles.listContentEmpty
                          : styles.listContent
                      }
                      showsVerticalScrollIndicator={false}
                      ItemSeparatorComponent={RowDivider}
                      refreshControl={
                        <RefreshControl
                          refreshing={isRefreshing}
                          onRefresh={() => {
                            void refreshAll();
                          }}
                          tintColor={tokens.colors.primary.main}
                        />
                      }
                      ListEmptyComponent={
                        <WatchlistEmpty
                          onAddPress={() => setSearchOpen(true)}
                          picked={quickPicked}
                          onTogglePick={toggleQuickPick}
                        />
                      }
                      renderItem={renderWatchlistItem}
                    />
                  </View>
                </View>
                {/* אישור ההוספה המהירה — צף בתחתית כל עוד יש בחירה */}
                {listData.length === 0 && quickPicked.length > 0 ? (
                  <View style={styles.quickAddBar} pointerEvents="box-none">
                    <UIButton
                      title={quickPicked.length === 1 ? 'הוספת מניה אחת' : `הוספת ${quickPicked.length} מניות`}
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={quickAdding}
                      onPress={() => void finishQuickAdd()}
                    />
                  </View>
                ) : null}
              </>
            )}
          </MarketsErrorBoundary>
        </View>
      </RNSafeAreaView>

      <SymbolSearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(r) => {
          void handleSelectSymbol(r);
        }}
      />

      <WatchlistListNameSheet
        visible={createListOpen || !!renameTarget}
        mode={renameTarget ? 'rename' : 'create'}
        value={newListName}
        onChangeValue={setNewListName}
        onClose={closeListNameSheet}
        onSubmit={() => {
          if (renameTarget) void handleRenameList();
          else void handleCreateList();
        }}
      />

      <WatchlistSymbolSheet
        visible={!!notesTarget}
        row={notesTarget}
        notes={notesDraft}
        onChangeNotes={setNotesDraft}
        onClose={() => setNotesTarget(null)}
        onSaveNotes={() => {
          void saveNotes();
        }}
        onRemove={removeFromSheet}
        onPatch={async (itemId, patch) => {
          await patchItem(itemId, patch);
        }}
        onAddToJournal={goAddTrade}
      />
    </ScreenChrome>
  );
}
