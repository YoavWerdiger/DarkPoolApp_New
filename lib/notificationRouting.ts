/**
 * מיפוי data מהתראת Push → יעד ניווט ב-root stack.
 * פונקציה טהורה לבדיקות יחידה ולשימוש מ-App.tsx (tap חם / cold start).
 */

export type NotificationNavTarget =
  | {
      kind: 'chat';
      groupId: string;
      groupName: string;
      messageId?: string;
    }
  | {
      kind: 'news';
      articleId: string;
    }
  | {
      kind: 'earnings';
      earningsReportId?: string;
      ticker?: string;
      reportDate?: string;
    }
  | {
      kind: 'economic_calendar';
      eventId?: string;
    }
  | {
      kind: 'dark_pool';
      ticker: string;
    }
  | {
      kind: 'dark_pool_person';
      personId: string;
      personKind: 'politician' | 'insider' | 'fund_manager';
      ticker?: string;
      nameHint?: string;
    }
  | {
      kind: 'watchlist_alert';
      symbol: string;
      price?: number;
    }
  | {
      kind: 'main';
    };

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** מנרמל payload מהתראה (edge / pending_notifications) ליעד ניווט */
export function resolveNotificationNavTarget(
  data: Record<string, unknown> | null | undefined,
): NotificationNavTarget {
  if (!data || typeof data !== 'object') {
    return { kind: 'main' };
  }

  const type = asString(data.type) ?? asString(data.notificationType);
  const kind = asString(data.kind);

  if (type === 'chat_message') {
    const groupId = asString(data.group_id) ?? asString(data.groupId);
    if (!groupId) return { kind: 'main' };
    return {
      kind: 'chat',
      groupId,
      groupName: asString(data.group_name) ?? asString(data.groupName) ?? "צ'אט",
      messageId: asString(data.message_id) ?? asString(data.messageId),
    };
  }

  if (type === 'news') {
    const articleId = asString(data.articleId) ?? asString(data.article_id);
    if (!articleId) return { kind: 'main' };
    return { kind: 'news', articleId };
  }

  if (type === 'earnings' || type === 'earnings_results') {
    return {
      kind: 'earnings',
      earningsReportId:
        asString(data.earnings_report_id) ?? asString(data.earningsReportId),
      ticker: asString(data.ticker) ?? asString(data.code),
      reportDate: asString(data.report_date) ?? asString(data.reportDate),
    };
  }

  if (type === 'economic_calendar' || type === 'economic_result') {
    return {
      kind: 'economic_calendar',
      eventId: asString(data.eventId) ?? asString(data.event_id),
    };
  }

  if (kind === 'dark_pool_signal') {
    const ticker = asString(data.ticker);
    if (!ticker) return { kind: 'main' };
    return { kind: 'dark_pool', ticker };
  }

  if (
    type === 'dark_pool_person_trade' ||
    type === 'dark_pool_fund_13f' ||
    type === 'dark_pool_follow'
  ) {
    const personId = asString(data.person_id) ?? asString(data.personId);
    const personKindRaw = asString(data.person_kind) ?? asString(data.personKind);
    if (!personId || !personKindRaw) return { kind: 'main' };
    const personKind =
      personKindRaw === 'politician' || personKindRaw === 'fund_manager'
        ? personKindRaw
        : 'insider';
    return {
      kind: 'dark_pool_person',
      personId,
      personKind,
      ticker: asString(data.ticker),
      nameHint: asString(data.person_name) ?? asString(data.personName),
    };
  }

  if (type === 'watchlist_alert') {
    const symbol = asString(data.symbol);
    if (!symbol) return { kind: 'main' };
    return {
      kind: 'watchlist_alert',
      symbol: symbol.toUpperCase(),
      price: asFiniteNumber(data.price),
    };
  }

  return { kind: 'main' };
}

/** בונה ארגומנטים ל-rootNavigationRef.navigate(...) */
export function buildNotificationNavigateArgs(
  target: NotificationNavTarget,
): { name: string; params?: Record<string, unknown> } {
  switch (target.kind) {
    case 'chat':
      return {
        name: 'Main',
        params: {
          screen: 'Chat',
          params: {
            screen: 'ChatGroup',
            params: {
              groupId: target.groupId,
              groupName: target.groupName,
              ...(target.messageId ? { scrollToMessageId: target.messageId } : {}),
            },
          },
        },
      };
    case 'news':
      return {
        name: 'Main',
        params: {
          screen: 'News',
          params: { articleId: target.articleId },
        },
      };
    case 'earnings':
      return {
        name: 'Main',
        params: {
          screen: 'NewsEarnings',
          params: {
            ...(target.earningsReportId
              ? { earningsReportId: target.earningsReportId }
              : {}),
            ...(target.ticker ? { ticker: target.ticker } : {}),
            ...(target.reportDate ? { reportDate: target.reportDate } : {}),
          },
        },
      };
    case 'economic_calendar':
      return {
        name: 'Main',
        params: {
          screen: 'NewsCalendar',
          params: {
            ...(target.eventId ? { eventId: target.eventId } : {}),
          },
        },
      };
    case 'dark_pool':
      return {
        name: 'Main',
        params: {
          screen: 'DarkPool',
          params: {
            screen: 'DarkPoolTicker',
            params: { ticker: target.ticker, tab: 'darkpool' },
          },
        },
      };
    case 'dark_pool_person':
      return {
        name: 'Main',
        params: {
          screen: 'DarkPool',
          params: {
            screen: 'DarkPoolInvestor',
            params: {
              id: target.personId,
              kind: target.personKind,
              ...(target.ticker ? { ticker: target.ticker } : {}),
              ...(target.nameHint ? { nameHint: target.nameHint } : {}),
            },
          },
        },
      };
    case 'watchlist_alert':
      return {
        name: 'Main',
        params: {
          screen: 'Journal',
          params: {
            screen: 'AddTrade',
            params: {
              initialSymbol: target.symbol,
              ...(target.price != null ? { initialEntryPrice: target.price } : {}),
            },
          },
        },
      };
    case 'main':
    default:
      return { name: 'Main' };
  }
}
