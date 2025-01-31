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
                // Option 1: Load just the most recent state
                const state = await loadReplState(user.id);
                if (state) {
                    this.commandHistory = JSON.parse(state.command_history || '[]');
                    if (state.last_output) {
                        this.appendOutput(state.last_output);
                    }
                }
    
                // Option 2: Load full command history
                // const fullHistory = await getFullCommandHistory(user.id);
                // this.commandHistory = fullHistory;
                
            } catch (error) {
                console.error('Error loading REPL state:', error);
                // Don't throw - just log the error and continue with empty history
            }
        }
    }
    

    async loadLocalFile(fileBlob, fileName) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        await webrService.webR.FS.writeFile(fileName, new Uint8Array(arrayBuffer));
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
            // Check if code contains plotting commands
            const hasPlot = /^(?:.*\b(?:plot|hist|boxplot|ggplot|geom_|barplot|pie|curve|contour|image|persp)\b.*|\s*par\b.*)$/m.test(code);

            if (hasPlot) {
                // Handle plot creation
                const plotBlob = await webrService.createPlot(code);
                const user = await getUser();
                if (user) {
                    try {
                        const plotUrl = await uploadPlot(user.id, plotBlob);
                        this.showPlot(plotUrl);
                    } catch (error) {
                        this.appendOutput('Error saving plot: ' + error.message + '\n');
                    }
                }
            } else {
                // Regular code execution
                const result = await webrService.executeCode(code);
                this.appendOutput(result + '\n');
            }

            // Save state
            const user = await getUser();
            if (user) {
                try {
                    await saveReplState(user.id, {
                        commandHistory: this.commandHistory,
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

    showPlot(url) {
        // Create a container for this plot
        const container = document.createElement('div');
        container.className = 'plot-card';
      
        // Create the <img> element
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'R Plot';
        img.className = 'plot-image';
        
        // Create a "Close Plot" button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close Plot';
        closeBtn.onclick = () => {
          container.remove(); // remove this entire plot card
        };
      
        // Create a "Share Plot" button
        const shareBtn = document.createElement('button');
        shareBtn.textContent = 'Share Plot';
        shareBtn.onclick = () => {
          // For an MVP, just prompt or copy the URL
          window.prompt('Share this URL:', url);
        };
      
        // Assemble the container
        container.appendChild(img);
        container.appendChild(closeBtn);
        container.appendChild(shareBtn);
      
        // Append to the existing .plot-output
        // (Don't overwrite existing content)
        this.plotOutput.appendChild(container);
      }
      

    disconnectedCallback() {
        // Cleanup
        webrService.cleanup();
    }
}

// Register the custom element
customElements.define('webr-repl', WebRRepl);