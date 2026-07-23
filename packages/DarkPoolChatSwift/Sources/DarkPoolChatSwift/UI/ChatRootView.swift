import SwiftUI
#if os(iOS)
import UIKit
#endif

private enum ChatNav: Hashable {
    case conversation(String)
    case groupDetail(String)
}

/// ממשק צ׳אט — אסתטיקה נייטיבית של SwiftUI (מערכת, Materials, SF Symbols), עם **accent** מותג (`ChatDesignTokens.brand`).
public struct ChatRootView: View {
    @ObservedObject private var model: ChatSessionViewModel
    /// תפריט חשבון בסרגל רשימת הצ׳אטים (אופציונלי — ללא כפילות עם בר־אפליקציה חיצוני).
    let userEmail: String?
    let onSignOut: (() async -> Void)?
    @State private var draft = ""
    @State private var storyUserId: String?
    @State private var showStoryViewer = false
    @State private var showAddStory = false
    @State private var chatPath: [ChatNav] = []
    @State private var chatListSearch = ""

    public init(
        model: ChatSessionViewModel,
        userEmail: String? = nil,
        onSignOut: (() async -> Void)? = nil
    ) {
        self.model = model
        self.userEmail = userEmail
        self.onSignOut = onSignOut
    }

    private var accountToolbarPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .automatic
        #endif
    }

    public var body: some View {
        ZStack {
            ChatScreenBackground()
            NavigationStack(path: $chatPath) {
                chatGroupsSidebar
                    .navigationDestination(for: ChatNav.self) { route in
                        switch route {
                        case .conversation(let gid):
                            ConversationPane(model: model, groupId: gid, draft: $draft)
                                .navigationTitle(model.group(withId: gid)?.name ?? "צ׳אט")
                        case .groupDetail(let gid):
                            ChatGroupDetailView(groupId: gid, model: model, onLeavePopToRoot: {
                                chatPath.removeAll()
                            })
                        }
                    }
            }
            .tint(ChatDesignTokens.brand)
        }
        .environment(\.layoutDirection, .rightToLeft)
        .preferredColorScheme(.dark)
    }

    private var filteredChatGroups: [ChatGroupListItem] {
        let q = chatListSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return model.groups }
        return model.groups.filter { g in
            g.name.lowercased().contains(q)
                || (g.lastMessagePreview ?? "").lowercased().contains(q)
        }
    }

    /// מפוצל מ־`body` לזמן קומפילציה של SwiftUI.
    private var chatGroupsSidebar: some View {
        VStack(spacing: 0) {
            StoryStripView(
                items: model.storyStrip,
                onSelect: { item in
                    storyUserId = item.userId
                    showStoryViewer = true
                },
                onAddTap: { showAddStory = true }
            )
            .padding(.vertical, ChatDesignTokens.Spacing.sm)
            .background(ChatBrandTheme.backgroundSecondary)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(ChatBrandTheme.borderDivider)
                    .frame(height: 0.5)
            }

            if let err = model.errorMessage, !err.isEmpty {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(Color(red: 1, green: 0.42, blue: 0.42))
                    .multilineTextAlignment(.center)
                    .padding(ChatDesignTokens.Spacing.sm)
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 1, green: 0.32, blue: 0.32).opacity(0.14))
            }

            Group {
                if model.isLoadingGroups && model.groups.isEmpty {
                    VStack(spacing: ChatDesignTokens.Spacing.md) {
                        Spacer(minLength: 24)
                        ProgressView()
                            .scaleEffect(1.1)
                        Text("טוען שיחות…")
                            .font(.subheadline)
                            .foregroundStyle(ChatBrandTheme.textSecondary)
                        Spacer(minLength: 24)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.groups.isEmpty {
                    ChatListEmptyStateView(isFilteredEmpty: false)
                } else if filteredChatGroups.isEmpty {
                    ChatListEmptyStateView(isFilteredEmpty: true)
                } else {
                    chatGroupsList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.clear)
        .navigationTitle("צ׳אטים")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $chatListSearch, prompt: "חיפוש צ׳אטים")
        #endif
        .chatNavigationChrome()
        .toolbar {
            if onSignOut != nil {
                ToolbarItem(placement: accountToolbarPlacement) {
                    Menu {
                        if let email = userEmail, !email.isEmpty {
                            Text(email)
                                .font(.caption)
                        }
                        Button(role: .destructive) {
                            Task { await onSignOut?() }
                        } label: {
                            Label("התנתק", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                    }
                    .accessibilityLabel("חשבון והתנתקות")
                }
            }
        }
        .task {
            await model.loadGroups()
            await model.loadStoryStrip()
        }
        .sheet(isPresented: $showStoryViewer) {
            if let uid = storyUserId {
                StoryViewerSheet(userId: uid, model: model) {
                    showStoryViewer = false
                    Task { await model.loadStoryStrip() }
                }
            }
        }
        .sheet(isPresented: $showAddStory) {
            AddStorySheet(model: model) {
                showAddStory = false
                Task { await model.loadStoryStrip() }
            }
        }
    }

    private var chatGroupsList: some View {
        List {
            ForEach(filteredChatGroups) { g in
                NavigationLink(value: ChatNav.conversation(g.id)) {
                    ChatConversationListRow(group: g)
                }
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        #if os(iOS)
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        #else
        .listStyle(.plain)
        #endif
        .refreshable {
            await model.loadGroups()
            await model.loadStoryStrip()
        }
    }
}

// MARK: - רשימה ריקה

private struct ChatListEmptyStateView: View {
    let isFilteredEmpty: Bool

    var body: some View {
        VStack(spacing: ChatDesignTokens.Spacing.md) {
            Spacer(minLength: 32)
            Image(systemName: isFilteredEmpty ? "magnifyingglass" : "bubble.left.and.bubble.right")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(ChatDesignTokens.brand.opacity(0.85))
            Text(isFilteredEmpty ? "אין תוצאות" : "אין צ׳אטים עדיין")
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(ChatBrandTheme.textPrimary)
            Text(isFilteredEmpty ? "נסה מילת חיפוש אחרת" : "כשתצטרף לקבוצה, היא תופיע כאן")
                .font(.subheadline)
                .foregroundStyle(ChatBrandTheme.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, ChatDesignTokens.Spacing.xl)
            Spacer(minLength: 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Conversation

private struct ConversationPane: View {
    @ObservedObject var model: ChatSessionViewModel
    let groupId: String
    @Binding var draft: String
    @State private var editingMessage: ChatMessageListItem?
    @State private var editText = ""
    @State private var deleteTarget: ChatMessageListItem?
    @State private var showDeleteEveryone = false
    @State private var showSearch = false
    @State private var searchQuery = ""
    @State private var showMediaLibraryPicker = false
    @State private var showDocumentPicker = false
    @State private var forwardTarget: ChatMessageListItem?

    var body: some View {
        conversationWithSheets
    }

    /// שכבת toolbar + lifecycle — מפוצל לזמן קומפילציה.
    private var conversationChromeAndToolbar: some View {
        conversationCore
            .chatNavigationChrome()
            #if os(iOS)
            .toolbar(.hidden, for: .tabBar)
            #endif
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        showSearch = true
                    } label: {
                        Image(systemName: "magnifyingglass")
                    }
                    NavigationLink(value: ChatNav.groupDetail(groupId)) {
                        Image(systemName: "info.circle")
                    }
                }
            }
            .task(id: groupId) {
                await model.selectGroup(groupId)
            }
            .onDisappear {
                Task { await model.stopRealtime() }
            }
            .onChange(of: model.messages.last?.id) { _ in
                Task { await model.markVisibleAsRead() }
            }
            .onChange(of: editingMessage?.id) { _ in
                if let m = editingMessage { editText = m.content ?? "" }
            }
    }

    private var conversationWithSheets: some View {
        conversationChromeAndToolbar
            .sheet(item: $editingMessage) { m in
                editMessageSheet(m)
            }
            .confirmationDialog("מחיקה", isPresented: Binding(
                get: { deleteTarget != nil },
                set: { if !$0 { deleteTarget = nil } }
            ), titleVisibility: .visible) {
                Button("מחק", role: .destructive) {
                    if let m = deleteTarget {
                        Task {
                            await model.deleteMessage(message: m, forEveryone: showDeleteEveryone)
                            deleteTarget = nil
                        }
                    }
                }
                Button("ביטול", role: .cancel) { deleteTarget = nil }
            } message: {
                Text(showDeleteEveryone ? "למחוק לכולם?" : "להסיר אצלך בלבד?")
            }
            .sheet(isPresented: $showSearch) {
                searchSheet
            }
            .sheet(item: $forwardTarget) { msg in
                ForwardDestinationSheet(
                    model: model,
                    excludeGroupId: groupId,
                    messageId: msg.id,
                    onFinished: { forwardTarget = nil }
                )
            }
            #if os(iOS)
            .sheet(isPresented: $showMediaLibraryPicker) {
                ChatMediaLibraryPicker { result in
                    showMediaLibraryPicker = false
                    switch result {
                    case .image(let data):
                        Task { await model.sendImage(data: data) }
                    case .video(let data):
                        Task { await model.sendVideo(data: data) }
                    case .cancelled:
                        break
                    }
                }
            }
            .sheet(isPresented: $showDocumentPicker) {
                ChatDocumentPicker { data, name in
                    showDocumentPicker = false
                    if let data, let name {
                        Task { await model.sendDocument(data: data, fileName: name) }
                    }
                }
            }
            #endif
    }

    @ViewBuilder
    private func editMessageSheet(_ m: ChatMessageListItem) -> some View {
        NavigationView {
            Form {
                TextField("תוכן", text: $editText)
            }
            .navigationTitle("עריכת הודעה")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { editingMessage = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("שמור") {
                        Task {
                            await model.editMessage(message: m, newText: editText)
                            editingMessage = nil
                        }
                    }
                }
            }
        }
    }

    private var searchSheet: some View {
        NavigationView {
            VStack {
                TextField("חיפוש בהודעות…", text: $searchQuery)
                    .textFieldStyle(.roundedBorder)
                    .padding()
                    .onSubmit {
                        Task { await model.searchInCurrentGroup(query: searchQuery) }
                    }
                Button("חפש") {
                    Task { await model.searchInCurrentGroup(query: searchQuery) }
                }
                .buttonStyle(.borderedProminent)
                .tint(ChatDesignTokens.brand)
                if model.isSearching {
                    ProgressView()
                }
                List(model.searchResults) { r in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(r.senderDisplayName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(r.content ?? "")
                            .font(.body)
                    }
                }
            }
            .navigationTitle("חיפוש")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("סגור") { showSearch = false }
                }
            }
        }
    }

    /// מפוצל לטובת זמן קומפילציה של SwiftUI.
    private var conversationCore: some View {
        ZStack {
            ChatScreenBackground()
            VStack(spacing: 0) {
                if let err = model.errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(ChatSwiftTheme.destructive)
                        .padding(ChatDesignTokens.Spacing.sm)
                }

                if !model.typingUserNames.isEmpty {
                    Text(typingLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.top, ChatDesignTokens.Spacing.xs)
                }

                messageListWithScroll
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                composerInset
            }
        }
    }

    private var messageListWithScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    loadMoreSection
                    ForEach(model.messages) { m in
                        messageRow(m, scrollProxy: proxy)
                    }
                }
                .padding()
            }
            .onChange(of: model.messages.count) { _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: draft) { new in
                model.userTypedInComposer(new)
            }
        }
    }

    @ViewBuilder
    private var loadMoreSection: some View {
        if model.hasMoreOlder {
            Button(action: {
                Task { await model.loadOlderMessages() }
            }) {
                if model.isLoadingOlder {
                    ProgressView()
                } else {
                    Label("טען הודעות קודמות", systemImage: "arrow.up.circle")
                        .font(.caption)
                        .foregroundStyle(ChatDesignTokens.brand)
                }
            }
            .frame(maxWidth: .infinity)
            .id("loadMoreTop")
        }
    }

    private func messageRow(_ m: ChatMessageListItem, scrollProxy: ScrollViewProxy) -> some View {
        MessageBubbleView(
            message: m,
            model: model,
            onReplyPreviewTap: { repliedId in
                withAnimation(.easeInOut(duration: 0.28)) {
                    scrollProxy.scrollTo(repliedId, anchor: .center)
                }
            }
        )
            .id(m.id)
            .contextMenu {
                Button("השב") { model.replyDraftTo = m }
                Button(m.isStarred ? "הסר כוכב" : "סמן בכוכב") {
                    Task { await model.toggleStar(message: m) }
                }
                Button("העברה…") {
                    forwardTarget = m
                }
                #if os(iOS)
                if let t = m.content, !t.isEmpty {
                    Button("העתק") {
                        UIPasteboard.general.string = t
                    }
                }
                #endif
                if m.isFromCurrentUser && m.messageType == "text" {
                    Button("ערוך") {
                        editingMessage = m
                        editText = m.content ?? ""
                    }
                }
                Button("מחק אצלי", role: .destructive) {
                    deleteTarget = m
                    showDeleteEveryone = false
                }
                if m.isFromCurrentUser {
                    Button("מחק לכולם", role: .destructive) {
                        deleteTarget = m
                        showDeleteEveryone = true
                    }
                }
                Menu("ריאקציה") {
                    ForEach(["👍", "❤️", "😂", "😮", "🙏"], id: \.self) { e in
                        Button(e) {
                            Task { await model.toggleReaction(message: m, emoji: e) }
                        }
                    }
                }
            }
    }

    private var composerInset: some View {
        VStack(spacing: 0) {
            if let reply = model.replyDraftTo {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("תשובה ל־\(reply.senderDisplayName)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(reply.content ?? "")
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                    }
                    Spacer()
                    Button(action: { model.replyDraftTo = nil }) {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(ChatDesignTokens.Spacing.sm)
                .background(ChatSwiftTheme.secondaryGrouped)
                .clipShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous))
                .padding(.horizontal)
                .padding(.bottom, ChatDesignTokens.Spacing.xs)
            }

            HStack(alignment: .center, spacing: ChatDesignTokens.Spacing.sm) {
                #if os(iOS)
                Menu {
                    Button {
                        showMediaLibraryPicker = true
                    } label: {
                        Label("תמונה או וידאו", systemImage: "photo.on.rectangle.angled")
                    }
                    Button {
                        showDocumentPicker = true
                    } label: {
                        Label("מסמך", systemImage: "doc.badge.plus")
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .symbolRenderingMode(.hierarchical)
                }
                .accessibilityLabel("צרף מדיה")
                #endif

                TextField("הודעה", text: $draft)
                    .padding(.horizontal, ChatDesignTokens.Spacing.md)
                    .padding(.vertical, ChatDesignTokens.Spacing.sm)
                    .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.md, style: .continuous))
                    .foregroundStyle(.primary)
                #if os(iOS)
                .textInputAutocapitalization(.sentences)
                #endif

                Button(action: {
                    Task {
                        await model.sendCurrentDraft(draft)
                        draft = ""
                    }
                }) {
                    Text("שלח")
                        .font(.body.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(ChatDesignTokens.brand)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, ChatDesignTokens.Layout.screenPadding)
            .padding(.vertical, ChatDesignTokens.Spacing.sm)
        }
        #if os(iOS)
        .background(Material.bar)
        #else
        .background(ChatSwiftTheme.secondaryGrouped)
        #endif
    }

    private var typingLine: String {
        let names = model.typingUserNames.joined(separator: ", ")
        return names.isEmpty ? "" : "\(names) מקליד…"
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        guard let last = model.messages.last else { return }
        withAnimation {
            proxy.scrollTo(last.id, anchor: .bottom)
        }
    }
}

// MARK: - Bubbles

private struct MessageBubbleView: View {
    let message: ChatMessageListItem
    @ObservedObject var model: ChatSessionViewModel
    /// לחיצה על בועת התשובה (ציטוט) — גלילה להודעה המקורית ברשימה.
    var onReplyPreviewTap: ((String) -> Void)?

    init(
        message: ChatMessageListItem,
        model: ChatSessionViewModel,
        onReplyPreviewTap: ((String) -> Void)? = nil
    ) {
        self.message = message
        self.model = model
        self.onReplyPreviewTap = onReplyPreviewTap
    }

    var body: some View {
        HStack(alignment: .bottom) {
            if message.isFromCurrentUser { Spacer(minLength: 36) }
            VStack(alignment: message.isFromCurrentUser ? .trailing : .leading, spacing: 6) {
                if !message.isFromCurrentUser {
                    Text(message.senderDisplayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if message.isForwarded {
                    HStack(spacing: 4) {
                        Image(systemName: "arrowshape.turn.up.right")
                            .font(.caption2)
                        Text("הועבר")
                            .font(.caption2.weight(.medium))
                    }
                    .foregroundStyle(message.isFromCurrentUser ? Color.white.opacity(0.85) : Color.secondary)
                }

                if let reply = message.replyTo {
                    HStack {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(ChatDesignTokens.brand)
                            .frame(width: 3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(reply.senderName)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(reply.contentPreview ?? "")
                                .font(.caption2)
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                        }
                    }
                    .padding(ChatDesignTokens.Spacing.sm)
                    .background(ChatSwiftTheme.secondaryGrouped.opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous))
                    .onTapGesture {
                        onReplyPreviewTap?(reply.messageId)
                    }
                    .accessibilityAddTraits(onReplyPreviewTap != nil ? .isButton : AccessibilityTraits())
                }

                Group {
                    if message.messageType == "poll", let pid = message.pollId {
                        PollMessageView(pollId: pid, model: model)
                    } else if message.messageType == "image", let ref = message.mediaURL {
                        ChatSignedImageView(mediaRef: ref, model: model)
                    } else if message.messageType == "video", let ref = message.mediaURL {
                        ChatSignedVideoView(mediaRef: ref, model: model)
                    } else if (message.messageType == "audio" || message.messageType == "voice"), let ref = message.mediaURL {
                        ChatSignedAudioPlayerView(
                            mediaRef: ref,
                            durationSeconds: message.mediaDurationSeconds,
                            isFromCurrentUser: message.isFromCurrentUser,
                            model: model
                        )
                    } else if message.messageType == "document", let ref = message.mediaURL {
                        ChatSignedDocumentView(
                            mediaRef: ref,
                            fileName: message.mediaFileName,
                            isFromCurrentUser: message.isFromCurrentUser,
                            model: model
                        )
                    } else if message.messageType == "trade", let raw = message.content, !raw.isEmpty {
                        ChatTradeBubbleView(jsonContent: raw, isFromCurrentUser: false)
                    } else if message.messageType == "media_group" {
                        Text("אלבום מדיה")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.primary)
                        Text("הצגה מלאה תתווסף בהמשך.")
                            .font(.caption2)
                            .foregroundStyle(Color.secondary)
                    } else if message.messageType == "text" || message.messageType == "system" {
                        Text(displayText)
                            .font(.body)
                            .foregroundStyle(message.isFromCurrentUser ? Color.white : Color.primary)
                    } else {
                        Text("[\(message.messageType)]")
                            .font(.caption)
                            .foregroundStyle(ChatSwiftTheme.tertiaryLabel)
                    }
                }
                .padding(ChatDesignTokens.Spacing.md)
                .background(bubbleBackground(for: message))
                .clipShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.bubble, style: .continuous))

                if message.isEdited {
                    Text("נערך")
                        .font(.caption2)
                        .foregroundStyle(ChatSwiftTheme.tertiaryLabel)
                }

                if !message.reactions.isEmpty {
                    FlowReactionRow(reactions: message.reactions) { emoji in
                        Task { await model.toggleReaction(message: message, emoji: emoji) }
                    }
                }

                HStack(spacing: 4) {
                    if message.isStarred {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(message.isFromCurrentUser ? Color.white.opacity(0.9) : ChatDesignTokens.brand)
                    }
                    Text(timeString)
                        .font(.caption2)
                        .foregroundStyle(ChatSwiftTheme.tertiaryLabel)
                    if message.isFromCurrentUser {
                        Image(systemName: message.isReadByMe ? "checkmark.circle.fill" : "checkmark.circle")
                            .font(.caption2)
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(.white.opacity(message.isReadByMe ? 1 : 0.55))
                    }
                }
            }
            if !message.isFromCurrentUser { Spacer(minLength: 36) }
        }
    }

    private func bubbleBackground(for message: ChatMessageListItem) -> some View {
        Group {
            if message.messageType == "poll" {
                ChatSwiftTheme.secondaryGrouped
            } else if message.messageType == "trade" || message.messageType == "media_group" {
                ChatSwiftTheme.secondaryGrouped
            } else if message.isFromCurrentUser {
                ChatDesignTokens.brand
            } else {
                ChatSwiftTheme.fill
            }
        }
    }

    private var displayText: String {
        message.content ?? ""
    }

    private var timeString: String {
        let f = DateFormatter()
        f.timeStyle = .short
        f.dateStyle = .none
        return f.string(from: message.createdAt)
    }
}

private struct FlowReactionRow: View {
    let reactions: [ReactionGroup]
    let onTap: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(reactions, id: \.emoji) { r in
                Button(action: { onTap(r.emoji) }) {
                    Text("\(r.emoji) \(r.count)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(r.reactedByMe ? ChatDesignTokens.brand.opacity(0.22) : ChatSwiftTheme.fill)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct ForwardDestinationSheet: View {
    @ObservedObject var model: ChatSessionViewModel
    let excludeGroupId: String
    let messageId: String
    var onFinished: () -> Void

    @State private var selected = Set<String>()
    @Environment(\.dismiss) private var dismiss

    private var destinations: [ChatGroupListItem] {
        model.groups.filter { $0.id != excludeGroupId }
    }

    var body: some View {
        NavigationView {
            Group {
                if destinations.isEmpty {
                    VStack(spacing: ChatDesignTokens.Spacing.md) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 40))
                            .foregroundStyle(.tertiary)
                        Text("אין קבוצות נוספות")
                            .font(.headline)
                        Text("הצטרף לקבוצה נוספת כדי להעביר אליה הודעות.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding()
                } else {
                    List {
                        ForEach(destinations) { g in
                            Button {
                                if selected.contains(g.id) {
                                    selected.remove(g.id)
                                } else {
                                    selected.insert(g.id)
                                }
                            } label: {
                                HStack {
                                    Text(g.name)
                                    Spacer()
                                    if selected.contains(g.id) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(ChatDesignTokens.brand)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("העברה ל…")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") {
                        dismiss()
                        onFinished()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("העבר") {
                        Task {
                            await model.forwardMessage(messageId: messageId, toGroupIds: Array(selected))
                            dismiss()
                            onFinished()
                        }
                    }
                    .disabled(selected.isEmpty)
                }
            }
        }
    }
}

// MARK: - Navigation bar material (iOS 16+)

extension View {
    @ViewBuilder
    func chatNavigationChrome() -> some View {
        #if os(iOS)
        if #available(iOS 16.0, *) {
            self
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarBackground(ChatBrandTheme.navBarBackground, for: .navigationBar)
        } else {
            self
        }
        #else
        self
        #endif
    }
}
