import { supabase, isAuthenticated } from "./supabase.js";

// Show loading state
const showLoading = (button) => {
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span> Processing...';
    }
};

// Hide loading state
const hideLoading = (button, originalText) => {
    if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
    }
};

// Show error message
const showError = (message) => {
    console.error('Auth Error:', message);
    alert(`❌ Error: ${message}`);
};

// Show success message
const showSuccess = (message) => {
    console.log('Auth Success:', message);
    alert(`✅ ${message}`);
};

// Validate email format
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Validate phone number (basic validation for Indian numbers)
const validatePhone = (phone) => {
    const re = /^[6-9]\d{9}$/;
    return re.test(phone);
};

// Check authentication on page load
const checkAuth = async () => {
    const { user, error } = await isAuthenticated();
    if (user && !window.location.pathname.includes('dashboard.html') && 
        !window.location.pathname.includes('add-product.html') && 
        !window.location.pathname.includes('products.html') && 
        !window.location.pathname.includes('orders.html')) {
        // User is authenticated but not on dashboard pages, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
    return { user, error };
};

// ---------- REGISTER ----------
window.register = async () => {
    const button = event.target;
    const originalText = button.innerHTML;
    showLoading(button);

    try {
        // Get form values
        const name = document.getElementById('name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const location = document.getElementById('location').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validation
        if (!name || !phone || !location || !email || !password) {
            throw new Error('Please fill in all fields');
        }

        if (!validateEmail(email)) {
            throw new Error('Please enter a valid email address');
        }

        if (!validatePhone(phone)) {
            throw new Error('Please enter a valid 10-digit phone number');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Sign up user with metadata
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    phone: phone,
                    location: location,
                    role: 'farmer'
                }
            }
        });

        if (error) {
            throw error;
        }

        showSuccess('Registration successful! Please check your email to verify your account.');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading(button, originalText);
    }
};

// ---------- LOGIN ----------
window.login = async () => {
    const button = event.target;
    const originalText = button.innerHTML;
    showLoading(button);

    try {
        // Get form values
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validation
        if (!email || !password) {
            throw new Error('Please enter both email and password');
        }

        if (!validateEmail(email)) {
            throw new Error('Please enter a valid email address');
        }

        // Sign in user
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        // Check if user profile exists and has correct role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        // If profile doesn't exist, create it from user metadata
        if (profileError && profileError.code === 'PGRST116') {
            console.log('Profile not found, creating from user metadata...');
            
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    name: data.user.user_metadata?.name || 'Unknown User',
                    phone: data.user.user_metadata?.phone || '0000000000',
                    location: data.user.user_metadata?.location || 'Unknown',
                    role: data.user.user_metadata?.role || 'farmer'
                })
                .select()
                .single();
            
            if (createError) {
                console.error('Error creating profile:', createError);
                throw new Error('Failed to create user profile. Please try registering again.');
            }
            
            console.log('Profile created successfully:', newProfile);
        } else if (profileError) {
            throw new Error('Error fetching user profile: ' + profileError.message);
        }

        showSuccess('Login successful!');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading(button, originalText);
    }
};

// ---------- LOGOUT ----------
window.logout = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            throw error;
        }

        showSuccess('Logged out successfully!');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);

    } catch (error) {
        showError(error.message);
    }
};

// ---------- PASSWORD RESET ----------
window.resetPassword = async () => {
    const email = prompt('Enter your email address for password reset:');
    
    if (!email) {
        return;
    }

    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        
        if (error) {
            throw error;
        }

        showSuccess('Password reset link sent to your email!');

    } catch (error) {
        showError(error.message);
    }
};

// ---------- FORM VALIDATION ----------
// Add real-time validation
document.addEventListener('DOMContentLoaded', () => {
    // Email validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value && !validateEmail(input.value)) {
                input.style.borderColor = '#ff5252';
                input.title = 'Please enter a valid email address';
            } else {
                input.style.borderColor = '#e0e0e0';
                input.title = '';
            }
        });
    });

    // Phone validation
    const phoneInputs = document.querySelectorAll('input[type="tel"], input[id="phone"]');
    phoneInputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value && !validatePhone(input.value)) {
                input.style.borderColor = '#ff5252';
                input.title = 'Please enter a valid 10-digit phone number';
            } else {
                input.style.borderColor = '#e0e0e0';
                input.title = '';
            }
        });
    });

    // Password validation
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value && input.value.length < 6) {
                input.style.borderColor = '#ff5252';
                input.title = 'Password must be at least 6 characters long';
            } else {
                input.style.borderColor = '#e0e0e0';
                input.title = '';
            }
        });
    });

    // Check auth on page load
    checkAuth();
});

// ---------- SESSION MANAGEMENT ----------
// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        console.log('User signed in:', session.user);
    } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
    }
});

// Export functions for use in other modules
export { register, login, logout, resetPassword, checkAuth };