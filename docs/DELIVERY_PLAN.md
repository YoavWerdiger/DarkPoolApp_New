# DarkPool – Production Delivery Plan

> Living document. Replaces the dozens of scattered `*_AUDIT.md`, `*_FIX_GUIDE.md`,
> and `*_README.md` files in the repository root. Treat this as the single
> source of truth for **what is left between us and production**.

Owner: Engineering. Last updated: see `git log -- docs/DELIVERY_PLAN.md`.

---

## 0. How to use this document

Each row in the tables below is an actionable work item. Status legend:

- `DONE`   – shipped to `main` and verified in CI.
- `WIP`    – branch open / in review.
- `TODO`   – queued; pick from the highest-priority `TODO` next.
- `BLOCKED` – waiting on a third party (Apple, Google, CardCom, etc.).

Priority bands:

- `P0` – Blocks production / security incident risk. Do these first.
- `P1` – Required for a sustainable release cadence.
- `P2` – Should-have hardening + DX improvements.
- `P3` – Nice-to-have, follow-ups, debt cleanup.

---

## 1. P0 – Security incidents

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | **Stop bundling CardCom API password into the client.** `EXPO_PUBLIC_CARDCOM_API_PASSWORD` (and `_API_NAME`, `_TERMINAL`) are read inside `services/paymentService.ts` and therefore inlined into every APK/IPA. | TODO | Rotate the CardCom credentials immediately. Move the password and API name into Supabase Edge Function secrets and call `create-payment` / `rapid-responder` from the client without secrets. Keep only the terminal number client-side if needed. |
| 1.2 | **Rotate Benzinga / EODHD / RapidAPI keys** – all currently exposed via `EXPO_PUBLIC_*`. | TODO | Proxy market-data requests through Edge Functions (`benzinga-*`, `daily-earnings-sync-*` already exist) and remove the keys from the client. |
| 1.3 | **Rotate Firebase API key** in `google-services.json`. Keep the platform-local copy under `android/app/`, do not commit a copy at the repo root. | TODO | The root-level `google-services.json` is now `.gitignore`d. For EAS Build, upload the file as an EAS Secret and reference it from `eas.json`. |
| 1.4 | **Untrack secrets and binary build artifacts.** Done: `git rm --cached` for `google-oauth-credentials.json`, root `google-services.json`, 8 × `app-release-*.aab`, loose `payment-callback-function.ts` / `payment-success-function.ts` / `send-push-direct.ts`, build logs. New `.gitignore` blocks future re-introduction. | DONE | Working tree intact; nothing was deleted from disk. Commit the staged removals to actually remove them from `HEAD`. |
| 1.5 | **`.idea/` workspace files churn** – now ignored. | DONE | |
| 1.6 | **History cleanup** – the AAB files and JSON credentials are still reachable via `git log` even after step 1.4. Use `git filter-repo` (one-shot, after coordination) and rotate any embedded secrets. | TODO | Coordinate – this rewrites history and forces every collaborator to re-clone. |

## 2. P0 – Build / CI

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | **`tsc --noEmit` crashes with `RangeError: Maximum call stack size exceeded`.** Root cause: deep type graph in chat + portfolios modules vs. Node's default ~1MB main-thread stack. | DONE | New `npm run typecheck` (and the CI step) run `tsc` via `node --stack-size=16384`. CI is currently green with 0 type errors. |
| 2.2 | **8 real TypeScript errors that were hidden behind the crash.** Listed in section 9. | DONE | Fixed: ChatGroupSettings type, GroupWithMembership union, RouteProp imports ×4, AddTradeScreen const assertion, TransactionsTab Ionicon name typing. |
| 2.3 | **Unit test scaffolding.** | DONE | `jest` + `jest-expo/node` preset. 58 tests across chat validation (XSS, length, rate-limit isolation per modality), portfolio FIFO / XIRR, persistent offline queue, per-group drafts, and throttled typing-broadcaster. Runs in `npm run test:ci` from CI. |

## 2.5 P0 – Consumer-grade messaging hardening (this PR)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.5.1 | **Persisted offline send queue.** Replaces the RAM-only `offlineQueueRef` with `services/chat/chatOfflineQueue.ts` (AsyncStorage-backed). Messages no longer evaporate on app kill / device reboot. Per-message attempt counter + exponential backoff (1s → 30s cap) and a hard ceiling of 5 attempts per message. | DONE | `__tests__/chat/chatOfflineQueue.test.ts` covers ordering, dedupe-by-id, idempotent remove, concurrent-enqueue serialisation, attempt counters, and round-trip across simulated process restarts. |
| 2.5.2 | **Per-group draft autosave.** New `services/chat/chatDrafts.ts` + `hooks/useChatDraft.ts`. Restores text on chat open, flushes to AsyncStorage on AppState background and on screen unmount with a 300ms debounce so writes are coalesced. Wired into `components/chat/ChatInput.tsx`; replaces the local `useState('')`. | DONE | Users never lose typed text — covers screen lock, app background, and force-quit. |
| 2.5.3 | **Throttled typing broadcaster.** New `hooks/useTypingBroadcast.ts`. First keystroke fires `onTyping(true)` immediately; subsequent keystrokes inside a 1.5s window are coalesced; `onTyping(false)` fires once after 2s of idle, on empty input, on send, and on unmount. Removes the per-keystroke realtime flood that was the largest realtime-channel cost driver. | DONE | 8 test cases in `__tests__/chat/useTypingBroadcast.test.ts` covering throttle window, idle timeout, instant-stop on empty, flushStop, and unmount cleanup. |
| 2.5.4 | **Client-generated `client_message_id`.** Each outbound message now carries a UUID v4 generated in `chatOfflineQueue.makeClientMessageId()` that travels through optimistic placeholder, network retries, and the persisted queue. **Server-side dedupe is not yet active** — migration 018 will add the column + unique index + an idempotent RPC; until then the id is a passive metadata field on the client. Tracked separately as 4.6. | PARTIAL | Forward-compatible: PostgREST today does not see the field. |
| 2.5.5 | **Tap-to-retry on failed sends.** `ChatMessage` already exposes `send_error`. UX wiring (visible "Tap to retry" button + call back through `sendMessage` with the same `client_message_id`) is the next step. | TODO | Once 2.5.4 server-side ships, the retry path becomes idempotent for free. |
| 2.5.6 | **Input feedback latency / scroll jitter / keyboard animation.** Three symptoms with one root cause: every state update in `ChatGroupScreen` (scroll event, message arrival, reaction) was rebuilding the inline handler closures passed into `ChatInput` and `ChatMessage`. `renderMessage`'s `useCallback` was effectively a no-op because its deps (those handlers) were fresh references on every render, so FlatList re-evaluated every visible cell on every render. ChatInput (~2,100 LOC with animation values, voice recorder, mention picker) was also unmemoised so it remounted internally on every keystroke. Fixes shipped in this PR: <ul><li>Wrapped `handleSendMessage`, `handleTyping`, `handleReply`, `handleMessageLongPress`, `handleReactionPress`, `handleReactionDetailsPress`, `handleJumpToMessage`, and a new `handleCancelReply` in `useCallback` with tight deps.</li><li>Wrapped `ChatInput`'s default export in `React.memo` with a comparator that short-circuits when none of the typed-message-relevant props changed.</li><li>Switched the chat `KeyboardAvoidingView` (from `react-native-keyboard-controller`) from `behavior="padding"` to `behavior="translate-with-padding"` — the library's recommended mode for chat screens (one-shot Reanimated transform, no per-frame layout pass).</li><li>Switched the keyboard event listeners from `keyboardWillShow/Hide` to `keyboardDidShow/Hide` on BOTH platforms. Updating state in `keyboardWillShow` is a documented cause of dropped keyboard animations on iOS because the React commit blocks Reanimated.</li><li>Dropped `autoscrollToTopThreshold: 10` from `maintainVisibleContentPosition` — in a non-inverted chat list "top" means the oldest message, so a 10-px threshold meant the list would silently fly to the start whenever the user paused near the top. `minIndexForVisible: 0` is preserved so prepended history still anchors correctly.</li></ul> | DONE | Verified with `npm run typecheck` + `npm test` (64 green). |

## 3. P1 – Test coverage on critical paths

| # | Item | Status |
|---|------|--------|
| 3.1 | Chat message sending — permission + rate-limit paths (integration with a Supabase mock). | TODO |
| 3.2 | Chat realtime — exponential backoff, jitter, max-retry cap (`chatRealtimeService.scheduleRetry`). | TODO |
| 3.3 | Payment flow — `paymentService.createCardcomLowProfileSession`, callback signature validation. | TODO |
| 3.4 | RLS regression suite — a `supabase/tests/` directory invoked via `psql`/`pgTAP`. | TODO |
| 3.5 | Snapshot/component tests for `ChatMessage`, `ChatGroupCard`, `PortfolioCard`. | TODO |

Coverage gate currently set to `lines: 5 / statements: 5` in `jest.config.js`. Raise by 10 points per milestone.

## 4. P1 – Server / Edge Functions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | **Move payment session creation server-side.** `create-payment` already exists in `supabase/functions/`; ensure the client calls it instead of building the CardCom request directly. | TODO | Pre-req for 1.1. |
| 4.2 | **Server-side rate-limit enforcement on message send.** Today rate-limit is client-side only (`chatValidation.checkRateLimit`); the `rate_limits` table + `atomic_rate_limit` RPC already exist (migrations 002 / 008) — wire them into `chat-send-message` Edge Function and require it from the client. | TODO | |
| 4.3 | **Audit RLS on `chat_messages`, `chat_group_members`, `polls`, `trades`, `portfolio_transactions`.** Confirm every read/write path is restricted by `auth.uid()` and that no `usingChat()` policy uses heavy joins. | TODO | |
| 4.4 | **Edge Function consolidation.** 12+ overlapping `daily-earnings-sync-*` variants in `supabase/functions/` — delete dead ones, keep one canonical version per cadence (daily / live / notifications). | TODO | |
| 4.5 | **Realtime fan-out.** `subscribeToAllUserGroups` listens to *every* `chat_messages` INSERT then filters client-side. Plan a migration to per-group channels or server-side filters once concurrent active users exceed ~100. | TODO | Tracked in `CHAT_SYSTEM_AUDIT.md` § 6. |
| 4.6 | **Idempotent message insert.** Add `client_message_id uuid` column on `chat_messages` + a partial unique index where it is `NOT NULL`. Replace the raw `.insert(...)` in `services/chat/chatMessageService.ts` with an RPC `send_chat_message(...)` that uses `INSERT ... ON CONFLICT (client_message_id) DO NOTHING RETURNING ...` (or a `SELECT` fallback) so retries from the offline queue never produce duplicate rows. The client already generates and persists the id (see 2.5.4). | TODO | Migration only — does not require a client roll-forward, since 2.5.4 already includes the id everywhere. |

## 5. P1 – Repository hygiene

| # | Item | Status |
|---|------|--------|
| 5.1 | Untrack stale duplicate project `DarkPoolApp_New/` (95MB) and `DASHBOARD_DEPLOY/` (Edge Function copy-pastes). | DONE |
| 5.2 | Move ~100 root-level `*.sql` scratch files into `database/scratch/` and the ~80 `*_FIX_*.md` / `*_GUIDE.md` files into `docs/archive/`. | TODO |
| 5.3 | Add ESLint + Prettier + `expo lint` as a CI step. | TODO |
| 5.4 | Split `services/chat/chatMessageService.ts` (1,127 LOC) into `send`, `edit`, `react`, `mark-as-read` sub-modules. Same for `chatGroupService.ts` (785 LOC). | TODO |

## 6. P2 – Performance

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | Wrap `renderMessage` in `useCallback`; fix `ChatMessage` memo comparator to include `isHighlighted` and the other rendered fields. | DONE | `renderMessage` was already memoised. We expanded the `ChatMessage` comparator to cover `mentioned_users`, `read_by_count`, `is_starred_by_me`, `reactions_count`, `deleted_for_everyone`, `media_thumbnail_url`, and `reply_to`, plus an identity-equality fast path. Also dropped redundant inner `key` props from the renderItem return — FlatList already keys cells via `keyExtractor`. |
| 6.2 | Throttle outbound `setTypingStatus` to ≥ 1Hz. | DONE | See 2.5.3. |
| 6.3 | Migrate `chat_messages` `FlatList` → `@shopify/flash-list` (already a dependency). | TODO | |
| 6.4 | Persist React Query cache via `@tanstack/query-async-storage-persister` for offline-first chat opens. | TODO | |
| 6.5 | Audit bundle with `npx expo export --dump-sourcemap` and check unused locale data from `date-fns`. | TODO | |
| 6.6 | FlatList tuning — eliminate scroll-anchor jumps and stop invalidating memoisation on every parent render. | DONE | Replaced `extraData={displayMessages}` (freshly-allocated array on every state update) with `extraData={highlightedMessageId}`. Added `removeClippedSubviews` on Android. `maintainVisibleContentPosition` and `windowSize=11 / initialNumToRender=15 / maxToRenderPerBatch=8` were already in place. `getItemLayout` is intentionally left off: chat rows have variable heights (text vs media vs trade cards), so any estimate causes worse scroll jumps than the default measurement path. |
| 6.7 | Replace `console.log` in chat hot paths with the structured `logger`. | DONE | Verified zero `console.log` calls in `components/chat/**`, `screens/ChatNew/**`, and `context/ChatContext.tsx`. Also removed the per-frame `logger.debug` inside `onContentSizeChange` which was flooding the dev console during scroll. |

## 7. P2 – Observability

Sentry is already initialised (`utils/sentry.ts`) and the structured `logger` routes warns/errors through it.

| # | Item |
|---|------|
| 7.1 | Add transaction sampling for the chat send path (`Sentry.startTransaction`). |
| 7.2 | Forward Supabase Edge Function logs to Sentry via `@sentry/deno`. |
| 7.3 | Add a Sentry release tag derived from `eas.json` autoIncrement. |
| 7.4 | Dashboard: P95 message-send latency, realtime disconnects per hour, payment callback failures. |

## 8. P3 – Follow-ups

- Consolidate `COLORS` / `MSG_COLORS` into `components/ui/DesignTokens.tsx`.
- Accessibility pass on chat (`accessibilityLabel`s on icons, send button, reactions).
- Pre-flight checklist `expo-doctor` is currently `continue-on-error: true` in CI — make it blocking once outstanding warnings are resolved.

---

## 9. Type-system fixes shipped in this PR

For posterity, these are the eight TypeScript errors that surfaced once we
gave the compiler enough stack to actually run:

1. `components/chat/CreateGroupSheet.tsx` — `is_announcement` / `is_public`
   were assigned to `ChatGroupSettings` but the interface didn't declare them.
   The settings column is JSONB, so the fields are now declared as optional
   on the type.
2. `screens/ChatNew/ChatGroupsListScreen.tsx` — `GroupWithMembership.my_role`
   was typed as `string`, narrowing the underlying `ChatMemberRole | undefined`
   on `ChatGroup`. Now uses `Omit<ChatGroup, 'my_role'>` + `ChatGroup['my_role']`.
3. `screens/Journal/AddTradeScreen.tsx` — `null as const` is illegal (`const`
   assertions can't be applied to `null`). Replaced with `null as null`.
4–7. `RouteProp` was imported from `@react-navigation/native-stack` (which does
   not export it) in `screens/Journal/TradeDetailScreen.tsx`,
   `screens/Portfolios/PortfolioDetailScreen.tsx`,
   `screens/Portfolios/AddTransactionScreen.tsx`, and
   `screens/Portfolios/ImportTransactionsScreen.tsx`. Now imported from
   `@react-navigation/native`.
8. `screens/Portfolios/tabs/TransactionsTab.tsx` — the deprecated namespace
   import `import('@expo/vector-icons/Ionicons').glyphMap` does not exist on
   `@expo/vector-icons@^15`. Replaced with
   `React.ComponentProps<typeof Ionicons>['name']`.

## 10. Required follow-ups before tagging a production release

These must be true at tag time (cross out, don't delete, as you complete them):

- [ ] CardCom API password no longer reachable from the client bundle.
- [ ] Benzinga / EODHD / RapidAPI keys no longer reachable from the client bundle.
- [ ] Firebase API key rotated; root `google-services.json` not in `HEAD`.
- [x] CI green (`npm run typecheck`, `npm run test:ci`, `npx expo export`).
- [ ] Sentry release tag matches the build version (EAS `autoIncrement`).
- [ ] RLS test suite passes on a staging Supabase project.
- [ ] Rollback path documented (previous EAS Update channel pinned).
- [ ] On-call runbook in `docs/RUNBOOK.md` (TODO).
