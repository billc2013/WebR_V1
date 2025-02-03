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
        this.outputElement.textContent += text;
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    disconnectedCallback() {
        webrService.cleanup();
    }
}

// Register the custom element
customElements.define('webr-repl', WebRRepl);