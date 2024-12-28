//
//  ContentView.swift
//  XcodeDemo
//
//  Created by icodesign on 2023/12/10.
//

import SwiftUI

struct ContentView: View {
    
    private let author = "Lance"
    
    private let numberOfLines = 20
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Dolphin Demo")    // no comment here, we can provide suggestions interactively
                .font(.largeTitle)
            
            HStack {
                Text("Dolphin is an i18n service transforming apps and websites with effortless localization to unleash global possibilities and embrace a borderless digital experience.", comment: "Dolphin is a specific term and shouldn't be translated.")
            }
            
            HStack {
                Text("\(author) is the author who wrote only \(numberOfLines) lines of code.")
            }
            
            Button {
                
            } label: {
                Text("New Message", comment: "Button action title for users to create a a message.")
            }
            .buttonStyle(BorderedProminentButtonStyle())
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

#Preview {
    ContentView()
}
