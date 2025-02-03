// main.js
import { supabase } from '/src/supabase/supabaseClient.js'
import { signIn, signUp, signOut, getUser } from './supabase/auth.js';
import { uploadCSV, downloadFile } from './supabase/storageService.js';
import './components/webRRepl.js';  // Import the WebR REPL component
import { webrService } from './webr/webr-service.js';

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
    
    // Create auth form if it doesn't exist
    if (!authUI.innerHTML) {
        authUI.innerHTML = `
            <div class="auth-form">
                <h2>Sign In or Sign Up</h2>
                <input type="email" id="email" placeholder="Email" class="auth-input">
                <input type="password" id="password" placeholder="Password" class="auth-input">
                <div class="auth-buttons">
                    <button id="signin-btn" class="btn">Sign In</button>
                    <button id="signup-btn" class="btn">Sign Up</button>
                </div>
            </div>
        `;

        // Add auth event listeners
        document.getElementById('signin-btn').addEventListener('click', handleSignIn);
        document.getElementById('signup-btn').addEventListener('click', handleSignUp);
    }
}

// Show the main application
function showApp() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
}

// Handle sign in
async function handleSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

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
async function handleSignUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

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