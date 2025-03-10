// rHelperComponent.js
export class RHelperComponent extends HTMLElement {
    constructor() {
        super();
        this.tutorials = [];
        this.currentStep = 0;
        this.isContentVisible = false;
    }

    async connectedCallback() {
        await this.loadTutorials();
        this.render();
        this.setupEvents();
    }

    async loadTutorials() {
        // Define the tutorial steps - in a real implementation, 
        // this could come from a configuration file or API
        const tutorialFiles = [
            {
                id: 'basic-operations',
                title: 'Exploring the Dataset',
                file: '/tutorials/basic-operations.md'
            },
            {
                id: 'species-counts',
                title: 'Counting Species',
                file: '/tutorials/species-counts.md'
            },
            {
                id: 'basic-plot',
                title: 'Simple Plot',
                file: '/tutorials/basic-plot.md'
            },
            {
                id: 'formatted-plot',
                title: 'Formatted Plot',
                file: '/tutorials/formatted-plot.md'
            }
        ];

        // Load each tutorial file
        for (const tutorial of tutorialFiles) {
            try {
                const response = await fetch(tutorial.file);
                if (!response.ok) {
                    throw new Error(`Failed to load tutorial: ${response.statusText}`);
                }
                
                const content = await response.text();
                const parsedContent = this.parseTutorialMarkdown(content);
                
                this.tutorials.push({
                    ...tutorial,
                    ...parsedContent
                });
            } catch (error) {
                console.error(`Error loading tutorial ${tutorial.file}:`, error);
                // Add a placeholder for the failed tutorial
                this.tutorials.push({
                    ...tutorial,
                    description: 'Tutorial content could not be loaded.',
                    code: '# Tutorial content not available',
                    explanation: ['Error loading tutorial content.']
                });
            }
        }
    }

    parseTutorialMarkdown(markdownContent) {
        // Simple markdown parser that looks for specific sections
        const sections = {
            description: '',
            code: '',
            explanation: []
        };

        // Split content by markdown section markers
        const descriptionMatch = markdownContent.match(/## Description\s+([\s\S]*?)(?=##|$)/);
        if (descriptionMatch) {
            sections.description = descriptionMatch[1].trim();
        }

        const codeMatch = markdownContent.match(/## Code\s+```r\s+([\s\S]*?)```/);
        if (codeMatch) {
            sections.code = codeMatch[1].trim();
        }

        const explanationMatch = markdownContent.match(/## Explanation\s+([\s\S]*?)(?=##|$)/);
        if (explanationMatch) {
            // Split by bullet points
            sections.explanation = explanationMatch[1]
                .split('\n')
                .filter(line => line.trim().startsWith('- '))
                .map(line => line.trim().substring(2).trim());
        }

        return sections;
    }

    render() {
        this.innerHTML = `
            <div class="helper-container">
                <div class="helper-header">
                    <h3>Step-by-Step R Tutorial</h3>
                    <button id="toggle-helper" class="btn">
                        ${this.isContentVisible ? 'Hide Tutorial' : 'Show Tutorial'}
                    </button>
                </div>
                <div id="helper-content" class="helper-content ${this.isContentVisible ? '' : 'hidden'}">
                    <div class="helper-nav">
                        ${this.tutorials.map((tutorial, index) => 
                            `<button class="helper-nav-btn ${index === this.currentStep ? 'active' : ''}" 
                                data-step="${index}">${tutorial.title}</button>`
                        ).join('')}
                    </div>
                    <div id="tutorial-display" class="tutorial-display">
                        <p>Loading tutorial content...</p>
                    </div>
                    <div class="tutorial-navigation">
                        <button id="prev-step" class="btn nav-btn" ${this.currentStep === 0 ? 'disabled' : ''}>Previous Step</button>
                        <span class="step-indicator">Step ${this.currentStep + 1} of ${this.tutorials.length}</span>
                        <button id="next-step" class="btn nav-btn" ${this.currentStep === this.tutorials.length - 1 ? 'disabled' : ''}>Next Step</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
        // Toggle helper visibility
        const toggleBtn = this.querySelector('#toggle-helper');
        const helperContent = this.querySelector('#helper-content');
        
        toggleBtn.addEventListener('click', () => {
            this.isContentVisible = !this.isContentVisible;
            helperContent.classList.toggle('hidden', !this.isContentVisible);
            toggleBtn.textContent = this.isContentVisible ? 'Hide Tutorial' : 'Show Tutorial';
        });
        

        // Navigation button clicks
        const navBtns = this.querySelectorAll('.helper-nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.step);
                this.navigateToStep(step);
            });
        });

        // Prev/Next buttons
        const prevBtn = this.querySelector('#prev-step');
        const nextBtn = this.querySelector('#next-step');
        
        prevBtn.addEventListener('click', () => {
            if (this.currentStep > 0) {
                this.navigateToStep(this.currentStep - 1);
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (this.currentStep < this.tutorials.length - 1) {
                this.navigateToStep(this.currentStep + 1);
            }
        });

        // Display the current step
        this.displayTutorial(this.currentStep);
    }

    navigateToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.tutorials.length) {
            return;
        }
        
        this.currentStep = stepIndex;
        
        // Update the active nav button
        const navBtns = this.querySelectorAll('.helper-nav-btn');
        navBtns.forEach((btn, index) => {
            btn.classList.toggle('active', index === stepIndex);
        });
        
        // Update prev/next buttons
        const prevBtn = this.querySelector('#prev-step');
        const nextBtn = this.querySelector('#next-step');
        prevBtn.disabled = stepIndex === 0;
        nextBtn.disabled = stepIndex === this.tutorials.length - 1;
        
        // Update step indicator
        const stepIndicator = this.querySelector('.step-indicator');
        stepIndicator.textContent = `Step ${stepIndex + 1} of ${this.tutorials.length}`;
        
        // Display the tutorial
        this.displayTutorial(stepIndex);
    }

    displayTutorial(index) {
        const tutorialDisplay = this.querySelector('#tutorial-display');
        const tutorial = this.tutorials[index];
        
        if (!tutorial) {
            tutorialDisplay.innerHTML = '<p>Tutorial not found</p>';
            return;
        }
        
        tutorialDisplay.innerHTML = `
            <h4>${tutorial.title}</h4>
            <p class="tutorial-description">${tutorial.description}</p>
            <div class="code-actions">
                <pre class="code-block"><code>${this.escapeHtml(tutorial.code)}</code></pre>
                <div class="button-group">
                    <button class="btn copy-btn" data-code="${this.escapeHtml(tutorial.code)}">Copy Code</button>
                    <button class="btn try-btn" data-code="${this.escapeHtml(tutorial.code)}">Try in Console</button>
                </div>
            </div>
            <div class="explanation">
                <h5>How it works:</h5>
                <ul>
                    ${tutorial.explanation.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Set up the copy button
        const copyBtn = tutorialDisplay.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            const code = copyBtn.dataset.code;
            navigator.clipboard.writeText(code)
                .then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy Code';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                });
        });
        
        // Set up the try button
        const tryBtn = tutorialDisplay.querySelector('.try-btn');
        tryBtn.addEventListener('click', () => {
            const code = tryBtn.dataset.code;
            const replInput = document.querySelector('.repl-input');
            if (replInput) {
                replInput.value = code;
                // Optional: scroll to the REPL
                document.querySelector('webr-repl').scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    }
    
    escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
}

// Register the web component
customElements.define('r-helper', RHelperComponent);