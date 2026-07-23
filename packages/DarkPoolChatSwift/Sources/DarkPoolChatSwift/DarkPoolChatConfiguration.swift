import Foundation
import Supabase

/// הגדרות חיבור — מזינים מהאפליקציה (למשל `Info.plist` / `xcconfig`), בלי להטמיע סודות בקוד סטטי.
public struct DarkPoolChatConfiguration: Sendable {
    public let supabaseURL: URL
    public let supabaseAnonKey: String

    public init(supabaseURL: URL, supabaseAnonKey: String) {
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
    }

    public func makeClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    autoRefreshToken: true,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    /// לאחר התחברות (אימייל / OAuth) — מעביר טוקנים כדי ש־RLS ב־Postgres יעבוד כמו ב־React Native.
    public func makeAuthenticatedClient(accessToken: String, refreshToken: String) async throws -> SupabaseClient {
        let client = makeClient()
        _ = try await client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
        return client
    }
}
