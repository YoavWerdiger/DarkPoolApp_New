import SwiftUI

/// העלאת סטורי תמונה — מקביל מעודף ל־`AddStoryFullScreen` ב־RN (מצומצם).
public struct AddStorySheet: View {
    @ObservedObject var model: ChatSessionViewModel
    var onDismiss: () -> Void

    #if os(iOS)
    @State private var showPicker = false
    @State private var pickedJPEG: Data?
    #endif

    public init(model: ChatSessionViewModel, onDismiss: @escaping () -> Void) {
        self.model = model
        self.onDismiss = onDismiss
    }

    public var body: some View {
        #if os(iOS)
        NavigationView {
            VStack(spacing: 20) {
                Text("בחר תמונה לסטורי")
                    .font(.headline)
                Button("בחר מהגלריה") {
                    showPicker = true
                }
                .buttonStyle(.borderedProminent)

                if pickedJPEG != nil {
                    Button("פרסם") {
                        Task {
                            if let d = pickedJPEG {
                                await model.publishStory(imageData: d)
                                onDismiss()
                            }
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding()
            .navigationTitle("סטורי חדש")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { onDismiss() }
                }
            }
            .sheet(isPresented: $showPicker) {
                ChatPhotoLibraryPicker { data in
                    pickedJPEG = data
                    showPicker = false
                }
            }
        }
        #else
        Text("סטוריז זמינים ב־iOS")
            .padding()
        #endif
    }
}
