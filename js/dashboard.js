import { supabase, isAuthenticated } from "./supabase.js";

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    await loadDashboardData();
    setupEventListeners();
});

// Check if user is authenticated
const checkAuthentication = async () => {
    const { user, error } = await isAuthenticated();
    
    if (error || !user) {
        console.error('Authentication error:', error);
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
};

// Load dashboard data
const loadDashboardData = async () => {
    try {
        const { user } = await isAuthenticated();
        
        // Load user stats
        await Promise.all([
            loadUserStats(user.id),
            loadRecentOrders(user.id),
            loadRecentProducts(user.id)
        ]);
        
        // Update welcome message
        updateWelcomeMessage(user);
        
        // Load menu items based on user role
        if(user.role==="farmer"){
            menu.innerHTML=`
            <a href="add-product.html">
            <button class="btn">Add Crop</button></a>
            <a href="orders.html">
            <button class="btn">Orders</button></a>`;
        } else {
            menu.innerHTML=`
            <a href="products.html">
            <button class="btn">Buy Products</button></a>`;
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
};

// Load user statistics
const loadUserStats = async (userId) => {
    try {
        // Get total products count
        const { count: productCount, error: productError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('farmer_id', userId);
        
        // Get total orders count (as farmer)
        const { count: orderCount, error: orderError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('product_id', 
                supabase.from('products').select('id').eq('farmer_id', userId)
            );
        
        if (!productError) {
            document.getElementById('totalProducts').textContent = productCount || 0;
        }
        
        if (!orderError) {
            document.getElementById('totalOrders').textContent = orderCount || 0;
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
};

// Load recent orders
const loadRecentOrders = async (userId) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products:product_id (
                    product_name,
                    image_url
                ),
                profiles:buyer_id (
                    name,
                    phone
                )
            `)
            .in('product_id', 
                supabase.from('products').select('id').eq('farmer_id', userId)
            )
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        // You can display recent orders here if needed
        console.log('Recent orders:', orders);
        
    } catch (error) {
        console.error('Error loading recent orders:', error);
    }
};

// Load recent products
const loadRecentProducts = async (userId) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('farmer_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        // You can display recent products here if needed
        console.log('Recent products:', products);
        
    } catch (error) {
        console.error('Error loading recent products:', error);
    }
};

// Update welcome message
const updateWelcomeMessage = async (user) => {
    try {
        // Get user profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();
        
        if (error) throw error;
        
        const welcomeElement = document.querySelector('.welcome-section h1');
        if (welcomeElement && profile) {
            welcomeElement.textContent = `👋 Welcome, ${profile.name.split(' ')[0]}!`;
        }
        
    } catch (error) {
        console.error('Error updating welcome message:', error);
    }
};

// Setup event listeners
const setupEventListeners = () => {
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
    
    // Add hover effects to cards
    const cards = document.querySelectorAll('.action-card, .stat-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
};

// Create ripple effect on button click
const createRipple = (event) => {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
};

// Show error message
const showError = (message) => {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification error';
    errorDiv.innerHTML = `
        <span class="notification-icon">❌</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
};

// Show success message
const showSuccess = (message) => {
    // Create success notification
    const successDiv = document.createElement('div');
    successDiv.className = 'notification success';
    successDiv.innerHTML = `
        <span class="notification-icon">✅</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentElement) {
            successDiv.remove();
        }
    }, 3000);
};

// Add notification styles dynamically
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    }
    
    .notification.error {
        border-left: 4px solid #ff5252;
    }
    
    .notification.success {
        border-left: 4px solid #4caf50;
    }
    
    .notification-icon {
        font-size: 18px;
        flex-shrink: 0;
    }
    
    .notification-message {
        flex: 1;
        font-size: 14px;
        color: #333;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
    }
    
    .notification-close:hover {
        background: #f5f5f5;
        color: #333;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;

// Add notification styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Export functions for use in other modules
export { loadDashboardData, showError, showSuccess };