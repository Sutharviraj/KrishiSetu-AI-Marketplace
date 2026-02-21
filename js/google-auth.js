import { supabase } from "./supabase.js";

// Google Authentication Functions
export const authWithGoogle = async () => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'http://localhost:8000/dashboard.html'
            }
        });

        if (error) throw error;
        
        console.log('Google auth initiated:', data);
        return { success: true, data };
        
    } catch (error) {
        console.error('Google auth error:', error);
        return { success: false, error: error.message };
    }
};

// Sign out function
export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
        return { success: true };
        
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
};

// Make functions global for HTML onclick
window.authWithGoogle = authWithGoogle;
window.signOut = signOut;

// Handle OAuth redirect
const handleOAuthRedirect = async () => {
    const { data, error } = await supabase.auth.getSession();
    
    if (data.session && window.location.pathname.includes('dashboard.html')) {
        console.log('User authenticated via OAuth:', data.session.user);
        // User is logged in, continue to dashboard
    } else if (error) {
        console.error('OAuth session error:', error);
        window.location.href = 'index.html';
    }
};

// Check for OAuth redirect on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash.includes('#access_token')) {
        handleOAuthRedirect();
    }
});
