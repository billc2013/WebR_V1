// webr-service.js
import { WebR } from 'https://webr.r-wasm.org/latest/webr.mjs';

class WebRService {
    constructor() {
        this.webR = null;
        this.isInitialized = false;
        this.requiredPackages = ['ggplot2'];
        this.packagesLoaded = false;
        this.shelter = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Initialize WebR with PostMessage channel for better compatibility
            this.webR = new WebR({
                baseURL: 'https://webr.r-wasm.org/latest/',
                serviceWorkerUrl: undefined,
                channelType: "post-message"
            });
            
            await this.webR.init();
            
            // Create a shelter for memory management
            this.shelter = await new this.webR.Shelter();
            
            // Set up canvas as default graphics device
            await this.webR.evalRVoid('options(device=webr::canvas)');
            
            // Load packages and configure graphics
            await this.loadRequiredPackages();
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('WebR initialization failed:', error);
            throw error;
        }
    }

    async loadRequiredPackages() {
        if (this.packagesLoaded) return;

        try {
            console.log('Installing and loading required R packages...');
            
            // First install all required packages
            await this.webR.installPackages(this.requiredPackages, true);
            
            // Then set up the graphics device and load packages
            await this.webR.evalRVoid(`
                # Set up graphics device
                options(device=webr::canvas)
                options(repr.plot.width=6, repr.plot.height=4)
                
                # Load required packages
                library(ggplot2)
            `);
            
            this.packagesLoaded = true;
            console.log('R packages loaded successfully');
        } catch (error) {
            console.error('Failed to load R packages:', error);
            throw error;
        }
    }

    async executeCode(code) {
        if (!this.isInitialized) {
            throw new Error('WebR not initialized');
        }

        try {
            // Check if code contains ggplot
            const isGgplot = code.includes('ggplot(');
            
            // If it's a ggplot command, wrap it in print()
            const execCode = isGgplot ? `print(${code})` : code;

            // Use captureR to get all output including plots
            const capture = await this.shelter.captureR(execCode, {
                withAutoprint: true,
                captureConditions: true,
                captureStreams: true,
                captureGraphics: {
                    width: 504,
                    height: 504,
                    pointsize: 12,
                    bg: "white"
                }
            });

            // Process the captured output
            let outputText = '';
            
            // Handle standard output and errors
            if (capture.output) {
                for (const out of capture.output) {
                    switch (out.type) {
                        case 'stdout':
                        case 'stderr':
                            outputText += out.data + '\n';
                            break;
                        case 'message':
                        case 'warning':
                        case 'error':
                            const condition = await out.data.toJs();
                            outputText += `${out.type}: ${condition.message}\n`;
                            break;
                    }
                }
            }

            // Return the results and any captured plots
            return {
                output: outputText.trim(),
                images: capture.images,
                result: capture.result ? await capture.result.toJs() : null
            };
        } catch (error) {
            throw new Error(`R execution error: ${error.message}`);
        }
    }

    async cleanup() {
        if (this.shelter) {
            await this.shelter.purge();
        }
        if (this.webR) {
            await this.webR.close();
            this.isInitialized = false;
            this.webR = null;
        }
    }
}

// Export a singleton instance
export const webrService = new WebRService();