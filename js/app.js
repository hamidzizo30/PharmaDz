/* ============================================================
   Pharma-Find DZ — Application Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // ============ APP STATE ============
    const state = {
        currentView: 'home',
        userLocation: null,       // { lat, lng }
        locationPermission: 'prompt', // 'granted' | 'denied' | 'prompt'
        pharmacies: [],
        selectedWilaya: null,
        finderMap: null,
        gardeMap: null,
        registerMap: null,
        registerMarker: null,
        registerLat: 36.7538,     // default: Alger Centre
        registerLng: 3.0588,
        currentPharmacist: null,
    };

    // ============ DOM REFS ============
    const dom = {
        splash: document.getElementById('splash'),
        app: document.getElementById('app'),
        mainContent: document.getElementById('mainContent'),
        headerTitle: document.getElementById('headerTitle'),
        btnBack: document.getElementById('btnBack'),
        btnMenu: document.getElementById('btnMenu'),
        bottomNav: document.getElementById('bottomNav'),
        navItems: document.querySelectorAll('.nav-item'),
        portal: document.getElementById('pharmacistPortal'),
        portalClose: document.getElementById('btnClosePortal'),
        portalLogin: document.getElementById('portalLogin'),
        portalRegister: document.getElementById('portalRegister'),
        portalPending: document.getElementById('portalPending'),
        toastContainer: document.getElementById('toastContainer'),
    };

    // ============ INIT ============
    function init() {
        state.pharmacies = getStoredPharmacies();
        state.currentPharmacist = getStoredPharmacist();
        populateWilayaSelect();
        setupEventListeners();
        renderView('home');
        requestLocation();
        // Hide splash after load
        setTimeout(() => {
            dom.splash.classList.add('hide');
        }, 1500);
    }

    // ============ EVENT LISTENERS ============
    function setupEventListeners() {
        // Bottom navigation
        dom.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                navigateTo(view);
            });
        });

        // Back button
        dom.btnBack.addEventListener('click', goBack);

        // Menu (pharmacist portal)
        dom.btnMenu.addEventListener('click', openPharmacistPortal);
        dom.portalClose.addEventListener('click', closePharmacistPortal);

        // Portal tab switching
        document.getElementById('linkToRegister').addEventListener('click', (e) => {
            e.preventDefault();
            showPortalTab('register');
        });
        document.getElementById('linkToLogin').addEventListener('click', (e) => {
            e.preventDefault();
            showPortalTab('login');
        });

        // Login form
        document.getElementById('formLogin').addEventListener('submit', handleLogin);
        // Register form
        document.getElementById('formRegister').addEventListener('submit', handleRegister);

        // Photo uploads
        setupPhotoUpload('photoOutsideBox', 'photoOutside', 'previewOutside');
        setupPhotoUpload('photoInsideBox', 'photoInside', 'previewInside');

        // Toggle password visibility
        document.querySelectorAll('.toggle-pw').forEach(btn => {
            btn.addEventListener('click', function() {
                const input = this.parentElement.querySelector('input');
                const icon = this.querySelector('.material-symbols-rounded');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = 'visibility';
                } else {
                    input.type = 'password';
                    icon.textContent = 'visibility_off';
                }
            });
        });

        // Logout from pending
        document.getElementById('btnLogoutPending').addEventListener('click', () => {
            clearPharmacist();
            state.currentPharmacist = null;
            showPortalTab('login');
            closePharmacistPortal();
            toast('Déconnecté avec succès', 'success');
        });

        // Close portal on overlay click
        dom.portal.addEventListener('click', (e) => {
            if (e.target === dom.portal) closePharmacistPortal();
        });
    }

    // ============ NAVIGATION / ROUTING ============
    function navigateTo(view) {
        state.currentView = view;
        updateNavActive(view);
        renderView(view);
        dom.mainContent.scrollTop = 0;
    }

    function updateNavActive(view) {
        dom.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        // Hide bottom nav for dashboard view
        if (view === 'dashboard') {
            dom.bottomNav.style.display = 'none';
        } else {
            dom.bottomNav.style.display = '';
        }
    }

    function renderView(view) {
        dom.mainContent.innerHTML = '';
        dom.mainContent.className = 'main-content';

        switch (view) {
            case 'home': renderHomeView(); break;
            case 'finder': renderFinderView(); break;
            case 'garde': renderGardeView(); break;
            case 'search': renderSearchView(); break;
            case 'dashboard': renderDashboardView(); break;
            default: renderHomeView();
        }

        dom.headerTitle.textContent = getViewTitle(view);
        dom.btnBack.style.visibility = (view === 'home') ? 'hidden' : 'visible';
        dom.btnMenu.style.visibility = (view === 'dashboard') ? 'hidden' : 'visible';
    }

    function getViewTitle(view) {
        const titles = {
            home: 'Pharma-Find DZ',
            finder: 'À Proximité',
            garde: 'Pharmacies de Garde',
            search: 'Recherche Médicament',
            dashboard: 'Tableau de Bord'
        };
        return titles[view] || 'Pharma-Find DZ';
    }

    function goBack() {
        if (state.currentView === 'dashboard') {
            navigateTo('home');
        } else {
            navigateTo('home');
        }
    }

    // ============ HOME VIEW ============
    function renderHomeView() {
        const wilaya = state.userLocation 
            ? findNearestWilaya(state.userLocation.lat, state.userLocation.lng)
            : null;

        const gardeCount = state.pharmacies.filter(p => p.isGarde && p.approved && p.isPublic).length;
        const totalApproved = state.pharmacies.filter(p => p.approved && p.isPublic).length;

        dom.mainContent.innerHTML = `
            <div class="hero-banner">
                <div class="hero-icon">
                    <span class="material-symbols-rounded">local_pharmacy</span>
                </div>
                <h1>Pharma-Find <span>DZ</span></h1>
                <p class="hero-sub">Trouvez vos médicaments et pharmacies de garde en un clic</p>
            </div>

            <div class="quick-actions">
                <div class="quick-action-card" data-action="finder">
                    <div class="qa-icon location">
                        <span class="material-symbols-rounded">my_location</span>
                    </div>
                    <div class="qa-title">Pharmacies Proches</div>
                    <div class="qa-sub">Trouvez les pharmacies autour de vous</div>
                </div>
                <div class="quick-action-card" data-action="garde">
                    <div class="qa-icon garde">
                        <span class="material-symbols-rounded">local_hospital</span>
                    </div>
                    <div class="qa-title">Pharmacies de Garde</div>
                    <div class="qa-sub">Celles ouvertes aujourd'hui</div>
                </div>
                <div class="quick-action-card" data-action="search">
                    <div class="qa-icon search-med">
                        <span class="material-symbols-rounded">medication</span>
                    </div>
                    <div class="qa-title">Chercher Médicament</div>
                    <div class="qa-sub">Vérifiez la disponibilité</div>
                </div>
                <div class="quick-action-card" id="cardPharmacistPortal">
                    <div class="qa-icon map">
                        <span class="material-symbols-rounded">store</span>
                    </div>
                    <div class="qa-title">Espace Pharmacien</div>
                    <div class="qa-sub">Gérez votre pharmacie</div>
                </div>
            </div>

            <div class="stats-strip">
                <div class="stat-item">
                    <div class="stat-value">${totalApproved}</div>
                    <div class="stat-label">Pharmacies</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${gardeCount}</div>
                    <div class="stat-label">De Garde Aujourd'hui</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${COMMON_MEDICINES.length}+</div>
                    <div class="stat-label">Médicaments Référencés</div>
                </div>
            </div>

            <div class="wilaya-strip">
                <h3>
                    <span class="material-symbols-rounded">location_city</span>
                    ${wilaya ? 'Pharmacies à ' + wilaya.name : 'Choisir une Wilaya'}
                </h3>
                <div class="wilaya-chips" id="homeWilayaChips">
                    ${['16','31','25','19','09','02','13','23'].map(code => {
                        const w = WILAYAS.find(ww => ww.code === code);
                        const selected = state.selectedWilaya === code ? ' selected' : '';
                        return `<button class="wilaya-chip${selected}" data-wilaya="${code}">${w ? w.name : code}</button>`;
                    }).join('')}
                </div>
            </div>

            <div class="section-header">
                <h3>Pharmacies de Garde ⚡</h3>
            </div>
            <div class="pharmacy-list" id="homeGardeList">
                ${renderGardeCards()}
            </div>
        `;

        // Quick action cards
        dom.mainContent.querySelectorAll('.quick-action-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                if (action === 'finder' || action === 'garde' || action === 'search') {
                    navigateTo(action);
                }
            });
        });

        document.getElementById('cardPharmacistPortal').addEventListener('click', openPharmacistPortal);

        // Wilaya chips
        dom.mainContent.querySelectorAll('.wilaya-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                state.selectedWilaya = chip.dataset.wilaya;
                renderView('home');
            });
        });
    }

    function renderGardeCards(maxCount = 5) {
        let gardePharmacies = state.pharmacies.filter(p => p.isGarde && p.approved && p.isPublic);
        
        if (state.selectedWilaya) {
            gardePharmacies = gardePharmacies.filter(p => p.wilaya === state.selectedWilaya);
        }

        if (gardePharmacies.length === 0) {
            return `
                <div class="empty-state">
                    <span class="material-symbols-rounded">medication</span>
                    <h3>Aucune pharmacie de garde</h3>
                    <p>Revenez plus tard ou élargissez votre recherche.</p>
                </div>`;
        }

        return gardePharmacies.slice(0, maxCount).map(p => renderPharmacyCard(p)).join('');
    }

    function renderPharmacyCard(p, showDistance = false) {
        const distanceText = showDistance && state.userLocation
            ? formatDistance(haversineDistance(state.userLocation.lat, state.userLocation.lng, p.lat, p.lng))
            : '';

        return `
            <div class="pharmacy-card" data-id="${p.id}">
                ${p.isGarde ? '<div class="garde-badge"><span class="material-symbols-rounded" style="font-size:12px">bolt</span> Garde</div>' : ''}
                <div class="pharmacy-avatar">
                    <span class="material-symbols-rounded">local_pharmacy</span>
                </div>
                <div class="pharmacy-info">
                    <div class="pharmacy-name">${p.pharmacyName}</div>
                    <div class="pharmacy-address">
                        <span class="material-symbols-rounded">location_on</span>
                        ${p.commune}, ${p.wilayaName || ''}
                    </div>
                    ${distanceText ? `<div class="pharmacy-distance">📏 ${distanceText}</div>` : ''}
                    <div class="pharmacy-actions">
                        <a href="tel:${p.phone}" class="btn-sm btn-call" onclick="event.stopPropagation()">
                            <span class="material-symbols-rounded" style="font-size:16px">call</span>
                            Appeler
                        </a>
                        <button class="btn-sm btn-directions" onclick="event.stopPropagation(); openDirections(${p.lat},${p.lng})">
                            <span class="material-symbols-rounded" style="font-size:16px">directions</span>
                            Itinéraire
                        </button>
                    </div>
                </div>
            </div>`;
    }

    // ============ FINDER VIEW (MAP + LIST) ============
    function renderFinderView() {
        dom.mainContent.innerHTML = `
            ${!state.userLocation ? `
                <div class="location-permission-banner" id="locationBanner">
                    <span class="material-symbols-rounded">my_location</span>
                    <span>Activez votre localisation pour trouver les pharmacies proches</span>
                </div>
            ` : ''}
            <div class="map-wrapper" id="finderMapWrapper">
                <div id="finderMap"></div>
                <button class="map-fab" id="btnLocateMe" title="Ma position">
                    <span class="material-symbols-rounded">my_location</span>
                </button>
            </div>
            <div class="section-header">
                <h3>${state.userLocation ? 'Pharmacies les plus proches' : 'Toutes les pharmacies'}</h3>
                ${state.selectedWilaya ? `<span style="font-size:0.8rem;color:var(--md-primary);font-weight:600">${WILAYAS.find(w=>w.code===state.selectedWilaya)?.name||''}</span>` : ''}
            </div>
            <div class="pharmacy-list" id="finderPharmacyList"></div>
        `;

        // Init map
        setTimeout(() => {
            initFinderMap();
        }, 100);

        // Location banner
        const banner = document.getElementById('locationBanner');
        if (banner) {
            banner.addEventListener('click', requestLocation);
        }

        document.getElementById('btnLocateMe').addEventListener('click', () => {
            requestLocation().then(() => {
                if (state.finderMap && state.userLocation) {
                    state.finderMap.setView([state.userLocation.lat, state.userLocation.lng], 14);
                }
            });
        });

        renderFinderPharmacyList();
    }

    function initFinderMap() {
        const mapEl = document.getElementById('finderMap');
        if (!mapEl) return;

        if (state.finderMap) {
            // Clear existing markers
            state.finderMap.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.TileLayer === false) {
                    if (!(layer instanceof L.TileLayer)) {
                        state.finderMap.removeLayer(layer);
                    }
                }
            });
            state.finderMap.invalidateSize();
        } else {
            const center = state.userLocation
                ? [state.userLocation.lat, state.userLocation.lng]
                : [36.7538, 3.0588];

            state.finderMap = L.map('finderMap', {
                center: center,
                zoom: 13,
                zoomControl: true,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(state.finderMap);
        }

        // Add pharmacy markers
        addPharmacyMarkers(state.finderMap);

        // Handle resize
        setTimeout(() => {
            if (state.finderMap) state.finderMap.invalidateSize();
        }, 400);
    }

    function addPharmacyMarkers(map) {
        // Clear existing markers (keep tile layer)
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        let pharmacies = state.pharmacies.filter(p => p.approved && p.isPublic);
        
        if (state.selectedWilaya) {
            pharmacies = pharmacies.filter(p => p.wilaya === state.selectedWilaya);
        }

        pharmacies.forEach(p => {
            const icon = L.divIcon({
                className: p.isGarde ? 'garde-marker' : '',
                html: `<div style="
                    background:${p.isGarde?'#e65100':'#0d6b4e'};
                    color:white;
                    width:32px;height:32px;
                    border-radius:50% 50% 50% 0;
                    transform:rotate(-45deg);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    box-shadow:0 2px 8px rgba(0,0,0,0.3);
                "><span style="transform:rotate(45deg);font-size:16px;">+</span></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });

            const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
            marker.bindPopup(`
                <b>${p.pharmacyName}</b><br>
                <span style="font-size:0.8rem;">${p.commune}, ${p.wilayaName || ''}</span><br>
                ${p.isGarde ? '<span style="color:#e65100;font-weight:600;">⚡ De Garde</span><br>' : ''}
                <a href="tel:${p.phone}" style="color:#0d6b4e;font-weight:600;">📞 ${p.phone}</a>
            `);
        });

        // User location marker
        if (state.userLocation) {
            const userIcon = L.divIcon({
                className: '',
                html: `<div style="
                    background:#1565c0;
                    border:3px solid white;
                    width:20px;height:20px;
                    border-radius:50%;
                    box-shadow:0 2px 6px rgba(0,0,0,0.4);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        }
    }

    function renderFinderPharmacyList() {
        const listEl = document.getElementById('finderPharmacyList');
        if (!listEl) return;

        let pharmacies = state.pharmacies.filter(p => p.approved && p.isPublic);
        
        if (state.selectedWilaya) {
            pharmacies = pharmacies.filter(p => p.wilaya === state.selectedWilaya);
        }

        // Sort by distance if location available
        if (state.userLocation) {
            pharmacies.sort((a, b) => {
                const dA = haversineDistance(state.userLocation.lat, state.userLocation.lng, a.lat, a.lng);
                const dB = haversineDistance(state.userLocation.lat, state.userLocation.lng, b.lat, b.lng);
                return dA - dB;
            });
        }

        if (pharmacies.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">location_off</span>
                    <h3>Aucune pharmacie trouvée</h3>
                    <p>Essayez de changer de wilaya.</p>
                </div>`;
            return;
        }

        listEl.innerHTML = pharmacies.map(p => renderPharmacyCard(p, !!state.userLocation)).join('');
    }

    // ============ GARDE VIEW ============
    function renderGardeView() {
        const gardePharmacies = state.pharmacies.filter(p => p.isGarde && p.approved && p.isPublic);
        const today = new Date();
        const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        dom.mainContent.innerHTML = `
            <div class="garde-date-strip">
                <div class="date-big">${dateStr}</div>
                <div class="date-label">Pharmacies de garde aujourd'hui</div>
            </div>
            <div class="map-wrapper" style="height:35vh" id="gardeMapWrapper">
                <div id="gardeMap"></div>
            </div>
            <div class="section-header">
                <h3>📋 Liste des pharmacies de garde</h3>
                <span style="font-size:0.8rem;color:var(--md-primary);font-weight:600">${gardePharmacies.length} trouvée(s)</span>
            </div>
            <div class="pharmacy-list" id="gardePharmacyList">
                ${gardePharmacies.length === 0 ? `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">nightlight</span>
                        <h3>Aucune pharmacie de garde aujourd'hui</h3>
                        <p>Les données sont mises à jour quotidiennement. Revenez plus tard !</p>
                    </div>
                ` : gardePharmacies.slice(0, 5).map(p => renderPharmacyCard(p, !!state.userLocation)).join('')}
            </div>
        `;

        setTimeout(() => initGardeMap(), 100);
    }

    function initGardeMap() {
        const mapEl = document.getElementById('gardeMap');
        if (!mapEl) return;

        const gardePharmacies = state.pharmacies.filter(p => p.isGarde && p.approved && p.isPublic);

        if (state.gardeMap) {
            state.gardeMap.invalidateSize();
            // Clear markers only
            state.gardeMap.eachLayer(layer => {
                if (layer instanceof L.Marker) state.gardeMap.removeLayer(layer);
            });
        } else {
            const center = gardePharmacies.length > 0
                ? [gardePharmacies[0].lat, gardePharmacies[0].lng]
                : [36.7538, 3.0588];

            state.gardeMap = L.map('gardeMap', {
                center: center,
                zoom: gardePharmacies.length > 0 ? 12 : 6,
                zoomControl: true,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(state.gardeMap);
        }

        gardePharmacies.forEach(p => {
            const icon = L.divIcon({
                className: 'garde-marker',
                html: `<div style="
                    background:#e65100;
                    color:white;
                    width:36px;height:36px;
                    border-radius:50%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    box-shadow:0 2px 12px rgba(230,81,0,0.5);
                    font-size:18px;
                ">⚡</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
                popupAnchor: [0, -18]
            });

            const marker = L.marker([p.lat, p.lng], { icon }).addTo(state.gardeMap);
            marker.bindPopup(`
                <b>${p.pharmacyName}</b><br>
                <span style="font-size:0.8rem;">${p.commune}, ${p.wilayaName || ''}</span><br>
                <a href="tel:${p.phone}" style="color:#e65100;font-weight:600;">📞 ${p.phone}</a>
            `);
        });

        setTimeout(() => {
            if (state.gardeMap) state.gardeMap.invalidateSize();
        }, 300);
    }

    // ============ SEARCH VIEW ============
    function renderSearchView() {
        dom.mainContent.innerHTML = `
            <div class="search-box" id="searchBox">
                <span class="material-symbols-rounded">search</span>
                <input type="text" id="searchInput" placeholder="Rechercher un médicament (nom, marque...)" autocomplete="off">
                <span class="material-symbols-rounded" id="searchClear" style="cursor:pointer;display:none">close</span>
            </div>
            <div class="search-results" id="searchResults">
                <div class="empty-state">
                    <span class="material-symbols-rounded">medication</span>
                    <h3>Recherchez un médicament</h3>
                    <p>Tapez le nom d'un principe actif ou d'une marque pour vérifier sa disponibilité</p>
                </div>
            </div>
        `;

        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        const searchResults = document.getElementById('searchResults');

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            searchClear.style.display = query ? 'block' : 'none';

            if (query.length < 2) {
                searchResults.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">medication</span>
                        <h3>Recherchez un médicament</h3>
                        <p>Tapez le nom d'un principe actif ou d'une marque</p>
                    </div>`;
                return;
            }

            performMedicineSearch(query, searchResults);
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchResults.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">medication</span>
                    <h3>Recherchez un médicament</h3>
                    <p>Tapez le nom d'un principe actif ou d'une marque</p>
                </div>`;
        });

        // Focus search
        setTimeout(() => searchInput.focus(), 300);
    }

    function performMedicineSearch(query, container) {
        const q = query.toLowerCase();

        // Search in common medicines
        const matchedMeds = COMMON_MEDICINES.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.brand.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q)
        );

        // Find pharmacies that have these medicines
        const results = [];

        matchedMeds.forEach(med => {
            const pharmaciesWith = state.pharmacies.filter(p =>
                p.approved && p.isPublic &&
                p.medicines && p.medicines.some(m => m.toLowerCase() === med.name.toLowerCase())
            );

            results.push({
                medicine: med,
                pharmacies: pharmaciesWith
            });
        });

        // Also search directly in pharmacy medicine lists
        const directMatches = [];
        state.pharmacies.filter(p => p.approved && p.isPublic).forEach(p => {
            if (p.medicines) {
                p.medicines.forEach(m => {
                    if (m.toLowerCase().includes(q)) {
                        const alreadyInResults = results.some(r => r.medicine.name.toLowerCase() === m.toLowerCase());
                        if (!alreadyInResults) {
                            directMatches.push({
                                medicine: { name: m, brand: '', category: '' },
                                pharmacies: [p]
                            });
                        } else {
                            // Add pharmacy to existing result
                            const existing = results.find(r => r.medicine.name.toLowerCase() === m.toLowerCase());
                            if (existing && !existing.pharmacies.find(pp => pp.id === p.id)) {
                                existing.pharmacies.push(p);
                            }
                        }
                    }
                });
            }
        });

        const allResults = [...results, ...directMatches];

        if (allResults.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">search_off</span>
                    <h3>Aucun résultat</h3>
                    <p>Aucun médicament trouvé pour "${query}". Essayez un autre nom.</p>
                </div>`;
            return;
        }

        container.innerHTML = allResults.map(r => `
            <div class="medicine-result-card">
                <div class="med-icon">
                    <span class="material-symbols-rounded">pill</span>
                </div>
                <div class="med-info">
                    <div class="med-name">${r.medicine.brand || r.medicine.name}</div>
                    <div class="med-details">
                        ${r.medicine.brand ? r.medicine.name + ' • ' : ''}${r.medicine.category || ''}
                    </div>
                    <div class="med-details">
                        Disponible dans <b>${r.pharmacies.length}</b> pharmacie(s)
                    </div>
                    ${r.pharmacies.map(p => `
                        <div style="font-size:0.72rem;color:var(--md-primary);margin-top:2px;">
                            📍 ${p.pharmacyName} — ${p.commune}
                            ${p.isGarde ? ' <span style="color:#e65100;font-weight:700;">⚡ Garde</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="med-status ${r.pharmacies.length > 0 ? 'available' : 'unavailable'}">
                    ${r.pharmacies.length > 0 ? 'Disponible' : 'Indisponible'}
                </div>
            </div>
        `).join('');
    }

    // ============ PHARMACIST PORTAL ============
    function openPharmacistPortal() {
        dom.portal.classList.add('open');
        
        if (state.currentPharmacist) {
            if (state.currentPharmacist.approved) {
                // Show dashboard in main content
                closePharmacistPortal();
                navigateTo('dashboard');
                return;
            } else {
                showPortalTab('pending');
                return;
            }
        }

        showPortalTab('login');
    }

    function closePharmacistPortal() {
        dom.portal.classList.remove('open');
    }

    function showPortalTab(tab) {
        document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
        const target = document.getElementById(tab === 'login' ? 'portalLogin' : 
                                        tab === 'register' ? 'portalRegister' : 'portalPending');
        if (target) target.classList.add('active');

        // Init register map if needed
        if (tab === 'register') {
            // Destroy old map if exists (to handle portal visibility changes)
            if (state.registerMap) {
                state.registerMap.remove();
                state.registerMap = null;
                state.registerMarker = null;
            }
            setTimeout(initRegisterMap, 400);
        }
    }

    function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
            toast('Veuillez remplir tous les champs', 'error');
            return;
        }

        // Check if in pending registrations
        const pending = getPendingRegistrations();
        const foundPending = pending.find(p => p.email === email);
        
        // Check if in approved pharmacies
        const pharmacies = getStoredPharmacies();
        const foundPharmacy = pharmacies.find(p => 
            p.contactEmail === email || p.pharmacistEmail === email
        );

        if (foundPharmacy && foundPharmacy.approved) {
            state.currentPharmacist = foundPharmacy;
            savePharmacist(foundPharmacy);
            closePharmacistPortal();
            toast(`Bienvenue Dr. ${foundPharmacy.pharmacistName || ''}`, 'success');
            navigateTo('dashboard');
        } else if (foundPending) {
            state.currentPharmacist = { ...foundPending, approved: false };
            savePharmacist({ ...foundPending, approved: false });
            showPortalTab('pending');
            toast('Votre compte est en attente d\'approbation', 'success');
        } else {
            // Demo: accept any credentials for testing
            // Find a demo pharmacy to log into
            const demoPharmacy = pharmacies.find(p => p.approved && p.isPublic);
            if (demoPharmacy && email && password) {
                // Assign this email to the pharmacy for tracking
                demoPharmacy.pharmacistEmail = email;
                savePharmacies(pharmacies);
                state.currentPharmacist = demoPharmacy;
                savePharmacist(demoPharmacy);
                closePharmacistPortal();
                toast(`Bienvenue Dr. ${demoPharmacy.pharmacistName}`, 'success');
                navigateTo('dashboard');
                return;
            }
            toast('Email ou mot de passe incorrect', 'error');
        }
    }

    function handleRegister(e) {
        e.preventDefault();
        
        const data = {
            fullName: document.getElementById('regFullName').value.trim(),
            pharmacyName: document.getElementById('regPharmacyName').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            phone: document.getElementById('regPhone').value.trim(),
            password: document.getElementById('regPassword').value.trim(),
            wilaya: document.getElementById('regWilaya').value,
            commune: document.getElementById('regCommune').value.trim(),
            address: document.getElementById('regAddress').value.trim(),
            lat: state.registerLat,
            lng: state.registerLng,
            photoOutside: document.getElementById('previewOutside').querySelector('img')?.src || null,
            photoInside: document.getElementById('previewInside').querySelector('img')?.src || null,
            submittedAt: new Date().toISOString(),
            approved: false,
            id: 'ph-reg-' + Date.now()
        };

        // Validate
        if (!data.fullName || !data.pharmacyName || !data.email || !data.phone || !data.password || !data.wilaya || !data.commune || !data.address) {
            toast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        // Save to pending
        savePendingRegistration(data);
        
        // Also add to pharmacies list as unapproved
        const pharmacies = getStoredPharmacies();
        pharmacies.push({
            id: data.id,
            pharmacyName: data.pharmacyName,
            pharmacistName: data.fullName,
            address: data.address,
            commune: data.commune,
            wilaya: data.wilaya,
            wilayaName: WILAYAS.find(w => w.code === data.wilaya)?.name || '',
            phone: data.phone,
            lat: data.lat,
            lng: data.lng,
            isGarde: false,
            isPublic: false,
            approved: false,
            medicines: [],
            photoOutside: data.photoOutside,
            photoInside: data.photoInside,
            pharmacistEmail: data.email,
            contactEmail: data.email
        });
        savePharmacies(pharmacies);
        state.pharmacies = pharmacies;

        // Auto-login to pending
        state.currentPharmacist = { ...data, approved: false };
        savePharmacist({ ...data, approved: false });
        
        showPortalTab('pending');
        toast('Demande envoyée avec succès ! En attente de validation.', 'success');

        // Reset form
        document.getElementById('formRegister').reset();
        document.getElementById('previewOutside').innerHTML = '';
        document.getElementById('previewInside').innerHTML = '';
    }

    // ============ REGISTER MAP ============
    function initRegisterMap() {
        const mapEl = document.getElementById('registerMap');
        if (!mapEl || state.registerMap) return;

        state.registerMap = L.map('registerMap', {
            center: [state.registerLat, state.registerLng],
            zoom: 13,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(state.registerMap);

        // Draggable marker
        const markerIcon = L.divIcon({
            className: '',
            html: `<div style="
                background:#0d6b4e;
                color:white;
                width:40px;height:40px;
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow:0 3px 12px rgba(0,0,0,0.3);
                border:3px solid white;
            "><span style="transform:rotate(45deg);font-size:20px;">+</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });

        state.registerMarker = L.marker([state.registerLat, state.registerLng], {
            icon: markerIcon,
            draggable: true
        }).addTo(state.registerMap);

        state.registerMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            state.registerLat = pos.lat;
            state.registerLng = pos.lng;
            updatePinCoordText();
        });

        state.registerMap.on('click', function(e) {
            state.registerLat = e.latlng.lat;
            state.registerLng = e.latlng.lng;
            state.registerMarker.setLatLng(e.latlng);
            updatePinCoordText();
        });

        updatePinCoordText();
        setTimeout(() => state.registerMap.invalidateSize(), 200);
    }

    function updatePinCoordText() {
        const el = document.getElementById('pinCoordText');
        if (el) {
            el.textContent = `📍 Position: ${state.registerLat.toFixed(4)}, ${state.registerLng.toFixed(4)}`;
        }
    }

    // ============ DASHBOARD VIEW ============
    function renderDashboardView() {
        if (!state.currentPharmacist || !state.currentPharmacist.approved) {
            navigateTo('home');
            return;
        }

        const p = state.currentPharmacist;
        const pharmacy = state.pharmacies.find(ph => ph.id === p.id) || p;
        const isGarde = pharmacy.isGarde || false;
        const medicines = pharmacy.medicines || [];

        dom.mainContent.innerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-avatar">
                    <span class="material-symbols-rounded">local_pharmacy</span>
                </div>
                <h2>${pharmacy.pharmacyName}</h2>
                <p>Dr. ${pharmacy.pharmacistName} • ${pharmacy.commune}, ${pharmacy.wilayaName}</p>
            </div>

            <div class="dashboard-section">
                <h3><span class="material-symbols-rounded">toggle_on</span> Statut de la pharmacie</h3>
                <div class="toggle-row">
                    <div>
                        <div class="toggle-label">Pharmacie de Garde</div>
                        <div class="toggle-sub">Activez si votre pharmacie est de garde aujourd'hui</div>
                    </div>
                    <div class="toggle-switch ${isGarde ? 'active' : ''}" id="toggleGarde"></div>
                </div>
                <div class="toggle-row">
                    <div>
                        <div class="toggle-label">Visible publiquement</div>
                        <div class="toggle-sub">Votre pharmacie apparaît sur la carte</div>
                    </div>
                    <div class="toggle-switch ${pharmacy.isPublic ? 'active' : ''}" id="togglePublic"></div>
                </div>
            </div>

            <div class="dashboard-section">
                <h3><span class="material-symbols-rounded">pill</span> Gestion des médicaments</h3>
                <div class="med-manager">
                    <div class="add-med-row">
                        <input type="text" id="newMedInput" placeholder="Ajouter un médicament disponible..." autocomplete="off">
                        <button class="btn-icon-sm" id="btnAddMed">
                            <span class="material-symbols-rounded">add</span>
                        </button>
                    </div>
                    <div class="med-tags" id="medTags">
                        ${medicines.length === 0 ? '<span style="font-size:0.78rem;color:var(--md-on-surface-variant)">Aucun médicament ajouté</span>' : ''}
                        ${medicines.map(m => `
                            <span class="med-tag">
                                ${m}
                                <span class="remove-tag" data-med="${m}">×</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="dashboard-section">
                <button class="btn-outline btn-full" id="btnLogoutDash">
                    <span class="material-symbols-rounded">logout</span>
                    <span>Déconnexion</span>
                </button>
            </div>
        `;

        // Toggle switches
        document.getElementById('toggleGarde').addEventListener('click', function() {
            this.classList.toggle('active');
            updatePharmacyField(p.id, 'isGarde', this.classList.contains('active'));
            toast('Statut de garde mis à jour', 'success');
        });

        document.getElementById('togglePublic').addEventListener('click', function() {
            this.classList.toggle('active');
            updatePharmacyField(p.id, 'isPublic', this.classList.contains('active'));
            toast('Visibilité mise à jour', 'success');
        });

        // Add medicine
        document.getElementById('btnAddMed').addEventListener('click', addMedicine);
        document.getElementById('newMedInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addMedicine();
        });

        // Remove medicine tags
        document.querySelectorAll('.remove-tag').forEach(tag => {
            tag.addEventListener('click', function() {
                removeMedicine(this.dataset.med);
            });
        });

        // Logout
        document.getElementById('btnLogoutDash').addEventListener('click', () => {
            clearPharmacist();
            state.currentPharmacist = null;
            navigateTo('home');
            toast('Déconnecté avec succès', 'success');
        });
    }

    function addMedicine() {
        const input = document.getElementById('newMedInput');
        const med = input.value.trim();
        if (!med) return;

        const pharmacy = state.pharmacies.find(ph => ph.id === state.currentPharmacist.id);
        if (!pharmacy) return;

        if (!pharmacy.medicines) pharmacy.medicines = [];
        if (pharmacy.medicines.find(m => m.toLowerCase() === med.toLowerCase())) {
            toast('Ce médicament existe déjà', 'error');
            return;
        }

        pharmacy.medicines.push(med);
        savePharmacies(state.pharmacies);
        state.currentPharmacist.medicines = pharmacy.medicines;
        state.pharmacies = getStoredPharmacies();
        
        input.value = '';
        renderView('dashboard');
        toast(`"${med}" ajouté`, 'success');
    }

    function removeMedicine(med) {
        const pharmacy = state.pharmacies.find(ph => ph.id === state.currentPharmacist.id);
        if (!pharmacy || !pharmacy.medicines) return;

        pharmacy.medicines = pharmacy.medicines.filter(m => m !== med);
        savePharmacies(state.pharmacies);
        state.currentPharmacist.medicines = pharmacy.medicines;
        state.pharmacies = getStoredPharmacies();
        renderView('dashboard');
        toast(`"${med}" retiré`, 'success');
    }

    function updatePharmacyField(pharmacyId, field, value) {
        const pharmacies = getStoredPharmacies();
        const idx = pharmacies.findIndex(p => p.id === pharmacyId);
        if (idx === -1) return;
        
        pharmacies[idx][field] = value;
        savePharmacies(pharmacies);
        state.pharmacies = pharmacies;
        
        if (state.currentPharmacist && state.currentPharmacist.id === pharmacyId) {
            state.currentPharmacist[field] = value;
            savePharmacist(state.currentPharmacist);
        }
    }

    // ============ PHOTO UPLOAD ============
    function setupPhotoUpload(boxId, inputId, previewId) {
        const box = document.getElementById(boxId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        if (!box || !input) return;

        box.addEventListener('click', () => input.click());

        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Aperçu">`;
                box.classList.add('has-file');
            };
            reader.readAsDataURL(file);
        });
    }

    // ============ LOCATION ============
    function requestLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                state.locationPermission = 'denied';
                toast('Géolocalisation non supportée par votre navigateur', 'error');
                resolve(false);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    state.userLocation = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                    state.locationPermission = 'granted';
                    // Refresh current view
                    renderView(state.currentView);
                    resolve(true);
                },
                (err) => {
                    state.locationPermission = 'denied';
                    console.warn('Geolocation error:', err.message);
                    resolve(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        });
    }

    // ============ UTILITY FUNCTIONS ============
    function haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDistance(km) {
        if (km < 1) return Math.round(km * 1000) + ' m';
        return km.toFixed(1) + ' km';
    }

    function openDirections(lat, lng) {
        const url = `https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`;
        window.open(url, '_blank');
    }

    function findNearestWilaya(lat, lng) {
        // Quick check for major cities
        if (lat > 36.6 && lat < 36.85 && lng > 2.9 && lng < 3.2) return WILAYAS.find(w => w.code === '16');
        if (lat > 35.6 && lat < 35.8 && lng > -0.7 && lng < -0.5) return WILAYAS.find(w => w.code === '31');
        if (lat > 36.3 && lat < 36.4 && lng > 6.5 && lng < 6.7) return WILAYAS.find(w => w.code === '25');
        return WILAYAS.find(w => w.code === '16'); // Default to Alger
    }

    function toast(message, type = '') {
        const toastEl = document.createElement('div');
        toastEl.className = `toast ${type}`;
        toastEl.innerHTML = `
            <span class="material-symbols-rounded" style="font-size:18px">
                ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
            </span>
            <span>${message}</span>
        `;
        dom.toastContainer.appendChild(toastEl);

        setTimeout(() => {
            if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        }, 3000);
    }

    function populateWilayaSelect() {
        const select = document.getElementById('regWilaya');
        if (!select) return;

        WILAYAS.forEach(w => {
            const option = document.createElement('option');
            option.value = w.code;
            option.textContent = `${w.code} - ${w.name}`;
            select.appendChild(option);
        });
    }

    // ============ START APP ============
    init();
});
