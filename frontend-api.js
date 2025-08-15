// Frontend API Integration for Pricing Calculator
// This file contains the updated functions that connect to the backend API

// Configuration
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

// Utility function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        throw error;
    }
}

// Show notification to user
function showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: opacity 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Updated Quote Management Functions

async function saveCurrentQuote() {
    try {
        const quoteName = document.getElementById('quoteName').value;
        if (!quoteName.trim()) {
            showNotification('Please enter a quote name before saving.', 'warning');
            return;
        }
        
        // Validate form data
        const validation = validateFormData();
        if (!validation.isValid) {
            showNotification('Please fill in all required fields before saving.', 'error');
            highlightMissingFields();
            return;
        }
        
        // Get all form data
        const quoteData = getAllFormData();
        quoteData.quoteName = quoteName;
        
        // Check if we're updating existing quote or creating new
        const existingQuoteId = document.getElementById('currentQuoteId')?.value;
        
        let result;
        if (existingQuoteId) {
            // Update existing quote
            result = await apiCall(`/quotes/${existingQuoteId}`, {
                method: 'PUT',
                body: JSON.stringify(quoteData)
            });
        } else {
            // Create new quote
            result = await apiCall('/quotes', {
                method: 'POST',
                body: JSON.stringify(quoteData)
            });
            
            // Store the new quote ID for future updates
            let quoteIdInput = document.getElementById('currentQuoteId');
            if (!quoteIdInput) {
                quoteIdInput = document.createElement('input');
                quoteIdInput.type = 'hidden';
                quoteIdInput.id = 'currentQuoteId';
                document.body.appendChild(quoteIdInput);
            }
            quoteIdInput.value = result.quote._id;
        }
        
        showNotification(`Quote "${quoteName}" saved successfully!`, 'success');
        
        // Refresh recent quotes list
        await loadRecentQuotes();
        
    } catch (error) {
        console.error('Error saving quote:', error);
        showNotification(`Failed to save quote: ${error.message}`, 'error');
    }
}

async function showLoadQuotes() {
    try {
        // Create modal dialog for loading quotes
        const modal = document.createElement('div');
        modal.id = 'loadQuotesModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 800px;
            max-height: 600px;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #2c5f47;">Load Quote</h2>
                <button onclick="closeLoadQuotesModal()" style="background: #f44336; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">✕</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <input type="text" id="quoteSearchInput" placeholder="Search quotes..." style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
            </div>
            
            <div id="quotesListContainer" style="min-height: 200px;">
                <div style="text-align: center; padding: 20px;">Loading quotes...</div>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Load quotes
        await loadQuotesIntoModal();
        
        // Add search functionality
        document.getElementById('quoteSearchInput').addEventListener('input', debounce(async (e) => {
            await loadQuotesIntoModal(e.target.value);
        }, 300));
        
    } catch (error) {
        console.error('Error showing load quotes:', error);
        showNotification(`Failed to load quotes: ${error.message}`, 'error');
    }
}

async function loadQuotesIntoModal(searchTerm = '') {
    try {
        const container = document.getElementById('quotesListContainer');
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading quotes...</div>';
        
        // Build query parameters
        const params = new URLSearchParams({
            limit: '20',
            page: '1'
        });
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        const result = await apiCall(`/quotes?${params.toString()}`);
        
        if (result.quotes.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No quotes found.</div>';
            return;
        }
        
        // Generate quotes list HTML
        const quotesHTML = result.quotes.map(quote => `
            <div class="quote-item" style="border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: background-color 0.2s;" 
                 onclick="loadQuote('${quote._id}')" 
                 onmouseover="this.style.backgroundColor='#f5f5f5'" 
                 onmouseout="this.style.backgroundColor='white'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #2c5f47;">${quote.quoteName}</strong>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            ${quote.quoteNumber} | ${quote.customer.companyName}
                        </div>
                        <div style="font-size: 11px; color: #999; margin-top: 3px;">
                            Created: ${new Date(quote.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #4a9b8e;">
                            R ${quote.calculations?.totals?.grandTotal?.toFixed(2) || '0.00'}
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 3px;">
                            Status: ${quote.status}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = quotesHTML;
        
    } catch (error) {
        console.error('Error loading quotes into modal:', error);
        document.getElementById('quotesListContainer').innerHTML = 
            '<div style="text-align: center; padding: 20px; color: #f44336;">Failed to load quotes.</div>';
    }
}

async function loadQuote(quoteId) {
    try {
        const quote = await apiCall(`/quotes/${quoteId}`);
        
        // Populate form with quote data
        populateFormWithQuoteData(quote);
        
        // Store current quote ID
        let quoteIdInput = document.getElementById('currentQuoteId');
        if (!quoteIdInput) {
            quoteIdInput = document.createElement('input');
            quoteIdInput.type = 'hidden';
            quoteIdInput.id = 'currentQuoteId';
            document.body.appendChild(quoteIdInput);
        }
        quoteIdInput.value = quote._id;
        
        // Close modal
        closeLoadQuotesModal();
        
        showNotification(`Quote "${quote.quoteName}" loaded successfully!`, 'success');
        
        // Recalculate to update display
        calculate();
        
    } catch (error) {
        console.error('Error loading quote:', error);
        showNotification(`Failed to load quote: ${error.message}`, 'error');
    }
}

function populateFormWithQuoteData(quote) {
    // Helper function to safely set input values
    const setInputValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.value = value;
        }
    };
    
    // Quote name
    setInputValue('quoteName', quote.quoteName);
    
    // Customer information
    setInputValue('companyName', quote.customer?.companyName);
    setInputValue('contactPerson', quote.customer?.contactPerson);
    setInputValue('phoneNumber', quote.customer?.phoneNumber);
    setInputValue('emailAddress', quote.customer?.emailAddress);
    setInputValue('vatNumber', quote.customer?.vatNumber);
    setInputValue('companyReg', quote.customer?.companyRegistration);
    
    // Project details
    setInputValue('projectName', quote.project?.projectName);
    setInputValue('orderNumber', quote.project?.orderNumber);
    setInputValue('customerReference', quote.project?.customerReference);
    
    // Dates
    if (quote.project?.deliveryDate) {
        setInputValue('deliveryDate', new Date(quote.project.deliveryDate).toISOString().split('T')[0]);
    }
    if (quote.project?.quoteDate) {
        setInputValue('date', new Date(quote.project.quoteDate).toISOString().split('T')[0]);
    }
    if (quote.project?.validUntil) {
        setInputValue('validUntil', new Date(quote.project.validUntil).toISOString().split('T')[0]);
    }
    
    // Address information
    setInputValue('billingAddress', quote.address?.billingAddress);
    setInputValue('deliveryAddress', quote.address?.deliveryAddress);
    setInputValue('siteContact', quote.address?.siteContact);
    setInputValue('siteContactNumber', quote.address?.siteContactNumber);
    setInputValue('specialInstructions', quote.address?.specialInstructions);
    setInputValue('accountManager', quote.address?.accountManager);
    
    // Shadecloth
    setInputValue('shadeQty', quote.shadecloth?.quantity);
    setInputValue('shadeWidth', quote.shadecloth?.width);
    
    // Item 1
    setInputValue('item1desc', quote.item1?.description);
    setInputValue('item1size', quote.item1?.size);
    setInputValue('item1coverage', quote.item1?.coverage);
    setInputValue('item1colors', quote.item1?.colors);
    setInputValue('item1printWidth', quote.item1?.printWidth);
    setInputValue('item1printHeight', quote.item1?.printHeight);
    setInputValue('item1totalQty', quote.item1?.totalQty);
    setInputValue('item1printsPerRoll', quote.item1?.printsPerRoll);
    
    // Item 2
    setInputValue('item2desc', quote.item2?.description);
    setInputValue('item2size', quote.item2?.size);
    setInputValue('item2coverage', quote.item2?.coverage);
    setInputValue('item2colors', quote.item2?.colors);
    setInputValue('item2printWidth', quote.item2?.printWidth);
    setInputValue('item2printHeight', quote.item2?.printHeight);
    setInputValue('item2totalQty', quote.item2?.totalQty);
    setInputValue('item2printsPerRoll', quote.item2?.printsPerRoll);
    
    // Setup
    const waiveSetupCheckbox = document.getElementById('waiveSetup');
    if (waiveSetupCheckbox) {
        waiveSetupCheckbox.checked = quote.setup?.waiveSetupFee || false;
    }
    setInputValue('manualScreenCount', quote.setup?.manualScreenCount);
}

function closeLoadQuotesModal() {
    const modal = document.getElementById('loadQuotesModal');
    if (modal) {
        modal.remove();
    }
}

async function loadRecentQuotes() {
    try {
        const result = await apiCall('/quotes/recent?limit=5');
        
        // Update recent quotes dropdown
        const recentSelect = document.getElementById('recentQuotes');
        if (recentSelect) {
            recentSelect.innerHTML = '<option value="">Select a recent quote...</option>';
            
            result.forEach(quote => {
                const option = document.createElement('option');
                option.value = quote._id;
                option.textContent = `${quote.quoteName} (${quote.customer.companyName}) - R${quote.calculations?.totals?.grandTotal?.toFixed(2) || '0.00'}`;
                recentSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading recent quotes:', error);
    }
}

async function exportQuoteFile() {
    try {
        const quoteName = document.getElementById('quoteName').value;
        if (!quoteName.trim()) {
            showNotification('Please enter a quote name before exporting.', 'warning');
            return;
        }
        
        // Get current quote ID or save first
        let quoteId = document.getElementById('currentQuoteId')?.value;
        
        if (!quoteId) {
            // Save quote first
            await saveCurrentQuote();
            quoteId = document.getElementById('currentQuoteId')?.value;
        }
        
        if (!quoteId) {
            showNotification('Failed to save quote before export.', 'error');
            return;
        }
        
        // Export quote
        const response = await fetch(`${API_BASE_URL}/quotes/${quoteId}/export?format=json`);
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `quote-${quoteName.replace(/[^a-z0-9]/gi, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Quote exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting quote:', error);
        showNotification(`Failed to export quote: ${error.message}`, 'error');
    }
}

async function importQuoteFile() {
    try {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const quoteData = JSON.parse(text);
                
                // Validate it's a quote file
                if (!quoteData.quoteName || !quoteData.customer) {
                    throw new Error('Invalid quote file format');
                }
                
                // Remove ID fields to create new quote
                delete quoteData._id;
                delete quoteData.quoteNumber;
                delete quoteData.createdAt;
                delete quoteData.updatedAt;
                
                // Update quote name to indicate it's imported
                quoteData.quoteName += ' (Imported)';
                quoteData.status = 'draft';
                
                // Populate form
                populateFormWithQuoteData(quoteData);
                
                // Clear current quote ID so it creates new one when saved
                const quoteIdInput = document.getElementById('currentQuoteId');
                if (quoteIdInput) {
                    quoteIdInput.value = '';
                }
                
                showNotification('Quote imported successfully!', 'success');
                
                // Recalculate
                calculate();
                
            } catch (error) {
                console.error('Error importing quote:', error);
                showNotification(`Failed to import quote: ${error.message}`, 'error');
            }
            
            // Clean up
            document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        
    } catch (error) {
        console.error('Error importing quote:', error);
        showNotification(`Failed to import quote: ${error.message}`, 'error');
    }
}

// Updated Invoice Functions

async function generateInvoiceFromQuote() {
    try {
        const quoteId = document.getElementById('currentQuoteId')?.value;
        
        if (!quoteId) {
            showNotification('Please save the quote first before generating an invoice.', 'warning');
            return;
        }
        
        const result = await apiCall(`/invoices/from-quote/${quoteId}`, {
            method: 'POST'
        });
        
        showNotification(`Invoice ${result.invoice.invoiceNumber} created successfully!`, 'success');
        
        // Optionally open invoice in new window or redirect
        // window.open(`/invoice/${result.invoice._id}`, '_blank');
        
    } catch (error) {
        console.error('Error generating invoice:', error);
        showNotification(`Failed to generate invoice: ${error.message}`, 'error');
    }
}

// Utility Functions

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Copy quote text to clipboard
async function copyQuoteText() {
    try {
        const validation = validateFormData();
        if (!validation.isValid) {
            showNotification('Please fill in all required fields before copying.', 'error');
            return;
        }
        
        const data = getAllFormData();
        const quoteText = generateQuoteText(data);
        
        await navigator.clipboard.writeText(quoteText);
        showNotification('Quote text copied to clipboard!', 'success');
        
    } catch (error) {
        console.error('Error copying quote text:', error);
        showNotification('Failed to copy quote text.', 'error');
    }
}

function generateQuoteText(data) {
    return `PRINTED SHADENET SOLUTIONS - QUOTE
    
Quote: ${data.quoteName || 'Untitled Quote'}
Company: ${data.customer.companyName}
Contact: ${data.customer.contactPerson}
Date: ${new Date().toLocaleDateString()}

ITEMS:
${data.shadecloth.quantity > 0 ? `Shadenet: ${data.shadecloth.quantity} rolls @ R${data.shadecloth.unitPrice} = R${(data.shadecloth.quantity * data.shadecloth.unitPrice).toFixed(2)}\n` : ''}
${data.item1.description ? `${data.item1.description}: ${data.item1.totalQty} prints = R${data.calculations.item1.lineTotal.toFixed(2)}\n` : ''}
${data.item2.description ? `${data.item2.description}: ${data.item2.totalQty} prints = R${data.calculations.item2.lineTotal.toFixed(2)}\n` : ''}

TOTAL: R${data.calculations.totals.grandTotal.toFixed(2)} (incl VAT)
Deposit: R${data.calculations.totals.deposit.toFixed(2)}
Balance: R${data.calculations.totals.balance.toFixed(2)}

Terms: 50% deposit, balance on completion
Lead time: 10 working days for printing`;
}

// Initialize API integration when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load recent quotes
    loadRecentQuotes();
    
    // Add event listener for recent quotes dropdown
    const recentSelect = document.getElementById('recentQuotes');
    if (recentSelect) {
        recentSelect.addEventListener('change', function() {
            if (this.value) {
                loadQuote(this.value);
            }
        });
    }
});

// Export functions to global scope so they can be called from HTML
window.saveCurrentQuote = saveCurrentQuote;
window.showLoadQuotes = showLoadQuotes;
window.exportQuoteFile = exportQuoteFile;
window.importQuoteFile = importQuoteFile;
window.generateInvoiceFromQuote = generateInvoiceFromQuote;
window.copyQuoteText = copyQuoteText;
window.closeLoadQuotesModal = closeLoadQuotesModal;
window.loadQuote = loadQuote;