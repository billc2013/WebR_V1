// webRRepl.js with xterm.js integration
import { webrService } from '../webr/webr-service.js';
import { saveReplState, loadReplState } from '../supabase/dbService.js';
import { uploadPlot } from '../supabase/storageService.js';
import { getUser } from '../supabase/auth.js';

const FitAddon = window.FitAddon;

export class WebRRepl extends HTMLElement {
    constructor() {
        super();
        this.commandHistory = [];
        this.currentHistoryIndex = -1;
        this.plotCounter = 0;
        this.terminal = null;
        this.fitAddon = null;
        this.currentCommand = '';
    }

    async connectedCallback() {
        // Instead of creating your HTML structure, just reference the existing elements
        this.terminalContainer = document.getElementById('terminal-container');
        this.clearButton = document.getElementById('clearButton');
        this.plotOutput = document.getElementById('plot-output');

        setTimeout(async () => {
            // Initialize xterm.js
            this.initTerminal();

            // Initialize WebR
            try {
                this.writeToTerminal('Initializing R environment... This may take a moment.\r\n', {bold: true});
                await webrService.initialize();
                this.writeToTerminal('R environment ready. Type R commands and press Enter to run.\r\n', {bold: true, fg: 'green'});
                this.writeToTerminal('Use Ctrl+Enter to execute multi-line code.\r\n', {fg: 'blue'});
                this.writeToTerminal('> ');
            } catch (error) {
                this.writeToTerminal(`Failed to initialize R environment: ${error.message}\r\n`, {bold: true, fg: 'red'});
                return;
            }

            // Event listeners
            this.clearButton.addEventListener('click', () => this.clearTerminal());

            // Load previous state if user is logged in
            const user = await getUser();
            if (user) {
                try {
                    const state = await loadReplState(user.id);
                    if (state) {
                        this.commandHistory = JSON.parse(state.command_history || '[]');
                    }
                } catch (error) {
                    console.error('Error loading REPL state:', error);
                }
            }
        },300);// Short delay to ensure DOM is ready    
    }


    initTerminal() {
        // Initialize xterm.js
        this.terminal = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#f8f9fa',
                foreground: '#333',
                cursor: '#333',
                selection: 'rgba(52, 152, 219, 0.3)',
                black: '#000000',
                red: '#e74c3c',
                green: '#2ecc71',
                yellow: '#f1c40f',
                blue: '#3498db',
                magenta: '#9b59b6',
                cyan: '#1abc9c',
                white: '#ffffff',
            },
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            convertEol: true,
            scrollback: 1000,
            scrollOnUserInput: true,  // Add this to ensure it scrolls when user types
            allowTransparency: false  // Disable transparency to avoid rendering issues
        });

        // Use FitAddon to make the terminal resize to its container
        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);

        // Open the terminal in the container
        this.terminal.open(this.terminalContainer);
        this.fitAddon.fit();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.fitAddon.fit();
        });

        // Handle terminal input
        this.terminal.onKey(e => {
            const ev = e.domEvent;
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

            if (ev.keyCode === 13) { // Enter key
                if (ev.ctrlKey) {
                    // Ctrl+Enter: execute code
                    this.executeCurrentCommand();
                } else if (this.currentCommand.trim()) {
                    // Enter: add new line if in multi-line mode
                    this.currentCommand += '\n';
                    this.terminal.write('\r\n');
                    // Check for continuation (for multi-line input)
                    if (this.shouldContinueInput(this.currentCommand)) {
                        this.terminal.write('+ ');
                    } else {
                        this.executeCurrentCommand();
                    }
                } else {
                    // Empty command, just add a new prompt
                    this.terminal.write('\r\n> ');
                }
            } else if (ev.keyCode === 8) { // Backspace
                // Do not delete the prompt
                if (this.terminal._core.buffer.x > 2) {
                    this.terminal.write('\b \b');
                    this.currentCommand = this.currentCommand.slice(0, -1);
                }
            } else if (printable) {
                // Add character to current command
                this.terminal.write(e.key);
                this.currentCommand += e.key;
            } else if (ev.keyCode === 38) { // Up arrow
                this.navigateHistory(-1);
            } else if (ev.keyCode === 40) { // Down arrow
                this.navigateHistory(1);
            }
        });
    }

    shouldContinueInput(command) {
        // Basic check for multi-line inputs
        // e.g., if a line ends with '+', '{', '(', or a function call wasn't closed
        const lastLine = command.trim().split('\n').pop();
        return /[+\-*/]$/.test(lastLine) || 
               /{$/.test(lastLine) || 
               /\($/.test(lastLine) ||
               (lastLine.includes('(') && !lastLine.includes(')')) ||
               (lastLine.includes('{') && !lastLine.includes('}'));
    }

    writeToTerminal(text, options = {}) {
        if (!this.terminal) return;
    
        // Process ANSI escape codes for formatting
        if (options.bold) {
            text = `\x1b[1m${text}\x1b[0m`;
        }
        if (options.fg) {
            const colors = {
                'black': 30, 'red': 31, 'green': 32, 'yellow': 33, 
                'blue': 34, 'magenta': 35, 'cyan': 36, 'white': 37
            };
            if (colors[options.fg]) {
                text = `\x1b[${colors[options.fg]}m${text}\x1b[0m`;
            }
        }
    
        this.terminal.write(text);
        
        // Force scrolling to the bottom - more reliable than scrollToBottom()
        setTimeout(() => {
            // This ensures the scroll happens after the content is rendered
            if (this.terminal) {
                try {
                    // Try using the buffer directly for scrolling
                    const buffer = this.terminal.buffer.active;
                    this.terminal.scrollLines(buffer.baseY + buffer.cursorY);
                    // If that doesn't work, try forcing viewport to scroll
                    const viewport = this.terminalContainer.querySelector('.xterm-viewport');
                    if (viewport) {
                        viewport.scrollTop = viewport.scrollHeight;
                    }
                } catch (e) {
                    console.error('Scroll error:', e);
                }
            }
        }, 10);
    }

    async executeCurrentCommand() {
        const command = this.currentCommand.trim();
        if (!command) {
            this.terminal.write('\r\n> ');
            return;
        }

        // Add to history
        this.commandHistory.push(command);
        this.currentHistoryIndex = this.commandHistory.length;

        // Reset current command
        this.currentCommand = '';

        // Execute the command
        this.terminal.write('\r\n');
        try {
            const result = await webrService.executeCode(command);

            // Handle output text
            if (result.output) {
                this.writeToTerminal(result.output + '\r\n');
            }

            // Handle captured plots
            if (result.images && result.images.length > 0) {
                for (const image of result.images) {
                    await this.showPlot(image);
                }
            }

            // Save state
            const user = await getUser();
            if (user) {
                try {
                    await saveReplState(user.id, {
                        commandHistory: JSON.stringify(this.commandHistory)
                    });
                } catch (error) {
                    console.error('Error saving REPL state:', error);
                }
            }
        } catch (error) {
            this.writeToTerminal('Error: ' + error.message + '\r\n', {fg: 'red'});
        }

        this.writeToTerminal('> ');
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        this.currentHistoryIndex += direction;
        
        if (this.currentHistoryIndex >= this.commandHistory.length) {
            this.currentHistoryIndex = this.commandHistory.length;
            this.currentCommand = '';
        } else if (this.currentHistoryIndex < 0) {
            this.currentHistoryIndex = 0;
        } else {
            this.currentCommand = this.commandHistory[this.currentHistoryIndex];
        }

        // Clear the current line and write the command from history
        this.terminal.write('\r\x1b[K> ' + this.currentCommand);
    }

    async loadLocalFile(fileBlob, fileName) {
        try {
            this.writeToTerminal(`Loading file ${fileName}...\r\n`, {fg: 'blue'});
            
            const arrayBuffer = await fileBlob.arrayBuffer();
            await webrService.webR.FS.writeFile(fileName, new Uint8Array(arrayBuffer));
            
            // After writing the file, try to read it as a data frame
            const result = await webrService.executeCode(`
                df <- read.csv("${fileName}")
                cat("\\nFile loaded successfully as 'df'\\n")
                cat("\\nTo view your data:\\n")
                cat("  • Type head(df) to see the first few rows\\n")
                cat("  • Type str(df) to see the structure\\n")
                cat("  • Type summary(df) for basic statistics\\n")
                cat("\\nPreview of data:\\n")
                head(df)
            `);
            
            this.writeToTerminal("File loaded successfully. Preview:\r\n", {fg: 'green', bold: true});
            this.writeToTerminal(result.output + "\r\n");
            this.writeToTerminal('> ');
        } catch (error) {
            this.writeToTerminal(`Error loading file: ${error.message}\r\n`, {fg: 'red'});
            this.writeToTerminal('> ');
        }
    }

    async showPlot(imageData) {
        this.plotCounter++;
        
        // Create a container for this plot
        const container = document.createElement('div');
        container.className = 'plot-card';

        // Create the canvas element
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.className = 'plot-image';
        
        // Draw the plot
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageData, 0, 0);
        
        // Create control buttons
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close Plot';
        closeBtn.onclick = () => container.remove();

        const shareBtn = document.createElement('button');
        shareBtn.textContent = 'Share Plot';
        shareBtn.onclick = async () => {
            try {
                const user = await getUser();
                if (user) {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve));
                    const url = await uploadPlot(user.id, blob);
                    window.prompt('Share this URL:', url);
                }
            } catch (error) {
                console.error('Error sharing plot:', error);
            }
        };

        // Assemble the container
        container.appendChild(canvas);
        container.appendChild(closeBtn);
        container.appendChild(shareBtn);

        // Add to plot output area
        this.plotOutput.appendChild(container);
    }

    clearTerminal() {
        if (confirm("Are you sure you want to clear the terminal?")) {
            this.terminal.clear();
            this.writeToTerminal('Terminal cleared.\r\n', {fg: 'green'});
            this.writeToTerminal('> ');
        }
    }

    disconnectedCallback() {
        webrService.cleanup();
    }
}

// Register the custom element
customElements.define('webr-repl', WebRRepl);