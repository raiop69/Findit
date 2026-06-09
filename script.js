// FINDIT App with Backend API Integration
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

const db = {
    users: [],
    foundItems: [],
    lostItems: [],
    claims: [],
    nextUserId: 1,
    nextFoundId: 1,
    nextLostId: 1,
    nextClaimId: 1,
    get currentUser() {
        return currentUser;
    },
    save() {
        localStorage.setItem('finditLocalDB', JSON.stringify({
            users: this.users,
            foundItems: this.foundItems,
            lostItems: this.lostItems,
            claims: this.claims,
            nextUserId: this.nextUserId,
            nextFoundId: this.nextFoundId,
            nextLostId: this.nextLostId,
            nextClaimId: this.nextClaimId
        }));
    },
    load() {
        try {
            const stored = localStorage.getItem('finditLocalDB');
            if (!stored) return;
            const state = JSON.parse(stored);
            this.users = state.users || [];
            this.foundItems = state.foundItems || [];
            this.lostItems = state.lostItems || [];
            this.claims = state.claims || [];
            this.nextUserId = state.nextUserId || this.nextUserId;
            this.nextFoundId = state.nextFoundId || this.nextFoundId;
            this.nextLostId = state.nextLostId || this.nextLostId;
            this.nextClaimId = state.nextClaimId || this.nextClaimId;
        } catch (e) {
            console.warn('Failed to load local DB state:', e);
        }
    },
    createUser(name, email, password, role = 'user') {
        const user = {
            id: this.nextUserId++,
            name,
            email,
            password,
            role
        };
        this.users.push(user);
        this.save();
        return user;
    },
    getFoundItems() {
        return this.foundItems;
    },
    getUserLostItems() {
        return this.lostItems.filter(item => item.userId === this.currentUser?.id);
    },
    addFoundItem(name, description, image) {
        const item = {
            id: this.nextFoundId++,
            userId: this.currentUser?.id || null,
            name,
            description,
            location: null,
            date: new Date().toISOString(),
            contactInfo: null,
            image,
            status: 'found'
        };
        this.foundItems.push(item);
        this.save();
        return item;
    },
    addLostItem(name, description, location, date, contactInfo, image) {
        const item = {
            id: this.nextLostId++,
            userId: this.currentUser?.id || null,
            name,
            description,
            location,
            date,
            contactInfo,
            image,
            status: 'lost'
        };
        this.lostItems.push(item);
        this.save();
        return item;
    },
    addClaim(foundItemId, contactInfo) {
        const claim = {
            id: this.nextClaimId++,
            foundItemId,
            claimantUserId: this.currentUser?.id || null,
            claimerName: this.currentUser?.name || 'Unknown',
            contactInfo,
            status: 'pending',
            date: new Date().toISOString()
        };
        this.claims.push(claim);
        this.save();
        return claim;
    },
    getPendingClaims() {
        return this.claims.filter(claim => claim.status === 'pending');
    },
    verifyClaim(claimId) {
        const claim = this.claims.find(c => c.id === claimId);
        if (!claim) return false;
        claim.status = 'verified';
        this.save();
        return true;
    },
    rejectClaim(claimId) {
        const claim = this.claims.find(c => c.id === claimId);
        if (!claim) return false;
        claim.status = 'rejected';
        this.save();
        return true;
    },
    removeFoundItem(itemId) {
        const index = this.foundItems.findIndex(item => item.id === itemId);
        if (index === -1) return false;
        this.foundItems.splice(index, 1);
        this.save();
        return true;
    },
    removeLostItem(itemId) {
        const index = this.lostItems.findIndex(item => item.id === itemId);
        if (index === -1) return false;
        this.lostItems.splice(index, 1);
        this.save();
        return true;
    }
};

db.load();

// API Base URL
const API_BASE = '/api';

// Utility function for API calls
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(currentUser?.id ? { 'X-User-Id': currentUser.id } : {}),
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
        currentUser = { id: data.userId, name, email, role: 'user' };
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
        const user = {
            id: data.userId,
            email,
            name: data.name || email,
            role: data.role || 'user'
        };
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
    window.location.href = '/index.html';
}

function isLoggedIn() {
    return currentUser !== null;
}

function isAdmin() {
    return currentUser?.role === 'admin';
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
    
    // Try API first
    try {
        return await apiRequest('/claims', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    } catch (err) {
        // Fallback: save to local database
        const claim = db.addClaim(foundItemId, data.claim_description);
        console.log('Claim saved to local database (API unavailable):', claim);
        return claim;
    }
}

async function getClaims() {
    try {
        return await apiRequest('/claims');
    } catch (err) {
        // Fallback: return local claims
        console.log('Fetching claims from local database (API unavailable):', err);
        return db.getPendingClaims().map(claim => ({
            claim_id: claim.id,
            item_name: db.foundItems.find(i => i.id === claim.foundItemId)?.name || 'Deleted Item',
            posted_by: db.users.find(u => u.id === db.foundItems.find(i => i.id === claim.foundItemId)?.userId)?.name || 'Unknown',
            claimant_username: claim.claimerName,
            proof_details: claim.contactInfo || '{}',
            status: claim.status,
            date: claim.date,
            ...claim
        }));
    }
}

async function getUserClaims() {
    try {
        return await apiRequest(`/users/${currentUser.id}/claims`);
    } catch (err) {
        console.log('Fetching user claims from local database (API unavailable):', err);
        return db.claims
            .filter(claim => claim.claimantUserId === currentUser?.id)
            .map(claim => ({
                claim_id: claim.id,
                item_name: db.foundItems.find(i => i.id === claim.foundItemId)?.name || 'Deleted Item',
                status: claim.status,
                claim_description: claim.claim_description || claim.claimDescription || 'No description',
                proof_details: claim.contactInfo || '{}',
                submitted_at: claim.date,
                ...claim
            }));
    }
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
         'my-lost-items.html', 'claim.html', 'claim_admin.html', 'admin.html'].includes(currentPage)) {
        if (!isLoggedIn()) {
            window.location.href = '/pages/login.html';
            return;
        }
        if (currentPage === 'admin.html' && !isAdmin()) {
            window.location.href = '/pages/dashboard.html';
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
        case 'claim_admin.html': initUserClaims(); break;
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
                setTimeout(() => window.location.href = '/pages/login.html', 1000);
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
            setTimeout(() => window.location.href = '/pages/dashboard.html', 1000);
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
            setTimeout(() => window.location.href = '/pages/dashboard.html', 1000);
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
            setTimeout(() => window.location.href = '/pages/dashboard.html', 1500);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

function initReportFound() {
    const form = document.getElementById('foundItemForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('foundItemName').value;
        const description = document.getElementById('foundDescription').value;
        const imageFile = document.getElementById('foundImage').files[0];

        let imageUrl = null;
        if (imageFile) {
            imageUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.readAsDataURL(imageFile);
            });
        }

        try {
            // Use API to report found item; falls back to local db inside API functions if needed
            await reportFoundItem({ name, description, location: null, date: new Date().toISOString(), contact: null, image: imageUrl });
            showNotification('Found item reported!', 'success');
            setTimeout(() => window.location.href = '/pages/dashboard.html', 1500);
        } catch (error) {
            // Fallback to in-memory DB if API fails
            db.addFoundItem(name, description, imageUrl);
            showNotification('Found item reported (offline)!', 'success');
            setTimeout(() => window.location.href = '/pages/dashboard.html', 1500);
        }
    });
}

// Items Display
async function initFoundItems() {
    await displayFoundItems();
}

async function initMyLostItems() {
    await displayLostItems();
}

async function displayFoundItems() {
    const grid = document.getElementById('foundItemsGrid');
    if (!grid) return;

    let items = [];
    try {
        items = await getFoundItems();
    } catch (err) {
        // Fallback to in-memory store when API is unavailable
        items = db.getFoundItems();
    }

    // Normalize server items to frontend model
    items = items.map(item => ({
        id: item.item_id || item.id,
        userId: item.user_id || item.userId,
        name: item.item_name || item.name,
        description: item.description || '',
        image: item.image_url || item.image || null,
        date: item.date_found || item.date || item.created_at || null,
        status: item.status || 'found'
    }));

    grid.innerHTML = '';

    if (!items || items.length === 0) {
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
        const isOwner = item.userId === currentUser?.id;
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
        grid.appendChild(card);

        if (isOwner) {
            const btn = card.querySelector('.revoke-btn');
            if (btn) btn.onclick = () => revokeFoundItem(item.id);
        } else {
            const btn = card.querySelector('.claim-btn');
            if (btn) btn.onclick = () => claimItem(item);
        }
    });
}

async function displayLostItems() {
    const grid = document.getElementById('lostItemsGrid');
    if (!grid) return;

    let items = [];
    try {
        items = await getUserLostItems();
    } catch (err) {
        items = db.getUserLostItems();
    }

    // Normalize items
    items = items.map(item => ({
        id: item.item_id || item.id,
        userId: item.user_id || item.userId,
        name: item.item_name || item.name,
        description: item.description || '',
        image: item.image_url || item.image || null,
        date: item.date_lost || item.date || item.created_at || null,
        status: item.status || 'lost'
    }));

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
function claimItem(itemOrId) {
    // Accept either the full item object or just its ID.
    let item = null;
    let itemId = null;

    if (typeof itemOrId === 'object' && itemOrId !== null) {
        item = itemOrId;
        itemId = item.id;
    } else {
        itemId = parseInt(itemOrId);
        const items = db.getFoundItems();
        item = items.find(i => i.id === itemId);
    }

    if (item) {
        localStorage.setItem('claimItemData', JSON.stringify(item));
    }
    if (itemId) {
        localStorage.setItem('claimItemId', itemId);
    }

    window.location.href = 'claim.html';
}

function initClaimPage() {
    const itemId = parseInt(localStorage.getItem('claimItemId'));
    let item = null;
    
    // Try to get stored item data first
    const storedItemData = localStorage.getItem('claimItemData');
    if (storedItemData) {
        try {
            item = JSON.parse(storedItemData);
        } catch (err) {
            console.error('Failed to parse stored item data');
        }
    }
    
    // Fallback to lookup if stored data is not available
    if (!item && itemId) {
        item = db.foundItems.find(i => i.id === itemId);
    }
    
    // Clear stored data
    localStorage.removeItem('claimItemId');
    localStorage.removeItem('claimItemData');
    
    if (!item || !currentUser) {
        window.location.href = 'found-items.html';
        return;
    }
    
    // Populate form
    document.getElementById('claimItemImage').src = item.image || '';
    document.getElementById('claimItemName').textContent = item.name;
    document.getElementById('claimItemDescription').textContent = item.description || 'No description';
    document.getElementById('claimItemDate').textContent = new Date(item.date).toLocaleDateString();
    document.getElementById('claimerName').value = currentUser.name;
    
    // Form submit
    document.getElementById('claimForm').onsubmit = async function(e) {
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
        try {
            const result = await submitClaim(item.id, contactInfo, document.getElementById('proofDescription').value || '');
            // Show success
            document.querySelector('.claim-form-card').style.display = 'none';
            document.getElementById('claimStatusCard').style.display = 'block';
            document.getElementById('claimId').textContent = result.claimId || result.id || 'N/A';
            document.getElementById('claimSubmitDate').textContent = new Date().toLocaleDateString();
            showNotification('Claim submitted!', 'success');
        } catch (err) {
            showNotification(`Failed to submit claim: ${err.message}`, 'error');
        }
    };
}

// Admin Panel
function initAdmin() {
    updateAdminStats();
    displayClaims();
}

function initUserClaims() {
    document.getElementById('claimsUserName').textContent = currentUser.name;
    const totalClaimsEl = document.getElementById('userTotalClaims');
    const pendingClaimsEl = document.getElementById('userPendingClaims');
    const verifiedClaimsEl = document.getElementById('userVerifiedClaims');
    const grid = document.getElementById('userClaimsGrid');

    getUserClaims().then(claims => {
        const normalized = claims.map(claim => ({
            claim_id: claim.claim_id || claim.id,
            item_name: claim.item_name || 'Unknown Item',
            claim_description: claim.claim_description || claim.claimDescription || 'No description',
            status: (claim.status || 'pending').toLowerCase(),
            submitted_at: claim.submitted_at || claim.date || claim.created_at,
            proof_details: claim.proof_details || claim.contactInfo || '{}'
        }));

        totalClaimsEl.textContent = normalized.length;
        pendingClaimsEl.textContent = normalized.filter(c => c.status === 'pending').length;
        verifiedClaimsEl.textContent = normalized.filter(c => c.status === 'verified' || c.status === 'approved').length;

        if (!normalized.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;"><i class="fas fa-inbox" style="font-size:4rem;color:#00d4ff"></i><h3>No claims yet</h3><p>Your submitted claims will appear here once you request verification.</p></div>`;
            return;
        }

        grid.innerHTML = normalized.map((claim, index) => {
            const info = JSON.parse(claim.proof_details || '{}');
            const claimDate = new Date(claim.submitted_at || Date.now()).toLocaleDateString();
            const statusClass = claim.status === 'pending' ? 'pending' : (claim.status === 'verified' || claim.status === 'approved' ? 'success' : 'rejected');
            return `
                <div class="item-card glass">
                    <div class="item-name">${claim.item_name}</div>
                    <div class="item-description">${claim.claim_description}</div>
                    <div class="status-row">
                        <span class="status-badge ${statusClass}">${claim.status.toUpperCase()}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Claim ID:</span>
                        <span class="detail-text">${claim.claim_id}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Submitted:</span>
                        <span class="detail-text">${claimDate}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-text">${info.phone || 'N/A'}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Social:</span>
                        <span class="detail-text">${info.social || 'N/A'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }).catch(err => {
        console.error('Failed to load user claims:', err);
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;"><i class="fas fa-exclamation-triangle" style="font-size:4rem;color:#ff5757"></i><h3>Unable to load claims</h3><p>Please refresh or try again later.</p></div>`;
    });
}

function updateAdminStats() {
    // Try to fetch counts from server; fallback to in-memory data
    getClaims().then(claims => {
        document.getElementById('totalClaims').textContent = claims.length;
        document.getElementById('pendingClaims').textContent = claims.filter(c => (c.status || 'pending') === 'pending').length;
        document.getElementById('verifiedClaims').textContent = claims.filter(c => (c.status || '') === 'verified').length;
    }).catch(() => {
        document.getElementById('totalClaims').textContent = db.claims.length;
        document.getElementById('pendingClaims').textContent = db.getPendingClaims().length;
        document.getElementById('verifiedClaims').textContent = db.claims.filter(c => c.status === 'verified').length;
    });
}

function displayClaims() {
    const grid = document.getElementById('claimsGrid');
    if (!grid) return;

    // Try to get claims from server (admin only)
    getClaims().then(claimsFromServer => {
        const claims = (claimsFromServer || []).filter(c => ((c.status || 'pending').toString().toLowerCase() === 'pending'));
        
        // Show message if no pending claims
        if (!claims || claims.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                    <i class="fas fa-file-alt" style="font-size: 4rem; color: #00d4ff; margin-bottom: 20px;"></i>
                    <h3>No pending claims</h3>
                    <p>Claims will appear here once users submit them or when there are unreviewed requests.</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = claims.map((claim, index) => {
            const itemName = claim.item_name || 'Deleted Item';
            const posterName = claim.posted_by || 'Unknown';
            const claimerName = claim.claimant_username || claim.claimerName || 'Unknown';
            const info = JSON.parse(claim.proof_details || '{}' );
            const claimDate = new Date(claim.submitted_at || claim.date || Date.now()).toLocaleDateString();
            const itemDate = new Date(claim.item_date || claim.date || Date.now()).toLocaleDateString();
            return `
                <div class="claim-item-container">
                    <div class="claim-row">
                        <div class="claim-row-number">${index + 1}</div>
                        
                        <div class="claim-row-item">
                            <div class="row-item-title">${itemName}</div>
                            <div class="row-item-desc">${claim.claim_description || 'No description'}</div>
                        </div>
                        
                        <div class="claim-row-separator"></div>
                        
                        <div class="claim-row-info">
                            <div class="info-line">
                                <span class="info-label">Posted by</span>
                                <span class="info-value">${posterName}</span>
                            </div>
                        </div>
                        
                        <div class="claim-row-separator"></div>
                        
                        <div class="claim-row-claimer">
                            <div class="info-line">
                                <span class="info-label">Claimed by</span>
                                <span class="info-value">${claimerName}</span>
                            </div>
                            <div class="claimer-details">
                                <span class="detail-item"><i class="fas fa-phone"></i> ${info.phone || 'N/A'}</span>
                                <span class="detail-item"><i class="fas fa-link"></i> ${info.social || 'N/A'}</span>
                            </div>
                        </div>
                        
                        <div class="claim-row-actions">
                            <button class="row-btn row-btn-expand" onclick="toggleClaimExpand(${claim.claim_id})" title="View Details">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <button class="row-btn row-btn-verify" onclick="verifyClaim(${claim.claim_id})" title="Verify Claim">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="row-btn row-btn-reject" onclick="rejectClaim(${claim.claim_id})" title="Reject Claim">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                
                <div class="claim-expanded" id="claim-expanded-${claim.claim_id}">
                    <div class="expanded-content">
                        <div class="expanded-header">
                            <h3>Full Claim Details</h3>
                        </div>
                        <div class="expanded-grid">
                            <div class="expanded-section">
                                <h4>Item Details</h4>
                                <div class="expanded-image">
                                    <img src="${claim.image_url || ''}" alt="${itemName}">
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Item Name:</span>
                                    <span class="detail-text">${itemName}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Description:</span>
                                    <span class="detail-text">${claim.claim_description || 'N/A'}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Posted Date:</span>
                                    <span class="detail-text">${itemDate}</span>
                                </div>
                                <div class="detail-group">
                                    <span class="detail-label">Posted By:</span>
                                    <span class="detail-text">${posterName}</span>
                                </div>
                            </div>
                            
                            <div class="expanded-divider"></div>
                            
                            <div class="expanded-section">
                                <h4>Claim Information</h4>
                                <div class="detail-group">
                                    <span class="detail-label">Claimed By:</span>
                                    <span class="detail-text">${claimerName}</span>
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
                                    <span class="detail-text status-badge status-pending">${(claim.status || 'pending').toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="expanded-actions">
                            <button class="expanded-btn expanded-btn-verify" onclick="verifyClaim(${claim.claim_id})">
                                <i class="fas fa-check-circle"></i> Verify Claim
                            </button>
                            <button class="expanded-btn expanded-btn-reject" onclick="rejectClaim(${claim.claim_id})">
                                <i class="fas fa-times-circle"></i> Reject Claim
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }).catch((err) => {
        console.error('Failed to load claims from API:', err);
        // Fallback to local DB: load all local claims but hide verified ones
        const claims = db.claims.filter(c => (c.status || '').toString().toLowerCase() !== 'verified');
        if (!claims.length) {
            // No pending/unreviewed claims locally — show empty grid (do not display the previous message)
            grid.innerHTML = '';
            return;
        }

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
    });
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

async function confirmRevoke() {
    if (!currentRevokeType || !currentRevokeId) return;
    const id = currentRevokeId;
    if (currentRevokeType === 'found') {
        try {
            await apiRequest(`/found-items/${id}`, { method: 'DELETE' });
            showNotification('Found item revoked!', 'info');
            await displayFoundItems();
        } catch (err) {
            showNotification(`Failed to revoke item: ${err.message}`, 'error');
        }
    } else if (currentRevokeType === 'lost') {
        try {
            await apiRequest(`/lost-items/${id}`, { method: 'DELETE' });
            showNotification('Lost item revoked!', 'info');
            await displayLostItems();
        } catch (err) {
            showNotification(`Failed to revoke item: ${err.message}`, 'error');
        }
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
    if (!currentUser || !isAdmin()) {
        window.location.href = '/pages/dashboard.html';
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