// webr-service.js
import { WebR } from 'https://webr.r-wasm.org/v0.2.1/webr.mjs';

class WebRService {
    constructor() {
        this.webR = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.webR = new WebR({
                baseURL: 'https://webr.r-wasm.org/v0.2.1/',
                // serviceWorkerUrl: 'https://webr.r-wasm.org/v0.2.1/webr-serviceworker.js',
                serviceWorkerUrl: undefined,
                debug: false
            });
            
            await this.webR.init();
            this.isInitialized = true;
            
            return true;
        } catch (error) {
            console.error('WebR initialization failed:', error);
            throw error;
        }
    }

    async executeCode(code) {
        if (!this.isInitialized) {
            throw new Error('WebR not initialized');
        }

        try {
            const result = await this.webR.evalR(code);
            let output;

            try {
                const jsResult = await result.toJs();
                output = this.formatROutput(jsResult);
            } catch (conversionError) {
                output = await result.toString();
            }

            return output;
        } catch (error) {
            throw new Error(`R execution error: ${error.message}`);
        }
    }

    async createPlot(plotCode) {
        if (!this.isInitialized) {
            throw new Error('WebR not initialized');
        }

        try {
            // Set up PNG device
            await this.webR.evalR('png(filename = "plot.png", width = 800, height = 600)');
            
            // Execute plotting code
            await this.webR.evalR(plotCode);
            
            // Close device
            await this.webR.evalR('dev.off()');

            // Get the plot binary data
            const plotData = await this.webR.FS.readFile("plot.png");
            
            // Convert to blob
            return new Blob([plotData], { type: 'image/png' });
        } catch (error) {
            throw new Error(`Plot creation error: ${error.message}`);
        }
    }

    formatROutput(obj) {
        console.log(obj);
        if (!obj ||!obj.type) return '';
    
        switch (obj.type) {
            case 'double':
            case 'integer':
            case 'logical':
            case 'character':
                return ` ${obj.values.join(' ')}`;
            
            case 'list':  // This handles all lists
                if (obj.names && obj.names.length > 0) { 
                    // This is the specific case for named lists
                    let output = `${obj.class? obj.class + ':\n': 'List:\n'}`;
                    for (let key of obj.names) {
                        output += `${key}:\n${this.formatROutput(obj.values[obj.names.indexOf(key)])}\n`;
                    }
                    return output;
                } else {
                    // This is for regular lists without names
                    return `List:\n${obj.values.map((val, i) => 
                        `[[${i + 1}]]\n${this.formatROutput(val)}`
                    ).join('\n')}`;
                }

            case 'data.frame':
                const colNames = obj.names || [];
                const rows = obj.values;
                // Create the formatted output string first
                const formattedRows = rows.map(row => row.values.join('\t')).join('\n'); 
                return colNames.join('\t') + '\n' + formattedRows; // Then return it
                
            default:
                return `Unsupported type: ${obj.type}`;
        }
    }
    
    async cleanup() {
        if (this.webR) {
            // Add any necessary cleanup here
            this.isInitialized = false;
            this.webR = null;
        }
    }
}

// Export a singleton instance
export const webrService = new WebRService();