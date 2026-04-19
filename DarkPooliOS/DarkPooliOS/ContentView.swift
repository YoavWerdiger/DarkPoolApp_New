//
//  ContentView.swift
//  DarkPooliOS
//
//  Created by יואב ורדיגר on 07/04/2026.
//

import SwiftUI
import Supabase
import DarkPoolChatSwift

/// אותם ערכי ברירת מחדל כמו ב־`config/publicEnv.ts` (מפתח anon ציבורי).
private enum SupabasePublicEnv {
    static let url = URL(string: "https://wpmrtczbfcijoocguime.supabase.co")!
    static let anonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"
}

struct ContentView: View {
    /// מחזיקים את אותו לקוח שבו בוצעה התחברות — ל־`signOut` ול־`ChatSessionViewModel`.
    @State private var supabaseClient: SupabaseClient?
    @State private var chatModel: ChatSessionViewModel?
    /// כתובת המשתמש המחובר (לתצוגה בתפריט)
    @State private var sessionUserEmail: String?
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var isCheckingSession = true

    private var configuration: DarkPoolChatConfiguration {
        DarkPoolChatConfiguration(supabaseURL: SupabasePublicEnv.url, supabaseAnonKey: SupabasePublicEnv.anonKey)
    }

    var body: some View {
        Group {
            if isCheckingSession {
                ProgressView("טוען…")
            } else if let chatModel {
                MainTabShellView(
                    chatModel: chatModel,
                    userEmail: sessionUserEmail,
                    onSignOut: { await signOut() }
                )
            } else {
                loginForm
            }
        }
        .task {
            await restoreSessionIfPossible()
        }
    }

    private var loginForm: some View {
        NavigationStack {
            Form {
                Section {
                    #if os(iOS)
                    TextField("אימייל", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    #else
                    TextField("אימייל", text: $email)
                    #endif
                    SecureField("סיסמה", text: $password)
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
                Section {
                    Button(action: { Task { await signIn() } }) {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("התחבר")
                        }
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("DarkPool")
        }
    }

    private func restoreSessionIfPossible() async {
        isCheckingSession = true
        defer { isCheckingSession = false }
        let client = configuration.makeClient()
        do {
            let session = try await client.auth.session
            let uid = session.user.id.uuidString
            supabaseClient = client
            chatModel = ChatSessionViewModel(supabaseClient: client, currentUserId: uid)
            sessionUserEmail = session.user.email
        } catch {
            supabaseClient = nil
            chatModel = nil
            sessionUserEmail = nil
        }
    }

    private func signIn() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let client = configuration.makeClient()
        do {
            let session = try await client.auth.signIn(email: email, password: password)
            let uid = session.user.id.uuidString
            supabaseClient = client
            chatModel = ChatSessionViewModel(supabaseClient: client, currentUserId: uid)
            sessionUserEmail = session.user.email
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signOut() async {
        guard let model = chatModel, let client = supabaseClient else { return }
        await model.stopRealtime()
        try? await client.auth.signOut()
        supabaseClient = nil
        chatModel = nil
        sessionUserEmail = nil
        email = ""
        password = ""
    }
}

#Preview {
    ContentView()
}
