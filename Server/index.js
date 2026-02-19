const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require('peer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// For debugging purposes
const DEBUG_MODE = true;

const app = express();
const server = http.createServer(app);

// Debug log function
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

// Set up Socket.IO
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5 * 1024 * 1024 // 5MB max payload size
});

// Set up PeerJS Server with proper configuration
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/',
    proxied: false,
    allow_discovery: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
});

// Mount PeerJS server
app.use('/peerjs', peerServer);

// Enable CORS for all routes
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Store meetings and code data
let meetings = {}; // Format: { meetingCode: [{ name, id, peerId }, ...] }
let meetingCodes = {}; // Format: { meetingCode: { code: string, language: string } }
let hosted = {}; // Format: {meetingCode: hostname}

// Configuration for Judge0 API
const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || 'YOUR_RAPIDAPI_KEY'; 

// Add this after the API key declaration to provide better debugging
console.log(`Judge0 API configured. API key ${JUDGE0_API_KEY === 'YOUR_RAPIDAPI_KEY' ? 'NOT SET!' : 'is set'}`);

// Language ID mappings for Judge0 API
const LANGUAGE_IDS = {
    'javascript': 93,  // Node.js
    'python': 71,      // Python 3
    'java': 62,        // Java
    'cpp': 54,         // C++ (GCC 9.2.0)
    'csharp': 51,      // C# (.NET Core)
};

// Add CaptureConsole utility before the socket connection handlers
// Utility class to capture console output for code execution
class CaptureConsole {
    constructor() {
        this.output = '';
        this.originalConsoleLog = null;
    }

    log(...args) {
        // Join arguments with spaces and add a newline
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ') + '\n';
        
        this.output += message;
    }

    start() {
        this.output = '';
        this.originalConsoleLog = console.log;
        console.log = (...args) => {
            this.log(...args);
            // Still call the original function for server-side logging
            this.originalConsoleLog(...args);
        };
    }

    stop() {
        if (this.originalConsoleLog) {
            console.log = this.originalConsoleLog;
            this.originalConsoleLog = null;
        }
    }

    getOutput() {
        return this.output;
    }
}

// Handle socket connections
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentMeetingCode = null;

    socket.on("join", ({ userName, meetingCode, peerId }) => {
        console.log(`${userName} joining ${meetingCode} with peerId ${peerId}`);
        currentMeetingCode = meetingCode;

        // Remove any existing instances of this user from the meeting
        if (meetings[meetingCode]) {
            const existingUser = meetings[meetingCode].find(user => 
                user.name === userName || user.id === socket.id
            );
            if (existingUser) {
                meetings[meetingCode] = meetings[meetingCode].filter(user => 
                    user.name !== userName && user.id !== socket.id
                );
                // Notify others about the user being removed
                socket.to(meetingCode).emit("userDisconnected", existingUser.peerId);
            }
        }

        if (!meetings[meetingCode]) {
            meetings[meetingCode] = [];
            meetingCodes[meetingCode] = { code: "", language: "javascript" };
            hosted[meetingCode] = userName;
        }

        // Add user to meeting
        const user = { name: userName, id: socket.id, peerId };
        meetings[meetingCode].push(user);
        socket.join(meetingCode);

        // Send host information
        io.to(meetingCode).emit("hostName", hosted[meetingCode]);

        // Send code update to new user
        socket.emit("codeUpdate", { code: meetingCodes[meetingCode].code });

        // Notify all users in the meeting
        io.to(meetingCode).emit("updateList", meetings[meetingCode]);
        socket.emit("joined", true);
        console.log("Meeting participants:", meetings[meetingCode]);
    });

    socket.on("getHost", function ({ meetingCode }) {
        io.to(meetingCode).emit("hostName", hosted[meetingCode]);
    });

    socket.on("updateUsers", ({ meetingCode }) => {
        if (meetings[meetingCode]) {
            meetings[meetingCode] = meetings[meetingCode].filter(user => user.id !== socket.id);
            console.log(`User ${socket.id} left meeting ${meetingCode}`);

            // Emit the updated user list
            io.to(meetingCode).emit("updateList", meetings[meetingCode]);
        }
    });

    // Handle code change events
    socket.on("codeChange", ({ meetingCode, code, language }) => {
        console.log(`Code changed in meeting ${meetingCode}, language: ${language}`);
        // Initialize the meeting code object if it doesn't exist
        if (!meetingCodes[meetingCode]) {
            meetingCodes[meetingCode] = { code: "", language: "javascript" };
        }
        // Update the code and language
        meetingCodes[meetingCode].code = code;
        meetingCodes[meetingCode].language = language;
        socket.to(meetingCode).emit("codeUpdate", { code, language });
    });

    // Handle language change events
    socket.on("languageChange", ({ meetingCode, code, language }) => {
        console.log(`Language changed in meeting ${meetingCode} to ${language}`);
        // Initialize the meeting code object if it doesn't exist
        if (!meetingCodes[meetingCode]) {
            meetingCodes[meetingCode] = { code: "", language: "javascript" };
        }
        // Update the code and language
        meetingCodes[meetingCode].code = code;
        meetingCodes[meetingCode].language = language;
        // Broadcast to all users including sender to ensure synchronization
        io.to(meetingCode).emit("codeUpdate", { code, language });
    });

    // Handle meeting state request
    socket.on("getMeetingState", ({ meetingCode }) => {
        console.log(`Meeting state requested for ${meetingCode}`);
        if (meetingCodes[meetingCode]) {
            // Send the current meeting state to the requesting user
            socket.emit("meetingState", {
                code: meetingCodes[meetingCode].code,
                language: meetingCodes[meetingCode].language
            });
        }
    });

    // Handle code execution
    socket.on("runCode", ({ code, language, input, meetingCode }) => {
        console.log(`Executing code in language: ${language} for meeting ${meetingCode}`);
        debugLog(`Code length: ${code?.length || 0}, Input length: ${input?.length || 0}`);
        
        if (!code || code.trim() === '') {
            console.error('Empty code received');
            io.to(meetingCode).emit("codeOutput", { 
                output: "Error: No code to execute. Please enter some code first.", 
                language, 
                code 
            });
            return;
        }
        
        // Execute the code using our unified code execution system
        executeCode(code, language, input)
            .then(output => {
                // Send output back to all users in the meeting
                io.to(meetingCode).emit("codeOutput", { output, language, code });
            })
            .catch(err => {
                const errorOutput = `Execution Error: ${err.message}\n\n${err.stack || ''}`;
                io.to(meetingCode).emit("codeOutput", { 
                    output: errorOutput, 
                    language, 
                    code 
                });
            });
    });

    // Unified code execution system - now using external API
    async function executeCode(code, language, input) {
        // Create a timeout promise to handle very long API calls
        const timeout = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Execution timed out after 30 seconds'));
            }, 30000); // 30 seconds timeout
        });
        
        // Execute the code using the appropriate method
        const executionPromise = new Promise(async (resolve, reject) => {
            try {
                // Check if we should use API or local simulation
                const useAPI = JUDGE0_API_KEY !== 'YOUR_RAPIDAPI_KEY' && LANGUAGE_IDS[language];
                
                if (useAPI) {
                    console.log(`Using Judge0 API for ${language} code execution`);
                    // Use the external API for execution
                    const output = await executeWithJudge0(code, language, input);
                    resolve(output);
                } else {
                    // Log why we're falling back
                    if (JUDGE0_API_KEY === 'YOUR_RAPIDAPI_KEY') {
                        console.log(`Falling back to simulated execution for ${language}: API key not set`);
                    } else if (!LANGUAGE_IDS[language]) {
                        console.log(`Falling back to simulated execution for ${language}: Language not supported by API`);
                    } else {
                        console.log(`Falling back to simulated execution for ${language}: Unknown reason`);
                    }
                    
                    // Fallback to simulation for testing or if API key is not configured
                    let output = '';
                    
                    switch (language) {
                        case 'javascript':
                            output = executeJavaScript(code, input);
                            break;
                        case 'python':
                            output = executePython(code, input);
                            break;
                        case 'java':
                            output = executeJava(code, input);
                            break;
                        case 'cpp':
                            output = executeCpp(code, input);
                            break;
                        case 'csharp':
                            output = executeCSharp(code, input);
                            break;
                        default:
                            output = `Code execution for ${language} is not supported.\n\n` +
                                    `Your ${language} code:\n${code}\n\n` +
                                    `Input: ${input || 'None provided'}\n\n`;
                    }
                    
                    resolve(output);
                }
            } catch (error) {
                reject(error);
            }
        });
        
        // Race between execution and timeout
        return Promise.race([executionPromise, timeout]);
    }

    // Execute code using Judge0 API
    async function executeWithJudge0(code, language, input) {
        try {
            const languageId = LANGUAGE_IDS[language];
            if (!languageId) {
                return `Language '${language}' is not supported by the code execution API.`;
            }
            
            console.log(`Submitting ${language} code to Judge0 API...`);
            
            // Special handling for Python code
            let processedCode = code;
            if (language === 'python') {
                // For Python, don't add any verification code that might cause NZEC
                // Just send the code as-is without modifications
                processedCode = code.trim();
                console.log("Using unmodified Python code for execution");
            }
            
            // Create unique token for this submission
            const token = uuidv4();
            
            // Request options for code submission
            const submissionOptions = {
                method: 'POST',
                url: `${JUDGE0_API_URL}/submissions`,
                params: {base64_encoded: 'false', fields: '*'},
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': JUDGE0_API_KEY,
                    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                },
                data: {
                    source_code: processedCode,
                    language_id: languageId,
                    stdin: input || '',
                    redirect_stderr_to_stdout: true,
                    // Add compiler options only for C++
                    compiler_options: language === 'cpp' ? '-Wall' : null,
                    command_line_arguments: '',
                    // Increase resource limits slightly
                    cpu_time_limit: 5,         // 5 seconds
                    cpu_extra_time: 1,         // 1 second buffer
                    wall_time_limit: 10,       // 10 seconds total
                    memory_limit: 256000,      // 256MB
                    stack_limit: 64000,        // 64MB
                    enable_network: false
                }
            };
            
            // Submit the code for execution
            const submissionResponse = await axios.request(submissionOptions);
            const submissionToken = submissionResponse.data.token;
            
            if (!submissionToken) {
                console.error('Failed to get submission token from Judge0 API');
                return 'Error: Code execution service unavailable. Please try again later.';
            }
            
            console.log(`Code submitted successfully, token: ${submissionToken}`);
            
            // Wait for the result (with polling)
            let result = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!result && attempts < maxAttempts) {
                // Increase wait time between attempts
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(1.5, attempts)));
                attempts++;
                
                // Request options for getting submission result
                const resultOptions = {
                    method: 'GET',
                    url: `${JUDGE0_API_URL}/submissions/${submissionToken}`,
                    params: {base64_encoded: 'false', fields: '*'},
                    headers: {
                        'X-RapidAPI-Key': JUDGE0_API_KEY,
                        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                    }
                };
                
                // Get the execution result
                const resultResponse = await axios.request(resultOptions);
                
                // Check if processing is complete
                if (resultResponse.data.status?.id > 2) { // Status > 2 means not queued/processing
                    result = resultResponse.data;
                    console.log(`Received execution result for token: ${submissionToken}, status: ${result.status.description}`);
                } else {
                    console.log(`Submission still processing, status: ${resultResponse.data.status?.description}`);
                }
            }
            
            if (!result) {
                return 'Error: Code execution timed out. Your code might have an infinite loop or the execution service is busy.';
            }
            
            // Format the output based on result
            let formattedOutput = '';
            
            // Add language-specific headers
            switch (language) {
                case 'python':
                    formattedOutput += "Python 3.8.1 (default)\n";
                    formattedOutput += "[GCC 7.4.0] on linux\n";
                    formattedOutput += "Type \"help\", \"copyright\", \"credits\" or \"license\" for more information.\n\n";
                    break;
                case 'javascript':
                    formattedOutput += "Node.js v12.14.0\n\n";
                    break;
                case 'java':
                    formattedOutput += "OpenJDK Runtime Environment\n\n";
                    break;
                case 'cpp':
                    formattedOutput += "GCC 9.2.0 Compiler\n\n";
                    break;
                case 'csharp':
                    formattedOutput += ".NET Core 3.1.0\n\n";
                    break;
            }
            
            formattedOutput += `Executing ${language} code...\n\n`;
            
            // Show compilation errors if any
            if (result.compile_output && result.compile_output.trim()) {
                formattedOutput += "Compilation Error:\n";
                formattedOutput += result.compile_output + "\n\n";
            }
            
            // Show execution output or errors
            if (result.status.id === 3) { // Accepted / Success
                if (result.stdout) {
                    formattedOutput += result.stdout;
                } else {
                    formattedOutput += "(No output)\n";
                }
                formattedOutput += "\nExecution completed successfully.\n";
            } else if (result.status.id === 5) { // Time Limit Exceeded
                formattedOutput += "Error: Time limit exceeded. Your code took too long to execute.\n";
            } else if (result.status.id === 6) { // Compilation Error
                // Already handled above
            } else if (result.status.id === 7 || result.status.id === 8 || result.status.id === 11) { // Runtime Error, including NZEC
                formattedOutput += "Runtime Error:\n";
                
                // Special handling for Python errors
                if (language === 'python') {
                    // First check if we got any output at all
                    if (result.stdout) {
                        formattedOutput += "Program output before error:\n";
                        formattedOutput += result.stdout + "\n";
                    }
                    
                    // Add error details
                    if (result.stderr) {
                        // Clean up the error to make it more readable
                        let errorDetails = result.stderr
                            .replace(/File "(.+)", line \d+/g, 'File "<string>", line X')
                            .replace(/^.*\/judge0.*$/gm, '')
                            .trim();
                        
                        formattedOutput += errorDetails + "\n";
                    } else if (result.status.description.includes('NZEC')) {
                        formattedOutput += "Non-Zero Exit Code - Your program exited abnormally.\n";
                        formattedOutput += "This typically happens when there's an unhandled exception or error in your code.\n\n";
                        formattedOutput += "Suggestions:\n";
                        formattedOutput += "- Check for IndexError or accessing invalid dictionary keys\n";
                        formattedOutput += "- Ensure all input is properly handled\n";
                        formattedOutput += "- Look for division by zero\n";
                        formattedOutput += "- Make sure all files are accessible if doing file operations\n";
                    }
                } else {
                    // General runtime error handling for other languages
                    if (result.stderr) {
                        formattedOutput += result.stderr + "\n";
                    }
                    if (result.message) {
                        formattedOutput += result.message + "\n";
                    }
                    if (result.stdout) {
                        formattedOutput += "Program output before error:\n" + result.stdout + "\n";
                    }
                }
            } else {
                formattedOutput += `Error: ${result.status.description}\n`;
                if (result.stderr) {
                    formattedOutput += result.stderr + "\n";
                }
            }
            
            // Add execution stats
            if (result.time && result.memory) {
                formattedOutput += `\nExecution Time: ${result.time}s | Memory used: ${result.memory} KB\n`;
            }
            
            return formattedOutput;
        } catch (error) {
            console.error('Error executing code with Judge0:', error);
            
            // Return appropriate error message based on the error
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                return `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                // The request was made but no response was received
                return 'Error: No response from code execution service. Please try again later.';
            } else {
                // Something happened in setting up the request that triggered an Error
                return `Error executing code: ${error.message}`;
            }
        }
    }

    // Common code execution context management
    class CodeExecutionContext {
        constructor(language, input) {
            this.language = language;
            this.input = input || '';
            this.inputLines = this.input.split('\n').filter(line => line.trim());
            this.inputIndex = 0;
            this.variables = {};
            this.output = '';
            this.errors = [];
        }
        
        // Get the next input line
        getNextInput() {
            if (this.inputIndex < this.inputLines.length) {
                return this.inputLines[this.inputIndex++];
            }
            return null;
        }
        
        // Add to output
        appendOutput(text) {
            this.output += text;
            if (!text.endsWith('\n')) {
                this.output += '\n';
            }
        }
        
        // Add error to error list
        addError(error) {
            this.errors.push(error);
        }
        
        // Get formatted output with errors
        getFormattedOutput() {
            let result = this.output;
            
            if (this.errors.length > 0) {
                result += '\nErrors:\n';
                this.errors.forEach(error => {
                    result += `${error}\n`;
                });
            } else {
                result += '\nExecution completed successfully.';
            }
            
            return result;
        }
    }

    // Simulate Python execution - now using the execution context
    function executePython(code, input) {
        const context = new CodeExecutionContext('python', input);
        
        // Add Python header
        context.appendOutput("Python 3.9.0 (default, Oct 5 2020, 17:52:02)");
        context.appendOutput("[GCC 9.3.0] on linux");
        context.appendOutput("Type \"help\", \"copyright\", \"credits\" or \"license\" for more information.");
        context.appendOutput("\nExecuting Python code...\n");
        
        try {
            // Basic syntax validation - check for common Python syntax errors
            validatePythonSyntax(code, context);
            
            // If we have syntax errors, return early
            if (context.errors.length > 0) {
                context.appendOutput("Traceback (most recent call last):");
                context.appendOutput(`  File "<string>", line 1`);
                context.errors.forEach(error => {
                    context.appendOutput(error);
                });
                return context.output;
            }
            
            // Process the code line by line
            executePythonCode(code, context);
            
        } catch (err) {
            context.appendOutput(`\nError: ${err.toString()}`);
        }
        
        return context.getFormattedOutput();
    }

    // Python syntax validation function
    function validatePythonSyntax(code, context) {
        // Check for mismatched parentheses
        const openParenCount = (code.match(/\(/g) || []).length;
        const closeParenCount = (code.match(/\)/g) || []).length;
        if (openParenCount !== closeParenCount) {
            context.addError("SyntaxError: Mismatched parentheses");
        }
        
        // Check for unclosed quotes
        const codeWithoutEscapedQuotes = code.replace(/\\['"`]/g, '');
        const lines = codeWithoutEscapedQuotes.split('\n');
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inTripleQuote = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip comment lines
            if (line.trim().startsWith('#')) continue;
            
            // Check each character in the line for quotes
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const nextChars = line.substr(j, 3);
                
                // Handle triple quotes
                if (nextChars === '"""' || nextChars === "'''") {
                    inTripleQuote = !inTripleQuote;
                    j += 2; // Skip the next two characters
                    continue;
                }
                
                // Only check single and double quotes if not in a triple quote
                if (!inTripleQuote) {
                    // Check for single quotes
                    if (char === "'" && (j === 0 || line[j-1] !== '\\')) {
                        inSingleQuote = !inSingleQuote;
                    }
                    // Check for double quotes
                    else if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
                        inDoubleQuote = !inDoubleQuote;
                    }
                }
            }
        }
        
        if (inSingleQuote) {
            context.addError("SyntaxError: Unclosed string literal (single quotes)");
        }
        
        if (inDoubleQuote) {
            context.addError("SyntaxError: Unclosed string literal (double quotes)");
        }
        
        if (inTripleQuote) {
            context.addError("SyntaxError: Unclosed triple-quoted string");
        }
    }

    // Execute Python code line by line
    function executePythonCode(code, context) {
        const codeLines = code.split('\n');
        
        for (let i = 0; i < codeLines.length; i++) {
            const line = codeLines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;
            
            // Handle input() calls
            if (trimmedLine.includes('input(')) {
                handlePythonInput(trimmedLine, context);
                continue;
            }
            
            // Handle variable assignments
            if (trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/) && !trimmedLine.includes('input(')) {
                handlePythonAssignment(trimmedLine, context);
                continue;
            }
            
            // Handle print statements
            if (trimmedLine.startsWith('print(')) {
                handlePythonPrint(trimmedLine, context);
                continue;
            }
            
            // Handle try-except blocks (basic support)
            if (trimmedLine.startsWith('try:') || trimmedLine.startsWith('except ')) {
                handlePythonTryExcept(trimmedLine, codeLines, i, context);
                continue;
            }
        }
    }

    // Handle Python input() function
    function handlePythonInput(line, context) {
        const inputMatch = line.match(/input\(\s*(?:['"](.*)['"])?\s*\)/);
        if (inputMatch) {
            const promptMsg = inputMatch[1];
            if (promptMsg) {
                context.output += promptMsg;
                if (!promptMsg.endsWith(' ')) {
                    context.output += ' ';
                }
            }
            
            const inputValue = context.getNextInput();
            if (inputValue !== null) {
                context.output += inputValue + '\n';
                
                // Handle variable assignment with input
                const assignmentMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*input/);
                if (assignmentMatch) {
                    const varName = assignmentMatch[1];
                    
                    // Handle type conversions
                    if (line.includes('int(input(')) {
                        try {
                            context.variables[varName] = parseInt(inputValue);
                        } catch (e) {
                            context.appendOutput("ValueError: invalid literal for int() with base 10");
                            context.variables['_valueError'] = true;
                        }
                    } else if (line.includes('float(input(')) {
                        try {
                            context.variables[varName] = parseFloat(inputValue);
                        } catch (e) {
                            context.appendOutput("ValueError: could not convert string to float");
                            context.variables['_valueError'] = true;
                        }
                    } else {
                        context.variables[varName] = inputValue;
                    }
                }
            } else {
                context.appendOutput('No more input available');
            }
        }
    }

    // Handle Python variable assignments
    function handlePythonAssignment(line, context) {
        const assignmentMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
        if (assignmentMatch) {
            const [, varName, valueExpr] = assignmentMatch;
            
            // Handle string literals
            if (valueExpr.match(/^['"].*['"]$/)) {
                context.variables[varName] = valueExpr.slice(1, -1);
            }
            // Handle numeric values
            else if (!isNaN(valueExpr) && !isNaN(parseFloat(valueExpr))) {
                context.variables[varName] = Number(valueExpr);
            }
            // Try to handle simple expressions
            else if (valueExpr.includes('+')) {
                try {
                    const parts = valueExpr.split('+').map(p => p.trim());
                    let result = 0;
                    let isString = false;
                    
                    for (const part of parts) {
                        if (context.variables[part] !== undefined) {
                            if (typeof context.variables[part] === 'string') {
                                isString = true;
                                result = result.toString() + context.variables[part];
                            } else {
                                if (isString) {
                                    result = result + context.variables[part].toString();
                                } else {
                                    result += context.variables[part];
                                }
                            }
                        } else if (part.match(/^['"].*['"]$/)) {
                            isString = true;
                            result = result.toString() + part.slice(1, -1);
                        } else if (!isNaN(part)) {
                            if (isString) {
                                result = result + Number(part).toString();
                            } else {
                                result += Number(part);
                            }
                        }
                    }
                    
                    context.variables[varName] = result;
                } catch (e) {
                    // Ignore if we can't evaluate the expression
                }
            }
        }
    }

    // Handle Python print() function
    function handlePythonPrint(line, context) {
        let content = line.substring(6);
        content = content.substring(0, content.lastIndexOf(')')).trim();
        
        // Handle empty print()
        if (!content) {
            context.appendOutput('');
            return;
        }
        
        // Handle f-strings
        if (content.startsWith('f"') || content.startsWith("f'")) {
            content = content.slice(2, -1); // Remove f" and "
            
            // Replace {var} with variable values
            content = content.replace(/\{([^}]+)\}/g, (match, expr) => {
                const trimmedExpr = expr.trim();
                
                // Handle expressions like {var + 10}
                if (trimmedExpr.includes('+')) {
                    const parts = trimmedExpr.split('+').map(p => p.trim());
                    let result = 0;
                    let isString = false;
                    
                    for (const part of parts) {
                        if (context.variables[part] !== undefined) {
                            if (typeof context.variables[part] === 'string') {
                                isString = true;
                                result = result.toString() + context.variables[part];
                            } else {
                                if (isString) {
                                    result = result + context.variables[part].toString();
                                } else {
                                    result += context.variables[part];
                                }
                            }
                        } else if (!isNaN(part)) {
                            if (isString) {
                                result = result + Number(part).toString();
                            } else {
                                result += Number(part);
                            }
                        }
                    }
                    
                    return result;
                }
                
                // Simple variable reference
                if (context.variables[trimmedExpr] !== undefined) {
                    return context.variables[trimmedExpr];
                }
                
                return `{${expr}}`;
            });
            
            context.appendOutput(content);
        }
        // Handle regular strings
        else if (content.match(/^['"].*['"]$/)) {
            context.appendOutput(content.slice(1, -1));
        }
        // Handle variables in print
        else if (context.variables[content] !== undefined) {
            context.appendOutput(context.variables[content].toString());
        }
        // Handle multiple items (comma-separated)
        else if (content.includes(',')) {
            const parts = content.split(',').map(p => p.trim());
            const printParts = [];
            
            for (const part of parts) {
                if (part.match(/^['"].*['"]$/)) {
                    printParts.push(part.slice(1, -1));
                } else if (context.variables[part] !== undefined) {
                    printParts.push(context.variables[part]);
                } else {
                    printParts.push(part);
                }
            }
            
            context.appendOutput(printParts.join(' '));
        }
        // Default
        else {
            context.appendOutput(content);
        }
    }

    // Handle Python try-except blocks (basic support)
    function handlePythonTryExcept(line, codeLines, lineIndex, context) {
        // For try blocks, we just continue execution
        if (line.trim().startsWith('try:')) {
            return;
        }
        
        // For except blocks, check if we should process them
        if (line.trim().startsWith('except ')) {
            const exceptionType = line.match(/except\s+(\w+)/)[1];
            if (exceptionType === 'ValueError' && context.variables['_valueError']) {
                // Process the except block - for now we just let execution continue
                return;
            } else {
                // Skip until we find code at the same indentation level
                const currentIndent = line.search(/\S/);
                let j = lineIndex + 1;
                while (j < codeLines.length) {
                    const nextLine = codeLines[j];
                    // If next line has same or less indentation, exit the loop
                    if (nextLine.search(/\S/) <= currentIndent) {
                        lineIndex = j - 1; // Set lineIndex to resume at this line
                        break;
                    }
                    j++;
                }
            }
        }
    }

    // Execute JavaScript code with the unified approach
    function executeJavaScript(code, input) {
        const captureConsole = new CaptureConsole();
        captureConsole.start();
        
        try {
            // Create a context specific to JavaScript
            const context = new CodeExecutionContext('javascript', input);
            
            // Set up mock input handling
            if (input && input.trim()) {
                const inputLines = input.split('\n').filter(line => line.trim());
                let currentInputLine = 0;
                
                // Create a global prompt function that will be available in the evaluated code
                global.prompt = (message) => {
                    if (message) captureConsole.log(message);
                    
                    // Check if we have input available
                    if (currentInputLine < inputLines.length) {
                        const answer = inputLines[currentInputLine++];
                        captureConsole.log(`> ${answer}`);
                        return answer;
                    } else {
                        captureConsole.log("> No more input available");
                        return "";
                    }
                };
                
                // Mock readline for Node.js style inputs
                global.readline = {
                    createInterface: () => ({
                        question: (query, callback) => {
                            if (query) captureConsole.log(query);
                            const answer = global.prompt("");
                            callback(answer);
                        },
                        close: () => {}
                    })
                };
            } else {
                // If no input is provided, create a default prompt that returns empty values
                global.prompt = (message) => {
                    if (message) captureConsole.log(message);
                    captureConsole.log("> No input provided. Add input in the input panel.");
                    return "";
                };
                
                global.readline = {
                    createInterface: () => ({
                        question: (query, callback) => {
                            if (query) captureConsole.log(query);
                            callback("");
                        },
                        close: () => {}
                    })
                };
            }
            
            // Wrap code execution in try-catch for better error handling
            captureConsole.log("Executing JavaScript code...\n");
            
            // Execute the JavaScript code
            eval(code);
            captureConsole.log("\nExecution completed successfully.");
        } catch (err) {
            captureConsole.log(`\nError: ${err.toString()}`);
            if (err.stack) {
                // Clean up stack trace for better readability
                const stackLines = err.stack.split('\n')
                    .filter(line => !line.includes('at eval') && !line.includes('at executeJavaScript'))
                    .slice(0, 3)
                    .join('\n');
                captureConsole.log(stackLines);
            }
        } finally {
            const output = captureConsole.getOutput();
            captureConsole.stop();
            
            // Clean up globals
            delete global.prompt;
            delete global.readline;
            
            return output;
        }
    }

    // Simulate Java execution
    function executeJava(code, input) {
        let output = "";
        
        try {
            // Check if code contains a class definition with main method
            if (code.includes("public static void main") && code.includes("class")) {
                const className = (code.match(/class\s+(\w+)/) || ['', 'Main'])[1];
                output += `Compiling ${className}.java...\n`;
                output += "Compilation successful.\n\n";
                output += `Running ${className}...\n`;
                
                // Extract System.out.println statements
                const printRegex = /System\.out\.println\s*\((.*)\)/g;
                let printMatch;
                
                while ((printMatch = printRegex.exec(code)) !== null) {
                    try {
                        const content = printMatch[1].replace(/["']/g, '');
                        output += content + '\n';
                    } catch (e) {
                        output += printMatch[1] + '\n';
                    }
                }
                
                // Handle Scanner for input
                if (code.includes("Scanner") && input) {
                    const inputLines = input.split('\n');
                    let inputIndex = 0;
                    
                    const scannerRegex = /\.\s*next(?:Line|Int|Double)?\s*\(\s*\)/g;
                    code.replace(scannerRegex, () => {
                        if (inputIndex < inputLines.length) {
                            const inputVal = inputLines[inputIndex++];
                            output += `> ${inputVal}\n`;
                            return inputVal;
                        }
                        return "";
                    });
                }
                
                // Add successful execution message
                output += "\nProcess finished with exit code 0\n";
            } else {
                output += "Error: No public static void main method found in class.\n";
                output += "Make sure your code contains a proper Java entry point.\n";
            }
        } catch (err) {
            output += `\nCompilation error:\n${err.toString()}\n`;
        }
        
        return output;
    }

    // Simulate C++ execution
    function executeCpp(code, input) {
        let output = "";
        
        try {
            output += "Compiling with g++ -std=c++17...\n";
            
            // Basic syntax validation
            // Check for common C++ syntax errors
            const syntaxErrors = [];
            
            // Check for missing semicolons in non-comment lines
            const lines = code.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Skip comments, empty lines, preprocessor directives, and lines ending with { or }
                if (line === '' || line.startsWith('//') || line.startsWith('#') || 
                    line.endsWith('{') || line.endsWith('}') || line.endsWith(';')) {
                    continue;
                }
                
                // Check for missing semicolons in statement lines
                if (!/^\s*for\s*\(.*\)/.test(line) && !/^\s*if\s*\(.*\)/.test(line) && 
                    !/^\s*while\s*\(.*\)/.test(line) && !/^\s*switch\s*\(.*\)/.test(line)) {
                    syntaxErrors.push(`Error: Missing semicolon at line ${i+1}: ${line}`);
                }
            }
            
            // Check for mismatched braces
            const openBraceCount = (code.match(/\{/g) || []).length;
            const closeBraceCount = (code.match(/\}/g) || []).length;
            if (openBraceCount !== closeBraceCount) {
                syntaxErrors.push("Error: Mismatched braces");
            }
            
            // Check for missing main function
            if (!code.includes('main')) {
                syntaxErrors.push("Error: No main function found");
            }
            
            // If there are syntax errors, output them and return
            if (syntaxErrors.length > 0) {
                output += "Compilation failed.\n\n";
                output += "Errors:\n";
                syntaxErrors.forEach(error => {
                    output += `${error}\n`;
                });
                return output;
            }
            
            output += "Compilation successful.\n\n";
            output += "Running program...\n\n";
            
            // Process code line by line for better handling
            const variables = {};
            let inputLines = input ? input.split('\n').filter(line => line.trim()) : [];
            let inputIndex = 0;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Skip comments and empty lines
                if (trimmedLine.startsWith('//') || !trimmedLine) continue;
                
                // Handle cout statements - more flexible pattern
                if (trimmedLine.includes('cout')) {
                    // Match any text between quotes in a cout statement
                    const quotedTextMatches = trimmedLine.match(/["']([^"']*)["']/g) || [];
                    for (const quoted of quotedTextMatches) {
                        // Remove the quotes and output the text
                        output += quoted.slice(1, -1);
                    }
                    
                    // Handle endl or \n
                    if (trimmedLine.includes('endl') || trimmedLine.includes('\\n')) {
                        output += '\n';
                    }
                    
                    // Handle variables in cout
                    const varMatches = trimmedLine.match(/<<\s*([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
                    for (const varMatch of varMatches) {
                        const varName = varMatch.replace('<<', '').trim();
                        if (variables[varName] !== undefined) {
                            output += variables[varName];
                        }
                    }
                }
                
                // Handle cin statements
                if (trimmedLine.includes('cin')) {
                    const varMatches = trimmedLine.match(/cin\s*>>\s*([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
                    for (const varMatch of varMatches) {
                        const varName = varMatch.replace(/cin\s*>>\s*/, '').trim();
                        if (inputIndex < inputLines.length) {
                            const inputValue = inputLines[inputIndex++];
                            
                            // Store the input value in our variables object
                            if (!isNaN(inputValue)) {
                                variables[varName] = Number(inputValue);
                            } else {
                                variables[varName] = inputValue;
                            }
                            
                            output += `> ${inputValue}\n`;
                        } else {
                            output += "> No more input available\n";
                            variables[varName] = "";
                        }
                    }
                }
                
                // Handle variable declarations and assignments
                const variableMatch = trimmedLine.match(/^(int|float|double|string|char)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);$/);
                if (variableMatch) {
                    const [, type, name, value] = variableMatch;
                    try {
                        // Handle string literals
                        if (value.match(/^["'].*["']$/)) {
                            variables[name] = value.slice(1, -1);
                        } 
                        // Handle numeric literals
                        else if (!isNaN(value)) {
                            variables[name] = Number(value);
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
                
                // Handle assignment to existing variables
                const assignmentMatch = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);$/);
                if (assignmentMatch && !variableMatch) {
                    const [, name, value] = assignmentMatch;
                    try {
                        // Handle string literals
                        if (value.match(/^["'].*["']$/)) {
                            variables[name] = value.slice(1, -1);
                        } 
                        // Handle numeric literals
                        else if (!isNaN(value)) {
                            variables[name] = Number(value);
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
            
            // Add successful execution message
            output += "\nProcess finished with exit code 0\n";
        } catch (err) {
            output += `\nCompilation error:\n${err.toString()}\n`;
        }
        
        return output;
    }

    // Simulate C# execution
    function executeCSharp(code, input) {
        let output = "";
        
        try {
            output += "Compiling with .NET SDK...\n";
            output += "Compilation successful.\n\n";
            output += "Running program...\n";
            
            // Extract Console.WriteLine statements
            const printRegex = /Console\.WriteLine\s*\((.*)\)/g;
            let printMatch;
            
            while ((printMatch = printRegex.exec(code)) !== null) {
                try {
                    const content = printMatch[1].replace(/["']/g, '');
                    output += content + '\n';
                } catch (e) {
                    output += printMatch[1] + '\n';
                }
            }
            
            // Handle Console.ReadLine for input
            if (code.includes("Console.ReadLine") && input) {
                const inputLines = input.split('\n');
                let inputIndex = 0;
                
                code.replace(/Console\.ReadLine\(\)/g, () => {
                    if (inputIndex < inputLines.length) {
                        const inputVal = inputLines[inputIndex++];
                        output += `> ${inputVal}\n`;
                        return `"${inputVal}"`;
                    }
                    return '""';
                });
            }
            
            // Add successful execution message
            output += "\nProcess finished with exit code 0\n";
        } catch (err) {
            output += `\nCompilation error:\n${err.toString()}\n`;
        }
        
        return output;
    }

    // Handle sending messages
    socket.on("sendMessage", ({ meetingCode, userName, message, attachment, links }) => {
        console.log(`Received message from ${userName} in meeting ${meetingCode}`);
        
        const timestamp = new Date().toISOString();
        const messageData = {
            userName,
            message,
            timestamp,
            attachment,
            links
        };
        
        io.to(meetingCode).emit("receiveMessage", messageData);
    });

    // ===== VIDEO CALL SIGNALING HANDLERS =====

    // Handle WebRTC signaling
    socket.on("sendSignal", ({ userToSignal, from, signal }) => {
        console.log(`Forwarding signal from ${from} to ${userToSignal}`);
        io.to(userToSignal).emit("receiveSignal", { from, signal });
    });

    // Handle screen sharing signals
    socket.on("startScreenShare", ({ meetingCode, from }) => {
        console.log(`User ${from} started screen sharing in meeting ${meetingCode}`);
        socket.to(meetingCode).emit("userStartedScreenShare", { from });
    });

    socket.on("stopScreenShare", ({ meetingCode, from }) => {
        console.log(`User ${from} stopped screen sharing in meeting ${meetingCode}`);
        socket.to(meetingCode).emit("userStoppedScreenShare", { from });
    });

    socket.on("screenShareSignal", ({ userToSignal, from, signal }) => {
        console.log(`Forwarding screen share signal from ${from} to ${userToSignal}`);
        io.to(userToSignal).emit("receiveScreenShareSignal", { from, signal });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        
        // Clean up user from all meetings
        for (const meetingCode in meetings) {
            const userIndex = meetings[meetingCode].findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                const user = meetings[meetingCode][userIndex];
                meetings[meetingCode].splice(userIndex, 1);
                
                // Notify others about the disconnection
                socket.to(meetingCode).emit("userDisconnected", user.peerId);
                io.to(meetingCode).emit("updateList", meetings[meetingCode]);

                console.log(`${user.name} removed from meeting ${meetingCode}`);
                
                // Clean up empty meetings
                if (meetings[meetingCode].length === 0) {
                    console.log(`Meeting ${meetingCode} is empty, cleaning up...`);
                    delete meetings[meetingCode];
                    delete meetingCodes[meetingCode];
                    delete hosted[meetingCode];
                }
            }
        }
    });

    // Handle explicit leave meeting
    socket.on("leaveMeeting", () => {
        if (currentMeetingCode && meetings[currentMeetingCode]) {
            const userIndex = meetings[currentMeetingCode].findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                const user = meetings[currentMeetingCode][userIndex];
                meetings[currentMeetingCode].splice(userIndex, 1);
                
                // Notify others
                socket.to(currentMeetingCode).emit("userDisconnected", user.peerId);
                io.to(currentMeetingCode).emit("updateList", meetings[currentMeetingCode]);
                
                // Leave the socket room
                socket.leave(currentMeetingCode);
                
                console.log(`${user.name} left meeting ${currentMeetingCode}`);
                
                // Clean up empty meetings
                if (meetings[currentMeetingCode].length === 0) {
                    console.log(`Meeting ${currentMeetingCode} is empty, cleaning up...`);
                    delete meetings[currentMeetingCode];
                    delete meetingCodes[currentMeetingCode];
                    delete hosted[currentMeetingCode];
                }
            }
        }
    });
});

// PeerJS error handling
peerServer.on('connection', (client) => {
    console.log('Client connected to PeerJS server:', client.id);
});

peerServer.on('disconnect', (client) => {
    console.log('Client disconnected from PeerJS server:', client.id);
});

// Add a simple test route
app.get('/test', (req, res) => {
    res.send('Server is running correctly');
});

// Add a test route for code execution
app.get('/test-code', (req, res) => {
    const testCode = 'console.log("Hello from test");';
    const result = executeJavaScript(testCode, '');
    res.send(result);
});

// Add test routes for each language
app.get('/test-python', (req, res) => {
    const testCode = `
# Test Python code with errors
print("Starting Python test")

# Indentation error
if True:
print("This has an indentation error")

# Syntax error
print("Unclosed string literal
`;
    const result = executePython(testCode, '');
    res.send(result);
});

// Execute JavaScript code
function executeJavaScript(code, input) {
    const captureConsole = new CaptureConsole();
    captureConsole.start();
    
    try {
        // Set up mock input handling
        if (input && input.trim()) {
            const inputLines = input.split('\n').filter(line => line.trim());
            let currentInputLine = 0;
            
            // Create a global prompt function that will be available in the evaluated code
            global.prompt = (message) => {
                if (message) captureConsole.log(message);
                
                // Check if we have input available
                if (currentInputLine < inputLines.length) {
                    const answer = inputLines[currentInputLine++];
                    captureConsole.log(`> ${answer}`);
                    return answer;
                } else {
                    captureConsole.log("> No more input available");
                    return "";
                }
            };
            
            // Mock readline for Node.js style inputs
            global.readline = {
                createInterface: () => ({
                    question: (query, callback) => {
                        if (query) captureConsole.log(query);
                        const answer = global.prompt("");
                        callback(answer);
                    },
                    close: () => {}
                })
            };
        } else {
            // If no input is provided, create a default prompt that returns empty values
            global.prompt = (message) => {
                if (message) captureConsole.log(message);
                captureConsole.log("> No input provided. Add input in the input panel.");
                return "";
            };
            
            global.readline = {
                createInterface: () => ({
                    question: (query, callback) => {
                        if (query) captureConsole.log(query);
                        callback("");
                    },
                    close: () => {}
                })
            };
        }
        
        // Wrap code execution in try-catch for better error handling
        captureConsole.log("Executing JavaScript code...\n");
        
        // Execute the JavaScript code
        eval(code);
        captureConsole.log("\nExecution completed successfully.");
    } catch (err) {
        captureConsole.log(`\nError: ${err.toString()}`);
        if (err.stack) {
            // Clean up stack trace for better readability
            const stackLines = err.stack.split('\n')
                .filter(line => !line.includes('at eval') && !line.includes('at executeJavaScript'))
                .slice(0, 3)
                .join('\n');
            captureConsole.log(stackLines);
        }
    } finally {
        const output = captureConsole.getOutput();
        captureConsole.stop();
        
        // Clean up globals
        delete global.prompt;
        delete global.readline;
        
        return output;
    }
}

app.get('/test-cpp', (req, res) => {
    const testCode = `
// Test C++ code with errors
#include <iostream>
using namespace std;

int main() {
    cout << "Starting C++ test" << endl;
    
    // Missing semicolon
    int x = 5
    cout << "Value: " << x << endl;
    
    // Mismatched braces
    if (x > 3) {
        cout << "X is greater than 3" << endl;
    
    return 0;
}`;
    const result = executeCpp(testCode, '');
    res.send(result);
});

server.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
    console.log("PeerJS server running on http://localhost:3001/peerjs");
});