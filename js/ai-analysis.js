import { supabase, isAuthenticated } from "./supabase.js";

// Global variables
let currentUserId = null;
let selectedImage = null;

// Initialize AI analysis page
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
    // Image upload button
    const analyzeButton = document.querySelector('[onclick="analyzeImage()"]');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', handleImageAnalysis);
    }
    
    // Form validation
    const inputs = document.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearFieldError(input));
    });
};

// Setup image upload functionality
const setupImageUpload = () => {
    const imageInput = document.getElementById('analysisImage');
    const imagePreview = document.getElementById('imagePreview');
    
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
    
    // Validate file size (max 10MB for AI analysis)
    if (file.size > 10 * 1024 * 1024) {
        showError('Image size should be less than 10MB');
        return;
    }
    
    selectedImage = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.innerHTML = `
                <img src="${e.target.result}" alt="Crop analysis preview" style="width: 100%; height: 100%; object-fit: cover;">
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
                <p>Click to upload crop photo for AI analysis</p>
                <small>AI will analyze quality and suggest price</small>
            </div>
        `;
    }
    
    // Clear file input
    const imageInput = document.getElementById('analysisImage');
    if (imageInput) {
        imageInput.value = '';
    }
};

// Handle AI image analysis
window.analyzeImage = async () => {
    try {
        if (!selectedImage) {
            throw new Error('Please select an image for analysis');
        }
        
        // Show loading state
        const button = event.target;
        const originalText = button.innerHTML;
        showLoading(button);
        
        // Get analysis type
        const analysisType = document.getElementById('analysisType')?.value || 'quality';
        
        // Upload image to Supabase Storage for AI processing
        const { data: imageUrl, error: uploadError } = await uploadImageForAnalysis(selectedImage, currentUserId);
        
        if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError.message}`);
        }
        
        // Send to N8N AI analysis workflow
        const analysisResult = await sendToN8NAnalysis({
            imageUrl: imageUrl,
            userId: currentUserId,
            analysisType: analysisType,
            timestamp: new Date().toISOString()
        });
        
        if (!analysisResult.success) {
            throw new Error(analysisResult.error || 'AI analysis failed');
        }
        
        // Store analysis results in database
        const { data: savedAnalysis, error: saveError } = await saveAnalysisResults({
            user_id: currentUserId,
            image_path: imageUrl,
            analysis_type: analysisType,
            analysis_result: analysisResult.data,
            confidence_score: analysisResult.confidence,
            processing_time: analysisResult.processingTime,
            n8n_workflow_id: analysisResult.workflowId
        });
        
        if (saveError) {
            console.error('Error saving analysis:', saveError);
        }
        
        // Display results
        displayAnalysisResults(analysisResult.data, analysisResult.confidence);
        
        // If quality analysis with price prediction, update product form
        if (analysisType === 'quality' && analysisResult.data.predicted_price) {
            updateProductFormWithAnalysis(analysisResult.data);
        }
        
        showSuccess('AI analysis completed successfully!');
        
    } catch (error) {
        console.error('AI analysis error:', error);
        showError(error.message);
    } finally {
        hideLoading(button, originalText);
    }
};

// Upload image for AI analysis
const uploadImageForAnalysis = async (file, userId) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `ai-uploads/${userId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
        .from('ai-uploads')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) {
        return { data: null, error };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('ai-uploads')
        .getPublicUrl(fileName);
    
    return { data: publicUrl, error: null };
};

// Send image to N8N AI analysis workflow
const sendToN8NAnalysis = async (payload) => {
    try {
        const response = await fetch('https://your-n8n-instance.com/webhook/ai-crop-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_N8N_WEBHOOK_KEY'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`N8N workflow error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('N8N API error:', error);
        return {
            success: false,
            error: 'Failed to connect to AI analysis service'
        };
    }
};

// Save analysis results to database
const saveAnalysisResults = async (analysisData) => {
    const { data, error } = await supabase
        .from('ai_analyses')
        .insert(analysisData)
        .select()
        .single();
    
    return { data, error };
};

// Display analysis results
const displayAnalysisResults = (results, confidence) => {
    const resultsContainer = document.getElementById('analysisResults');
    
    if (!resultsContainer) return;
    
    let resultsHTML = `
        <div class="analysis-results">
            <h3>🤖 AI Analysis Results</h3>
            <div class="confidence-score">
                <strong>Confidence:</strong> ${confidence}%
            </div>
    `;
    
    if (results.quality_score) {
        resultsHTML += `
            <div class="quality-score">
                <strong>Quality Score:</strong> ${results.quality_score}/100
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${results.quality_score}%"></div>
                </div>
            </div>
        `;
    }
    
    if (results.predicted_price) {
        resultsHTML += `
            <div class="price-prediction">
                <strong>Predicted Fair Price:</strong> ₹${results.predicted_price}/kg
            </div>
        `;
    }
    
    if (results.freshness) {
        resultsHTML += `
            <div class="freshness">
                <strong>Freshness:</strong> ${results.freshness}
            </div>
        `;
    }
    
    if (results.defects && results.defects.length > 0) {
        resultsHTML += `
            <div class="defects">
                <strong>Detected Issues:</strong>
                <ul>
                    ${results.defects.map(defect => `<li>${defect}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (results.recommendations && results.recommendations.length > 0) {
        resultsHTML += `
            <div class="recommendations">
                <strong>Recommendations:</strong>
                <ul>
                    ${results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    resultsHTML += `</div>`;
    
    resultsContainer.innerHTML = resultsHTML;
    
    // Add animation
    resultsContainer.classList.add('fade-in');
    setTimeout(() => {
        resultsContainer.classList.remove('fade-in');
    }, 500);
};

// Update product form with AI analysis data
const updateProductFormWithAnalysis = (analysisData) => {
    // If on add-product page, update form fields
    const priceInput = document.getElementById('price');
    const descriptionInput = document.getElementById('description');
    
    if (priceInput && analysisData.predicted_price) {
        priceInput.value = analysisData.predicted_price;
        priceInput.style.borderColor = '#4caf50';
    }
    
    if (descriptionInput && analysisData.quality_description) {
        descriptionInput.value = analysisData.quality_description;
        descriptionInput.style.borderColor = '#4caf50';
    }
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'ai-notification';
    notification.innerHTML = `
        <strong>AI Analysis Applied!</strong><br>
        Price and description have been updated based on AI analysis.
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
};

// Validate form field
const validateField = (field) => {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    if (!value) {
        errorMessage = 'This field is required';
        isValid = false;
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

// Show loading state
const showLoading = (button) => {
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span> Analyzing...';
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

// Add analysis styles
const analysisStyles = `
    .analysis-results {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 12px;
        margin-top: 20px;
        border: 2px solid #4caf50;
    }
    
    .confidence-score {
        background: #e3f2fd;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
    }
    
    .quality-score {
        margin-bottom: 15px;
    }
    
    .progress-bar {
        width: 100%;
        height: 20px;
        background: #e0e0e0;
        border-radius: 10px;
        overflow: hidden;
        margin-top: 5px;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4caf50, #8bc34a);
        transition: width 0.5s ease;
    }
    
    .price-prediction {
        background: #e8f5e8;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-size: 18px;
        font-weight: bold;
        color: #2e7d32;
    }
    
    .defects, .recommendations {
        margin-bottom: 15px;
    }
    
    .defects ul {
        color: #f44336;
    }
    
    .recommendations ul {
        color: #4caf50;
    }
    
    .fade-in {
        animation: fadeIn 0.5s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = analysisStyles;
document.head.appendChild(styleSheet);

// Export functions for use in other modules
export { analyzeImage, handleImageSelect, removeImage };
