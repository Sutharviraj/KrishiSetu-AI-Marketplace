import { supabase, isAuthenticated } from "./supabase.js";

// Global variables
let allProducts = [];
let filteredProducts = [];
let currentUserId = null;

// Initialize marketplace page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    await loadProducts();
    setupEventListeners();
    setupSearchAndFilter();
});

// Check if user is authenticated
const checkAuthentication = async () => {
    const { user, error } = await isAuthenticated();
    
    if (user) {
        currentUserId = user.id;
    }
    
    return true; // Allow browsing without login
};

// Load all products
const loadProducts = async () => {
    try {
        const productsGrid = document.getElementById('productsGrid');
        const loadingElement = productsGrid.querySelector('.loading');
        
        // Show loading state
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                *,
                profiles:farmer_id (
                    name,
                    location
                )
            `)
            .eq('quantity', 'gt', 0)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allProducts = products || [];
        filteredProducts = [...allProducts];
        
        // Hide loading state
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // Render products
        renderProducts(filteredProducts);
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products');
    }
};

// Render products to grid
const renderProducts = (products) => {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌾</div>
                <h3>No products found</h3>
                <p>Try adjusting your filters or check back later</p>
            </div>
        `;
        return;
    }
    
    const productsHTML = products.map(product => createProductCard(product)).join('');
    productsGrid.innerHTML = productsHTML;
    
    // Add click handlers to buy buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const productId = btn.dataset.productId;
            openOrderModal(productId);
        });
    });
};

// Create product card HTML
const createProductCard = (product) => {
    const imageUrl = product.image_url || 'https://via.placeholder.com/200x150?text=No+Image';
    const farmerName = product.profiles?.name || 'Unknown Farmer';
    const location = product.profiles?.location || 'Unknown Location';
    
    return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image-container">
                <img src="${imageUrl}" alt="${product.product_name}" loading="lazy">
                ${product.quantity <= 5 ? '<div class="low-stock-badge">Low Stock</div>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.product_name}</h3>
                <p class="product-farmer">👨‍🌾 ${farmerName}</p>
                <p class="product-location">📍 ${location}</p>
                <div class="product-price-quantity">
                    <span class="product-price">₹${product.price}</span>
                    <span class="product-quantity">${product.quantity}kg available</span>
                </div>
                ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
                <button class="buy-btn" data-product-id="${product.id}">
                    🛒 Buy Now
                </button>
            </div>
        </div>
    `;
};

// Setup event listeners
const setupEventListeners = () => {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            applyFilter(filter);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
};

// Setup search and filter functionality
const setupSearchAndFilter = () => {
    // Add search styles
    const searchStyles = `
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .empty-icon {
            font-size: 60px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
        
        .product-image-container {
            position: relative;
            overflow: hidden;
        }
        
        .low-stock-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ff5252;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            z-index: 1;
        }
        
        .product-farmer {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
        }
        
        .product-location {
            font-size: 11px;
            color: #999;
            margin-bottom: 8px;
        }
        
        .product-price-quantity {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .product-quantity {
            font-size: 12px;
            color: #666;
        }
        
        .product-description {
            font-size: 12px;
            color: #666;
            line-height: 1.4;
            margin-bottom: 12px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = searchStyles;
    document.head.appendChild(styleSheet);
};

// Apply filter
const applyFilter = (filter) => {
    if (filter === 'all') {
        filteredProducts = [...allProducts];
    } else {
        filteredProducts = allProducts.filter(product => {
            const productName = product.product_name.toLowerCase();
            
            switch (filter) {
                case 'vegetables':
                    return productName.includes('vegetable') || 
                           productName.includes('tomato') || 
                           productName.includes('potato') ||
                           productName.includes('onion') ||
                           productName.includes('carrot') ||
                           productName.includes('cabbage') ||
                           productName.includes('spinach');
                           
                case 'fruits':
                    return productName.includes('fruit') || 
                           productName.includes('apple') || 
                           productName.includes('mango') ||
                           productName.includes('banana') ||
                           productName.includes('orange') ||
                           productName.includes('grape');
                           
                case 'grains':
                    return productName.includes('grain') || 
                           productName.includes('wheat') || 
                           productName.includes('rice') ||
                           productName.includes('corn') ||
                           productName.includes('barley');
                           
                default:
                    return true;
            }
        });
    }
    
    renderProducts(filteredProducts);
};

// Handle search
const handleSearch = (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredProducts = [...allProducts];
    } else {
        filteredProducts = allProducts.filter(product => {
            const productName = product.product_name.toLowerCase();
            const farmerName = product.profiles?.name?.toLowerCase() || '';
            const location = product.profiles?.location?.toLowerCase() || '';
            const description = product.description?.toLowerCase() || '';
            
            return productName.includes(searchTerm) ||
                   farmerName.includes(searchTerm) ||
                   location.includes(searchTerm) ||
                   description.includes(searchTerm);
        });
    }
    
    renderProducts(filteredProducts);
};

// Debounce function for search
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Open order modal
const openOrderModal = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    // Populate modal with product details
    const modal = document.getElementById('orderModal');
    const modalImage = document.getElementById('modalProductImage');
    const modalName = document.getElementById('modalProductName');
    const modalPrice = document.getElementById('modalProductPrice');
    
    if (modalImage) modalImage.src = product.image_url || 'https://via.placeholder.com/60x60?text=No+Image';
    if (modalName) modalName.textContent = product.product_name;
    if (modalPrice) modalPrice.textContent = `₹${product.price} per kg`;
    
    // Store product ID for order submission
    modal.dataset.productId = productId;
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Reset form
    document.getElementById('orderForm').reset();
};

// Close order modal
window.closeOrderModal = () => {
    const modal = document.getElementById('orderModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
};

// Place order
window.placeOrder = async () => {
    try {
        if (!currentUserId) {
            showError('Please login to place an order');
            return;
        }
        
        const modal = document.getElementById('orderModal');
        const productId = modal.dataset.productId;
        
        const quantity = document.getElementById('orderQuantity').value;
        const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
        const paymentType = document.getElementById('paymentType').value;
        
        // Validation
        if (!quantity || quantity <= 0) {
            showError('Please enter a valid quantity');
            return;
        }
        
        if (!deliveryAddress) {
            showError('Please enter delivery address');
            return;
        }
        
        // Show loading state
        const button = event.target;
        const originalText = button.innerHTML;
        showLoading(button);
        
        // Call RPC function to place order
        const { data, error } = await supabase.rpc('place_order', {
            p_product_id: productId,
            p_quantity: parseInt(quantity),
            p_delivery_address: deliveryAddress,
            p_payment_type: paymentType
        });
        
        if (error) throw error;
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to place order');
        }
        
        showSuccess(`Order placed successfully! Total: ₹${data.total_price}`);
        
        // Close modal
        closeOrderModal();
        
        // Reload products to update quantities
        await loadProducts();
        
    } catch (error) {
        console.error('Order placement error:', error);
        showError(error.message);
    } finally {
        hideLoading(button, originalText);
    }
};

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
    alert(`❌ Error: ${message}`);
};

// Show success message
const showSuccess = (message) => {
    alert(`✅ ${message}`);
};

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('orderModal');
    if (event.target === modal) {
        closeOrderModal();
    }
});

// Close modal with Escape key
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeOrderModal();
    }
});

// Export functions for use in other modules
export { loadProducts, renderProducts, openOrderModal };
