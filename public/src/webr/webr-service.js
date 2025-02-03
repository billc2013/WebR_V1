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
        console.log("Formatting object:", obj);
        if (!obj || !obj.type) return '';
    
        switch (obj.type) {
            case 'double':
            case 'integer':
            case 'logical':
            case 'character':
                return ` ${obj.values.join(' ')}`;
            
            case 'list':
                // Check if this is a linear model (lm) object
                if (obj.class && obj.class.includes('lm')) {
                    return this.formatLinearModel(obj);
                }
                
                // Handle regular named lists
                if (obj.names && obj.names.length > 0) {
                    let output = `${obj.class ? obj.class.join(' ') + ':\n' : 'List:\n'}`;
                    for (let i = 0; i < obj.names.length; i++) {
                        const key = obj.names[i];
                        const value = obj.values[i];
                        if (value !== undefined) {
                            output += `$${key}\n${this.formatROutput(value)}\n`;
                        }
                    }
                    return output;
                }
                
                // Handle unnamed lists
                return `List:\n${obj.values.map((val, i) => 
                    `[[${i + 1}]]\n${this.formatROutput(val)}`
                ).join('\n')}`;

            case 'data.frame':
                const colNames = obj.names || [];
                const rows = obj.values;
                return colNames.join('\t') + '\n' + 
                       rows.map(row => row.values.join('\t')).join('\n');
            
            default:
                return `Unsupported type: ${obj.type}`;
        }
    }

    formatLinearModel(lmObj) {
        let output = 'Call:\n';
        
        // Format the call (formula)
        if (lmObj.values.find(v => v.names && v.names.includes('call'))) {
            output += this.formatROutput(lmObj.values[lmObj.names.indexOf('call')]) + '\n\n';
        }

        // Format coefficients
        const coefficients = lmObj.values.find(v => v.names && v.names.includes('coefficients'));
        if (coefficients) {
            output += 'Coefficients:\n';
            const coefValues = coefficients.values;
            const coefNames = coefficients.names || [];
            coefValues.forEach((coef, i) => {
                output += `${coefNames[i] || 'Unknown'}: ${coef}\n`;
            });
        }

        // Format residuals summary if available
        const residuals = lmObj.values.find(v => v.names && v.names.includes('residuals'));
        if (residuals) {
            output += '\nResidual summary:\n';
            output += this.formatROutput(residuals) + '\n';
        }

        // Format R-squared if available
        const rSquared = lmObj.values.find(v => v.names && v.names.includes('r.squared'));
        if (rSquared) {
            output += `\nR-squared: ${this.formatROutput(rSquared)}\n`;
        }

        return output;
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