//
//  ModulePlaceholderView.swift
//  DarkPooliOS
//
//  מסך זמני למודולים שעדיין לא מומשו ב־Swift — תואם למגירה ב־React Native.
//

import SwiftUI

/// צבע מותג DarkPool (#00C805)
private let kBrandGreen = Color(red: 0, green: 200 / 255, blue: 5 / 255)

struct ModulePlaceholderView: View {
    let title: String
    let systemImage: String
    let subtitle: String
    let footnote: String
    let userEmail: String?
    var onSignOut: (() async -> Void)?

    init(
        title: String,
        systemImage: String,
        subtitle: String,
        footnote: String,
        userEmail: String? = nil,
        onSignOut: (() async -> Void)? = nil
    ) {
        self.title = title
        self.systemImage = systemImage
        self.subtitle = subtitle
        self.footnote = footnote
        self.userEmail = userEmail
        self.onSignOut = onSignOut
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.04, green: 0.055, blue: 0.04),
                        Color(red: 0.06, green: 0.10, blue: 0.06),
                        Color(red: 0.04, green: 0.055, blue: 0.04),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 20) {
                    Image(systemName: systemImage)
                        .font(.system(size: 52))
                        .foregroundStyle(kBrandGreen.opacity(0.9))
                        .symbolRenderingMode(.hierarchical)

                    Text(title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.center)

                    Text(subtitle)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)

                    Text(footnote)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                }
                .padding()
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if onSignOut != nil {
                    ToolbarItem(placement: .topBarTrailing) {
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
        }
    }
}

#Preview("שווקים") {
    ModulePlaceholderView(
        title: "שווקים",
        systemImage: "chart.line.uptrend.xyaxis",
        subtitle: "גרפים, מחירים והתראות — בקרוב באפליקציית ה־iOS הנייטיבית.",
        footnote: "בינתיים השתמשו באפליקציית React Native / EAS לכל הפיצ’רים.",
        userEmail: nil,
        onSignOut: nil
    )
    .environment(\.layoutDirection, .rightToLeft)
}
