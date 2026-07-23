import SwiftUI

/// מסך פירוט קבוצה — מקביל ל־`ChatGroupInfoScreen.tsx` (RN): חברים, השתקה, גלריה, חיפוש, עריכה לאדמין.
public struct ChatGroupDetailView: View {
    public let groupId: String
    @ObservedObject public var model: ChatSessionViewModel
    public var onLeavePopToRoot: () -> Void

    @State private var members: [ChatGroupMemberItem] = []
    @State private var loadingMembers = false
    @State private var muted: Bool = false
    @State private var showSearch = false
    @State private var searchQuery = ""
    @State private var confirmLeave = false
    @State private var editName = ""
    @State private var editDescription = ""
    @State private var showEditName = false
    @State private var showEditDescription = false

    public init(
        groupId: String,
        model: ChatSessionViewModel,
        onLeavePopToRoot: @escaping () -> Void
    ) {
        self.groupId = groupId
        self.model = model
        self.onLeavePopToRoot = onLeavePopToRoot
    }

    private var group: ChatGroupListItem? { model.group(withId: groupId) }

    private var isAdmin: Bool { group?.myRole == "admin" }

    private var displayedMemberCount: Int {
        if let c = group?.membersCount { return c }
        return members.count
    }

    private var mediaPreview: [ChatMessageListItem] {
        model.messages
            .filter { $0.groupId == groupId && $0.mediaURL != nil && ($0.messageType == "image" || $0.messageType == "video") }
            .suffix(9)
            .reversed()
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ChatDesignTokens.Spacing.lg) {
                headerCard
                if let g = group, let d = g.description, !d.isEmpty {
                    descriptionCard(d)
                }
                mediaGalleryCard
                settingsCard
                membersSection
                leaveSection
            }
            .padding(ChatDesignTokens.Layout.screenPadding)
        }
        .background(ChatScreenBackground().ignoresSafeArea())
        .navigationTitle("פרטי קבוצה")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        #endif
        .task(id: groupId) {
            if let g = model.group(withId: groupId) {
                muted = g.isMuted
            }
            await reloadMembers()
        }
        .sheet(isPresented: $showSearch) {
            groupSearchSheet
        }
        .sheet(isPresented: $showEditName) {
            editNameSheet
        }
        .sheet(isPresented: $showEditDescription) {
            editDescriptionSheet
        }
        .confirmationDialog("לעזוב את הקבוצה?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("עזוב", role: .destructive) {
                Task {
                    await model.leaveGroup(groupId: groupId)
                    onLeavePopToRoot()
                }
            }
            Button("ביטול", role: .cancel) {}
        }
    }

    private var headerCard: some View {
        VStack(spacing: ChatDesignTokens.Spacing.sm) {
            ZStack {
                Circle()
                    .fill(ChatSwiftTheme.secondaryGrouped)
                    .frame(width: 88, height: 88)
                Image(systemName: "person.3.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(ChatDesignTokens.brand)
            }
            Text(group?.name ?? "קבוצה")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            Text("\(displayedMemberCount) חברים")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(ChatDesignTokens.Spacing.lg)
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private func descriptionCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: ChatDesignTokens.Spacing.xs) {
            Text("תיאור הקבוצה")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(text)
                .font(.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ChatDesignTokens.Spacing.lg)
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private var mediaGalleryCard: some View {
        VStack(alignment: .leading, spacing: ChatDesignTokens.Spacing.sm) {
            Text("גלריית הקבוצה")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if mediaPreview.isEmpty {
                Text("אין מדיה בקבוצה זו")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 6)], spacing: 6) {
                    ForEach(Array(mediaPreview)) { msg in
                        if let ref = msg.mediaURL {
                            if msg.messageType == "image" {
                                ChatSignedImageView(mediaRef: ref, model: model)
                                    .frame(height: 88)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous))
                            } else {
                                ZStack {
                                    RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.sm, style: .continuous)
                                        .fill(ChatSwiftTheme.secondaryGrouped)
                                    Image(systemName: "play.circle.fill")
                                        .font(.title)
                                        .foregroundStyle(ChatDesignTokens.brand)
                                }
                                .frame(height: 88)
                            }
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ChatDesignTokens.Spacing.lg)
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private var settingsCard: some View {
        VStack(spacing: 0) {
            Toggle("השתק התראות", isOn: Binding(
                get: { muted },
                set: { new in
                    muted = new
                    Task { await model.setGroupMuted(groupId: groupId, muted: new) }
                }
            ))
            .padding(.vertical, ChatDesignTokens.Spacing.sm)

            Divider()

            settingsRow(title: "הודעות מוצמדות", systemImage: "pin", disabled: true, subtitle: "בקרוב")
            Divider()
            Button {
                showSearch = true
            } label: {
                settingsRowContent(title: "חפש בהודעות", systemImage: "magnifyingglass", showChevron: true)
            }
            .buttonStyle(.plain)
            Divider()
            settingsRow(title: "שמירת מדיה", systemImage: "folder", disabled: true, subtitle: "בקרוב")

            if isAdmin {
                Divider()
                Button { showEditName = true } label: {
                    settingsRowContent(title: "שם הקבוצה", systemImage: "pencil", showChevron: true)
                }
                .buttonStyle(.plain)
                Divider()
                Button { showEditDescription = true } label: {
                    settingsRowContent(title: "תיאור הקבוצה", systemImage: "text.alignright", showChevron: true)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, ChatDesignTokens.Spacing.lg)
        .padding(.vertical, ChatDesignTokens.Spacing.sm)
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private func settingsRow(title: String, systemImage: String, disabled: Bool, subtitle: String? = nil) -> some View {
        HStack {
            settingsRowContent(title: title, systemImage: systemImage, subtitle: subtitle, showChevron: false)
            Spacer()
        }
        .padding(.vertical, ChatDesignTokens.Spacing.sm)
        .opacity(disabled ? 0.45 : 1)
    }

    private func settingsRowContent(
        title: String,
        systemImage: String,
        subtitle: String? = nil,
        showChevron: Bool
    ) -> some View {
        HStack {
            Image(systemName: systemImage)
                .foregroundStyle(.secondary)
                .frame(width: 28, alignment: .center)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .foregroundStyle(.primary)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer()
            if showChevron {
                Image(systemName: "chevron.left")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: ChatDesignTokens.Spacing.sm) {
            Text("חברים")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if loadingMembers && members.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                ForEach(sortedMembers) { m in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.displayName)
                                .font(.body)
                            Text(m.isAdmin ? "אדמין" : "חבר")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if isAdmin, m.userId != model.viewerId {
                            Menu {
                                if m.isAdmin {
                                    Button("הורד מאדמין") {
                                        Task {
                                            await model.demoteToMember(groupId: groupId, memberUserId: m.userId)
                                            await reloadMembers()
                                        }
                                    }
                                } else {
                                    Button("הפוך לאדמין") {
                                        Task {
                                            await model.promoteToAdmin(groupId: groupId, memberUserId: m.userId)
                                            await reloadMembers()
                                        }
                                    }
                                }
                                Button("הסר מהקבוצה", role: .destructive) {
                                    Task {
                                        await model.removeMemberAsAdmin(groupId: groupId, memberUserId: m.userId)
                                        await reloadMembers()
                                    }
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle")
                                    .foregroundStyle(ChatDesignTokens.brand)
                            }
                        }
                    }
                    .padding(.vertical, ChatDesignTokens.Spacing.xs)
                    if m.id != sortedMembers.last?.id {
                        Divider()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ChatDesignTokens.Spacing.lg)
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private var sortedMembers: [ChatGroupMemberItem] {
        members.sorted { a, b in
            if a.isAdmin && !b.isAdmin { return true }
            if !a.isAdmin && b.isAdmin { return false }
            return a.displayName < b.displayName
        }
    }

    private var leaveSection: some View {
        Button(role: .destructive) {
            confirmLeave = true
        } label: {
            Text("עזוב קבוצה")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding()
        }
        .background(ChatSwiftTheme.fill, in: RoundedRectangle(cornerRadius: ChatDesignTokens.Radius.lg, style: .continuous))
    }

    private var groupSearchSheet: some View {
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
                List(model.searchResults.filter { $0.groupId == groupId }) { r in
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

    private var editNameSheet: some View {
        NavigationView {
            Form {
                TextField("שם הקבוצה", text: $editName)
            }
            .navigationTitle("שם הקבוצה")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { showEditName = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("שמור") {
                        Task {
                            await model.updateGroupName(groupId: groupId, name: editName)
                            showEditName = false
                            await reloadMembers()
                        }
                    }
                }
            }
            .onAppear {
                editName = group?.name ?? ""
            }
        }
    }

    private var editDescriptionSheet: some View {
        NavigationView {
            Form {
                TextField("תיאור", text: $editDescription, axis: .vertical)
                    .lineLimit(3 ... 8)
            }
            .navigationTitle("תיאור הקבוצה")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { showEditDescription = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("שמור") {
                        Task {
                            await model.updateGroupDescription(groupId: groupId, text: editDescription)
                            showEditDescription = false
                            await reloadMembers()
                        }
                    }
                }
            }
            .onAppear {
                editDescription = group?.description ?? ""
            }
        }
    }

    private func reloadMembers() async {
        loadingMembers = true
        defer { loadingMembers = false }
        do {
            members = try await model.loadGroupMembers(groupId: groupId)
        } catch {
            members = []
        }
    }
}
