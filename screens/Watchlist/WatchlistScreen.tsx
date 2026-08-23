import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert, showAppConfirm, showAppDialog } from '../../utils/appDialog';
import { useWatchlist } from '../../hooks/useWatchlist';
import { SymbolSearchModal } from '../Portfolios/components/SymbolSearchModal';
import type { SymbolSearchResult } from '../../services/portfolios/portfolioPriceFeed';
import type { WatchlistRowData } from '../../services/watchlist/watchlistTypes';
import { WatchlistRow } from './components/WatchlistRow';
import { WatchlistColumnHeader } from './components/WatchlistColumnHeader';
import { WatchlistEmpty } from './components/WatchlistEmpty';
import { WatchlistListNameSheet } from './components/WatchlistFormSheet';
import { WatchlistSymbolSheet } from './components/WatchlistSymbolSheet';
import { MarketsErrorBoundary } from '../Markets/MarketsErrorBoundary';

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
    moveSymbol,
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

  const onReorderPress = useCallback(
    (symbol: string) => {
      void showAppDialog({
        title: symbol,
        message: 'סידור ברשימה',
        type: 'info',
        buttons: [
          {
            text: 'העבר למעלה',
            style: 'default',
            onPress: () => {
              void moveSymbol(symbol, -1);
            },
          },
          {
            text: 'העבר למטה',
            style: 'default',
            onPress: () => {
              void moveSymbol(symbol, 1);
            },
          },
          { text: 'ביטול', style: 'cancel' },
        ],
      });
    },
    [moveSymbol]
  );

  const renderWatchlistItem = useCallback(
    ({ item, index }: { item: WatchlistRowData; index: number }) => {
      if (!item?.item?.symbol) return null;
      return (
        <WatchlistRow
          row={item}
          index={index}
          onDrag={() => onReorderPress(item.item.symbol)}
          onPress={() => handleRowPress(item)}
        />
      );
    },
    [handleRowPress, onReorderPress]
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

  const hp = tokens.layout.screenPadding;
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
          paddingTop: 4,
        },
        panel: {
          flex: 1,
          minHeight: 0,
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        },
        panelInner: {
          flex: 1,
          minHeight: 0,
          width: '100%',
          alignSelf: 'stretch',
        },
        listWrap: { flex: 1, minHeight: 0, width: '100%' },
        list: { flex: 1 },
        listContent: { flexGrow: 1, paddingBottom: 8 },
        listContentEmpty: { flexGrow: 1 },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        },
        centerText: {
          color: tokens.colors.text.tertiary,
          fontSize: 13,
        },
        updatingRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 6,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        updatingText: {
          color: tokens.colors.primary.main,
          fontSize: 11,
          fontWeight: '700',
        },
      }),
    [tokens, hp]
  );

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
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
              <View style={styles.center}>
                <ActivityIndicator color={tokens.colors.primary.main} />
                <Text style={styles.centerText}>טוען רשימה…</Text>
              </View>
            ) : (
              <>
                <UICard
                  variant="glass"
                  glassIntensity="light"
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
                    <FlatList
                      data={listData}
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
