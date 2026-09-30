import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { UI_CARD_RADIUS, APP_LAYOUT } from '../../components/ui/appLayout';
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
import type { WatchlistRowData } from '../../services/watchlist/watchlistTypes';
import { WatchlistColumnHeader } from './components/WatchlistColumnHeader';
import { WatchlistEmpty } from './components/WatchlistEmpty';
import { WatchlistListNameSheet } from './components/WatchlistFormSheet';
import { WatchlistSymbolSheet } from './components/WatchlistSymbolSheet';
import { MarketsErrorBoundary } from '../Markets/MarketsErrorBoundary';

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
        marginHorizontal: APP_LAYOUT.cardPadding,
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
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const [newListName, setNewListName] = useState('');
  const [notesTarget, setNotesTarget] = useState<WatchlistRowData | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

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
    removeSymbol,
    setNotes,
    patchItem,
    reorderSymbols,
    addList,
    renameList,
    removeList,
  } = useWatchlist();

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
        prev.item.alerts_enabled === live.item.alerts_enabled &&
        prev.item.notes === live.item.notes &&
        prev.item.entry_price === live.item.entry_price &&
        prev.item.target_price === live.item.target_price
      ) {
        return prev;
      }
      return live;
    });
  }, [rows, notesTargetId]);

  const saveNotes = useCallback(async () => {
    const itemId = notesTarget?.item?.id;
    if (!itemId) return;
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

  const listData = useMemo(
    () => rows.filter((r) => !!r?.item?.symbol),
    [rows]
  );

  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      if (from === to) return;
      void HapticFeedback.impactLight();
      const data = reorderItems(listData, from, to);
      reorderSymbols(data.map((r) => r.item.symbol)).catch(() => {
        legacyAlert('שגיאה', 'לא ניתן לשמור את הסדר');
      });
    },
    [listData, reorderSymbols]
  );

  const handleDragStart = useCallback(() => {
    'worklet';
    runOnJS(hapticDragStart)();
  }, []);

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

  const openListsMenu = useCallback(() => {
    void HapticFeedback.selection();
    void showAppDialog({
      title: 'רשימות מעקב',
      message: 'בחירה, יצירה או ניהול',
      type: 'info',
      buttons: [
        ...watchlists.map((list) => ({
          text:
            list.id === activeWatchlistId ? `✓ ${list.name}` : list.name,
          style: 'default' as const,
          onPress: () => {
            if (list.id === activeWatchlistId) {
              openListActions(list.id, list.name, list.is_default);
              return;
            }
            setActiveWatchlistId(list.id);
          },
        })),
        {
          text: 'רשימה חדשה',
          style: 'default' as const,
          onPress: () => {
            setNewListName('');
            setCreateListOpen(true);
          },
        },
        { text: 'ביטול', style: 'cancel' as const },
      ],
    });
  }, [activeWatchlistId, openListActions, setActiveWatchlistId, watchlists]);

  const hp = APP_LAYOUT.screenPaddingHorizontal;
  const subtitle =
    rows.length > 0
      ? `${activeList?.name ?? 'הרשימה שלי'} · ${rows.length}`
      : activeList?.name;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1 },
        body: {
          flex: 1,
          minHeight: 0,
          paddingHorizontal: hp,
          paddingTop: APP_LAYOUT.stackGapSmall,
        },
        panel: {
          flex: 1,
          minHeight: 0,
          borderRadius: UI_CARD_RADIUS,
          overflow: 'hidden',
        },
        panelInner: {
          flex: 1,
          minHeight: 0,
          width: '100%',
          alignSelf: 'stretch',
        },
        skeletonList: { width: '100%' },
        listWrap: { flex: 1, minHeight: 0, width: '100%' },
        list: { flex: 1 },
        listContent: { flexGrow: 1, paddingBottom: APP_LAYOUT.stackGapSmall },
        listContentEmpty: { flexGrow: 1 },
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
    [tokens, hp]
  );

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.safe} edges={['top']}>
        <MainDrawerScreenHeader
          title="רשימת מעקב"
          subtitle={subtitle}
          onSubtitlePress={openListsMenu}
          onMenuPress={openMainDrawer}
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
              <UICard
                variant="soft"
                padding="none"
                style={styles.panel}
                contentContainerStyle={styles.panelInner}
              >
                <View style={styles.skeletonList}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <React.Fragment key={i}>
                      {i > 0 ? <RowDivider /> : null}
                      <WatchlistRowSkeleton delay={i * 50} index={i} />
                    </React.Fragment>
                  ))}
                </View>
              </UICard>
            ) : (
              <>
                <UICard
                  variant="soft"
                  padding="none"
                  style={styles.panel}
                  contentContainerStyle={styles.panelInner}
                >
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
                          onSuggest={(symbol, name) => {
                            void addSymbol(symbol, name);
                          }}
                        />
                      }
                      renderItem={renderWatchlistItem}
                    />
                  </View>
                </UICard>
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
