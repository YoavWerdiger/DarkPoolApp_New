import {
  buildNotificationNavigateArgs,
  resolveNotificationNavTarget,
} from '../../lib/notificationRouting';

describe('notificationRouting', () => {
  it('routes chat_message with group + message ids to ChatGroup scrollToMessageId', () => {
    const target = resolveNotificationNavTarget({
      type: 'chat_message',
      group_id: 'g1',
      group_name: 'קבוצה',
      message_id: 'm9',
    });
    expect(target).toEqual({
      kind: 'chat',
      groupId: 'g1',
      groupName: 'קבוצה',
      messageId: 'm9',
    });
    expect(buildNotificationNavigateArgs(target)).toEqual({
      name: 'Main',
      params: {
        screen: 'Chat',
        params: {
          screen: 'ChatGroup',
          params: {
            groupId: 'g1',
            groupName: 'קבוצה',
            scrollToMessageId: 'm9',
          },
        },
      },
    });
  });

  it('routes news with articleId to News params', () => {
    const target = resolveNotificationNavTarget({
      type: 'news',
      articleId: 'a42',
    });
    expect(target).toEqual({ kind: 'news', articleId: 'a42' });
    expect(buildNotificationNavigateArgs(target)).toEqual({
      name: 'Main',
      params: {
        screen: 'News',
        params: { articleId: 'a42' },
      },
    });
  });

  it('routes earnings_results with report id/ticker/date to NewsEarnings', () => {
    const target = resolveNotificationNavTarget({
      type: 'earnings_results',
      earnings_report_id: 'er-1',
      ticker: 'AAPL',
      report_date: '2026-08-14',
    });
    expect(target).toEqual({
      kind: 'earnings',
      earningsReportId: 'er-1',
      ticker: 'AAPL',
      reportDate: '2026-08-14',
    });
    expect(buildNotificationNavigateArgs(target)).toEqual({
      name: 'Main',
      params: {
        screen: 'NewsEarnings',
        params: {
          earningsReportId: 'er-1',
          ticker: 'AAPL',
          reportDate: '2026-08-14',
        },
      },
    });
  });

  it('accepts notificationType alias from process-pending-notifications', () => {
    const target = resolveNotificationNavTarget({
      notificationType: 'news',
      article_id: 'legacy-id',
    });
    expect(target).toEqual({ kind: 'news', articleId: 'legacy-id' });
  });

  it('falls back to Main when payload is empty', () => {
    expect(resolveNotificationNavTarget(null)).toEqual({ kind: 'main' });
    expect(buildNotificationNavigateArgs({ kind: 'main' })).toEqual({ name: 'Main' });
  });

  it('routes dark_pool_person_trade sell to DarkPoolInvestor', () => {
    const target = resolveNotificationNavTarget({
      type: 'dark_pool_person_trade',
      person_id: 'P000197',
      person_kind: 'politician',
      person_name: 'Nancy Pelosi',
      ticker: 'NVDA',
      transaction_type: 'sell',
    });
    expect(target).toEqual({
      kind: 'dark_pool_person',
      personId: 'P000197',
      personKind: 'politician',
      ticker: 'NVDA',
      nameHint: 'Nancy Pelosi',
    });
  });

  it('routes dark_pool_fund_13f to fund_manager profile', () => {
    const target = resolveNotificationNavTarget({
      type: 'dark_pool_fund_13f',
      person_id: '1067983',
      person_kind: 'fund_manager',
      person_name: 'Warren Buffett',
      filing_date: '2026-08-15',
    });
    expect(target).toEqual({
      kind: 'dark_pool_person',
      personId: '1067983',
      personKind: 'fund_manager',
      ticker: undefined,
      nameHint: 'Warren Buffett',
    });
    expect(buildNotificationNavigateArgs(target)).toEqual({
      name: 'Main',
      params: {
        screen: 'DarkPool',
        params: {
          screen: 'DarkPoolInvestor',
          params: {
            id: '1067983',
            kind: 'fund_manager',
            nameHint: 'Warren Buffett',
          },
        },
      },
    });
  });
});
