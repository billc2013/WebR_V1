// webRRepl.js
import { webrService } from '../webr/webr-service.js';
import { saveReplState, loadReplState } from '../supabase/dbService.js';
import { uploadPlot } from '../supabase/storageService.js';
import { getUser } from '../supabase/auth.js';

export class WebRRepl extends HTMLElement {
    constructor() {
        super();
        this.commandHistory = [];
        this.currentHistoryIndex = -1;
        this.plotCounter = 0;
    }

    async connectedCallback() {
        this.innerHTML = `
            <div class="repl-container">
                <div id="output" class="repl-output"></div>
                <div class="repl-input-wrapper">
                    <textarea id="input" class="repl-input" rows="3" placeholder="Enter R code here..."></textarea>
                    <button id="runButton" class="run-button">Run</button>
                </div>
                <div id="plot-output" class="plot-output"></div>
            </div>
        `;

        this.outputElement = this.querySelector('#output');
        this.inputElement = this.querySelector('#input');
        this.runButton = this.querySelector('#runButton');
        this.plotOutput = this.querySelector('#plot-output');

        // Initialize WebR
        try {
            await webrService.initialize();
            this.appendOutput('R environment ready...\n');
        } catch (error) {
            this.appendOutput('Failed to initialize R environment: ' + error.message + '\n');
            return;
        }

        // Event listeners
        this.runButton.addEventListener('click', () => this.executeCode());
        this.inputElement.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Load previous state if user is logged in
        const user = await getUser();
        if (user) {
            try {
                const state = await loadReplState(user.id);
                if (state) {
                    this.commandHistory = JSON.parse(state.command_history || '[]');
                    if (state.last_output) {
                        this.appendOutput(state.last_output);
                    }
                }
            } catch (error) {
                console.error('Error loading REPL state:', error);
            }
        }
    }

    async loadLocalFile(fileBlob, fileName) {
        try {
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
            
            this.appendOutput("File loaded successfully. Preview:\n");
            this.appendOutput(result.output + "\n");
        } catch (error) {
            this.appendOutput(`Error loading file: ${error.message}\n`);
        }
    }

    async executeCode() {
        const code = this.inputElement.value.trim();
        if (!code) return;

        // Add to history
        this.commandHistory.push(code);
        this.currentHistoryIndex = this.commandHistory.length;

        // Show the command
        this.appendOutput(`> ${code}\n`);

        try {
            const result = await webrService.executeCode(code);

            // Handle output text
            if (result.output) {
                this.appendOutput(result.output + '\n');
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
                        commandHistory: JSON.stringify(this.commandHistory),
                        lastOutput: this.outputElement.textContent
                    });
                } catch (error) {
                    console.error('Error saving REPL state:', error);
                }
            }
        } catch (error) {
            this.appendOutput('Error: ' + error.message + '\n');
        }

        // Clear input
        this.inputElement.value = '';
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

    handleKeyPress(event) {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            this.executeCode();
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.navigateHistory(event.key === 'ArrowUp' ? -1 : 1);
        }
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        this.currentHistoryIndex += direction;
        
        if (this.currentHistoryIndex >= this.commandHistory.length) {
            this.currentHistoryIndex = this.commandHistory.length - 1;
        } else if (this.currentHistoryIndex < 0) {
            this.currentHistoryIndex = 0;
        }

        this.inputElement.value = this.commandHistory[this.currentHistoryIndex];
    }

    appendOutput(text) {
        // Create a container for this output
        const outputContainer = document.createElement('div');
        outputContainer.className = 'output-block';
        
        // For tabular data formatting (like head() output)
        if (this.isDataFrameOutput(text)) {
            // Create pre element for preserving spacing
            const pre = document.createElement('pre');
            pre.className = 'data-table-content';
            pre.textContent = text; // Use textContent to avoid HTML interpretation
            
            outputContainer.appendChild(pre);
        } else {
            // For normal output
            outputContainer.textContent = text;
        }
        
        this.outputElement.appendChild(outputContainer);
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
    
    // Helper method to format a data frame row
    formatDataFrameRow(line, container) {
        const parts = line.split(/\s+/);
        let currentPosition = 0;
        
        // Process each part of the line
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue; // Skip empty parts
            
            const part = parts[i];
            const span = document.createElement('span');
            
            // Determine what kind of content this is
            if (i === 0 && /^\d+$/.test(part)) {
                // Row number
                span.className = 'r-number';
            } else if (/^-?\d*\.?\d+$/.test(part)) {
                // Numeric value
                span.className = 'r-number';
            } else if (part === 'NA' || part === 'NULL' || part === 'TRUE' || part === 'FALSE') {
                // Constants
                span.className = 'r-constant';
            } else if (/^".*"$/.test(part) || /^'.*'$/.test(part)) {
                // String
                span.className = 'r-string';
            }
            
            span.textContent = part + ' ';
            container.appendChild(span);
        }
    }
    
    isDataFrameOutput(text) {
        // Simple detection of head() and similar tabular output
        // This looks for patterns like row numbers at the beginning of lines
        // followed by consistently spaced columns of data
        
        const lines = text.trim().split('\n');
        
        // Need at least 3 lines for a data frame (command, header, data)
        if (lines.length < 3) return false;
        
        // Check if this appears to be a command output followed by a data frame
        const commandPattern = /^>\s*(head|print|tail|glimpse)\(/;
        const hasCommandLine = lines.some(line => commandPattern.test(line));
        
        // If we found a command line, look for a consistent table structure
        if (hasCommandLine) {
            // Find header line (typically contains column names)
            // Typically begins with spaces or a row number followed by columns
            const headerLineIndex = lines.findIndex((line, index) => 
                index > 0 && /^\s*(\d+\s+|\s+)([A-Za-z0-9_]+\s+){2,}/.test(line));
            
            if (headerLineIndex > 0) {
                // Check if subsequent lines have a similar structure
                const headerParts = lines[headerLineIndex].trim().split(/\s+/);
                
                // Count how many following lines have a similar number of columns
                let tableLineCount = 0;
                for (let i = headerLineIndex + 1; i < lines.length; i++) {
                    const parts = lines[i].trim().split(/\s+/);
                    // Allow for +/- 1 column to account for row numbers
                    if (Math.abs(parts.length - headerParts.length) <= 1 &&
                        parts.length > 1 &&
                        /^\s*\d+\s+|^\s+/.test(lines[i])) {
                        tableLineCount++;
                    } else {
                        break;
                    }
                }
                
                // If we found at least one data row, consider it a data frame
                return tableLineCount > 0;
            }
        }
        
        return false;
    }
    
    formatDataFrame(text) {
        const lines = text.trim().split('\n');
        
        // Find the command line (starts with ">")
        const commandLineIndex = lines.findIndex(line => line.trim().startsWith('>'));
        
        // Container for all output
        const result = document.createElement('div');
        
        // Format the command line with syntax highlighting if found
        if (commandLineIndex >= 0) {
            const commandDiv = document.createElement('div');
            commandDiv.innerHTML = this.highlightRSyntax(lines.slice(0, commandLineIndex + 1).join('\n'));
            result.appendChild(commandDiv);
        }
        
        // Find where the table starts
        const headerLineIndex = lines.findIndex((line, index) => 
            index > commandLineIndex && /^\s*(\d+\s+|\s+)([A-Za-z0-9_]+\s+){2,}/.test(line));
        
        if (headerLineIndex < 0) {
            // If we can't find a header, just format the rest normally
            const restDiv = document.createElement('div');
            restDiv.innerHTML = this.highlightRSyntax(lines.slice(commandLineIndex + 1).join('\n'));
            result.appendChild(restDiv);
            return result; // Return DOM element directly
        }
        
        // Format any text between command and header
        if (headerLineIndex > commandLineIndex + 1) {
            const midDiv = document.createElement('div');
            midDiv.innerHTML = this.highlightRSyntax(lines.slice(commandLineIndex + 1, headerLineIndex).join('\n'));
            result.appendChild(midDiv);
        }
        
        // Extract table content
        let tableEnd = headerLineIndex + 1;
        while (tableEnd < lines.length && 
               (/^\s*\d+\s+|^\s+/.test(lines[tableEnd]) && 
                !lines[tableEnd].trim().startsWith('>'))) {
            tableEnd++;
        }
        
        const tableLines = lines.slice(headerLineIndex, tableEnd);
        
        // Create the table HTML with horizontal scrolling
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        
        const tablePre = document.createElement('pre');
        tablePre.className = 'data-table-content';
        tablePre.innerHTML = this.highlightRSyntax(tableLines.join('\n'));
        
        tableContainer.appendChild(tablePre);
        result.appendChild(tableContainer);
        
        // Format any remaining text
        if (tableEnd < lines.length) {
            const restDiv = document.createElement('div');
            restDiv.innerHTML = this.highlightRSyntax(lines.slice(tableEnd).join('\n'));
            result.appendChild(restDiv);
        }
        
        return `<div class="data-frame-output">${result.innerHTML}</div>`;
    }
    
    highlightRSyntax(text) {
        // Handle null or undefined text
        if (!text) return '';
        
        // Escape HTML characters to prevent injection
        const escapeHtml = (unsafeText) => {
            return unsafeText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };
        
        const escapedText = escapeHtml(text);
        
        // Apply syntax highlighting using regular expressions
        return escapedText
            // R prompt
            .replace(/^(&gt;.*?)$/gm, '<span class="r-prompt">$1</span>')
            // Comments
            .replace(/(#.*)$/gm, '<span class="r-comment">$1</span>')
            // Function calls
            .replace(/\b([a-zA-Z0-9_.]+)\(/g, '<span class="r-function">$1</span>(')
            // Keywords
            .replace(/\b(if|else|for|while|function|in|return|next|break)\b/g, 
                     '<span class="r-keyword">$1</span>')
            // Constants
            .replace(/\b(TRUE|FALSE|NULL|NA|NaN|Inf)\b/g, 
                     '<span class="r-constant">$1</span>')
            // Numbers
            .replace(/\b(\d*\.?\d+)\b/g, '<span class="r-number">$1</span>')
            // Strings (simple version)
            .replace(/(".*?"|'.*?')/g, '<span class="r-string">$1</span>');
    }

    disconnectedCallback() {
        webrService.cleanup();
    }
}

// Register the custom element
customElements.define('webr-repl', WebRRepl);