// main.js
import { supabase } from '/src/supabase/supabaseClient.js'
import { signIn, signUp, signOut, getUser } from './supabase/auth.js';
import { uploadCSV, downloadFile } from './supabase/storageService.js';
import './components/webRRepl.js';  // Import the WebR REPL component
import { webrService } from './webr/webr-service.js';
import './components/rHelperComponent.js';  // Import the R Helper component


// DOM Elements
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const authUI = document.getElementById('auth-ui');
const signoutBtn = document.getElementById('signout-btn');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const statusIndicator = document.getElementById('status-indicator');

// Initialize the application
async function initApp() {
    const user = await getUser();
    if (user) {
        showApp();
        await loadUserFiles(user.id);
    } else {
        showAuth();
    }
}

// Show the authentication UI
function showAuth() {
    authContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    
    // Create auth form with tabbed interface
    if (!authUI.innerHTML) {
        authUI.innerHTML = `
            <div class="auth-form">
                <h2>Conservation Ecology R Lab</h2>
                <p class="auth-description">Access your browser-based R programming environment for conservation biology</p>
                
                <div class="auth-tabs">
                    <button id="signin-tab" class="auth-tab auth-tab-active">Sign In</button>
                    <button id="signup-tab" class="auth-tab">Create Account</button>
                </div>
                
                <div id="signin-panel" class="auth-panel">
                    <p>Sign in with your existing account</p>
                    <input type="email" id="signin-email" placeholder="Email" class="auth-input">
                    <input type="password" id="signin-password" placeholder="Password" class="auth-input">
                    <button id="signin-btn" class="btn btn-primary btn-full">Sign In</button>
                </div>
                
                <div id="signup-panel" class="auth-panel hidden">
                    <p>Create a new account to get started</p>
                    <input type="email" id="signup-email" placeholder="Email" class="auth-input">
                    <input type="password" id="signup-password" placeholder="Password" class="auth-input">
                    <input type="password" id="confirm-password" placeholder="Confirm Password" class="auth-input">
                    <button id="signup-btn" class="btn btn-primary btn-full">Create Account</button>
                </div>
            </div>
        `;

        // Add tab switching logic
        document.getElementById('signin-tab').addEventListener('click', () => {
            document.getElementById('signin-tab').classList.add('auth-tab-active');
            document.getElementById('signup-tab').classList.remove('auth-tab-active');
            document.getElementById('signin-panel').classList.remove('hidden');
            document.getElementById('signup-panel').classList.add('hidden');
        });
        
        document.getElementById('signup-tab').addEventListener('click', () => {
            document.getElementById('signup-tab').classList.add('auth-tab-active');
            document.getElementById('signin-tab').classList.remove('auth-tab-active');
            document.getElementById('signup-panel').classList.remove('hidden');
            document.getElementById('signin-panel').classList.add('hidden');
        });

        // Add auth event listeners
        document.getElementById('signin-btn').addEventListener('click', () => {
            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;
            handleSignIn(email, password);
        });
        
        document.getElementById('signup-btn').addEventListener('click', () => {
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Simple validation
            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }
            
            handleSignUp(email, password);
        });
    }
}


// Show the main application
function showApp() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
        // Initialize the helper component if it doesn't exist
    if (!document.querySelector('r-helper')) {
        const helperContainer = document.createElement('div');
        helperContainer.id = 'helper-container';
        helperContainer.innerHTML = '<r-helper></r-helper>';
        
        // Insert the helper between the header and the REPL
        const header = document.querySelector('header');
        const repl = document.querySelector('webr-repl');
        if (header && repl) {
            header.parentNode.insertBefore(helperContainer, repl);
        }
    }
}

// Handle sign in
async function handleSignIn(email, password) {
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        statusIndicator.textContent = 'Signing in...';
        const { user } = await signIn(email, password);
        if (user) {
            showApp();
            await loadUserFiles(user.id);
        }
    } catch (error) {
        alert('Sign in failed: ' + error.message);
    } finally {
        updateWebRStatus();
    }
}


// Handle sign up
async function handleSignUp(email, password) {
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        statusIndicator.textContent = 'Creating account...';
        const { user } = await signUp(email, password);
        if (user) {
            showApp();
            await loadUserFiles(user.id);
        }
    } catch (error) {
        alert('Sign up failed: ' + error.message);
    } finally {
        updateWebRStatus();
    }
}

// Handle sign out
async function handleSignOut() {
    try {
        await signOut();
        // Clean up WebR
        await webrService.cleanup();
        showAuth();
    } catch (error) {
        alert('Sign out failed: ' + error.message);
    }
}

// Update WebR status indicator
function updateWebRStatus() {
    if (webrService.isInitialized) {
        statusIndicator.textContent = 'WebR: Ready';
        statusIndicator.classList.add('status-ready');
    } else {
        statusIndicator.textContent = 'WebR: Not Ready';
        statusIndicator.classList.remove('status-ready');
    }
}

// Handle file upload
async function handleFileUpload() {
    const file = fileInput.files[0];
    if (!file) return;

    const user = await getUser();
    if (!user) return;

    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        statusIndicator.textContent = 'Uploading file...';

        // Upload the file to Supabase Storage
        await uploadCSV(user.id, file, file.name);

        // Insert a record into the files_uploads table
        const { data, error } = await supabase.from('files_uploads').insert([
            {
                user_id: user.id,
                file_name: file.name,
                file_path: `csv/${user.id}/${file.name}`,
                file_type: file.type
            },
        ]);

        if (error) throw error;

        // Reload the file list
        await loadUserFiles(user.id);

        // Get the WebR REPL component and load the file
        const repl = document.querySelector('webr-repl');
        if (repl) {
            const fileBlob = await downloadFile(`csv/${user.id}/${file.name}`);
            await repl.loadLocalFile(fileBlob, file.name);
        }

        fileInput.value = '';  // Clear the input
        alert('File uploaded successfully!');
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Upload failed: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
        updateWebRStatus();
    }
}

// Load user's files
async function loadUserFiles(userId) {
    try {
        const { data: files, error } = await supabase
            .from('files_uploads')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        fileList.innerHTML = files.length ? '' : '<li>No files uploaded yet</li>';
        
        files.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${file.file_name}</span>
                <button class="btn small" onclick="window.loadFileInR('${file.file_path}')">Load in R</button>
            `;
            fileList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

// Load a file into R workspace
window.loadFileInR = async function(filePath) {
    try {
        statusIndicator.textContent = 'Loading file...';
        const fileBlob = await downloadFile(filePath);
        const repl = document.querySelector('webr-repl');
        if (repl) {
            await repl.loadLocalFile(fileBlob, filePath.split('/').pop());
        }
    } catch (error) {
        alert('Error loading file into R: ' + error.message);
    } finally {
        updateWebRStatus();
    }
};

// Add event listeners
document.addEventListener('DOMContentLoaded', initApp);
signoutBtn.addEventListener('click', handleSignOut);
uploadBtn.addEventListener('click', handleFileUpload);

// Listen for authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        showApp();
        if (session?.user) {
            loadUserFiles(session.user.id);
        }
    } else if (event === 'SIGNED_OUT') {
        showAuth();
    }
});

// Update WebR status periodically
setInterval(updateWebRStatus, 5000);