import { supabase, isAuthenticated } from "./supabase.js";

// Global variables
let currentUserId = null;
let sellingOrders = [];
let buyingOrders = [];

// Initialize orders page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    await loadOrders();
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
    
    currentUserId = user.id;
    return true;
};

// Load orders (both selling and buying)
const loadOrders = async () => {
    try {
        await Promise.all([
            loadSellingOrders(),
            loadBuyingOrders()
        ]);
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Failed to load orders');
    }
};

// Load selling orders (orders for farmer's products)
const loadSellingOrders = async () => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products:product_id (
                    product_name,
                    image_url,
                    farmer_id
                ),
                profiles:buyer_id (
                    name,
                    phone
                )
            `)
            .in('product_id', 
                supabase.from('products').select('id').eq('farmer_id', currentUserId)
            )
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        sellingOrders = orders || [];
        renderSellingOrders(sellingOrders);
        
    } catch (error) {
        console.error('Error loading selling orders:', error);
    }
};

// Load buying orders (orders placed by user)
const loadBuyingOrders = async () => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products:product_id (
                    product_name,
                    image_url,
                    profiles:farmer_id (
                        name,
                        phone,
                        location
                    )
                )
            `)
            .eq('buyer_id', currentUserId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        buyingOrders = orders || [];
        renderBuyingOrders(buyingOrders);
        
    } catch (error) {
        console.error('Error loading buying orders:', error);
    }
};

// Render selling orders
const renderSellingOrders = (orders) => {
    const container = document.getElementById('farmerOrders');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No orders received</h3>
                <p>When customers buy your products, orders will appear here</p>
            </div>
        `;
        return;
    }
    
    const ordersHTML = orders.map(order => createSellingOrderCard(order)).join('');
    container.innerHTML = ordersHTML;
    
    // Add event listeners to action buttons
    container.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', () => updateOrderStatus(btn.dataset.orderId, 'accepted'));
    });
    
    container.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => updateOrderStatus(btn.dataset.orderId, 'rejected'));
    });
};

// Render buying orders
const renderBuyingOrders = (orders) => {
    const container = document.getElementById('customerOrders');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <h3>No orders placed</h3>
                <p>Your order history will appear here</p>
            </div>
        `;
        return;
    }
    
    const ordersHTML = orders.map(order => createBuyingOrderCard(order)).join('');
    container.innerHTML = ordersHTML;
};

// Create selling order card HTML
const createSellingOrderCard = (order) => {
    const buyerName = order.profiles?.name || 'Unknown Customer';
    const buyerPhone = order.profiles?.phone || 'N/A';
    const productName = order.products?.product_name || 'Unknown Product';
    const productImage = order.products?.image_url || 'https://via.placeholder.com/50x50?text=No+Image';
    const totalPrice = (order.quantity * order.price_per_unit).toFixed(2);
    
    const statusClass = `status-${order.status}`;
    const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-id">Order #${order.id.slice(0, 8)}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="order-details">
                <img src="${productImage}" alt="${productName}" class="order-product-image">
                <div class="order-info">
                    <h4>${productName}</h4>
                    <div class="order-meta">
                        <p><strong>Customer:</strong> ${buyerName}</p>
                        <p><strong>Phone:</strong> ${buyerPhone}</p>
                        <p><strong>Quantity:</strong> ${order.quantity}kg</p>
                        <p><strong>Price:</strong> ₹${order.price_per_unit}/kg</p>
                        <p><strong>Total:</strong> ₹${totalPrice}</p>
                        <p><strong>Payment:</strong> ${order.payment_type === 'cod' ? 'Cash on Delivery' : 'Online'}</p>
                        <p><strong>Delivery:</strong> ${order.delivery_address}</p>
                    </div>
                </div>
            </div>
            
            ${order.status === 'pending' ? `
                <div class="order-actions">
                    <button class="action-btn accept-btn" data-order-id="${order.id}">
                        ✅ Accept
                    </button>
                    <button class="action-btn reject-btn" data-order-id="${order.id}">
                        ❌ Reject
                    </button>
                </div>
            ` : ''}
        </div>
    `;
};

// Create buying order card HTML
const createBuyingOrderCard = (order) => {
    const farmerName = order.products?.profiles?.name || 'Unknown Farmer';
    const farmerPhone = order.products?.profiles?.phone || 'N/A';
    const farmerLocation = order.products?.profiles?.location || 'Unknown Location';
    const productName = order.products?.product_name || 'Unknown Product';
    const productImage = order.products?.image_url || 'https://via.placeholder.com/50x50?text=No+Image';
    const totalPrice = (order.quantity * order.price_per_unit).toFixed(2);
    
    const statusClass = `status-${order.status}`;
    const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-id">Order #${order.id.slice(0, 8)}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="order-details">
                <img src="${productImage}" alt="${productName}" class="order-product-image">
                <div class="order-info">
                    <h4>${productName}</h4>
                    <div class="order-meta">
                        <p><strong>Farmer:</strong> ${farmerName}</p>
                        <p><strong>Phone:</strong> ${farmerPhone}</p>
                        <p><strong>Location:</strong> ${farmerLocation}</p>
                        <p><strong>Quantity:</strong> ${order.quantity}kg</p>
                        <p><strong>Price:</strong> ₹${order.price_per_unit}/kg</p>
                        <p><strong>Total:</strong> ₹${totalPrice}</p>
                        <p><strong>Payment:</strong> ${order.payment_type === 'cod' ? 'Cash on Delivery' : 'Online'}</p>
                        <p><strong>Delivery:</strong> ${order.delivery_address}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Setup event listeners
const setupEventListeners = () => {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabSections = document.querySelectorAll('.orders-section');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Remove active class from all buttons and sections
            tabButtons.forEach(b => b.classList.remove('active'));
            tabSections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked button and corresponding section
            btn.classList.add('active');
            document.getElementById(`${targetTab}Orders`).classList.add('active');
        });
    });
};

// Update order status (for farmers)
const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (error) throw error;
        
        showSuccess(`Order ${newStatus} successfully!`);
        
        // Reload orders
        await loadOrders();
        
    } catch (error) {
        console.error('Error updating order status:', error);
        showError(`Failed to ${newStatus} order: ${error.message}`);
    }
};

// Show error message
const showError = (message) => {
    alert(`❌ Error: ${message}`);
};

// Show success message
const showSuccess = (message) => {
    alert(`✅ ${message}`);
};

// Add order styles
const orderStyles = `
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .empty-icon {
        font-size: 48px;
        margin-bottom: 15px;
        opacity: 0.5;
    }
    
    .order-id {
        font-size: 12px;
        color: #666;
        font-family: monospace;
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = orderStyles;
document.head.appendChild(styleSheet);

// Export functions for use in other modules
export { loadOrders, updateOrderStatus };

// Update order.js with complete order management functionality for both farmers and customers
window.buy = async (id) => {
    const { data, error } = await supabase.rpc("place_order", {
        p_product_id: id,
        p_quantity: 1,
        p_payment_type: "COD",
        p_delivery_address: "Local"
    });

    if (error) {
        alert(error.message);
    } else {
        alert("✅ Order Placed");
    }
};