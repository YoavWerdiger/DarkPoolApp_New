// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "DarkPoolChatSwift",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "DarkPoolChatSwift", targets: ["DarkPoolChatSwift"]),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "DarkPoolChatSwift",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "Sources/DarkPoolChatSwift"
        ),
    ]
)
