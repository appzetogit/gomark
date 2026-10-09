/**
 * Seed realistic DEMO data for every vertical of the super-app, into a fresh
 * `gomark` database.
 *
 * Run:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/gomark node scripts/seed-demo-all.js            # dry run (default)
 *   MONGODB_URI=mongodb://127.0.0.1:27017/gomark node scripts/seed-demo-all.js --apply    # write
 *
 * Optional: --only=food,qc,taxi,sp,medical   run a subset of modules.
 *
 * Safety rules (deliberate, do not loosen):
 *  - Reads ONLY process.env.MONGODB_URI. dotenv is NOT loaded, so a stray .env
 *    pointing at a live cluster can never be picked up by accident.
 *  - Refuses to run unless the database named in the URI path is exactly
 *    `gomark`, and re-checks the connected database name after connecting.
 *  - Additive only. Nothing is dropped or deleted. Documents this script did not
 *    create are never modified, with two explicit exceptions the operator asked
 *    for: the pre-seeded demo restaurant (phone 9009925021) and the pre-seeded
 *    taxi driver (phone 7974161582) get MISSING fields filled in (zone, location,
 *    vehicle type) -- fields that already hold a value are left alone.
 *  - Idempotent. Every document is looked up by a stable demo key (an
 *    @gomark.demo email, a name, a slug, a coupon code, a demo publicId...) and
 *    only created when absent. Existing matches are reported, not rewritten.
 *  - Every new document goes through the app's real Mongoose model and is
 *    validated with `doc.validate()` even in dry-run, so a schema mismatch shows
 *    up before anything is written.
 *  - autoIndex/autoCreate are off for this connection: the app builds its own
 *    indexes at boot, and a seed script should not be the thing that does it.
 *
 * Demo identities: phones 98000000xx (people/stores), 98765432xx (SP vendors),
 * emails ending @gomark.demo. No real personal data.
 */
// mongoose is imported inside main(), after the URI guard has passed.
let mongoose;
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* ------------------------------------------------------------------ */
/* CLI + guards                                                        */
/* ------------------------------------------------------------------ */

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
if (APPLY && ARGS.includes('--dry-run')) {
    console.error('Pass either --apply or --dry-run, not both.');
    process.exit(2);
}
const ONLY = (() => {
    const flag = ARGS.find((a) => a.startsWith('--only='));
    if (!flag) return null;
    return new Set(flag.slice('--only='.length).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
})();

const REQUIRED_DB = 'gomark';

const dbNameFromUri = (uri) => {
    // Not `new URL()`: a replica-set URI (h1:27017,h2:27017) is not a valid
    // WHATWG URL. Authority runs to the first '/', the path to '?'.
    const m = String(uri).match(/^mongodb(?:\+srv)?:\/\/[^/?#]+\/([^?#]*)/i);
    if (!m) return '';
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return m[1];
    }
};

const URI = process.env.MONGODB_URI;
if (!URI) {
    console.error('MONGODB_URI is not set. Example: MONGODB_URI=mongodb://127.0.0.1:27017/gomark');
    process.exit(2);
}
const URI_DB = dbNameFromUri(URI);
if (URI_DB !== REQUIRED_DB) {
    console.error(`Refusing to run: database in MONGODB_URI is "${URI_DB || '(none)'}", expected exactly "${REQUIRED_DB}".`);
    process.exit(2);
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const DEMO_EMAIL_DOMAIN = 'gomark.demo';
const NOW = new Date();
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactI = (s) => new RegExp(`^${escapeRegex(String(s).trim())}$`, 'i');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const demoEmail = (local) => `${slugify(local)}@${DEMO_EMAIL_DOMAIN}`;
const img = (id) => `https://images.unsplash.com/${id}?w=800&q=70`;

/** Per-collection counters, printed at the end. */
const STATS = new Map();
const bump = (collection, key) => {
    if (!STATS.has(collection)) STATS.set(collection, { created: 0, existing: 0, updated: 0, skipped: 0 });
    STATS.get(collection)[key] += 1;
};
const collOf = (Model) => Model?.collection?.collectionName || Model?.modelName || 'unknown';

const log = (...a) => console.log('  ', ...a);

/**
 * Find-or-create through the real model.
 *  - `filter`   stable demo key; a match is reported as existing and returned untouched.
 *  - `build`    plain object (or fn returning one) for a new document.
 *  - `conflict` optional filter for a unique field (phone/email): a match there
 *               that is NOT ours means someone else owns it -> skip, never touch.
 * Returns a plain object with an _id (in dry-run the _id is fresh and unsaved).
 */
async function ensure(Model, filter, build, { label, conflict } = {}) {
    const coll = collOf(Model);
    const name = label || JSON.stringify(filter);
    const existing = await Model.findOne(filter).lean();
    if (existing) {
        bump(coll, 'existing');
        log(`= ${coll.padEnd(30)} exists   ${name}`);
        return existing;
    }
    if (conflict) {
        const clash = await Model.findOne(conflict).select('_id').lean();
        if (clash) {
            bump(coll, 'skipped');
            log(`! ${coll.padEnd(30)} SKIPPED  ${name} -- ${JSON.stringify(conflict)} already used by ${clash._id}`);
            return null;
        }
    }
    const doc = new Model(typeof build === 'function' ? build() : build);
    await doc.validate();
    if (!APPLY) {
        bump(coll, 'created');
        log(`+ ${coll.padEnd(30)} would create ${name}`);
        return doc.toObject();
    }
    await doc.save();
    bump(coll, 'created');
    log(`+ ${coll.padEnd(30)} created  ${name}`);
    return doc.toObject();
}

/**
 * Fill ONLY empty fields on a document this script does not own.
 * `wanted` is { path: value }; a path is written only when currently null,
 * undefined, '' or an empty array.
 */
async function fillMissing(Model, doc, wanted, label) {
    const coll = collOf(Model);
    const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    const $set = {};
    for (const [path, value] of Object.entries(wanted)) {
        const cur = get(doc, path);
        const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0);
        if (empty && value !== undefined) $set[path] = value;
    }
    const keys = Object.keys($set);
    if (!keys.length) {
        bump(coll, 'existing');
        log(`= ${coll.padEnd(30)} unchanged ${label} (nothing missing)`);
        return;
    }
    if (APPLY) await Model.updateOne({ _id: doc._id }, { $set });
    bump(coll, 'updated');
    log(`~ ${coll.padEnd(30)} ${APPLY ? 'filled' : 'would fill'} ${label}: ${keys.join(', ')}`);
}

/** Axis-aligned box around a centre, in degrees. */
const box = (lat, lng, dLat = 0.15, dLng = 0.18) => ({
    // food/qc/medical zone shape: [{latitude, longitude}]
    latLngList: [
        { latitude: lat + dLat, longitude: lng - dLng },
        { latitude: lat + dLat, longitude: lng + dLng },
        { latitude: lat - dLat, longitude: lng + dLng },
        { latitude: lat - dLat, longitude: lng - dLng },
    ],
    // GeoJSON Polygon ring: [lng, lat], closed
    geoJsonRing: [[
        [lng - dLng, lat + dLat],
        [lng + dLng, lat + dLat],
        [lng + dLng, lat - dLat],
        [lng - dLng, lat - dLat],
        [lng - dLng, lat + dLat],
    ]],
});

const CITIES = {
    bhopal: { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
    indore: { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
    nagpur: { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
};

/** Address block used by food + qc sellers (both GeoJSON and flat lat/lng). */
const sellerAddress = ({ lat, lng, area, pincode, line1 }, city = CITIES.bhopal) => {
    const address = `${line1}, ${area}, ${city.name}`;
    return {
        addressLine1: line1,
        area,
        city: city.name,
        state: city.state,
        pincode,
        location: {
            type: 'Point',
            coordinates: [lng, lat],
            latitude: lat,
            longitude: lng,
            formattedAddress: `${address}, ${city.state} ${pincode}`,
            address,
            addressLine1: line1,
            area,
            city: city.name,
            state: city.state,
            pincode,
        },
    };
};

const weekTimings = (open = '09:00', close = '23:00') =>
    DAYS.map((day) => ({ day, isOpen: true, openingTime: open, closingTime: close }));

/** Lazy model loading, so nothing is imported before the URI guard passes. */
const M = {};
async function loadModels() {
    const imp = (p) => import(new URL(p, import.meta.url).href);
    const food = '../src/modules/food';
    const qc = '../src/modules/quickCommerce/modules/food';
    const taxi = '../src/modules/taxi';

    M.FoodZone = (await imp(`${food}/admin/models/zone.model.js`)).FoodZone;
    M.FoodCategory = (await imp(`${food}/admin/models/category.model.js`)).FoodCategory;
    M.FoodItem = (await imp(`${food}/admin/models/food.model.js`)).FoodItem;
    M.FoodOffer = (await imp(`${food}/admin/models/offer.model.js`)).FoodOffer;
    M.FoodRestaurant = (await imp(`${food}/restaurant/models/restaurant.model.js`)).FoodRestaurant;
    M.FoodOutletTimings = (await imp(`${food}/restaurant/models/outletTimings.model.js`)).FoodRestaurantOutletTimings;
    M.FoodHeroBanner = (await imp(`${food}/landing/models/heroBanner.model.js`)).FoodHeroBanner;

    M.QCZone = (await imp(`${qc}/admin/models/zone.model.js`)).QCZone;
    M.MedicalZone = (await imp(`${qc}/admin/models/medicalZone.model.js`)).MedicalZone;
    M.QCCategory = (await imp(`${qc}/admin/models/category.model.js`)).FoodCategory; // model QCCategory -> qc_categories
    M.QCItem = (await imp(`${qc}/admin/models/food.model.js`)).FoodItem; // model QCItem -> qc_items
    M.QCRestaurant = (await imp(`${qc}/restaurant/models/restaurant.model.js`)).FoodRestaurant; // QCRestaurant -> qc_restaurants
    M.QCOutletTimings = (await imp(`${qc}/restaurant/models/outletTimings.model.js`)).FoodRestaurantOutletTimings;

    M.TaxiZone = (await imp(`${taxi}/driver/models/Zone.js`)).Zone;
    M.TaxiDriver = (await imp(`${taxi}/driver/models/Driver.js`)).Driver;
    M.TaxiServiceLocation = (await imp(`${taxi}/admin/models/ServiceLocation.js`)).ServiceLocation;
    M.TaxiTransportType = (await imp(`${taxi}/admin/models/TaxiTransportType.js`)).default;
    M.TaxiVehicle = (await imp(`${taxi}/admin/models/Vehicle.js`)).Vehicle;
    M.TaxiSetPrice = (await imp(`${taxi}/admin/models/SetPrice.js`)).SetPrice;
    M.TaxiDriverNeededDocument = (await imp(`${taxi}/admin/models/DriverNeededDocument.js`)).DriverNeededDocument;

    // Service provider is CommonJS (its own package.json).
    M.SPCategory = require('../src/modules/serviceProvider/models/Category.js');
    M.SPVendor = require('../src/modules/serviceProvider/models/Vendor.js');
    M.SPWorker = require('../src/modules/serviceProvider/models/Worker.js');
}

/* ------------------------------------------------------------------ */
/* 1. FOOD                                                             */
/* ------------------------------------------------------------------ */

const FOOD_CATEGORIES = [
    { name: 'Starters', foodTypeScope: 'Both', image: img('photo-1601050690597-df0568f70950') },
    { name: 'Main Course', foodTypeScope: 'Both', image: img('photo-1565557623262-b51c2513a641') },
    { name: 'Biryani', foodTypeScope: 'Both', image: img('photo-1563379091339-03b21ab4a4f8') },
    { name: 'Pizza', foodTypeScope: 'Both', image: img('photo-1513104890138-7c749659a591') },
    { name: 'Burgers', foodTypeScope: 'Both', image: img('photo-1568901346375-23c9450c58cd') },
    { name: 'South Indian', foodTypeScope: 'Veg', image: img('photo-1589301760014-d929f3979dbc') },
    { name: 'Street Food', foodTypeScope: 'Veg', image: img('photo-1601050690597-df0568f70950') },
    { name: 'Desserts', foodTypeScope: 'Veg', image: img('photo-1551024601-bec78aea704b') },
    { name: 'Beverages', foodTypeScope: 'Veg', image: img('photo-1544145945-f90425340c7e') },
];
const catImage = Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.name, c.image]));

// [name, category, price, foodType, description]
const V = 'Veg';
const NV = 'Non-Veg';
const FOOD_RESTAURANTS = [
    {
        restaurantName: 'Bhopali Zaika',
        ownerName: 'Demo Owner Zaika',
        phone: '9800000001',
        pureVeg: false,
        cuisines: ['North Indian', 'Mughlai'],
        addr: { lat: 23.2332, lng: 77.4343, area: 'MP Nagar Zone 1', pincode: '462011', line1: 'Plot 12, Press Complex Road' },
        eta: '30-35 mins',
        rating: 4.3,
        menu: [
            ['Paneer Tikka', 'Starters', 249, V, 'Cottage cheese cubes marinated in spiced yoghurt, char-grilled.'],
            ['Chicken Seekh Kebab', 'Starters', 299, NV, 'Minced chicken skewers off the tandoor.'],
            ['Dal Makhani', 'Main Course', 229, V, 'Black lentils slow-cooked overnight with butter and cream.'],
            ['Butter Chicken', 'Main Course', 329, NV, 'Tandoori chicken in a tomato-butter gravy.'],
            ['Mutton Rogan Josh', 'Main Course', 399, NV, 'Kashmiri-style mutton curry.'],
            ['Chicken Dum Biryani', 'Biryani', 319, NV, 'Basmati and chicken layered and sealed for dum.'],
            ['Gulab Jamun (2 pcs)', 'Desserts', 89, V, 'Warm milk-solid dumplings in rose syrup.'],
            ['Sweet Lassi', 'Beverages', 79, V, 'Thick churned yoghurt drink.'],
        ],
    },
    {
        restaurantName: 'Shree Sagar Veg',
        ownerName: 'Demo Owner Sagar',
        phone: '9800000002',
        pureVeg: true,
        cuisines: ['South Indian', 'North Indian'],
        addr: { lat: 23.2335, lng: 77.4005, area: 'New Market, TT Nagar', pincode: '462003', line1: 'Shop 4, Bhadbhada Road' },
        eta: '20-25 mins',
        rating: 4.5,
        menu: [
            ['Masala Dosa', 'South Indian', 129, V, 'Crisp rice crepe with spiced potato filling.'],
            ['Idli Sambar (3 pcs)', 'South Indian', 89, V, 'Steamed rice cakes with sambar and chutney.'],
            ['Medu Vada (2 pcs)', 'South Indian', 79, V, 'Crisp lentil doughnuts.'],
            ['Rava Uttapam', 'South Indian', 139, V, 'Semolina pancake topped with onion and tomato.'],
            ['Veg Thali', 'Main Course', 199, V, 'Two sabzis, dal, rice, roti, salad and sweet.'],
            ['Paneer Butter Masala', 'Main Course', 239, V, 'Paneer in a rich tomato gravy.'],
            ['Rasmalai (2 pcs)', 'Desserts', 99, V, 'Soft chenna discs in saffron milk.'],
            ['Filter Coffee', 'Beverages', 49, V, 'South Indian decoction coffee.'],
        ],
    },
    {
        restaurantName: 'Lakeview Pizza Co.',
        ownerName: 'Demo Owner Lakeview',
        phone: '9800000003',
        pureVeg: false,
        cuisines: ['Pizza', 'Italian', 'Fast Food'],
        addr: { lat: 23.2457, lng: 77.3905, area: 'Shyamla Hills', pincode: '462013', line1: '22, Lake Drive Road' },
        eta: '35-40 mins',
        rating: 4.1,
        menu: [
            ['Margherita Pizza (Medium)', 'Pizza', 299, V, 'Tomato, mozzarella and basil.'],
            ['Farmhouse Pizza (Medium)', 'Pizza', 379, V, 'Onion, capsicum, mushroom and tomato.'],
            ['Chicken Pepperoni Pizza (Medium)', 'Pizza', 449, NV, 'Chicken pepperoni with extra cheese.'],
            ['BBQ Chicken Pizza (Medium)', 'Pizza', 469, NV, 'Smoky barbecue chicken and onion.'],
            ['Garlic Breadsticks', 'Starters', 149, V, 'Oven-baked with garlic butter.'],
            ['Cheesy Jalapeno Dip', 'Starters', 49, V, 'Creamy cheese dip with jalapenos.'],
            ['Choco Lava Cake', 'Desserts', 119, V, 'Molten chocolate centre.'],
            ['Cold Coffee', 'Beverages', 129, V, 'Blended iced coffee.'],
        ],
    },
    {
        restaurantName: 'Old City Biryani House',
        ownerName: 'Demo Owner Biryani',
        phone: '9800000004',
        pureVeg: false,
        cuisines: ['Biryani', 'Mughlai'],
        addr: { lat: 23.262, lng: 77.4005, area: 'Chowk Bazaar', pincode: '462001', line1: 'Near Jama Masjid Road' },
        eta: '30-40 mins',
        rating: 4.4,
        menu: [
            ['Chicken Biryani', 'Biryani', 279, NV, 'Bhopali-style chicken biryani.'],
            ['Mutton Biryani', 'Biryani', 379, NV, 'Tender mutton, long-grain basmati.'],
            ['Egg Biryani', 'Biryani', 219, NV, 'Spiced rice with boiled eggs.'],
            ['Veg Dum Biryani', 'Biryani', 229, V, 'Seasonal vegetables cooked on dum.'],
            ['Chicken 65', 'Starters', 249, NV, 'Fiery deep-fried chicken bites.'],
            ['Mutton Korma', 'Main Course', 359, NV, 'Mutton in a cashew and onion gravy.'],
            ['Shahi Tukda', 'Desserts', 109, V, 'Fried bread in reduced milk with nuts.'],
            ['Rooh Afza Sharbat', 'Beverages', 59, V, 'Chilled rose sharbat.'],
        ],
    },
    {
        restaurantName: 'Chai & Chaat Corner',
        ownerName: 'Demo Owner Chaat',
        phone: '9800000005',
        pureVeg: true,
        cuisines: ['Street Food', 'Snacks'],
        addr: { lat: 23.2133, lng: 77.4316, area: 'Arera Colony', pincode: '462016', line1: 'E-5 Market, 10 No. Stop' },
        eta: '15-20 mins',
        rating: 4.2,
        menu: [
            ['Pani Puri (8 pcs)', 'Street Food', 49, V, 'Crisp puris with tangy mint water.'],
            ['Aloo Tikki Chaat', 'Street Food', 79, V, 'Potato patties with chutneys and curd.'],
            ['Samosa (2 pcs)', 'Street Food', 39, V, 'Classic potato samosa.'],
            ['Poha Jalebi', 'Street Food', 69, V, 'The Madhya Pradesh breakfast.'],
            ['Pav Bhaji', 'Main Course', 129, V, 'Buttered pav with mashed vegetable curry.'],
            ['Dahi Bhalla', 'Starters', 89, V, 'Lentil dumplings in sweet curd.'],
            ['Kulfi Falooda', 'Desserts', 99, V, 'Malai kulfi with falooda and rose syrup.'],
            ['Masala Chai', 'Beverages', 25, V, 'Ginger-cardamom tea.'],
        ],
    },
    {
        restaurantName: 'Burger Junction',
        ownerName: 'Demo Owner Burger',
        phone: '9800000006',
        pureVeg: false,
        cuisines: ['Burgers', 'Fast Food'],
        addr: { lat: 23.1795, lng: 77.417, area: 'Kolar Road', pincode: '462042', line1: 'Shop 9, Sarvdharm Square' },
        eta: '25-30 mins',
        rating: 4.0,
        menu: [
            ['Aloo Tikki Burger', 'Burgers', 79, V, 'Spiced potato patty, onion and mayo.'],
            ['Paneer Crunch Burger', 'Burgers', 149, V, 'Crumb-fried paneer slab with lettuce.'],
            ['Crispy Chicken Burger', 'Burgers', 169, NV, 'Fried chicken fillet, slaw and pickles.'],
            ['Double Chicken Burger', 'Burgers', 229, NV, 'Two grilled chicken patties and cheese.'],
            ['Peri Peri Fries', 'Starters', 99, V, 'Fries tossed in peri peri seasoning.'],
            ['Chicken Nuggets (6 pcs)', 'Starters', 149, NV, 'Golden fried chicken nuggets.'],
            ['Brownie Sundae', 'Desserts', 129, V, 'Warm brownie, vanilla ice cream.'],
            ['Oreo Shake', 'Beverages', 139, V, 'Thick Oreo milkshake.'],
        ],
    },
];

// Menu for the pre-existing "K9 Rides Demo Restaurant" (phone 9009925021).
const EXISTING_DEMO_RESTAURANT_PHONE = '9009925021';
const EXISTING_DEMO_RESTAURANT_MENU = [
    ['Veg Manchurian', 'Starters', 179, V, 'Vegetable balls in Indo-Chinese gravy.'],
    ['Chilli Chicken', 'Starters', 249, NV, 'Wok-tossed chicken with peppers.'],
    ['Kadai Paneer', 'Main Course', 249, V, 'Paneer and peppers in kadai masala.'],
    ['Chicken Curry', 'Main Course', 279, NV, 'Home-style chicken curry.'],
    ['Hyderabadi Veg Biryani', 'Biryani', 219, V, 'Fragrant vegetable biryani.'],
    ['Chicken Fried Rice', 'Main Course', 199, NV, 'Wok-fried rice with chicken and egg.'],
    ['Moong Dal Halwa', 'Desserts', 99, V, 'Rich lentil halwa with ghee.'],
    ['Fresh Lime Soda', 'Beverages', 69, V, 'Sweet or salted.'],
];
const EXISTING_DEMO_RESTAURANT_ADDR = { lat: 23.2165, lng: 77.426, area: 'Bittan Market', pincode: '462016', line1: 'Bittan Market Road' };

async function ensureFoodItems(restaurantId, categoriesByName, menu) {
    for (const [name, category, price, foodType, description] of menu) {
        const cat = categoriesByName.get(category);
        await ensure(
            M.FoodItem,
            { restaurantId, name },
            {
                restaurantId,
                categoryId: cat?._id,
                categoryName: category,
                name,
                description,
                price,
                image: catImage[category] || '',
                foodType,
                isActive: true,
                isAvailable: true,
                isRecommended: price >= 249,
                preparationTime: '15-20 mins',
                approvalStatus: 'approved',
                approvedAt: NOW,
            },
            { label: `item "${name}"` },
        );
    }
}

async function seedFood() {
    const c = CITIES.bhopal;
    const shape = box(c.lat, c.lng);

    const zone = await ensure(
        M.FoodZone,
        { name: exactI(c.name) },
        {
            name: c.name,
            zoneName: c.name,
            country: 'India',
            serviceLocation: `${c.name}, ${c.state}`,
            unit: 'kilometer',
            boundary_mode: 'polygon',
            coordinates: shape.latLngList,
            isActive: true,
        },
        { label: `zone ${c.name}` },
    );

    const categoriesByName = new Map();
    for (const [i, cat] of FOOD_CATEGORIES.entries()) {
        const doc = await ensure(
            M.FoodCategory,
            { name: exactI(cat.name), restaurantId: null },
            {
                name: cat.name,
                image: cat.image,
                foodTypeScope: cat.foodTypeScope,
                approvalStatus: 'approved',
                isApproved: true,
                approvedAt: NOW,
                isActive: true,
                sortOrder: i + 1,
            },
            { label: `category ${cat.name}` },
        );
        if (doc) categoriesByName.set(cat.name, doc);
    }

    const created = [];
    for (const r of FOOD_RESTAURANTS) {
        const email = demoEmail(r.restaurantName);
        const doc = await ensure(
            M.FoodRestaurant,
            { ownerEmail: email },
            {
                restaurantName: r.restaurantName,
                ownerName: r.ownerName,
                ownerEmail: email,
                ownerPhone: r.phone,
                primaryContactNumber: r.phone,
                pureVegRestaurant: r.pureVeg,
                cuisines: r.cuisines,
                ...sellerAddress(r.addr, c),
                zoneId: zone._id,
                openingTime: '09:00',
                closingTime: '23:00',
                openDays: DAYS,
                isAcceptingOrders: true,
                profileImage: img('photo-1517248135467-4c7edcad34c4'),
                coverImage: catImage[r.menu[0][1]] || img('photo-1504674900247-0877df9cc836'),
                coverImages: [catImage[r.menu[0][1]] || img('photo-1504674900247-0877df9cc836')],
                estimatedDeliveryTime: r.eta,
                featuredDish: r.menu[0][0],
                featuredPrice: r.menu[0][2],
                rating: r.rating,
                totalRatings: 120,
                status: 'approved',
                approvedAt: NOW,
            },
            { label: `restaurant ${r.restaurantName}`, conflict: { ownerPhone: r.phone } },
        );
        if (!doc) continue;
        created.push(doc);
        await ensure(
            M.FoodOutletTimings,
            { restaurantId: doc._id },
            { restaurantId: doc._id, timings: weekTimings('09:00', '23:00') },
            { label: `outlet timings ${r.restaurantName}` },
        );
        await ensureFoodItems(doc._id, categoriesByName, r.menu);
    }

    // The pre-seeded demo restaurant: fill in what is missing, add a menu.
    const existing = await M.FoodRestaurant.findOne({
        $or: [
            { ownerPhone: EXISTING_DEMO_RESTAURANT_PHONE },
            { primaryContactNumber: EXISTING_DEMO_RESTAURANT_PHONE },
            { ownerPhoneLast10: EXISTING_DEMO_RESTAURANT_PHONE },
        ],
    }).lean();
    if (!existing) {
        log(`! food_restaurants: pre-seeded demo restaurant ${EXISTING_DEMO_RESTAURANT_PHONE} not found -- skipped attaching zone/menu`);
    } else {
        const a = sellerAddress(EXISTING_DEMO_RESTAURANT_ADDR, c);
        await fillMissing(
            M.FoodRestaurant,
            existing,
            {
                zoneId: zone._id,
                // location is written as a whole only when the restaurant has none.
                location: a.location,
                addressLine1: a.addressLine1,
                area: a.area,
                city: a.city,
                state: a.state,
                pincode: a.pincode,
                cuisines: ['North Indian', 'Chinese', 'Biryani'],
                pureVegRestaurant: false,
                openingTime: '09:00',
                closingTime: '23:00',
                openDays: DAYS,
                isAcceptingOrders: true,
                estimatedDeliveryTime: '25-30 mins',
                estimatedDeliveryTimeMinutes: 25,
                profileImage: img('photo-1517248135467-4c7edcad34c4'),
            },
            `pre-seeded restaurant ${existing.restaurantName || EXISTING_DEMO_RESTAURANT_PHONE}`,
        );
        await ensure(
            M.FoodOutletTimings,
            { restaurantId: existing._id },
            { restaurantId: existing._id, timings: weekTimings('09:00', '23:00') },
            { label: `outlet timings ${existing.restaurantName}` },
        );
        await ensureFoodItems(existing._id, categoriesByName, EXISTING_DEMO_RESTAURANT_MENU);
        created.push(existing);
    }

    // Hero banners (food module). publicId is the stable demo key.
    const banners = [
        { publicId: 'gomark-demo/food-hero-1', title: 'Bhopal\'s favourites, delivered', ctaText: 'Order now', image: img('photo-1504674900247-0877df9cc836') },
        { publicId: 'gomark-demo/food-hero-2', title: 'Biryani week: flat 50% off', ctaText: 'Use DEMO50', image: img('photo-1563379091339-03b21ab4a4f8') },
    ];
    for (const [i, b] of banners.entries()) {
        await ensure(
            M.FoodHeroBanner,
            { publicId: b.publicId },
            {
                imageUrl: b.image,
                publicId: b.publicId,
                resourceType: 'image',
                title: b.title,
                ctaText: b.ctaText,
                ctaLink: '',
                linkedRestaurantIds: created.slice(i * 2, i * 2 + 2).map((r) => r._id),
                module: 'food',
                sortOrder: i + 1,
                isActive: true,
            },
            { label: `hero banner ${b.publicId}` },
        );
    }

    await ensure(
        M.FoodOffer,
        { couponCode: 'DEMO50' },
        {
            couponCode: 'DEMO50',
            discountType: 'percentage',
            discountValue: 50,
            customerScope: 'all',
            restaurantScope: 'all',
            minOrderValue: 199,
            maxDiscount: 100,
            perUserLimit: 3,
            startDate: NOW,
            endDate: new Date(NOW.getTime() + 365 * 24 * 3600 * 1000),
            status: 'active',
            showInCart: true,
            createdByRole: 'ADMIN',
        },
        { label: 'offer DEMO50' },
    );
}

/* ------------------------------------------------------------------ */
/* 2. QUICK COMMERCE  (+ zones reused by MEDICAL)                      */
/* ------------------------------------------------------------------ */

// Cached so QC and Medical share one zone per city (and dry-run does not
// report the same "would create" twice with two different unsaved ids).
const QC_ZONE_CACHE = new Map();
async function ensureQcZone(city) {
    if (QC_ZONE_CACHE.has(city.name)) return QC_ZONE_CACHE.get(city.name);
    const zone = await ensureQcZoneUncached(city);
    QC_ZONE_CACHE.set(city.name, zone);
    return zone;
}

async function ensureQcZoneUncached(city) {
    const shape = box(city.lat, city.lng);
    return ensure(
        M.QCZone,
        { name: exactI(city.name) },
        {
            name: city.name,
            zoneName: city.name,
            country: 'India',
            serviceLocation: `${city.name}, ${city.state}`,
            unit: 'kilometer',
            coordinates: shape.latLngList,
            isActive: true,
        },
        { label: `qc zone ${city.name}` },
    );
}

const QC_CATALOGUE = {
    'Fruits & Vegetables': {
        image: img('photo-1542838132-92c53300491e'),
        subs: {
            'Fresh Fruits': [
                ['Banana (Robusta)', 6, 'fresh', 49, 55, '6 pcs'],
                ['Apple (Shimla)', 0, 'fresh', 159, 180, '1 kg'],
                ['Pomegranate', 0, 'fresh', 139, 160, '500 g'],
                ['Papaya', 0, 'fresh', 59, 70, '1 pc (approx 1 kg)'],
            ],
            'Fresh Vegetables': [
                ['Onion', 0, 'fresh', 39, 45, '1 kg'],
                ['Tomato (Hybrid)', 0, 'fresh', 35, 40, '1 kg'],
                ['Potato', 0, 'fresh', 32, 38, '1 kg'],
                ['Green Chilli', 0, 'fresh', 12, 15, '100 g'],
                ['Coriander Leaves', 0, 'fresh', 10, 12, '100 g'],
            ],
        },
    },
    'Dairy & Bakery': {
        image: img('photo-1550583724-b2692b85b150'),
        subs: {
            Milk: [
                ['Toned Milk', 0, 'chilled', 27, 28, '500 ml'],
                ['Full Cream Milk', 0, 'chilled', 34, 35, '500 ml'],
            ],
            'Paneer & Curd': [
                ['Fresh Paneer', 0, 'chilled', 95, 100, '200 g'],
                ['Plain Curd', 0, 'chilled', 35, 38, '400 g'],
                ['Table Butter', 0, 'chilled', 56, 58, '100 g'],
            ],
            'Bread & Eggs': [
                ['Brown Bread', 0, 'fresh', 45, 50, '400 g'],
                ['White Bread', 0, 'fresh', 40, 45, '400 g'],
                ['Farm Eggs', 0, 'chilled', 84, 90, '12 pcs', NV],
            ],
        },
    },
    Staples: {
        image: img('photo-1586201375761-83865001e31c'),
        subs: {
            'Atta & Flour': [
                ['Whole Wheat Atta', 0, 'ambient', 289, 320, '5 kg'],
                ['Besan', 0, 'ambient', 89, 99, '1 kg'],
            ],
            'Rice & Dals': [
                ['Basmati Rice', 0, 'ambient', 199, 230, '1 kg'],
                ['Sona Masoori Rice', 0, 'ambient', 69, 78, '1 kg'],
                ['Toor Dal', 0, 'ambient', 159, 175, '1 kg'],
                ['Moong Dal', 0, 'ambient', 139, 150, '1 kg'],
            ],
            'Oils & Ghee': [
                ['Refined Sunflower Oil', 0, 'ambient', 159, 175, '1 L'],
                ['Kachi Ghani Mustard Oil', 0, 'ambient', 179, 195, '1 L'],
                ['Desi Ghee', 0, 'ambient', 299, 320, '500 ml'],
            ],
        },
    },
    'Snacks & Beverages': {
        image: img('photo-1621939514649-280e2ee25f60'),
        subs: {
            'Chips & Namkeen': [
                ['Salted Potato Chips', 0, 'ambient', 20, 20, '52 g'],
                ['Ratlami Sev', 0, 'ambient', 55, 60, '200 g'],
                ['Aloo Bhujia', 0, 'ambient', 49, 55, '200 g'],
            ],
            Biscuits: [
                ['Glucose Biscuits', 0, 'ambient', 10, 10, '100 g'],
                ['Cream Biscuits', 0, 'ambient', 30, 30, '120 g'],
            ],
            'Tea & Coffee': [
                ['Assam Tea', 0, 'ambient', 135, 150, '250 g'],
                ['Instant Coffee', 0, 'ambient', 165, 180, '50 g'],
            ],
            'Cold Drinks & Juices': [
                ['Mixed Fruit Juice', 0, 'ambient', 99, 110, '1 L'],
                ['Lemon Soda', 0, 'ambient', 40, 40, '750 ml'],
            ],
        },
    },
    'Personal Care': {
        image: img('photo-1556228578-8c89e6adf883'),
        subs: {
            'Bath & Body': [
                ['Neem Bathing Soap (Pack of 4)', 0, 'ambient', 119, 140, '4 x 100 g'],
                ['Aloe Vera Body Wash', 0, 'ambient', 199, 225, '250 ml'],
            ],
            'Hair & Oral Care': [
                ['Herbal Shampoo', 0, 'ambient', 149, 170, '340 ml'],
                ['Coconut Hair Oil', 0, 'ambient', 99, 110, '200 ml'],
                ['Fluoride Toothpaste', 0, 'ambient', 95, 105, '150 g'],
            ],
        },
    },
    Household: {
        image: img('photo-1583947215259-38e31be8751f'),
        subs: {
            'Detergents & Cleaners': [
                ['Detergent Powder', 0, 'ambient', 199, 220, '2 kg'],
                ['Dishwash Liquid', 0, 'ambient', 105, 115, '500 ml'],
                ['Floor Cleaner', 0, 'ambient', 99, 110, '1 L'],
                ['Toilet Cleaner', 0, 'ambient', 89, 99, '500 ml'],
            ],
        },
    },
};

const QC_STORES = [
    {
        restaurantName: 'GoMark Fresh Mart',
        ownerName: 'Demo Owner Fresh Mart',
        phone: '9800000011',
        storeType: 'supermarket',
        storageCapability: ['chilled'],
        addr: { lat: 23.2318, lng: 77.4351, area: 'MP Nagar Zone 2', pincode: '462011', line1: 'Ground Floor, Jyoti Complex' },
        topCategories: null, // everything
    },
    {
        restaurantName: 'Arera Kirana Store',
        ownerName: 'Demo Owner Kirana',
        phone: '9800000012',
        storeType: 'kirana',
        storageCapability: [],
        addr: { lat: 23.2105, lng: 77.4302, area: 'Arera Colony', pincode: '462016', line1: 'E-7 Market' },
        topCategories: ['Staples', 'Snacks & Beverages', 'Household', 'Personal Care'],
    },
    {
        restaurantName: 'Kolar Daily Needs',
        ownerName: 'Demo Owner Daily Needs',
        phone: '9800000013',
        storeType: 'grocery',
        storageCapability: ['chilled'],
        addr: { lat: 23.1772, lng: 77.4188, area: 'Kolar Road', pincode: '462042', line1: 'Shop 3, Chuna Bhatti Square' },
        topCategories: ['Fruits & Vegetables', 'Dairy & Bakery'],
    },
];

async function seedQuickCommerce() {
    const c = CITIES.bhopal;
    const zone = await ensureQcZone(c);

    // Categories: top level (parentId unset) + subcategories (parentId = top).
    const subByName = new Map(); // sub name -> { doc, top }
    let order = 0;
    for (const [topName, top] of Object.entries(QC_CATALOGUE)) {
        const topDoc = await ensure(
            M.QCCategory,
            { name: exactI(topName), restaurantId: null, parentId: null },
            {
                name: topName,
                image: top.image,
                foodTypeScope: 'Both',
                approvalStatus: 'approved',
                isApproved: true,
                approvedAt: NOW,
                isActive: true,
                sortOrder: ++order,
            },
            { label: `qc category ${topName}` },
        );
        let subOrder = 0;
        for (const subName of Object.keys(top.subs)) {
            const subDoc = await ensure(
                M.QCCategory,
                { name: exactI(subName), restaurantId: null, parentId: topDoc._id },
                {
                    name: subName,
                    image: top.image,
                    foodTypeScope: 'Both',
                    parentId: topDoc._id,
                    approvalStatus: 'approved',
                    isApproved: true,
                    approvedAt: NOW,
                    isActive: true,
                    sortOrder: ++subOrder,
                },
                { label: `qc subcategory ${topName} > ${subName}` },
            );
            subByName.set(subName, { doc: subDoc, top: topName, image: top.image });
        }
    }

    let skuSeq = 0;
    const skuOf = new Map(); // product name -> stable SKU across stores
    for (const s of QC_STORES) {
        const email = demoEmail(s.restaurantName);
        const store = await ensure(
            M.QCRestaurant,
            { ownerEmail: email },
            {
                restaurantName: s.restaurantName,
                ownerName: s.ownerName,
                ownerEmail: email,
                ownerPhone: s.phone,
                primaryContactNumber: s.phone,
                pureVegRestaurant: false,
                storeType: s.storeType,
                storageCapability: s.storageCapability,
                cuisines: [],
                ...sellerAddress(s.addr, c),
                zoneId: zone._id,
                openingTime: '07:00',
                closingTime: '23:00',
                openDays: DAYS,
                isAcceptingOrders: true,
                autoAcceptOrders: true,
                estimatedDeliveryTime: '10-15 mins',
                estimatedDeliveryTimeMinutes: 10,
                profileImage: img('photo-1542838132-92c53300491e'),
                coverImage: img('photo-1542838132-92c53300491e'),
                storePhotos: { front: img('photo-1542838132-92c53300491e'), inside: '', signboard: '' },
                status: 'approved',
                approvedAt: NOW,
            },
            { label: `qc store ${s.restaurantName}`, conflict: { ownerPhone: s.phone } },
        );
        if (!store) continue;

        await ensure(
            M.QCOutletTimings,
            { restaurantId: store._id },
            { restaurantId: store._id, timings: weekTimings('07:00', '23:00') },
            { label: `qc outlet timings ${s.restaurantName}` },
        );

        for (const [topName, top] of Object.entries(QC_CATALOGUE)) {
            if (s.topCategories && !s.topCategories.includes(topName)) continue;
            for (const [subName, products] of Object.entries(top.subs)) {
                const sub = subByName.get(subName);
                for (const [name, _unused, perishability, price, mrp, packSize, foodType] of products) {
                    if (!skuOf.has(name)) skuOf.set(name, `DEMO-QC-${String(++skuSeq).padStart(3, '0')}`);
                    await ensure(
                        M.QCItem,
                        { restaurantId: store._id, name },
                        {
                            restaurantId: store._id,
                            categoryId: sub?.doc?._id,
                            categoryName: subName,
                            name,
                            description: `${name}, ${packSize}.`,
                            price,
                            mrp: Math.max(mrp, price),
                            image: sub?.image || '',
                            images: sub?.image ? [sub.image] : [],
                            foodType: foodType || 'Veg',
                            brand: 'GoMark Demo',
                            packSize,
                            sku: skuOf.get(name),
                            perishability,
                            gstRate: topName === 'Fruits & Vegetables' ? 0 : topName === 'Personal Care' || topName === 'Household' ? 18 : 5,
                            stockQty: 50,
                            lowStockThreshold: 5,
                            maxQtyPerOrder: 10,
                            isAvailable: true,
                            approvalStatus: 'approved',
                            approvedAt: NOW,
                        },
                        { label: `qc product "${name}" @ ${s.restaurantName}` },
                    );
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/* 3. TAXI                                                             */
/* ------------------------------------------------------------------ */

const TAXI_TRANSPORT_TYPES = [
    // Same set adminService.seedTransportTypes() creates on demand.
    { name: 'taxi', display_name: 'Taxi' },
    { name: 'delivery', display_name: 'Delivery' },
    { name: 'pooling', display_name: 'Pooling' },
    { name: 'both', display_name: 'Taxi & Delivery' },
];

// Fares in rupees. base_distance in km, time_price per minute.
const TAXI_VEHICLES = [
    { name: 'Bike', icon: 'bike', capacity: 1, desc: 'Quick, affordable bike rides', fare: [25, 2, 8, 1, 1] },
    { name: 'Auto', icon: 'auto', capacity: 3, desc: 'Everyday auto rickshaw rides', fare: [35, 2, 12, 1.5, 1.5] },
    { name: 'Cab Mini', icon: 'car', capacity: 4, desc: 'Compact hatchbacks', fare: [60, 2, 14, 1.5, 2] },
    { name: 'Sedan', icon: 'premium', capacity: 4, desc: 'Comfortable sedans with extra legroom', fare: [80, 2, 16, 2, 2] },
    { name: 'SUV', icon: 'suv', capacity: 6, desc: 'Spacious SUVs for groups', fare: [110, 2, 20, 2.5, 3] },
];

const TAXI_DRIVER_DOCUMENTS = [
    { name: 'Driving Licence', image_type: 'front_back', has_expiry_date: true, has_identify_number: true, identify_number_key: 'drivingLicenceNumber' },
    { name: 'Aadhaar Card', image_type: 'front_back', has_expiry_date: false, has_identify_number: true, identify_number_key: 'aadhaarNumber' },
    { name: 'Vehicle RC Book', image_type: 'front_back', has_expiry_date: true, has_identify_number: true, identify_number_key: 'vehicleRcNumber' },
    { name: 'Vehicle Insurance', image_type: 'image', has_expiry_date: true, has_identify_number: true, identify_number_key: 'insurancePolicyNumber' },
];

/** Same algorithm as adminService.toDocumentKey, so keys match admin-created ones. */
const toDocumentKey = (value) =>
    String(value).trim().replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/)
        .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
        .join('');

const EXISTING_TAXI_DRIVER_PHONE = '7974161582';

async function seedTaxi() {
    const c = CITIES.bhopal;
    const shape = box(c.lat, c.lng);

    const serviceLocation = await ensure(
        M.TaxiServiceLocation,
        { name: exactI(c.name) },
        {
            name: c.name,
            service_location_name: c.name,
            address: `${c.name}, ${c.state}, India`,
            country: 'India',
            currency_name: 'Indian Rupee',
            currency_symbol: '₹',
            currency_code: 'INR',
            timezone: 'Asia/Kolkata',
            unit: 'km',
            latitude: c.lat,
            longitude: c.lng,
            location: { type: 'Point', coordinates: [c.lng, c.lat] },
            status: 'active',
            active: true,
        },
        { label: `service location ${c.name}` },
    );

    const zone = await ensure(
        M.TaxiZone,
        { name: exactI(c.name) },
        {
            name: c.name,
            service_location_id: serviceLocation._id,
            unit: 'km',
            active: true,
            status: 'active',
            boundary_mode: 'polygon',
            maximum_distance_for_regular_rides: 50,
            maximum_distance_for_outstation_rides: 500,
            geometry: { type: 'Polygon', coordinates: shape.geoJsonRing },
            popular_places: [
                { name: 'Upper Lake (Boat Club)', address: 'Lake Drive Road, Shyamla Hills, Bhopal', location: { lat: 23.2484, lng: 77.3847 }, active: true },
                { name: 'DB Mall', address: 'MP Nagar Zone 1, Bhopal', location: { lat: 23.2329, lng: 77.4296 }, active: true },
                { name: 'Rani Kamlapati Railway Station', address: 'Habibganj, Bhopal', location: { lat: 23.2228, lng: 77.4381 }, active: true },
                { name: 'Bhopal Junction', address: 'Railway Station Road, Bhopal', location: { lat: 23.2687, lng: 77.4116 }, active: true },
            ],
        },
        { label: `taxi zone ${c.name}` },
    );

    for (const t of TAXI_TRANSPORT_TYPES) {
        await ensure(M.TaxiTransportType, { name: t.name }, { ...t, active: true }, { label: `transport type ${t.name}` });
    }

    const vehicles = [];
    for (const v of TAXI_VEHICLES) {
        const doc = await ensure(
            M.TaxiVehicle,
            { name: exactI(v.name), transport_type: 'taxi' },
            {
                name: v.name,
                short_description: v.desc,
                description: v.desc,
                transport_type: 'taxi',
                is_taxi: 'taxi',
                dispatch_type: 'normal',
                icon_types: v.icon,
                capacity: v.capacity,
                status: 1,
                active: true,
            },
            { label: `vehicle type ${v.name}` },
        );
        vehicles.push({ ...v, doc });
    }

    for (const [i, v] of vehicles.entries()) {
        const [base, baseKm, perKm, perMin, waiting] = v.fare;
        await ensure(
            M.TaxiSetPrice,
            { zone_id: zone._id, vehicle_type: v.doc._id, transport_type: 'taxi', pricing_scope: 'ride' },
            {
                zone_id: zone._id,
                service_location_id: serviceLocation._id,
                pricing_scope: 'ride',
                transport_type: 'taxi',
                vehicle_type: v.doc._id,
                payment_type: ['cash', 'online'],
                eta_sequence: i + 1,
                order_number: i + 1,
                base_price: base,
                base_distance: baseKm,
                price_per_distance: perKm,
                time_price: perMin,
                waiting_charge: waiting,
                free_waiting_before: 3,
                free_waiting_after: 3,
                admin_commision_type: 1,
                admin_commision: 10,
                admin_commission_type_from_driver: 1,
                admin_commission_from_driver: 10,
                service_tax: 5,
                user_cancellation_fee_type: 'fixed',
                user_cancellation_fee: 20,
                driver_cancellation_fee_type: 'fixed',
                driver_cancellation_fee: 20,
                status: 'active',
                active: 1,
            },
            { label: `set price ${v.name} @ ${c.name}` },
        );
    }

    for (const [i, d] of TAXI_DRIVER_DOCUMENTS.entries()) {
        const slug = slugify(d.name);
        const base = toDocumentKey(d.name);
        const keys = d.image_type === 'front_back'
            ? { key: '', front_key: `${base}Front`, back_key: `${base}Back` }
            : { key: base, front_key: '', back_key: '' };
        await ensure(
            M.TaxiDriverNeededDocument,
            { slug },
            {
                template_type: 'document',
                name: d.name,
                slug,
                account_type: 'individual',
                image_type: d.image_type,
                has_expiry_date: d.has_expiry_date,
                has_identify_number: d.has_identify_number,
                identify_number_key: d.identify_number_key,
                is_editable: true,
                is_required: true,
                active: true,
                sort_order: i + 1,
                ...keys,
            },
            { label: `driver document ${d.name}` },
        );
    }

    // Attach the pre-seeded driver to the zone and a matching vehicle type.
    const driver = await M.TaxiDriver.findOne({ phone: EXISTING_TAXI_DRIVER_PHONE }).lean();
    if (!driver) {
        log(`! taxidrivers: pre-seeded driver ${EXISTING_TAXI_DRIVER_PHONE} not found -- skipped`);
        return;
    }
    const iconFor = { bike: 'bike', auto: 'auto', car: 'car' };
    const wantIcon = iconFor[String(driver.vehicleType || 'bike').toLowerCase()] || 'bike';
    const vehicle = vehicles.find((v) => v.icon === wantIcon) || vehicles[0];
    await fillMissing(
        M.TaxiDriver,
        driver,
        {
            zoneId: zone._id,
            service_location_id: serviceLocation._id,
            vehicleTypeId: vehicle.doc._id,
            vehicleIconType: vehicle.icon,
            city: c.name,
        },
        `pre-seeded driver ${EXISTING_TAXI_DRIVER_PHONE} -> ${vehicle.name}`,
    );
}

/* ------------------------------------------------------------------ */
/* 4. SERVICE PROVIDER                                                 */
/* ------------------------------------------------------------------ */

// Category titles are matched (case-insensitive substring) against the
// existing sp_categories; the first hit wins. Unmatched hints are ignored.
const SP_VENDORS = [
    {
        name: 'Demo Vendor CoolCare',
        businessName: 'CoolCare AC & Appliance Services',
        phone: '9876543201',
        categoryHints: ['AC', 'Appliance', 'Cooler', 'Refrigerator'],
        area: 'MP Nagar', pincode: '462011', lat: 23.2335, lng: 77.4337,
        workers: [{ name: 'Demo Worker Arjun', phone: '9800000021' }, { name: 'Demo Worker Kabir', phone: '9800000022' }],
    },
    {
        name: 'Demo Vendor SparkFix',
        businessName: 'SparkFix Electricals',
        phone: '9876543202',
        categoryHints: ['Electric', 'LED', 'Fan', 'Inverter'],
        area: 'Arera Colony', pincode: '462016', lat: 23.2128, lng: 77.4321,
        workers: [{ name: 'Demo Worker Vikram', phone: '9800000023' }],
    },
    {
        name: 'Demo Vendor FlowRight',
        businessName: 'FlowRight Plumbing',
        phone: '9876543203',
        categoryHints: ['Plumb', 'Water', 'RO', 'Purifier'],
        area: 'Kolar Road', pincode: '462042', lat: 23.1801, lng: 77.4165,
        workers: [{ name: 'Demo Worker Sameer', phone: '9800000024' }],
    },
    {
        name: 'Demo Vendor SparkleHome',
        businessName: 'SparkleHome Cleaning',
        phone: '9876543204',
        categoryHints: ['Clean', 'Pest', 'Sofa', 'Bathroom'],
        area: 'Shyamla Hills', pincode: '462013', lat: 23.246, lng: 77.3912,
        workers: [{ name: 'Demo Worker Rohit', phone: '9800000025' }],
    },
];

async function seedServiceProvider() {
    const c = CITIES.bhopal;
    const categories = await M.SPCategory.find({ status: 'active' }).select('title').lean();
    if (!categories.length) log('! sp_categories: no active categories found -- vendors will be created without categories');

    const pickTitles = (hints) => {
        const out = [];
        for (const h of hints) {
            const hit = categories.find((cat) => String(cat.title || '').toLowerCase().includes(h.toLowerCase()) && !out.includes(cat.title));
            if (hit) out.push(hit.title);
        }
        // A vendor with no category is invisible to booking; fall back to any one.
        if (!out.length && categories.length) out.push(categories[0].title);
        return out;
    };

    const doc = (label) => `https://placehold.co/600x400/png?text=${encodeURIComponent(label)}`;
    const hours = (open, close, isOpen = true) => ({ open, close, isOpen });

    for (const [i, v] of SP_VENDORS.entries()) {
        const email = demoEmail(v.businessName);
        const titles = pickTitles(v.categoryHints);
        const vendor = await ensure(
            M.SPVendor,
            { email },
            {
                name: v.name,
                email,
                phone: v.phone,
                businessName: v.businessName,
                service: titles,
                categories: titles,
                skills: titles,
                aadhar: {
                    // Obviously fake placeholder values, not real identifiers.
                    number: `99990000${String(i + 1).padStart(4, '0')}`,
                    document: doc('DEMO AADHAAR FRONT'),
                    backDocument: doc('DEMO AADHAAR BACK'),
                },
                pan: { number: `DEMOV${String(i + 1).padStart(4, '0')}D`, document: doc('DEMO PAN') },
                approvalStatus: 'approved',
                approvalDate: NOW,
                profilePhoto: null,
                address: {
                    fullAddress: `${v.area}, ${c.name}, ${c.state} ${v.pincode}`,
                    addressLine1: v.area,
                    city: c.name,
                    state: c.state,
                    pincode: v.pincode,
                    lat: v.lat,
                    lng: v.lng,
                },
                location: { lat: v.lat, lng: v.lng, updatedAt: NOW },
                geoLocation: { type: 'Point', coordinates: [v.lng, v.lat] },
                isActive: true,
                isPhoneVerified: true,
                availability: 'OFFLINE',
                rating: 4.5,
                settings: { notifications: true, soundAlerts: true, language: 'en', serviceRange: 15 },
                businessHours: {
                    monday: hours('09:00', '20:00'),
                    tuesday: hours('09:00', '20:00'),
                    wednesday: hours('09:00', '20:00'),
                    thursday: hours('09:00', '20:00'),
                    friday: hours('09:00', '20:00'),
                    saturday: hours('09:00', '20:00'),
                    sunday: hours('10:00', '16:00', false),
                },
            },
            { label: `vendor ${v.businessName} [${titles.join(', ') || 'no category'}]`, conflict: { phone: v.phone } },
        );
        if (!vendor) continue;

        for (const w of v.workers) {
            const wEmail = demoEmail(w.name);
            await ensure(
                M.SPWorker,
                { email: wEmail },
                {
                    name: w.name,
                    email: wEmail,
                    phone: w.phone,
                    vendorId: vendor._id,
                    approvalStatus: 'approved',
                    serviceCategories: titles,
                    address: { addressLine1: v.area, city: c.name, state: c.state, pincode: v.pincode },
                    isActive: true,
                    isPhoneVerified: true,
                    location: { lat: v.lat, lng: v.lng, updatedAt: NOW },
                    geoLocation: { type: 'Point', coordinates: [v.lng, v.lat] },
                },
                { label: `worker ${w.name} -> ${v.businessName}`, conflict: { phone: w.phone } },
            );
        }
    }
}

/* ------------------------------------------------------------------ */
/* 5. MEDICAL                                                          */
/* ------------------------------------------------------------------ */

/**
 * scripts/seed-medical-stores.js looks for ACTIVE zones matching /nagpur/i and
 * /indore/i in qc_zones (it imports QC's zone model under the FoodZone alias),
 * and medical reads medical_zones. As in scripts/split-medical-zones.js, the
 * medical zone is created with the SAME _id as its qc zone, so a pharmacy's
 * zoneId resolves against either collection.
 */
async function seedMedical() {
    for (const key of ['bhopal', 'indore', 'nagpur']) {
        const city = CITIES[key];
        const qcZone = await ensureQcZone(city);
        if (!qcZone.isActive) log(`! qc_zones: ${city.name} exists but is inactive -- seed-medical-stores.js will skip it (left as-is)`);

        const byId = await M.MedicalZone.findById(qcZone._id).select('_id').lean();
        if (byId) {
            bump(collOf(M.MedicalZone), 'existing');
            log(`= ${collOf(M.MedicalZone).padEnd(30)} exists   medical zone ${city.name} (same id as qc zone)`);
            continue;
        }
        const byName = await M.MedicalZone.findOne({ name: exactI(city.name) }).select('_id').lean();
        if (byName) {
            bump(collOf(M.MedicalZone), 'existing');
            log(`= ${collOf(M.MedicalZone).padEnd(30)} exists   medical zone ${city.name} (id ${byName._id} differs from qc zone ${qcZone._id}; left as-is)`);
            continue;
        }
        await ensure(
            M.MedicalZone,
            { _id: qcZone._id },
            {
                _id: qcZone._id,
                name: qcZone.name,
                zoneName: qcZone.zoneName || qcZone.name,
                country: qcZone.country || 'India',
                serviceLocation: qcZone.serviceLocation || `${city.name}, ${city.state}`,
                unit: qcZone.unit || 'kilometer',
                coordinates: qcZone.coordinates,
                isActive: true,
            },
            { label: `medical zone ${city.name}` },
        );
    }
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

const MODULES = [
    ['food', 'Food', seedFood],
    ['qc', 'Quick commerce', seedQuickCommerce],
    ['taxi', 'Taxi', seedTaxi],
    ['sp', 'Service provider', seedServiceProvider],
    ['medical', 'Medical zones', seedMedical],
];

async function main() {
    console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes; pass --apply to write)'}`);
    console.log(`Target database: ${URI_DB}`);

    mongoose = (await import('mongoose')).default;
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
    await mongoose.connect(URI, { autoIndex: false, autoCreate: false });

    const connectedDb = mongoose.connection.db?.databaseName;
    if (connectedDb !== REQUIRED_DB) {
        throw new Error(`Connected to database "${connectedDb}", expected "${REQUIRED_DB}". Aborting before any read or write.`);
    }

    await loadModels();

    const failures = [];
    for (const [key, title, fn] of MODULES) {
        if (ONLY && !ONLY.has(key)) continue;
        console.log(`\n=== ${title} ===`);
        try {
            await fn();
        } catch (err) {
            failures.push(title);
            console.error(`!!! ${title} FAILED: ${err?.message || err}`);
            if (err?.errors) {
                for (const [path, e] of Object.entries(err.errors)) console.error(`    - ${path}: ${e?.message}`);
            }
        }
    }

    console.log(`\n=== Summary (${APPLY ? 'applied' : 'dry run: "created" = would create, "updated" = would fill'}) ===`);
    const rows = [...STATS.entries()].sort(([a], [b]) => a.localeCompare(b));
    console.log(`${'collection'.padEnd(34)}${'created'.padStart(8)}${'existing'.padStart(10)}${'updated'.padStart(9)}${'skipped'.padStart(9)}`);
    for (const [coll, s] of rows) {
        console.log(`${coll.padEnd(34)}${String(s.created).padStart(8)}${String(s.existing).padStart(10)}${String(s.updated).padStart(9)}${String(s.skipped).padStart(9)}`);
    }
    if (failures.length) {
        console.log(`\nModules that failed: ${failures.join(', ')}`);
        process.exitCode = 1;
    }
    if (!APPLY) console.log('\nNothing was written. Re-run with --apply to write.');
}

main()
    .catch((err) => {
        console.error('Fatal:', err?.message || err);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose) await mongoose.disconnect().catch(() => {});
    });
