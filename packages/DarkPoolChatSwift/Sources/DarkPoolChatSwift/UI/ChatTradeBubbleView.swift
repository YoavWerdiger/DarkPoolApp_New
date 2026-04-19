import SwiftUI

/// תצוגת טרייד מ־JSON ב־`content` (כמו שיתוף מיומן ב־RN).
struct ChatTradeBubbleView: View {
    let jsonContent: String
    let isFromCurrentUser: Bool

    var body: some View {
        if let t = TradeDisplay.parse(jsonContent) {
            VStack(alignment: .leading, spacing: ChatDesignTokens.Spacing.sm) {
                HStack(spacing: ChatDesignTokens.Spacing.sm) {
                    Text(t.symbol)
                        .font(.headline.weight(.bold))
                    Text(t.direction == "long" ? "לונג" : "שורט")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(
                                    t.direction == "long"
                                        ? ChatDesignTokens.brand.opacity(isFromCurrentUser ? 0.35 : 0.2)
                                        : Color.red.opacity(isFromCurrentUser ? 0.35 : 0.15)
                                )
                        )
                }
                row("כניסה", t.entryPrice)
                row("יציאה", t.exitPrice)
                row("כמות", String(format: "%.2f", t.quantity))
                HStack {
                    Text("רווח/הפסד")
                        .font(.caption2)
                        .foregroundStyle(secondaryText)
                    Spacer()
                    Text(formatCurrency(t.pnl))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(t.pnl >= 0 ? Color.green : Color.red)
                }
                if let pct = t.returnPercentage {
                    Text(String(format: "%@%.2f%%", pct >= 0 ? "+" : "", pct))
                        .font(.caption2)
                        .foregroundStyle(secondaryText)
                }
                if let notes = t.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption2)
                        .foregroundStyle(secondaryText)
                        .padding(.top, 2)
                }
            }
        } else {
            Text(jsonContent)
                .font(.caption)
                .foregroundStyle(secondaryText)
        }
    }

    private var secondaryText: Color {
        isFromCurrentUser ? Color.white.opacity(0.85) : Color.secondary
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .font(.caption2)
                .foregroundStyle(secondaryText)
            Spacer()
            Text(value)
                .font(.caption.weight(.medium))
                .foregroundStyle(isFromCurrentUser ? Color.white : Color.primary)
        }
    }

    private func formatCurrency(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 2
        return f.string(from: NSNumber(value: v)) ?? String(format: "%.2f", v)
    }
}

private struct TradeDisplay {
    let symbol: String
    let direction: String
    let entryPrice: String
    let exitPrice: String
    let quantity: Double
    let pnl: Double
    let returnPercentage: Double?
    let notes: String?

    static func parse(_ raw: String) -> TradeDisplay? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = trimmed.data(using: .utf8),
              let obj = try? JSONDecoder().decode(TradeJSON.self, from: data)
        else { return nil }
        let sym = obj.symbol.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sym.isEmpty else { return nil }
        let dir = (obj.direction ?? "long").lowercased()
        let nf = NumberFormatter()
        nf.numberStyle = .decimal
        return TradeDisplay(
            symbol: sym,
            direction: dir == "short" ? "short" : "long",
            entryPrice: formatPrice(obj.entry_price, nf: nf),
            exitPrice: formatPrice(obj.exit_price, nf: nf),
            quantity: obj.quantity?.value ?? 0,
            pnl: obj.pnl?.value ?? 0,
            returnPercentage: obj.return_percentage,
            notes: obj.notes
        )
    }
}

private struct TradeJSON: Decodable {
    let symbol: String
    let direction: String?
    let entry_price: DoubleCodable?
    let exit_price: DoubleCodable?
    let quantity: DoubleCodable?
    let pnl: DoubleCodable?
    let return_percentage: Double?
    let notes: String?
}

private enum DoubleCodable: Decodable {
    case d(Double)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let x = try? c.decode(Double.self) {
            self = .d(x)
        } else if let i = try? c.decode(Int.self) {
            self = .d(Double(i))
        } else {
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "number")
        }
    }

    var value: Double {
        switch self {
        case .d(let x): return x
        }
    }
}

private func formatPrice(_ v: DoubleCodable?, nf: NumberFormatter) -> String {
    guard let v else { return "—" }
    nf.maximumFractionDigits = 4
    return nf.string(from: NSNumber(value: v.value)) ?? String(v.value)
}
