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
            console.log('Loading required R packages...');
            await this.webR.installPackages(this.requiredPackages);
            
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

            // Get temp directory path from R
            const tempDir = await this.webR.evalR('tempdir()');
            const tempDirPath = await tempDir.toString();
            const filename = `plot_${Date.now()}.png`;
            const filepath = `${tempDirPath}/${filename}`;

            console.log('Using filepath:', filepath);

            // Set up device and create plot in a single R execution
            await this.webR.evalR(`
                tryCatch({
                    # Ensure temp directory exists
                    dir.create(tempdir(), showWarnings = FALSE, recursive = TRUE)
                    
                    # Set up the PNG device
                    png("${filepath}",
                        width = 800,
                        height = 600,
                        res = 96,
                        bg = "white")
                    
                    # Create the plot
                    print(${plotCode})
                    
                    # Close the device
                    dev.off()
                }, error = function(e) {
                    if (dev.cur() > 1) dev.off()
                    stop(paste("Plot error:", e$message))
                })
            `);

            // Verify the file exists
            const fileCheck = await this.webR.evalR(`file.exists("${filepath}")`);
            const exists = await fileCheck.toJs();
            
            if (!exists) {
                throw new Error('Plot file was not created');
            }

            // Read the file
            console.log('Reading plot file...');
            const plotData = await this.webR.FS.readFile(filepath);

            // Clean up
            await this.webR.evalR(`unlink("${filepath}")`);

            return new Blob([plotData], { type: 'image/png' });
        } catch (error) {
            console.error('Plot creation error:', error);
            throw error;
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
            
            // Get object name (for both assignments and direct expressions)
            const objectName = code.includes('<-') 
                ? code.split('<-')[0].trim() 
                : code.trim();
    
            // First check for ggplot commands
            if (code.includes('ggplot(')) {
                console.log('ggplot detected, creating plot...');
                return await this.createPlot(code);
            }
    
            try {
                // Get the class of the object
                const classResult = await this.webR.evalR(`class(${objectName})`);
                const classJS = await classResult.toJs();
                console.log("Object class:", classJS);
    
                if (!classJS.values) {
                    // If no class values, treat as regular output
                    const jsResult = await result.toJs();
                    return this.formatROutput(jsResult);
                }
    
                // Handle different object types based on class
                if (classJS.values.includes('lm')) {
                    // Handle linear models
                    const [printOutput, summaryOutput] = await Promise.all([
                        this.webR.evalR(`capture.output(print(${objectName}))`),
                        this.webR.evalR(`capture.output(summary(${objectName}))`)
                    ]);
                    
                    const [printJS, summaryJS] = await Promise.all([
                        printOutput.toJs(),
                        summaryOutput.toJs()
                    ]);
    
                    return [
                        "Call:",
                        ...printJS.values,
                        "",
                        "Coefficients:",
                        ...summaryJS.values.filter(line => 
                            !line.includes("Call:") && 
                            !line.trim().startsWith("---")
                        )
                    ].join('\n');
                } 
                
                // Handle regular output
                const jsResult = await result.toJs();
                return this.formatROutput(jsResult);
    
            } catch (conversionError) {
                console.error("Conversion error:", conversionError);
                
                // Fallback: try to get string representation
                try {
                    const stringOutput = await this.webR.evalR(`capture.output(print(${objectName}))`);
                    const stringJS = await stringOutput.toJs();
                    return stringJS.values.join('\n');
                } catch (stringError) {
                    return await result.toString();
                }
            }
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