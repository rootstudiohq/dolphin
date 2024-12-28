//
//  ContentView.swift
//  TranditionalXcodeDemo
//
//  Created by icodesign on 2023/12/11.
//

import SwiftUI

struct ContentView: View {
    
    private let author = "Lance"
    
    private let numberOfLines: Int = 20
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Title")    // no comment here, we can provide suggestions interactively
                .font(.largeTitle)
            
            HStack {
                Text("Introduction")
            }
            
            HStack {
                Text("Author Introduction \(author) \(numberOfLines)")
            }
            
            Button {
                
            } label: {
                Text("New Message [Verb]")
            }
            .buttonStyle(BorderedProminentButtonStyle())
            
            Text("New Message [Noun] \"%@\"")
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

#Preview {
    ContentView()
}
