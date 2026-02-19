import React, { useEffect, useState, useCallback, useRef } from "react";
import Editor from '@monaco-editor/react';
import socket from "../socket";

// Import loader for language support
import { loader } from '@monaco-editor/react';
import { FaRegStopCircle } from "react-icons/fa";
// Configure Monaco loader to load additional language features
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.34.0/min/vs'
  },
});

// Explicitly load language support for all languages 
loader.init().then(monaco => {
  // Ensure all required languages are available
  import('monaco-editor/esm/vs/basic-languages/python/python.contribution');
  import('monaco-editor/esm/vs/basic-languages/java/java.contribution');
  import('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution');
  import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution');
});

const LANGUAGES = [
  { id: "javascript", name: "JavaScript" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "csharp", name: "C#" },
  { id: "cpp", name: "C++" }
];

// Fix Python boilerplate to ensure it has valid syntax
const LANGUAGE_BOILERPLATE = {
  javascript: `// JavaScript Example
console.log("Hello, world!");

// Using input example:
const prompt = (message) => {
  console.log(message);
  // The prompt function is available in the execution environment
  // It will read from the input box below
};

const name = prompt("Enter your name:");
console.log(\`Hello, \${name}!\`);`,

  python: `# Python Example
print("Hello, world!")

# Basic input/output example
name = input("Enter your name: ")
print(f"Hello, {name}!")

# Numeric input example
try:
    age = int(input("Enter your age: "))
    print(f"In 10 years, you will be {age + 10} years old")
except ValueError:
    print("That's not a valid number!")`,

  java: `// Java Example
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
        
        // Using input example (uncomment to use):
        /*
        java.util.Scanner scanner = new java.util.Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        
        System.out.print("Enter your age: ");
        int age = scanner.nextInt();
        System.out.println("You are " + age + " years old.");
        */
    }
}`,

  csharp: `// C# Example
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, world!");
        
        // Using input example (uncomment to use):
        /*
        Console.Write("Enter your name: ");
        string name = Console.ReadLine();
        Console.WriteLine($"Hello, {name}!");
        
        Console.Write("Enter your age: ");
        try {
            int age = Convert.ToInt32(Console.ReadLine());
            Console.WriteLine($"In 5 years, you will be {age + 5} years old.");
        } catch {
            Console.WriteLine("Invalid age input.");
        }
        */
    }
}`,

  cpp: `// C++ Example
#include <iostream>
#include <string>
using namespace std;

int main() {
    cout << "Hello, world!" << endl;
    
    // Input example
    string name;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Hello, " << name << "!" << endl;
    
    int number;
    cout << "Enter a number: ";
    cin >> number;
    cout << "Double of " << number << " is " << number * 2 << endl;
    
    return 0;
}`
};

// Map language IDs to Monaco Editor language identifiers
const LANGUAGE_MONACO_MAP = {
  javascript: "javascript",
  python: "python",
  java: "java",
  csharp: "csharp",
  cpp: "cpp"
};

const CodeEditor = ({ meetingCode, onRunCode, consoleOutput }) => {
  // Get initial language from localStorage or default to javascript
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem(`language_${meetingCode}`);
    return savedLanguage || "javascript";
  });
  const [execution, setExecution] = useState(false);
  // Get initial code based on saved language or default to javascript
  const [code, setCode] = useState(() => {
    const savedLanguage = localStorage.getItem(`language_${meetingCode}`);
    return LANGUAGE_BOILERPLATE[savedLanguage || "javascript"];
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [inputHistory, setInputHistory] = useState([]);
  const [outputProcessed, setOutputProcessed] = useState("");
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const outputRef = useRef(null);
  
  // Store reference to the editor instance
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Register languages if not already registered
    const languages = Object.values(LANGUAGE_MONACO_MAP);
    languages.forEach(lang => {
      if (!monaco.languages.getLanguages().find(l => l.id === lang)) {
        try {
          monaco.languages.register({ id: lang });
        } catch (e) {
          console.warn(`Language ${lang} already registered`);
        }
      }
    });
    
    // Define custom theme with better syntax highlighting
    monaco.editor.defineTheme('peerlink-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0', fontStyle: 'bold' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' }
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorCursor.foreground': '#AEAFAD',
        'editor.lineHighlightBackground': '#2D2D30',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41'
      }
    });
    
    // Set the theme
    monaco.editor.setTheme('peerlink-dark');
    
    console.log(`Editor mounted with language: ${language}`);
  };
  
  // Handle code changes
  const handleEditorChange = (value) => {
    setCode(value);
    socket.emit("codeChange", { 
      meetingCode, 
      code: value,
      language
    });
  };

  // Handle language change
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    console.log(`Changing language to ${newLanguage}`);
    
    // Save the selected language to localStorage
    localStorage.setItem(`language_${meetingCode}`, newLanguage);
    
    // If the code is the default boilerplate for the previous language,
    // update it to the boilerplate for the new language
    if (LANGUAGE_BOILERPLATE[language] === code) {
      const newCode = LANGUAGE_BOILERPLATE[newLanguage];
      setCode(newCode);
      setLanguage(newLanguage);
      
      // Broadcast language and code change to all users
      socket.emit("languageChange", {
        meetingCode,
        code: newCode,
        language: newLanguage
      });
    } else {
      setLanguage(newLanguage);
      
      // Just notify others about the language change
      socket.emit("languageChange", {
        meetingCode,
        code,
        language: newLanguage
      });
    }
  };

  // Listen for code updates from other users
  useEffect(() => {
    const handleCodeUpdate = ({ code: newCode, language: newLanguage }) => {
      console.log(`Received code update with language: ${newLanguage}`);
      
      if (newLanguage && LANGUAGES.some(l => l.id === newLanguage)) {
        setLanguage(newLanguage);
        // Update localStorage with the new language
        localStorage.setItem(`language_${meetingCode}`, newLanguage);
      }
      
      if (newCode) {
        setCode(newCode);
      }
    };

    // Request current meeting state when joining
    socket.emit("getMeetingState", { meetingCode });

    // Listen for meeting state updates
    const handleMeetingState = ({ code: currentCode, language: currentLanguage }) => {
      console.log(`Received meeting state - language: ${currentLanguage}, code length: ${currentCode?.length || 0}`);
      
      if (currentLanguage && LANGUAGES.some(l => l.id === currentLanguage)) {
        setLanguage(currentLanguage);
        localStorage.setItem(`language_${meetingCode}`, currentLanguage);
      }
      
      if (currentCode) {
        setCode(currentCode);
      }
    };

    socket.on("codeUpdate", handleCodeUpdate);
    socket.on("meetingState", handleMeetingState);
    
    // Cleanup the socket listeners
    return () => {
      socket.off("codeUpdate", handleCodeUpdate);
      socket.off("meetingState", handleMeetingState);
    };
  }, [meetingCode]);

  // Process console output to properly display input/output
  useEffect(() => {
    if (!consoleOutput) {
      setOutputProcessed("");
      return;
    }
    
    // Process the output to handle input prompts
    const lines = consoleOutput.split('\n');
    const processedLines = [];
    
    // Track input prompts and responses
    lines.forEach(line => {
      const isInputPrompt = line.includes('Enter your') || 
                           line.includes('input(') || 
                           line.endsWith(':') ||
                           line.endsWith('?');
      
      if (isInputPrompt) {
        processedLines.push(`${line} `);
      } else {
        processedLines.push(line);
      }
    });
    
    setOutputProcessed(processedLines.join('\n'));
    
    // Scroll to bottom when output changes
    if (outputRef.current) {
      setTimeout(() => {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }, 100);
    }
  }, [consoleOutput]);

  const handleRunCode = useCallback(() => {
    setIsRunning(true);
    setHasError(false); // Reset error state when running new code
    setExecution(true);
    setTimeout(()=> {
      setIsRunning(false);
      setExecution(false);
    }, 4000);
    try {
      // Validate that we have code to run
      if (!code || code.trim() === '') {
        onRunCode({
          code: language == 'python' ? '#Empty Code' : '// Empty Code',
          language,
          input
        });
        setTimeout(() => setIsRunning(false), 500);
        return;
      }
      
      console.log(`Running ${language} code...`);
      
      // Format input based on language requirements
      let formattedInput = input;
      
      // For Python, ensure each input is on a new line
      if (language === 'python' && input && !input.endsWith('\n')) {
        formattedInput = input + '\n';
      }
      
      // Save input for history
      if (input.trim()) {
        setInputHistory(prev => {
          const newHistory = [...prev, input];
          // Keep last 10 inputs
          if (newHistory.length > 10) {
            return newHistory.slice(newHistory.length - 10);
          }
          return newHistory;
        });
      }
      
      // Send the code to the onRunCode handler
      onRunCode({
        code,
        language,
        input: formattedInput
      });
      
      // Set a timeout to ensure the button doesn't stay disabled if there's no response
      setTimeout(() => {
        if (isRunning) {
          setIsRunning(false);
          console.warn('Run code timeout - no response received');
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error('Error running code:', error);
      setIsRunning(false);
      setHasError(true);
    }
  }, [code, language, input, onRunCode, isRunning]);

  // Add a socket error handler
  useEffect(() => {
    const handleSocketError = (error) => {
      console.error('Socket error:', error);
      setIsRunning(false);
      setHasError(true);
    };

    socket.on('connect_error', handleSocketError);
    socket.on('error', handleSocketError);

    return () => {
      socket.off('connect_error', handleSocketError);
      socket.off('error', handleSocketError);
    };
  }, []);

    return (
    <div className="bg-white shadow-md rounded-lg p-4 h-full flex flex-col">
      {/* Header with language selector */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Code Editor</h2>
        <div className="relative">
          <select
            value={language}
            onChange={handleLanguageChange}
            className="block w-40 appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Code editor */}
      <div className="flex-grow mb-4 border border-gray-300 rounded-md overflow-hidden">
        <Editor
          height="100%"
                width="100%"
          language={LANGUAGE_MONACO_MAP[language] || 'javascript'}
                value={code}
          theme="peerlink-dark"
                onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          defaultLanguage="javascript"
          options={{
            fontSize: 14, 
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            },
            lineNumbers: 'on',
            roundedSelection: false,
            selectOnLineNumbers: true,
            wordWrap: 'on',
            folding: true,
            renderLineHighlight: 'all',
            renderIndentGuides: true,
            suggestOnTriggerCharacters: true,
            colorDecorators: true
          }}
        />
      </div>
      
      {/* Input area with history */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">Input (optional)</label>
          {inputHistory.length > 0 && (
            <div className="relative inline-block text-left">
              <button 
                type="button" 
                className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-xs bg-white hover:bg-gray-50"
                onClick={() => setShowInput(!showInput)}
              >
                History
                <svg className="-mr-1 ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showInput && (
                <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu">
                    {inputHistory.map((item, idx) => (
                      <button
                        key={idx}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => {
                          setInput(item);
                          setShowInput(false);
                        }}
                      >
                        {item.length > 20 ? item.substring(0, 20) + '...' : item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <textarea
          rows="2"
          className="shadow-sm block w-full focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-gray-300 rounded-md p-2"
          placeholder="Enter input values, one per line"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        ></textarea>
        <p className="mt-1 text-xs text-gray-500">For multiple inputs, put each value on a new line</p>
      </div>
      
      {/* Output area */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Output</label>
        <div
          ref={outputRef}
          className="output-container bg-[#1e1e1e] text-white p-3 h-36 overflow-y-auto font-mono text-sm rounded-md"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {!outputProcessed && !isRunning ? (
            <div className="text-gray-400 italic">Run your code to see output here</div>
          ) : isRunning ? (
            <div className="text-blue-400">Running code, please wait...</div>
          ) : (
            outputProcessed && outputProcessed.split('\n').map((line, i) => {
              // Add classes for special lines
              if (line.includes('Error:') || line.includes('error:') || 
                  line.includes('SyntaxError') || line.includes('Traceback')) {
                return <div key={i} className="text-red-400 font-bold">{line}</div>;
              } else if (line.includes('successful') || line.includes('Success')) {
                return <div key={i} className="text-green-400">{line}</div>;
              } else if (line.includes('Enter your') || line.includes('?') || line.endsWith(':')) {
                return <div key={i} className="text-yellow-400">{line}</div>;
              } else if (line.startsWith('>') || line.startsWith('>>>')) {
                return <div key={i} className="text-blue-400 italic">{line}</div>;
              } else {
                return <div key={i}>{line}</div>;
              }
            })
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRunCode}
          disabled={isRunning}
          className={`flex-grow flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isRunning 
              ? 'bg-gray-400 cursor-not-allowed' 
              : hasError 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
        >
          <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isRunning ? "Running..." : (hasError ? "Run (Fix Errors)" : "Run Code")}
         
        </button>
        {execution ? <button className="text-lg cursor-pointer" onClick={() => {
          setExecution(false);
          setIsRunning(false);
        }}><FaRegStopCircle /></button> : ""}
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
          }}
          className="inline-flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy
        </button>
      </div>
        </div>
    );
};

export default CodeEditor;
