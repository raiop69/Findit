// FINDIT App with Backend API Integration
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// API Base URL
const API_BASE = '/api';

// Utility function for API calls
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    const response = await fetch(url, config);
    
    // Check if response body is empty
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (!response.ok) {
        try {
            const error = isJson ? await response.json() : { error: response.statusText };
            throw new Error(error.error || error.message || 'API Error');
        } catch (parseError) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
    }
    
    // Handle empty response
    const text = await response.text();
    if (!text) {
        throw new Error('Empty response from server');
    }
    
    try {
        return JSON.parse(text);
    } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
}

// User Authentication
async function signup(name, email, password, phone = '') {
    try {
        const data = await apiRequest('/users/signup', {
            method: 'POST',
            body: JSON.stringify({ username: name, email, password, phone, full_name: name })
        });
        currentUser = { id: data.userId, name, email };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return data;
    } catch (error) {
        throw error;
    }
}

async function login(email, password) {
    try {
        const data = await apiRequest('/users/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        const user = { id: data.userId, email };
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return data;
    } catch (error) {
        throw error;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

function isLoggedIn() {
    return currentUser !== null;
}

function isAdmin() {
    // For now, assume no admin check; add later if needed
    return false;
}

// Items Management
async function reportLostItem(itemData) {
    if (!currentUser) throw new Error('Not logged in');
    const data = {
        user_id: currentUser.id,
        item_name: itemData.name,
        description: itemData.description,
        location: itemData.location,
        date_lost: itemData.date,
        contact_info: itemData.contact,
        image_url: itemData.image
    };
    return apiRequest('/lost-items', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function reportFoundItem(itemData) {
    if (!currentUser) throw new Error('Not logged in');
    const data = {
        user_id: currentUser.id,
        item_name: itemData.name,
        description: itemData.description,
        location: itemData.location,
        date_found: itemData.date,
        contact_info: itemData.contact,
        image_url: itemData.image
    };
    return apiRequest('/found-items', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function getLostItems() {
    return apiRequest('/lost-items');
}

async function getFoundItems() {
    return apiRequest('/found-items');
}

async function getUserLostItems() {
    if (!currentUser) return [];
    return apiRequest(`/users/${currentUser.id}/lost-items`);
}

async function getUserFoundItems() {
    if (!currentUser) return [];
    return apiRequest(`/users/${currentUser.id}/found-items`);
}

async function submitClaim(foundItemId, description, proof = '') {
    if (!currentUser) throw new Error('Not logged in');
    const data = {
        found_item_id: foundItemId,
        claimant_user_id: currentUser.id,
        claim_description: description,
        proof_details: proof
    };
    return apiRequest('/claims', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function getClaims() {
    return apiRequest('/claims');
}

async function updateClaimStatus(claimId, status) {
    return apiRequest(`/claims/${claimId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    });
}

// Page initialization
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
    
    // Protect dashboard and beyond
    if (['dashboard.html', 'report-lost.html', 'report-found.html', 'found-items.html', 
         'my-lost-items.html', 'claim.html', 'admin.html'].includes(currentPage)) {
        if (!isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        if (currentPage === 'admin.html' && !isAdmin()) {
            window.location.href = 'dashboard.html';
            return;
        }
    }
    
    // Initialize current page
    switch(currentPage) {
        case 'login.html': initLogin(); break;
        case 'signup.html': initSignup(); break;
        case 'dashboard.html': initDashboard(); break;
        case 'report-lost.html': initReportLost(); break;
        case 'report-found.html': initReportFound(); break;
        case 'found-items.html': initFoundItems(); break;
        case 'my-lost-items.html': initMyLostItems(); break;
        case 'claim.html': initClaimPage(); break;
        case 'admin.html': initAdmin(); break;
    }
    
    initImagePreview();
});

// 👑 ADMIN-PROTECTED DASHBOARD
function initDashboard() {
    // Set user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('dashboardUserName').textContent = currentUser.name;
    
    // 👑 SHOW/HIDE ADMIN PORTAL BASED ON ROLE
    const adminCard = document.getElementById('adminPortalCard');
    if (adminCard) {
        if (isAdmin()) {
            // 👑 SHOW for admin
            adminCard.style.display = 'block';
        } else {
            // HIDE for regular users
            adminCard.style.display = 'none';
        }
    }
    
    // Logout
    document.querySelectorAll('.logout-btn, .btn-outline').forEach(btn => {
        if (btn.textContent && btn.textContent.includes('Logout')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                logout();
                showNotification('Logged out successfully!', 'success');
                setTimeout(() => window.location.href = 'login.html', 1000);
            });
        }
    });
}

// Authentication
async function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await login(email, password);
            showNotification(`Welcome back!`, 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

async function initSignup() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        
        try {
            await signup(name, email, password);
            showNotification('Account created successfully!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

// Report Forms
async function initReportLost() {
    const form = document.getElementById('lostItemForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('lostItemName').value;
        const description = document.getElementById('lostDescription').value;
        const location = document.getElementById('lostLocation').value;
        const date = document.getElementById('lostDate').value;
        const contact = document.getElementById('lostContact').value;
        const imageFile = document.getElementById('lostImage').files[0];
        
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.readAsDataURL(imageFile);
            });
        }
        
        try {
            await reportLostItem({ name, description, location, date, contact, image: imageUrl });
            showNotification('Lost item reported!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1500);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

function initReportFound() {
    const form = document.getElementById('foundItemForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('foundItemName').value;
        const description = document.getElementById('foundDescription').value;
        const imageFile = document.getElementById('foundImage').files[0];
        
        if (imageFile) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result; // Base64 data URL
                db.addFoundItem(name, description, imageUrl);
                showNotification('Found item reported!', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            };
            reader.readAsDataURL(imageFile);
        } else {
            db.addFoundItem(name, description, null);
            showNotification('Found item reported!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1500);
        }
    });
}

// Items Display
function initFoundItems() {
    displayFoundItems();
}

function initMyLostItems() {
    displayLostItems();
}

function displayFoundItems() {
    const grid = document.getElementById('foundItemsGrid');
    if (!grid) return;
    
    const items = db.getFoundItems();
    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                <i class="fas fa-search" style="font-size: 4rem; color: #00d4ff; margin-bottom: 20px;"></i>
                <h3>No found items</h3>
                <a href="report-found.html" class="btn btn-primary">Report Found Item</a>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const isOwner = item.userId === db.currentUser.id;
        const card = document.createElement('div');
        card.className = 'item-card glass';
        card.innerHTML = `
            <div class="item-image">${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<i class="fas fa-box"></i>'}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-description">${item.description || 'No description'}</div>
            ${isOwner ? 
                `<button class="btn btn-outline revoke-btn" data-item-id="${item.id}">
                    <i class="fas fa-times"></i> Revoke Item
                </button>` :
                `<button class="btn btn-primary claim-btn" data-item-id="${item.id}">
                    <i class="fas fa-hand-holding"></i> Claim Item
                </button>`
            }
        `;
        if (isOwner) {
            card.querySelector('.revoke-btn').onclick = () => revokeFoundItem(item.id);
        } else {
            card.querySelector('.claim-btn').onclick = () => claimItem(item.id);
        }
        grid.appendChild(card);
    });
}

function displayLostItems() {
    const grid = document.getElementById('lostItemsGrid');
    if (!grid) return;
    
    const items = db.getUserLostItems();
    grid.innerHTML = items.map(item => `
        <div class="item-card glass">
            <div class="item-image">${item.image ? `<img src="${item.image}">` : '<i class="fas fa-exclamation-triangle"></i>'}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-description">${item.description}</div>
            <div style="padding: 10px; background: rgba(0,212,255,0.1); border-radius: 12px; color: #00d4ff;">
                ${item.status.toUpperCase()}
            </div>
            <button class="btn btn-outline revoke-btn" data-item-id="${item.id}">
                <i class="fas fa-times"></i> Revoke Item
            </button>
        </div>
    `).join('') || '<div style="grid-column:1/-1;text-align:center;padding:60px;"><i class="fas fa-inbox" style="font-size:4rem;color:#00d4ff"></i><h3>No lost items</h3></div>';
    
    // Add event listeners for revoke buttons
    document.querySelectorAll('.revoke-btn').forEach(btn => {
        btn.onclick = () => revokeLostItem(parseInt(btn.dataset.itemId));
    });
}

// Claim System
function claimItem(itemId) {
    localStorage.setItem('claimItemId', itemId);
    window.location.href = 'claim.html';
}

function initClaimPage() {
    const itemId = parseInt(localStorage.getItem('claimItemId'));
    localStorage.removeItem('claimItemId');
    
    if (!itemId || !db.currentUser) {
        window.location.href = 'found-items.html';
        return;
    }
    
    const item = db.foundItems.find(i => i.id === itemId);
    if (!item) {
        window.location.href = 'found-items.html';
        return;
    }
    
    // Populate form
    document.getElementById('claimItemImage').src = item.image || '';
    document.getElementById('claimItemName').textContent = item.name;
    document.getElementById('claimItemDescription').textContent = item.description || 'No description';
    document.getElementById('claimItemDate').textContent = new Date(item.date).toLocaleDateString();
    document.getElementById('claimerName').value = db.currentUser.name;
    
    // Form submit
    document.getElementById('claimForm').onsubmit = function(e) {
        e.preventDefault();
        const contactNumber = document.getElementById('contactNumber').value;
        const socialMedia = document.getElementById('socialMedia').value;
        
        if (!contactNumber || !socialMedia) {
            showNotification('Fill all required fields!', 'error');
            return;
        }
        
        const contactInfo = JSON.stringify({
            phone: contactNumber,
            social: socialMedia,
            proof: document.getElementById('proofDescription').value || null
        });
        
        db.addClaim(item.id, contactInfo);
        
        // Show success
        document.querySelector('.claim-form-card').style.display = 'none';
        document.getElementById('claimStatusCard').style.display = 'block';
        showNotification('Claim submitted!', 'success');
    };
}

// Admin Panel
function initAdmin() {
    updateAdminStats();
    displayClaims();
}

function updateAdminStats() {
    document.getElementById('totalClaims').textContent = db.claims.length;
    document.getElementById('pendingClaims').textContent = db.getPendingClaims().length;
    document.getElementById('verifiedClaims').textContent = db.claims.filter(c => c.status === 'verified').length;
}

function displayClaims() {
    const grid = document.getElementById('claimsGrid');
    if (!grid) return;
    
    const claims = db.getPendingClaims();
    grid.innerHTML = claims.map((claim, index) => {
        const item = db.foundItems.find(i => i.id === claim.foundItemId);
        const poster = db.users.find(u => u.id === item?.userId);
        const info = JSON.parse(claim.contactInfo || '{}');
        const imageUrl = item?.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23333" width="300" height="200"/%3E%3Ctext x="150" y="100" text-anchor="middle" dy=".3em" fill="%2300d4ff" font-size="16"%3ENo Image Available%3C/text%3E%3C/svg%3E';
        const claimDate = new Date(claim.date).toLocaleDateString();
        const itemDate = new Date(item?.date).toLocaleDateString();
        return `
            <div class="claim-item-container">
                <div class="claim-row">
                    <div class="claim-row-number">${index + 1}</div>
                    
                    <div class="claim-row-item">
                        <div class="row-item-title">${item?.name || 'Deleted Item'}</div>
                        <div class="row-item-desc">${item?.description || 'No description'}</div>
                    </div>
                    
                    <div class="claim-row-separator"></div>
                    
                    <div class="claim-row-info">
                        <div class="info-line">
                            <span class="info-label">Posted by</span>
                            <span class="info-value">${poster?.name || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    <div class="claim-row-separator"></div>
                    
                    <div class="claim-row-claimer">
                        <div class="info-line">
                            <span class="info-label">Claimed by</span>
                            <span class="info-value">${claim.claimerName}</span>
                        </div>
                        <div class="claimer-details">
                            <span class="detail-item"><i class="fas fa-phone"></i> ${info.phone || 'N/A'}</span>
                            <span class="detail-item"><i class="fas fa-link"></i> ${info.social || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="claim-row-actions">
                        <button class="row-btn row-btn-expand" onclick="toggleClaimExpand(${claim.id})" title="View Details">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <button class="row-btn row-btn-verify" onclick="verifyClaim(${claim.id})" title="Verify Claim">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="row-btn row-btn-reject" onclick="rejectClaim(${claim.id})" title="Reject Claim">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="claim-expanded" id="claim-expanded-${claim.id}">
                    <div class="expanded-content">
                        <div class="expanded-header">
                            <h3>Full Claim Details</h3>
                        </div>
                        
                        <div class="expanded-grid">
                            <div class="expanded-section">
                                <h4>Item Details</h4>
                                <div class="expanded-image">
                                    <img src="${imageUrl}" alt="${item?.name || 'Item'}">
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Item Name:</span>
                                    <span class="detail-text">${item?.name || 'N/A'}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Description:</span>
                                    <span class="detail-text">${item?.description || 'N/A'}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Posted Date:</span>
                                    <span class="detail-text">${itemDate}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Posted By:</span>
                                    <span class="detail-text">${poster?.name || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div class="expanded-divider"></div>
                            
                            <div class="expanded-section">
                                <h4>Claim Information</h4>
                                <div class="detail-group">
                                    <span class="detail-label">Claimed By:</span>
                                    <span class="detail-text">${claim.claimerName}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Phone:</span>
                                    <span class="detail-text">${info.phone || 'N/A'}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Social Media:</span>
                                    <span class="detail-text">${info.social || 'N/A'}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Claim Date:</span>
                                    <span class="detail-text">${claimDate}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Status:</span>
                                    <span class="detail-text status-badge status-pending">Pending</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="expanded-actions">
                            <button class="expanded-btn expanded-btn-verify" onclick="verifyClaim(${claim.id})">
                                <i class="fas fa-check-circle"></i> Verify Claim
                            </button>
                            <button class="expanded-btn expanded-btn-reject" onclick="rejectClaim(${claim.id})">
                                <i class="fas fa-times-circle"></i> Reject Claim
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || '<div style="padding:80px 40px;text-align:center;"><i class="fas fa-inbox" style="font-size:5rem;color:#00d4ff;margin-bottom:20px;opacity:0.6"></i><h3 style="font-size:1.5rem;margin-bottom:10px;">No Pending Claims</h3><p style="opacity:0.7;">All claims have been reviewed</p></div>';
}

function toggleClaimExpand(claimId) {
    const expandedElement = document.getElementById(`claim-expanded-${claimId}`);
    if (expandedElement) {
        expandedElement.classList.toggle('show');
        const container = expandedElement.closest('.claim-item-container');
        if (container) {
            const expandBtn = container.querySelector('.row-btn-expand i');
            if (expandBtn) {
                expandBtn.classList.toggle('rotated');
            }
        }
    }
}

// Revoke Functions
// Revoke Modal Variables
let currentRevokeType = null; // 'found' or 'lost'
let currentRevokeId = null;

// Modal Functions
function showRevokeModal(type, itemId) {
    currentRevokeType = type;
    currentRevokeId = itemId;
    
    const modal = document.getElementById('revokeModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Add click handler for overlay
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeRevokeModal();
            }
        };
        
        // Add keyboard handler for ESC key
        document.addEventListener('keydown', handleModalKeydown);
    }
}

function closeRevokeModal() {
    const modal = document.getElementById('revokeModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
        currentRevokeType = null;
        currentRevokeId = null;
        modal.onclick = null; // Remove click handler
        document.removeEventListener('keydown', handleModalKeydown); // Remove keyboard handler
    }
}

function handleModalKeydown(e) {
    if (e.key === 'Escape') {
        closeRevokeModal();
    }
}

function confirmRevoke() {
    if (!currentRevokeType || !currentRevokeId) return;
    
    let success = false;
    if (currentRevokeType === 'found') {
        success = db.removeFoundItem(currentRevokeId);
        if (success) {
            showNotification('Found item revoked!', 'info');
            displayFoundItems(); // Refresh the grid
        }
    } else if (currentRevokeType === 'lost') {
        success = db.removeLostItem(currentRevokeId);
        if (success) {
            showNotification('Lost item revoked!', 'info');
            displayLostItems(); // Refresh the grid
        }
    }
    
    if (!success) {
        showNotification('Failed to revoke item!', 'error');
    }
    
    closeRevokeModal();
}

function revokeFoundItem(itemId) {
    showRevokeModal('found', itemId);
}

function revokeLostItem(itemId) {
    showRevokeModal('lost', itemId);
}

// Global Functions
window.verifyClaim = claimId => {
    if (db.verifyClaim(claimId)) {
        showNotification('Claim verified!', 'success');
        setTimeout(initAdmin, 500);
    }
};

window.rejectClaim = claimId => {
    if (db.rejectClaim(claimId)) {
        showNotification('Claim rejected!', 'info');
        setTimeout(initAdmin, 500);
    }
};

window.claimItem = claimItem;
window.revokeFoundItem = revokeFoundItem;
window.revokeLostItem = revokeLostItem;
window.closeRevokeModal = closeRevokeModal;
window.confirmRevoke = confirmRevoke;
window.handleModalKeydown = handleModalKeydown;
window.toggleClaimExpand = toggleClaimExpand;

function checkAdminAccess() {
    if (!db.currentUser || !db.isAdmin()) {
        window.location.href = 'dashboard.html';
    }
}

// Utilities
function initImagePreview() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', function() {
            const previewId = this.id.replace(/Image$/, 'ImagePreview');
            const preview = document.getElementById(previewId);
            if (this.files[0] && preview) {
                const reader = new FileReader();
                reader.onload = e => {
                    preview.innerHTML = `<img src="${e.target.result}">`;
                    preview.style.display = 'flex';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    });
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;top:20px;right:20px;padding:16px 24px;border-radius:12px;
        color:white;font-weight:500;z-index:10000;transform:translateX(400px);transition:all .3s;
        background:${type=='success'?'#28a745':type=='error'?'#dc3545':'#17a2b8'};
        box-shadow:0 10px 30px rgba(0,0,0,.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(()=>toast.style.transform='translateX(0)',100);
    setTimeout(()=>{
        toast.style.transform='translateX(400px)';
        setTimeout(()=>toast.remove(),300);
    },4000);
}

// 👑 SAMPLE DATA
if (db.users.length === 0) {
    db.createUser('Demo User', 'demo@example.com', 'demo123', 'user');
    db.createUser('Admin', 'admin@example.com', 'admin123', 'admin');
    
    // Sample found items
    db.addFoundItem('Black Wallet', 'Found at park', null);
    db.addFoundItem('Keys', 'Car keys on bench', null);
} else if (!db.users.some(u => u.role === 'admin')) {
    db.createUser('Admin', 'admin@example.com', 'admin123', 'admin');
}