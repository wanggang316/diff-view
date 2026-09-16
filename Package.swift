// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "diff-view",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "DiffViewKit", targets: ["DiffViewKit"]),
        .executable(name: "diff-view-demo", targets: ["DiffViewDemo"]),
    ],
    targets: [
        .target(name: "DiffViewKit", resources: [.copy("Resources/Web")]),
        .executableTarget(name: "DiffViewDemo", dependencies: ["DiffViewKit"]),
        .testTarget(name: "DiffViewKitTests", dependencies: ["DiffViewKit"]),
    ]
)
