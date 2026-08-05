# Pharma-Find DZ

A mobile-first PWA to locate pharmacies, find on-duty ("de garde") pharmacies, check medicine availability, reserve medicines, and manage pharmacy listings — for Algeria.

## Features

### Public (patients)
- **Home** with quick actions and live stats.
- **À Proximité** — map of nearby pharmacies; when location is enabled, the list becomes the **10 nearest pharmacies** sorted by distance.
- **De Garde** — today's on-duty pharmacies (map + list).
- **Recherche Médicament** — search a medicine by name/brand and see which pharmacies stock it.
- **10 Plus Proches** — a focused, ranked view of the 10 closest pharmacies (requires location).
- **Mes Réclamations (Claims)** — reserve a medicine at a pharmacy and track its status
  (`En attente → Confirmée → Prête → Terminée`, or `Refusée`).
- **Menu** (top-right) → Espace Pharmacien / Mes Réclamations / Espace Admin.

### Pharmacist space
- Register a pharmacy (with photos + map pin) → goes into **pending approval**.
- After approval, a dashboard to toggle **de garde** / **public visibility**, manage stocked medicines, and handle incoming **medicine reservations**.

### Admin space
- Code-gated (demo code: `admin2026`).
- Tabs: **À valider** (approve/reject pending pharmacies), **Pharmacies** (toggle garde/public, delete), **Réclamations** (manage every claim's status / delete).

## Data & storage
All data is kept client-side in `localStorage` / `sessionStorage` (demo only — no backend):

| Key | Purpose |
|-----|---------|
| `pharmafind_pharmacies` | Pharmacy records (approved + pending) |
| `pharmafind_pending` | Pending registration submissions |
| `pharmafind_pharmacist` | Currently logged-in pharmacist session |
| `pharmafind_claims` | Medicine reservations |
| `pharmafind_user_id` | Anonymous per-browser id (for "My Claims") |
| `pharmafind_admin` | Admin session flag (sessionStorage) |

## Structure
```
index.html        # App shell, menu sheet, claim modal, pharmacist portal
css/style.css     # Material-3-inspired styles
js/data.js        # Wilayas, medicines, seed pharmacies, storage helpers (claims, admin)
js/app.js         # Router, views (home/finder/garde/search/nearest/claims/admin/dashboard)
manifest.json     # PWA manifest
assets/           # Icons
```

## Run locally
Open `index.html` directly, or serve the folder:
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
> Location, calls and maps require a browser with geolocation + internet access.
