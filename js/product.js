import { supabase, isAuthenticated, uploadImage } from "./supabase.js";

// Global variables
let selectedImage = null;
let currentUserId = null;

// Initialize product upload page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    setupEventListeners();
    setupImageUpload();
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

// Setup event listeners
const setupEventListeners = () => {
    // Form submission
    const uploadButton = document.querySelector('[onclick="uploadProduct()"]');
    if (uploadButton) {
        uploadButton.addEventListener('click', handleProductUpload);
    }
    
    // Form validation
    const inputs = document.querySelectorAll('input[required], textarea[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearFieldError(input));
    });
};

// Setup image upload functionality
const setupImageUpload = () => {
    const imageInput = document.getElementById('productImage');
    const imagePreview = document.getElementById('imagePreview');
    const uploadButton = document.querySelector('[onclick*="productImage"]');
    
    if (imageInput && imagePreview) {
        imageInput.addEventListener('change', handleImageSelect);
    }
    
    if (imagePreview) {
        imagePreview.addEventListener('click', () => {
            imageInput?.click();
        });
    }
};

// Handle image selection
const handleImageSelect = (event) => {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showError('Image size should be less than 5MB');
        return;
    }
    
    selectedImage = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.innerHTML = `
                <img src="${e.target.result}" alt="Product preview" style="width: 100%; height: 100%; object-fit: cover;">
                <div class="image-overlay">
                    <button type="button" class="remove-image-btn" onclick="removeImage()">×</button>
                </div>
            `;
        }
    };
    reader.readAsDataURL(file);
};

// Remove selected image
window.removeImage = () => {
    selectedImage = null;
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.innerHTML = `
            <div class="upload-placeholder">
                <span class="upload-icon">📷</span>
                <p>Click to upload crop photo</p>
                <small>Take a clear photo of your produce</small>
            </div>
        `;
    }
    
    // Clear file input
    const imageInput = document.getElementById('productImage');
    if (imageInput) {
        imageInput.value = '';
    }
};

// Validate form field
const validateField = (field) => {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    switch (field.id) {
        case 'productName':
            if (!value) {
                errorMessage = 'Product name is required';
                isValid = false;
            } else if (value.length < 2) {
                errorMessage = 'Product name must be at least 2 characters';
                isValid = false;
            }
            break;
            
        case 'price':
            if (!value) {
                errorMessage = 'Price is required';
                isValid = false;
            } else if (parseFloat(value) <= 0) {
                errorMessage = 'Price must be greater than 0';
                isValid = false;
            }
            break;
            
        case 'quantity':
            if (!value) {
                errorMessage = 'Quantity is required';
                isValid = false;
            } else if (parseInt(value) <= 0) {
                errorMessage = 'Quantity must be greater than 0';
                isValid = false;
            }
            break;
    }
    
    if (!isValid) {
        showFieldError(field, errorMessage);
    } else {
        clearFieldError(field);
    }
    
    return isValid;
};

// Show field error
const showFieldError = (field, message) => {
    field.style.borderColor = '#ff5252';
    field.setAttribute('data-error', message);
    
    // Create or update error message element
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
        errorElement = document.createElement('small');
        errorElement.className = 'field-error';
        errorElement.style.color = '#ff5252';
        errorElement.style.fontSize = '12px';
        errorElement.style.marginTop = '5px';
        errorElement.style.display = 'block';
        field.parentNode.appendChild(errorElement);
    }
    errorElement.textContent = message;
};

// Clear field error
const clearFieldError = (field) => {
    field.style.borderColor = '#e0e0e0';
    field.removeAttribute('data-error');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
};

// Handle product upload
window.uploadProduct = async () => {
    try {
        // Show loading state
        const button = event.target;
        const originalText = button.innerHTML;
        showLoading(button);
        
        // Get form values
        const productName = document.getElementById('productName')?.value.trim();
        const price = document.getElementById('price')?.value;
        const quantity = document.getElementById('quantity')?.value;
        const description = document.getElementById('description')?.value.trim();
        
        // Validate all fields
        const productNameField = document.getElementById('productName');
        const priceField = document.getElementById('price');
        const quantityField = document.getElementById('quantity');
        
        if (!validateField(productNameField) || 
            !validateField(priceField) || 
            !validateField(quantityField)) {
            throw new Error('Please fill in all required fields correctly');
        }
        
        if (!selectedImage) {
            throw new Error('Please select a product image');
        }
        
        // Upload image to Supabase Storage
        const { data: imageUrl, error: uploadError } = await uploadImage(selectedImage, currentUserId);
        
        if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError.message}`);
        }
        
        // Create product record
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert({
                product_name: productName,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                description: description || null,
                image_url: imageUrl,
                farmer_id: currentUserId
            })
            .select()
            .single();
        
        if (productError) {
            throw new Error(`Failed to create product: ${productError.message}`);
        }
        
        showSuccess('Product uploaded successfully!');
        
        // Reset form
        resetForm();
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Product upload error:', error);
        showError(error.message);
    } finally {
        hideLoading(button, originalText);
    }
};

// Show loading state
const showLoading = (button) => {
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span> Uploading...';
    }
};

// Hide loading state
const hideLoading = (button, originalText) => {
    if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
    }
};

// Reset form
const resetForm = () => {
    // Clear form fields
    const form = document.getElementById('addProductForm');
    if (form) {
        form.reset();
    }
    
    // Clear selected image
    selectedImage = null;
    removeImage();
    
    // Clear any field errors
    const errorElements = document.querySelectorAll('.field-error');
    errorElements.forEach(element => element.remove());
    
    // Reset field borders
    const fields = document.querySelectorAll('input, textarea');
    fields.forEach(field => {
        field.style.borderColor = '#e0e0e0';
    });
};

// Show error message
const showError = (message) => {
    alert(`❌ Error: ${message}`);
};

// Show success message
const showSuccess = (message) => {
    alert(`✅ ${message}`);
};

// Add image overlay styles
const imageStyles = `
    .image-overlay {
        position: absolute;
        top: 0;
        right: 0;
        background: rgba(0,0,0,0.5);
        border-radius: 0 15px 0 15px;
    }
    
    .remove-image-btn {
        background: #ff5252;
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 5px;
        transition: all 0.3s ease;
    }
    
    .remove-image-btn:hover {
        background: #ff1744;
        transform: scale(1.1);
    }
    
    .field-error {
        color: #ff5252 !important;
        font-size: 12px !important;
        margin-top: 5px !important;
        display: block !important;
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = imageStyles;
document.head.appendChild(styleSheet);

// Export functions for use in other modules
export { uploadProduct, handleImageSelect, removeImage };