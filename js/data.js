/* ============================================================
   Pharma-Find DZ — Data Layer
   ============================================================ */

const WILAYAS = [
    { code: "01", name: "Adrar" },
    { code: "02", name: "Chlef" },
    { code: "03", name: "Laghouat" },
    { code: "04", name: "Oum El Bouaghi" },
    { code: "05", name: "Batna" },
    { code: "06", name: "Béjaïa" },
    { code: "07", name: "Biskra" },
    { code: "08", name: "Béchar" },
    { code: "09", name: "Blida" },
    { code: "10", name: "Bouira" },
    { code: "11", name: "Tamanrasset" },
    { code: "12", name: "Tébessa" },
    { code: "13", name: "Tlemcen" },
    { code: "14", name: "Tiaret" },
    { code: "15", name: "Tizi Ouzou" },
    { code: "16", name: "Alger" },
    { code: "17", name: "Djelfa" },
    { code: "18", name: "Jijel" },
    { code: "19", name: "Sétif" },
    { code: "20", name: "Saïda" },
    { code: "21", name: "Skikda" },
    { code: "22", name: "Sidi Bel Abbès" },
    { code: "23", name: "Annaba" },
    { code: "24", name: "Guelma" },
    { code: "25", name: "Constantine" },
    { code: "26", name: "Médéa" },
    { code: "27", name: "Mostaganem" },
    { code: "28", name: "M'sila" },
    { code: "29", name: "Mascara" },
    { code: "30", name: "Ouargla" },
    { code: "31", name: "Oran" },
    { code: "32", name: "El Bayadh" },
    { code: "33", name: "Illizi" },
    { code: "34", name: "Bordj Bou Arréridj" },
    { code: "35", name: "Boumerdès" },
    { code: "36", name: "El Tarf" },
    { code: "37", name: "Tindouf" },
    { code: "38", name: "Tissemsilt" },
    { code: "39", name: "El Oued" },
    { code: "40", name: "Khenchela" },
    { code: "41", name: "Souk Ahras" },
    { code: "42", name: "Tipaza" },
    { code: "43", name: "Mila" },
    { code: "44", name: "Aïn Defla" },
    { code: "45", name: "Naâma" },
    { code: "46", name: "Aïn Témouchent" },
    { code: "47", name: "Ghardaïa" },
    { code: "48", name: "Relizane" },
    { code: "49", name: "El M'ghair" },
    { code: "50", name: "El Meniaa" },
    { code: "51", name: "Ouled Djellal" },
    { code: "52", name: "Bordj Baji Mokhtar" },
    { code: "53", name: "Béni Abbès" },
    { code: "54", name: "Timimoun" },
    { code: "55", name: "Touggourt" },
    { code: "56", name: "Djanet" },
    { code: "57", name: "In Salah" },
    { code: "58", name: "In Guezzam" }
];

const COMMON_MEDICINES = [
    { name: "Paracétamol", brand: "Doliprane®", category: "Antalgique" },
    { name: "Amoxicilline", brand: "Clamoxyl®", category: "Antibiotique" },
    { name: "Ibuprofène", brand: "Advil®", category: "Anti-inflammatoire" },
    { name: "Oméprazole", brand: "Mopral®", category: "Gastrique" },
    { name: "Metformine", brand: "Glucophage®", category: "Antidiabétique" },
    { name: "Salbutamol", brand: "Ventoline®", category: "Asthme" },
    { name: "Lévothyroxine", brand: "Levothyrox®", category: "Thyroïde" },
    { name: "Amlodipine", brand: "Amlor®", category: "Antihypertenseur" },
    { name: "Atorvastatine", brand: "Tahor®", category: "Hypolipémiant" },
    { name: "Insuline Glargine", brand: "Lantus®", category: "Diabète" },
    { name: "Azithromycine", brand: "Zithromax®", category: "Antibiotique" },
    { name: "Cétirizine", brand: "Zyrtec®", category: "Antihistaminique" },
    { name: "Vitamine D3", brand: "ZymaD®", category: "Vitamine" },
    { name: "Phloroglucinol", brand: "Spasfon®", category: "Antispasmodique" },
    { name: "Prednisone", brand: "Cortancyl®", category: "Corticoïde" }
];

/* ============================================================
   SEED PHARMACIES (mock data for demo)
   ============================================================ */
const SEED_PHARMACIES = [
    {
        id: "ph-001",
        pharmacyName: "Pharmacie Centrale Kouba",
        pharmacistName: "Dr. Benali Mohamed",
        address: "Avenue Mohamed Boudiaf, Kouba",
        commune: "Kouba",
        wilaya: "16",
        wilayaName: "Alger",
        phone: "+213 23 70 12 34",
        lat: 36.7225,
        lng: 3.0850,
        isGarde: true,
        isPublic: true,
        approved: true,
        medicines: ["Paracétamol", "Amoxicilline", "Ibuprofène", "Oméprazole"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-002",
        pharmacyName: "Pharmacie El Hikma",
        pharmacistName: "Dr. Ferhati Amina",
        address: "Rue Didouche Mourad, Alger Centre",
        commune: "Alger Centre",
        wilaya: "16",
        wilayaName: "Alger",
        phone: "+213 21 64 55 78",
        lat: 36.7588,
        lng: 3.0530,
        isGarde: true,
        isPublic: true,
        approved: true,
        medicines: ["Metformine", "Salbutamol", "Insuline Glargine"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-003",
        pharmacyName: "Pharmacie Ben Aknoun",
        pharmacistName: "Dr. Saadi Karim",
        address: "Cité El Qods, Ben Aknoun",
        commune: "Ben Aknoun",
        wilaya: "16",
        wilayaName: "Alger",
        phone: "+213 23 28 91 45",
        lat: 36.7464,
        lng: 3.0100,
        isGarde: false,
        isPublic: true,
        approved: true,
        medicines: ["Lévothyroxine", "Amlodipine", "Vitamine D3", "Azithromycine"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-004",
        pharmacyName: "Pharmacie du Peuple",
        pharmacistName: "Dr. Merabet Leila",
        address: "Boulevard Amirouche, Bab El Oued",
        commune: "Bab El Oued",
        wilaya: "16",
        wilayaName: "Alger",
        phone: "+213 21 97 33 21",
        lat: 36.7840,
        lng: 3.0485,
        isGarde: true,
        isPublic: true,
        approved: true,
        medicines: ["Paracétamol", "Cétirizine", "Phloroglucinol", "Prednisone"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-005",
        pharmacyName: "Pharmacie Sidi Yahia",
        pharmacistName: "Dr. Touati Samir",
        address: "Rue des Frères Bouadou, Hydra",
        commune: "Hydra",
        wilaya: "16",
        wilayaName: "Alger",
        phone: "+213 23 48 77 09",
        lat: 36.7400,
        lng: 3.0340,
        isGarde: false,
        isPublic: true,
        approved: true,
        medicines: ["Atorvastatine", "Oméprazole", "Amoxicilline"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-006",
        pharmacyName: "Pharmacie Les Orangers",
        pharmacistName: "Dr. Boudiaf Nadia",
        address: "Cité 500 Logements, Oran Centre",
        commune: "Oran",
        wilaya: "31",
        wilayaName: "Oran",
        phone: "+213 41 33 22 11",
        lat: 35.6971,
        lng: -0.6308,
        isGarde: true,
        isPublic: true,
        approved: true,
        medicines: ["Paracétamol", "Ibuprofène", "Salbutamol", "Cétirizine"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-007",
        pharmacyName: "Pharmacie Sidi Mabrouk",
        pharmacistName: "Dr. Zerrouki Hichem",
        address: "Route de Batna, Sidi Mabrouk",
        commune: "Constantine",
        wilaya: "25",
        wilayaName: "Constantine",
        phone: "+213 31 64 88 33",
        lat: 36.3500,
        lng: 6.6130,
        isGarde: true,
        isPublic: true,
        approved: true,
        medicines: ["Metformine", "Lévothyroxine", "Atorvastatine", "Insuline Glargine"],
        photoOutside: null,
        photoInside: null
    },
    {
        id: "ph-008",
        pharmacyName: "Pharmacie El Feth",
        pharmacistName: "Dr. Djebbour Fatima",
        address: "Cité El Feth, Sétif",
        commune: "Sétif",
        wilaya: "19",
        wilayaName: "Sétif",
        phone: "+213 36 91 44 22",
        lat: 36.1900,
        lng: 5.4100,
        isGarde: false,
        isPublic: true,
        approved: true,
        medicines: ["Amoxicilline", "Azithromycine", "Prednisone", "Vitamine D3"],
        photoOutside: null,
        photoInside: null
    }
];

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
function getStoredPharmacies() {
    try {
        const stored = localStorage.getItem('pharmafind_pharmacies');
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    // Initialize with seed data
    localStorage.setItem('pharmafind_pharmacies', JSON.stringify(SEED_PHARMACIES));
    return [...SEED_PHARMACIES];
}

function savePharmacies(list) {
    localStorage.setItem('pharmafind_pharmacies', JSON.stringify(list));
}

function getStoredPharmacist() {
    try {
        const stored = localStorage.getItem('pharmafind_pharmacist');
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return null;
}

function savePharmacist(data) {
    localStorage.setItem('pharmafind_pharmacist', JSON.stringify(data));
}

function clearPharmacist() {
    localStorage.removeItem('pharmafind_pharmacist');
}

function getPendingRegistrations() {
    try {
        const stored = localStorage.getItem('pharmafind_pending');
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
}

function savePendingRegistration(data) {
    const pending = getPendingRegistrations();
    pending.push(data);
    localStorage.setItem('pharmafind_pending', JSON.stringify(pending));
}
