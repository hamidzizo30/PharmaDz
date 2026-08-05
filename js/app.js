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
        nearestMap: null,
        registerMap: null,
        registerMarker: null,
        registerLat: 36.7538,     // default: Alger Centre
        registerLng: 3.0588,
        currentPharmacist: null,
        isAdmin: false,
        adminTab: 'pending',
        claimTargetPharmacyId: null,
        claimResultScroll: 0,
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
        menuSheet: document.getElementById('menuSheet'),
        claimModal: document.getElementById('claimModal'),
    };

    // ============ INIT ============
    function init() {
        state.pharmacies = getStoredPharmacies();
        state.currentPharmacist = getStoredPharmacist();
        state.isAdmin = getAdminSession();
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

        // Menu (opens a sheet with Pharmacien / Claims / Admin)
        dom.btnMenu.addEventListener('click', openMenuSheet);
        document.getElementById('btnCloseMenu').addEventListener('click', closeMenuSheet);
        dom.menuSheet.addEventListener('click', (e) => {
            if (e.target === dom.menuSheet) closeMenuSheet();
        });
        document.querySelectorAll('.menu-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const target = opt.dataset.menu;
                closeMenuSheet();
                if (target === 'pharmacist') {
                    openPharmacistPortal();
                } else if (target === 'claims') {
                    navigateTo('claims');
                } else if (target === 'admin') {
                    navigateTo('admin');
                }
            });
        });

        // Claim modal
        document.getElementById('btnCloseClaim').addEventListener('click', closeClaimModal);
        document.getElementById('formClaim').addEventListener('submit', handleClaimSubmit);
        dom.claimModal.addEventListener('click', (e) => {
            if (e.target === dom.claimModal) closeClaimModal();
        });

        // Delegated click actions inside dynamically-rendered views
        dom.mainContent.addEventListener('click', (e) => {
            const claimBtn = e.target.closest('[data-claim]');
            if (claimBtn) {
                e.stopPropagation();
                openClaimFor(claimBtn.dataset.claim);
                return;
            }
            const dirBtn = e.target.closest('[data-dir]');
            if (dirBtn) {
                e.stopPropagation();
                const parts = dirBtn.dataset.dir.split(',');
                openDirections(parseFloat(parts[0]), parseFloat(parts[1]));
                return;
            }
            const cancelBtn = e.target.closest('[data-cancel-claim]');
            if (cancelBtn) {
                updateClaim(cancelBtn.dataset.cancelClaim, { status: 'rejected' });
                toast('Réservation annulée', 'success');
                renderView(state.currentView);
                return;
            }
            const delClaim = e.target.closest('[data-delete-claim]');
            if (delClaim) {
                deleteClaim(delClaim.dataset.deleteClaim);
                toast('Réservation supprimée', 'success');
                renderView(state.currentView);
                return;
            }
            // Admin: tab switch
            const adminTab = e.target.closest('[data-admin-tab]');
            if (adminTab) {
                state.adminTab = adminTab.dataset.adminTab;
                renderView('admin');
                return;
            }
            // Admin: approve / reject / delete pharmacy
            const approve = e.target.closest('[data-approve]');
            if (approve) {
                approvePharmacy(approve.dataset.approve);
                toast('Pharmacie approuvée et publiée', 'success');
                renderView('admin');
                return;
            }
            const reject = e.target.closest('[data-reject]');
            if (reject) {
                if (confirm('Refuser (supprimer) cette demande de pharmacie ?')) {
                    rejectPharmacy(reject.dataset.reject);
                    toast('Demande refusée', 'success');
                    renderView('admin');
                }
                return;
            }
            const delPharm = e.target.closest('[data-del-pharm]');
            if (delPharm) {
                if (confirm('Supprimer définitivement cette pharmacie ?')) {
                    deletePharmacy(delPharm.dataset.delPharm);
                    toast('Pharmacie supprimée', 'success');
                    renderView('admin');
                }
                return;
            }
            // Admin: toggle garde / public
            const tg = e.target.closest('[data-toggle-garde]');
            if (tg) {
                const id = tg.dataset.toggleGarde;
                const p = getStoredPharmacies().find(x => x.id === id);
                updatePharmacyField(id, 'isGarde', !(p && p.isGarde));
                renderView('admin');
                return;
            }
            const tp = e.target.closest('[data-toggle-public]');
            if (tp) {
                const id = tp.dataset.togglePublic;
                const p = getStoredPharmacies().find(x => x.id === id);
                updatePharmacyField(id, 'isPublic', !(p && p.isPublic));
                renderView('admin');
                return;
            }
            // Admin logout
            const adminLogout = e.target.closest('[data-admin-logout]');
            if (adminLogout) {
                clearAdminSession();
                state.isAdmin = false;
                state.adminTab = 'pending';
                toast('Déconnecté de l\'espace admin', 'success');
                navigateTo('home');
                return;
            }
        });

        // Delegated change events (claim-status <select>s in pharmacist/admin views)
        dom.mainContent.addEventListener('change', (e) => {
            const sel = e.target.closest('[data-claim-status]');
            if (sel) {
                updateClaim(sel.dataset.claimStatus, { status: sel.value });
                toast('Statut de la réservation mis à jour', 'success');
                renderView(state.currentView);
            }
        });

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
        // Hide bottom nav for full-screen account views
        if (view === 'dashboard' || view === 'admin') {
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
            case 'nearest': renderNearestView(); break;
            case 'claims': renderClaimsView(); break;
            case 'admin': renderAdminView(); break;
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
            nearest: '10 Plus Proches',
            claims: 'Mes Réclamations',
            admin: 'Espace Admin',
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
                <div class="quick-action-card" data-action="nearest">
                    <div class="qa-icon location">
                        <span class="material-symbols-rounded">format_list_numbered</span>
                    </div>
                    <div class="qa-title">10 Plus Proches</div>
                    <div class="qa-sub">Les pharmacies autour de vous</div>
                </div>
                <div class="quick-action-card" data-action="finder">
                    <div class="qa-icon location">
                        <span class="material-symbols-rounded">my_location</span>
                    </div>
                    <div class="qa-title">Pharmacies Proches</div>
                    <div class="qa-sub">Carte des pharmacies</div>
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
                <div class="quick-action-card" data-action="claims">
                    <div class="qa-icon claims">
                        <span class="material-symbols-rounded">inventory_2</span>
                    </div>
                    <div class="qa-title">Mes Réclamations</div>
                    <div class="qa-sub">Vos réservations</div>
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
                if (action === 'finder' || action === 'garde' || action === 'search' || action === 'nearest' || action === 'claims') {
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

    function renderPharmacyCard(p, opts) {
        opts = opts || {};
        const showDistance = !!opts.showDistance;
        const rank = opts.rank;

        const distanceText = showDistance && state.userLocation
            ? formatDistance(haversineDistance(state.userLocation.lat, state.userLocation.lng, p.lat, p.lng))
            : '';

        const rankBadge = (rank && rank <= 10)
            ? `<div class="rank-badge">${rank}</div>`
            : '';

        return `
            <div class="pharmacy-card ${rank ? 'ranked' : ''}" data-id="${p.id}">
                ${rankBadge}
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
                        <a href="tel:${p.phone}" class="btn-sm btn-call">
                            <span class="material-symbols-rounded" style="font-size:16px">call</span>
                            Appeler
                        </a>
                        <button class="btn-sm btn-directions" data-dir="${p.lat},${p.lng}">
                            <span class="material-symbols-rounded" style="font-size:16px">directions</span>
                            Itinéraire
                        </button>
                        <button class="btn-sm btn-claim" data-claim="${p.id}">
                            <span class="material-symbols-rounded" style="font-size:16px">inventory_2</span>
                            Réserver
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
                <h3>${state.userLocation ? 'Les 10 plus proches' : 'Toutes les pharmacies'}</h3>
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

    function sortByDistance(arr) {
        if (!state.userLocation) return arr;
        return arr.slice().sort((a, b) => {
            const dA = haversineDistance(state.userLocation.lat, state.userLocation.lng, a.lat, a.lng);
            const dB = haversineDistance(state.userLocation.lat, state.userLocation.lng, b.lat, b.lng);
            return dA - dB;
        });
    }

    function getVisiblePharmacies() {
        let pharmacies = state.pharmacies.filter(p => p.approved && p.isPublic);
        if (state.selectedWilaya) {
            pharmacies = pharmacies.filter(p => p.wilaya === state.selectedWilaya);
        }
        return pharmacies;
    }

    function renderFinderPharmacyList() {
        const listEl = document.getElementById('finderPharmacyList');
        if (!listEl) return;

        const nearestMode = !!state.userLocation;
        let pharmacies = sortByDistance(getVisiblePharmacies());

        if (nearestMode) {
            pharmacies = pharmacies.slice(0, 10); // Nearest 10
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

        listEl.innerHTML = pharmacies.map((p, i) =>
            renderPharmacyCard(p, { showDistance: nearestMode, rank: nearestMode ? (i + 1) : null })
        ).join('');
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
                ` : gardePharmacies.slice(0, 5).map(p => renderPharmacyCard(p, { showDistance: !!state.userLocation })).join('')}
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
                        <div class="search-pharm-row">
                            <span class="search-pharm-loc">
                                📍 ${p.pharmacyName} — ${p.commune}
                                ${p.isGarde ? ' <span style="color:#e65100;font-weight:700;">⚡ Garde</span>' : ''}
                            </span>
                            <button type="button" class="btn-mini-claim" data-claim="${p.id}">
                                <span class="material-symbols-rounded" style="font-size:14px">inventory_2</span>
                                Réserver
                            </button>
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
        const incomingClaims = getClaims().filter(c => c.pharmacyId === p.id);

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
                <h3>
                    <span class="material-symbols-rounded">inventory_2</span> Réservations reçues
                    <span class="count-pill">${incomingClaims.length}</span>
                </h3>
                <div class="claims-list">
                    ${incomingClaims.length === 0
                        ? `<div class="mini-empty">Aucune réservation pour le moment.</div>`
                        : incomingClaims.map(c => renderClaimCard(c, 'manage')).join('')}
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

    // ============ v2: ESCAPE / CLAIM STATUS HELPERS ============
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const CLAIM_STATUS_OPTIONS = ['pending', 'confirmed', 'ready', 'completed', 'rejected'];

    function claimStatusMeta(status) {
        switch (status) {
            case 'confirmed': return { label: 'Confirmée', cls: 'st-confirmed', icon: 'check_circle' };
            case 'ready':     return { label: 'Prête', cls: 'st-ready', icon: 'inventory' };
            case 'completed': return { label: 'Terminée', cls: 'st-completed', icon: 'task_alt' };
            case 'rejected':  return { label: 'Refusée', cls: 'st-rejected', icon: 'cancel' };
            default:          return { label: 'En attente', cls: 'st-pending', icon: 'schedule' };
        }
    }

    // ============ v2: MENU SHEET ============
    function openMenuSheet() {
        dom.menuSheet.classList.add('open');
    }

    function closeMenuSheet() {
        dom.menuSheet.classList.remove('open');
    }

    // ============ v2: CLAIM MODAL ============
    function openClaimFor(pharmacyId) {
        state.claimTargetPharmacyId = pharmacyId;
        const pharmGroup = document.getElementById('claimPharmGroup');
        const nameEl = document.getElementById('claimPharmacyName');
        populateClaimMedList();

        if (pharmacyId) {
            const p = getStoredPharmacies().find(x => x.id === pharmacyId);
            if (pharmGroup) pharmGroup.style.display = 'none';
            nameEl.textContent = p ? `${p.pharmacyName} — ${p.commune}, ${p.wilayaName || ''}` : '';
        } else {
            if (pharmGroup) pharmGroup.style.display = 'flex';
            nameEl.textContent = 'Choisissez une pharmacie ci-dessous';
            populateClaimPharmacySelect();
        }

        dom.claimModal.classList.add('open');
        setTimeout(() => {
            const f = document.getElementById('claimMedicine');
            if (f) f.focus();
        }, 300);
    }

    function closeClaimModal() {
        dom.claimModal.classList.remove('open');
        const form = document.getElementById('formClaim');
        if (form) form.reset();
        state.claimTargetPharmacyId = null;
    }

    function populateClaimMedList() {
        const dl = document.getElementById('claimMedList');
        if (!dl) return;
        dl.innerHTML = COMMON_MEDICINES.map(m =>
            `<option value="${escapeHtml(m.name)}">${m.brand ? m.brand + ' — ' : ''}${escapeHtml(m.name)}</option>`
        ).join('');
    }

    function populateClaimPharmacySelect() {
        const sel = document.getElementById('claimPharmacySelect');
        if (!sel) return;
        sel.innerHTML = '<option value="" disabled selected>Sélectionnez une pharmacie</option>' +
            getStoredPharmacies().filter(p => p.approved && p.isPublic)
                .map(p => `<option value="${p.id}">${escapeHtml(p.pharmacyName)} — ${escapeHtml(p.commune)}</option>`)
                .join('');
    }

    function handleClaimSubmit(e) {
        e.preventDefault();
        let pharmacyId = state.claimTargetPharmacyId;
        if (!pharmacyId) {
            const sel = document.getElementById('claimPharmacySelect');
            pharmacyId = sel ? sel.value : '';
        }
        const pharmacy = getStoredPharmacies().find(p => p.id === pharmacyId);
        if (!pharmacy) { toast('Veuillez choisir une pharmacie', 'error'); return; }

        const medicine = document.getElementById('claimMedicine').value.trim();
        const quantity = parseInt(document.getElementById('claimQuantity').value, 10) || 1;
        const patientName = document.getElementById('claimName').value.trim();
        const phone = document.getElementById('claimPhone').value.trim();
        const note = document.getElementById('claimNote').value.trim();

        if (!medicine) { toast('Indiquez le médicament', 'error'); return; }
        if (!patientName || !phone) { toast('Veuillez remplir votre nom et téléphone', 'error'); return; }

        addClaim({
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.pharmacyName,
            commune: pharmacy.commune,
            wilayaName: pharmacy.wilayaName,
            medicine, quantity, patientName, phone, note,
            claimerId: getUserId(), status: 'pending'
        });

        closeClaimModal();
        toast('Réservation envoyée à la pharmacie', 'success');
        if (state.currentView === 'claims') renderView('claims');
    }

    // ============ v2: NEAREST 10 VIEW ============
    function renderNearestView() {
        if (!state.userLocation) {
            dom.mainContent.innerHTML = `
                <div class="nearest-hero">
                    <span class="material-symbols-rounded">format_list_numbered</span>
                    <h2>Les 10 pharmacies les plus proches</h2>
                    <p>Activez votre localisation pour voir les pharmacies autour de vous, classées par distance.</p>
                    <button class="btn-primary" id="btnNearestLocate">
                        <span class="material-symbols-rounded">my_location</span> Activer la localisation
                    </button>
                </div>`;
            const btn = document.getElementById('btnNearestLocate');
            if (btn) btn.addEventListener('click', () => {
                requestLocation().then(ok => { if (ok) renderView('nearest'); });
            });
            return;
        }

        const all = sortByDistance(getVisiblePharmacies()).slice(0, 10);

        dom.mainContent.innerHTML = `
            <div class="map-wrapper" style="height:36vh">
                <div id="nearestMap"></div>
                <button class="map-fab" id="btnNearestRecenter" title="Ma position">
                    <span class="material-symbols-rounded">my_location</span>
                </button>
            </div>
            <div class="section-header">
                <h3>🏆 Les 10 plus proches</h3>
                <span style="font-size:0.78rem;color:var(--md-on-surface-variant);font-weight:600">${all.length} trouvée(s)</span>
            </div>
            <div class="pharmacy-list" id="nearestList">
                ${all.length === 0
                    ? `<div class="empty-state"><span class="material-symbols-rounded">location_off</span><h3>Aucune pharmacie à proximité</h3><p>Essayez de changer de wilaya.</p></div>`
                    : all.map((p, i) => renderPharmacyCard(p, { showDistance: true, rank: i + 1 })).join('')}
            </div>`;

        setTimeout(() => initNearestMap(), 100);

        const fab = document.getElementById('btnNearestRecenter');
        if (fab) fab.addEventListener('click', () => {
            if (state.nearestMap && state.userLocation) {
                state.nearestMap.setView([state.userLocation.lat, state.userLocation.lng], 14);
            }
        });
    }

    function initNearestMap() {
        const mapEl = document.getElementById('nearestMap');
        if (!mapEl || !state.userLocation) return;
        if (state.nearestMap) { state.nearestMap.remove(); state.nearestMap = null; }
        state.nearestMap = L.map('nearestMap', {
            center: [state.userLocation.lat, state.userLocation.lng],
            zoom: 13, zoomControl: true, attributionControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.nearestMap);
        addPharmacyMarkers(state.nearestMap);
        setTimeout(() => { if (state.nearestMap) state.nearestMap.invalidateSize(); }, 250);
    }

    // ============ v2: CLAIMS VIEW ============
    function renderClaimsView() {
        const userId = getUserId();
        const myClaims = getClaims().filter(c => c.claimerId === userId);
        const activeCount = myClaims.filter(c => !['completed', 'rejected'].includes(c.status)).length;

        dom.mainContent.innerHTML = `
            <div class="claims-header">
                <div class="claims-icon"><span class="material-symbols-rounded">inventory_2</span></div>
                <h2>Mes Réclamations</h2>
                <p>${myClaims.length} réservation(s) • ${activeCount} en cours</p>
            </div>
            <div class="dashboard-section">
                <button class="btn-primary btn-full" id="btnNewClaim">
                    <span class="material-symbols-rounded">add</span> Nouvelle réservation
                </button>
            </div>
            <div class="claims-list" id="claimsList">
                ${myClaims.length === 0
                    ? `<div class="empty-state"><span class="material-symbols-rounded">inventory_2</span><h3>Aucune réservation</h3><p>Réservez un médicament depuis une pharmacie ou la recherche pour le retrouver ici.</p></div>`
                    : myClaims.map(c => renderClaimCard(c, 'user')).join('')}
            </div>`;

        document.getElementById('btnNewClaim').addEventListener('click', () => openClaimFor(null));
    }

    function renderClaimCard(claim, context) {
        const meta = claimStatusMeta(claim.status);
        const date = new Date(claim.createdAt).toLocaleString('fr-FR',
            { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

        let actions = '';
        if (context === 'user') {
            const cancellable = !['completed', 'rejected'].includes(claim.status);
            actions = cancellable
                ? `<button class="btn-sm btn-cancel-claim" data-cancel-claim="${claim.id}">Annuler la réservation</button>`
                : '';
        } else {
            actions = `
                <select class="claim-status-select" data-claim-status="${claim.id}">
                    ${CLAIM_STATUS_OPTIONS.map(s => `<option value="${s}" ${s === claim.status ? 'selected' : ''}>${claimStatusMeta(s).label}</option>`).join('')}
                </select>
                <button class="btn-icon-x" data-delete-claim="${claim.id}" title="Supprimer">
                    <span class="material-symbols-rounded">delete</span>
                </button>`;
        }

        return `
            <div class="claim-card">
                <div class="claim-card-top">
                    <div class="claim-med">
                        <span class="material-symbols-rounded claim-med-icon">pill</span>
                        <div>
                            <div class="claim-med-name">${escapeHtml(claim.medicine)} <span class="claim-qty">×${claim.quantity}</span></div>
                            <div class="claim-pharm">📍 ${escapeHtml(claim.pharmacyName)}${claim.commune ? ' — ' + escapeHtml(claim.commune) : ''}</div>
                        </div>
                    </div>
                    <span class="claim-status-badge ${meta.cls}">
                        <span class="material-symbols-rounded" style="font-size:14px">${meta.icon}</span>${meta.label}
                    </span>
                </div>
                <div class="claim-meta">
                    <span><span class="material-symbols-rounded">person</span>${escapeHtml(claim.patientName || '—')}</span>
                    ${claim.phone ? `<a href="tel:${escapeHtml(claim.phone)}"><span class="material-symbols-rounded">call</span>${escapeHtml(claim.phone)}</a>` : ''}
                    <span><span class="material-symbols-rounded">schedule</span>${date}</span>
                </div>
                ${claim.note ? `<div class="claim-note"><span class="material-symbols-rounded">notes</span>${escapeHtml(claim.note)}</div>` : ''}
                ${actions ? `<div class="claim-actions">${actions}</div>` : ''}
            </div>`;
    }

    // ============ v2: ADMIN VIEW ============
    function renderAdminView() {
        if (!state.isAdmin) { renderAdminLogin(); return; }
        renderAdminDashboard();
    }

    function renderAdminLogin() {
        dom.mainContent.innerHTML = `
            <div class="admin-login">
                <div class="admin-login-icon"><span class="material-symbols-rounded">admin_panel_settings</span></div>
                <h2>Espace Administrateur</h2>
                <p class="portal-sub">Connectez-vous pour valider les pharmacies et gérer les réclamations.</p>
                <form id="formAdminLogin" class="portal-form" autocomplete="off">
                    <div class="input-group">
                        <span class="material-symbols-rounded input-icon">vpn_key</span>
                        <input type="password" id="adminCode" placeholder="Code d'accès admin" required>
                    </div>
                    <button type="submit" class="btn-primary btn-full">
                        <span>Se connecter</span><span class="material-symbols-rounded">arrow_forward</span>
                    </button>
                </form>
                <p class="admin-hint"><span class="material-symbols-rounded">info</span> Code de démonstration : <b>admin2026</b></p>
            </div>`;

        document.getElementById('formAdminLogin').addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('adminCode').value.trim();
            if (code === ADMIN_CODE) {
                saveAdminSession();
                state.isAdmin = true;
                toast("Bienvenue dans l'espace admin", 'success');
                renderView('admin');
            } else {
                toast("Code d'accès incorrect", 'error');
            }
        });
    }

    function renderAdminDashboard() {
        const pharmacies = getStoredPharmacies();
        const approved = pharmacies.filter(p => p.approved);
        const pending = pharmacies.filter(p => !p.approved);
        const claims = getClaims();
        const gardeCount = approved.filter(p => p.isGarde).length;
        const tab = state.adminTab || 'pending';

        const tabs = [
            { id: 'pending', label: 'À valider', count: pending.length, icon: 'pending_actions' },
            { id: 'pharmacies', label: 'Pharmacies', count: approved.length, icon: 'local_pharmacy' },
            { id: 'claims', label: 'Réclamations', count: claims.length, icon: 'inventory_2' }
        ];

        let content = '';
        if (tab === 'pending') {
            content = pending.length === 0
                ? emptyAdmin('Aucune pharmacie à valider', 'Toutes les demandes ont été traitées.', 'verified')
                : pending.map(p => adminPendingCard(p)).join('');
        } else if (tab === 'pharmacies') {
            content = approved.length === 0
                ? emptyAdmin('Aucune pharmacie', 'Aucune pharmacie approuvée.', 'local_pharmacy')
                : approved.map(p => adminPharmacyRow(p)).join('');
        } else {
            content = claims.length === 0
                ? emptyAdmin('Aucune réclamation', 'Aucune réservation à traiter.', 'inventory_2')
                : claims.map(c => renderClaimCard(c, 'manage')).join('');
        }

        dom.mainContent.innerHTML = `
            <div class="admin-header">
                <div class="dashboard-avatar"><span class="material-symbols-rounded">admin_panel_settings</span></div>
                <h2>Espace Administrateur</h2>
                <div class="admin-stats">
                    <div><b>${approved.length}</b><span>Approuvées</span></div>
                    <div><b>${pending.length}</b><span>En attente</span></div>
                    <div><b>${gardeCount}</b><span>De garde</span></div>
                    <div><b>${claims.length}</b><span>Réclamations</span></div>
                </div>
            </div>
            <div class="admin-tabs">
                ${tabs.map(t => `
                    <button class="admin-tab ${t.id === tab ? 'active' : ''}" data-admin-tab="${t.id}">
                        <span class="material-symbols-rounded" style="font-size:18px">${t.icon}</span>
                        ${t.label} <span class="count-pill">${t.count}</span>
                    </button>`).join('')}
            </div>
            <div class="admin-content">${content}</div>
            <div class="dashboard-section">
                <button class="btn-outline btn-full" data-admin-logout="1">
                    <span class="material-symbols-rounded">logout</span> Déconnexion
                </button>
            </div>`;
    }

    function emptyAdmin(title, sub, icon) {
        return `<div class="empty-state"><span class="material-symbols-rounded">${icon}</span><h3>${title}</h3><p>${sub}</p></div>`;
    }

    function adminPendingCard(p) {
        return `
            <div class="admin-card">
                <div class="admin-card-head">
                    <div class="admin-card-title">${escapeHtml(p.pharmacyName)}</div>
                    ${p.isGarde ? '<span class="mini-badge garde">Garde</span>' : ''}
                </div>
                <div class="admin-card-meta">
                    <span><span class="material-symbols-rounded">person</span>${escapeHtml(p.pharmacistName || '')}</span>
                    <span><span class="material-symbols-rounded">call</span>${escapeHtml(p.phone || '')}</span>
                    <span><span class="material-symbols-rounded">location_on</span>${escapeHtml(p.commune || '')}, ${escapeHtml(p.wilayaName || '')}</span>
                    ${(p.pharmacistEmail || p.contactEmail) ? `<span><span class="material-symbols-rounded">email</span>${escapeHtml(p.pharmacistEmail || p.contactEmail)}</span>` : ''}
                </div>
                <div class="admin-card-actions">
                    <button class="btn-sm btn-approve" data-approve="${p.id}"><span class="material-symbols-rounded" style="font-size:16px">check</span>Approuver</button>
                    <button class="btn-sm btn-reject" data-reject="${p.id}"><span class="material-symbols-rounded" style="font-size:16px">close</span>Refuser</button>
                </div>
            </div>`;
    }

    function adminPharmacyRow(p) {
        return `
            <div class="admin-card">
                <div class="admin-card-head">
                    <div class="admin-card-title">${escapeHtml(p.pharmacyName)}</div>
                    ${p.isGarde ? '<span class="mini-badge garde">Garde</span>' : ''}
                    ${!p.isPublic ? '<span class="mini-badge muted">Masquée</span>' : ''}
                </div>
                <div class="admin-card-meta">
                    <span><span class="material-symbols-rounded">location_on</span>${escapeHtml(p.commune || '')}, ${escapeHtml(p.wilayaName || '')}</span>
                    <span><span class="material-symbols-rounded">call</span>${escapeHtml(p.phone || '')}</span>
                </div>
                <div class="admin-toggle-row">
                    <span class="admin-toggle-label">Pharmacie de garde</span>
                    <div class="toggle-switch ${p.isGarde ? 'active' : ''}" data-toggle-garde="${p.id}"></div>
                </div>
                <div class="admin-toggle-row">
                    <span class="admin-toggle-label">Visible publiquement</span>
                    <div class="toggle-switch ${p.isPublic ? 'active' : ''}" data-toggle-public="${p.id}"></div>
                </div>
                <div class="admin-card-actions">
                    <button class="btn-sm btn-reject" data-del-pharm="${p.id}"><span class="material-symbols-rounded" style="font-size:16px">delete</span>Supprimer</button>
                </div>
            </div>`;
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
