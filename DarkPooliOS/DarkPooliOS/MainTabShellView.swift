//
//  MainTabShellView.swift
//  DarkPooliOS
//
//  שלד ראשי — טאבים תואמים למגירה ב־MainTabs (RN): קהילה, שווקים, חדשות, יומן, אקדמיה.
//  ללא בר־כותרת גלובלי: כל מודול משתמש ב־NavigationStack/safe area משלו (כמו מסכי הצ׳אט ב־RN).
//

import SwiftUI
import DarkPoolChatSwift

private let kBrandGreen = Color(red: 0, green: 200 / 255, blue: 5 / 255)

struct MainTabShellView: View {
    @ObservedObject var chatModel: ChatSessionViewModel
    let userEmail: String?
    var onSignOut: () async -> Void

    var body: some View {
        TabView {
            ChatRootView(model: chatModel, userEmail: userEmail, onSignOut: onSignOut)
                .tabItem {
                    Label("קהילה", systemImage: "person.3.fill")
                }

            ModulePlaceholderView(
                title: "שווקים",
                systemImage: "chart.line.uptrend.xyaxis",
                subtitle: "מסכי שווקים, מדדים וכלים — יחוברו ל־Supabase / ה־APIs הקיימים בשלב הבא.",
                footnote: "מקביל ל־Markets ב־React Native.",
                userEmail: userEmail,
                onSignOut: onSignOut
            )
            .tabItem {
                Label("שווקים", systemImage: "chart.line.uptrend.xyaxis")
            }

            ModulePlaceholderView(
                title: "חדשות",
                systemImage: "newspaper.fill",
                subtitle: "מאמרים, לייקים והתראות חדשות — בתכנון.",
                footnote: "מקביל ל־News ב־React Native.",
                userEmail: userEmail,
                onSignOut: onSignOut
            )
            .tabItem {
                Label("חדשות", systemImage: "newspaper.fill")
            }

            ModulePlaceholderView(
                title: "יומן מסחר",
                systemImage: "book.fill",
                subtitle: "רישום עסקאות, סטטיסטיקות וייצוא — בתכנון.",
                footnote: "מקביל ל־Journal ב־React Native.",
                userEmail: userEmail,
                onSignOut: onSignOut
            )
            .tabItem {
                Label("יומן", systemImage: "book.fill")
            }

            ModulePlaceholderView(
                title: "אקדמיה",
                systemImage: "graduationcap.fill",
                subtitle: "קורסים, שיעורים והתקדמות — בתכנון (שימוש ב־`learning` ב־Supabase).",
                footnote: "מקביל ל־LearningStack ב־React Native.",
                userEmail: userEmail,
                onSignOut: onSignOut
            )
            .tabItem {
                Label("אקדמיה", systemImage: "graduationcap.fill")
            }
        }
        .tint(kBrandGreen)
        .environment(\.layoutDirection, .rightToLeft)
    }
}
