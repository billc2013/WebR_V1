// webr-service.js
import { WebR } from 'https://webr.r-wasm.org/latest/webr.mjs';

class WebRService {
    constructor() {
        this.webR = null;
        this.isInitialized = false;
        this.requiredPackages = ['ggplot2'];
        this.packagesLoaded = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.webR = new WebR({
                baseURL: 'https://webr.r-wasm.org/latest/',
                serviceWorkerUrl: undefined,
                debug: false
            });
            
            await this.webR.init();
            
            // Load required packages
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
            // Show loading message
            console.log('Loading required R packages...');
            
            // Install packages using WebR's installPackages method
            await this.webR.installPackages(this.requiredPackages);
            
            // Load the packages using library()
            for (const pkg of this.requiredPackages) {
                await this.webR.evalR(`library(${pkg})`);
            }
            
            this.packagesLoaded = true;
            console.log('R packages loaded successfully');
        } catch (error) {
            console.error('Failed to load R packages:', error);
            throw error;
        }
    }

    async createPlot(plotCode) {
        if (!this.isInitialized) {
            throw new Error('WebR not initialized');
        }

        try {
            console.log('Creating plot with code:', plotCode);

            // Ensure we have a writable directory
            await this.webR.evalR(`
                if (!dir.exists(tempdir())) {
                    dir.create(tempdir(), recursive = TRUE)
                }
            `);

            // Create a unique filename for this plot
            const filename = `plot_${Date.now()}.png`;
            const filepath = `${filename}`;

            // Set up PNG device with more detailed error handling
            console.log('Setting up PNG device...');
            await this.webR.evalR(`
                tryCatch({
                    png(filename = "${filepath}",
                        width = 800,
                        height = 600,
                        res = 96,
                        bg = "white")
                }, error = function(e) {
                    print(paste("Error setting up PNG device:", e$message))
                })
            `);
            
            // Execute plotting code with error handling
            console.log('Executing plot code...');
            await this.webR.evalR(`
                tryCatch({
                    ${plotCode}
                    dev.off()
                }, error = function(e) {
                    if (dev.cur() > 1) dev.off()
                    print(paste("Error during plotting:", e$message))
                    stop(e$message)
                })
            `);

            // Check if file exists
            console.log('Checking for plot file...');
            const fileExists = await this.webR.evalR(`file.exists("${filepath}")`);
            const fileExistsJS = await fileExists.toJs();
            
            if (!fileExistsJS) {
                throw new Error('Plot file was not created');
            }

            // Get the plot binary data
            console.log('Reading plot file...');
            const plotData = await this.webR.FS.readFile(filepath);
            
            // Clean up the file
            await this.webR.FS.unlink(filepath);
            
            // Convert to blob
            return new Blob([plotData], { type: 'image/png' });
        } catch (error) {
            console.error('Detailed plot error:', error);
            throw new Error(`Plot creation error: ${error.message}`);
        }
    }

    async executeCode(code) {
        if (!this.isInitialized) {
            throw new Error('WebR not initialized');
        }

        try {
            // Execute the code
            const result = await this.webR.evalR(code);
            console.log("Raw R result:", result);
            let output;

            try {
                // Enhanced ggplot detection
                if (code.includes('ggplot(')) {
                    console.log('ggplot detected, creating plot...');
                    return await this.createPlot(`
                        tryCatch({
                            print(${code})
                        }, error = function(e) {
                            print(paste("Error in ggplot:", e$message))
                            stop(e$message)
                        })
                    `);
                }
                // Check if this is an assignment operation
                const isAssignment = code.includes('<-');
                const objectName = isAssignment ? code.split('<-')[0].trim() : code.trim();

                // Get the class of the object
                const classResult = await this.webR.evalR(`class(${objectName})`);
                const classJS = await classResult.toJs();
                console.log("Object class:", classJS);

                // Special handling for different types of objects
                if (classJS.values && classJS.values.includes('gg')) {
                    // Handle ggplot objects
                    return await this.createPlot(code);
                } else if (classJS.values && classJS.values.includes('lm')) {
                    // Handle linear models
                    const printOutput = await this.webR.evalR(`capture.output(print(${objectName}))`);
                    const summaryOutput = await this.webR.evalR(`capture.output(summary(${objectName}))`);
                    
                    const printJS = await printOutput.toJs();
                    const summaryJS = await summaryOutput.toJs();

                    output = [
                        "Call:",
                        ...printJS.values,
                        "",
                        "Coefficients:",
                        ...summaryJS.values.filter(line => 
                            !line.includes("Call:") && 
                            !line.trim().startsWith("---")
                        )
                    ].join('\n');
                } else {
                    // Handle regular output
                    const jsResult = await result.toJs();
                    output = this.formatROutput(jsResult);
                }
            } catch (conversionError) {
                console.error("Conversion error:", conversionError);
                // If conversion fails, try to get string representation
                try {
                    const stringOutput = await this.webR.evalR(`capture.output(print(${code.trim()}))`);
                    const stringJS = await stringOutput.toJs();
                    output = stringJS.values.join('\n');
                } catch (stringError) {
                    output = await result.toString();
                }
            }

            return output;
        } catch (error) {
            throw new Error(`R execution error: ${error.message}`);
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
                if (obj.names) {
                    // Handle named vectors
                    return obj.names.map((name, i) => 
                        `${name}: ${obj.values[i]}`
                    ).join('\n');
                }
                return ` ${obj.values.join(' ')}`;
            
            case 'list':
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