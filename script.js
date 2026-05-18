// ============================
// PLOTYS - PLOTY OPAVA
// Hlavní skript - sdílený mezi všemi stránkami
// ============================

// ===== KONSTANTY BEZPEČNOSTI =====
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hodiny
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minut
const APP_OBFUSCATION_KEY = 'plotys-2026-secure-storage-key-v1';

// ============================
// KRYPTOGRAFICKÉ FUNKCE (Web Crypto API)
// ============================

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function hashPassword(password, salt) {
  return await sha256(password + ':' + salt + ':' + APP_OBFUSCATION_KEY);
}

async function deriveAESKey(password) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password + APP_OBFUSCATION_KEY),
    'PBKDF2', false, ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name:'PBKDF2', salt: new TextEncoder().encode('plotys-salt-fixed'), iterations: 100000, hash:'SHA-256' },
    baseKey,
    { name:'AES-GCM', length:256 },
    false, ['encrypt','decrypt']
  );
}

async function encryptData(plaintext, password) {
  try {
    const key = await deriveAESKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name:'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('Šifrování selhalo:', e);
    return null;
  }
}

async function decryptData(ciphertext, password) {
  try {
    const key = await deriveAESKey(password);
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('Dešifrování selhalo:', e);
    return null;
  }
}


let PRODUCTS = [];
let COMPANY = {};
let IMAGES = {};
let cart = JSON.parse(localStorage.getItem('plotys_cart') || '[]');
let currentFilter = 'all';
let currentSort = 'default';
let searchQuery = '';

// ===== NAČTENÍ DATABÁZE =====
// Priorita: 1) globální proměnné z data.js (funguje i offline/file://),
//           2) fetch JSON souborů (pro server), 3) fallback data
async function loadDatabase() {
  // 1) Z data.js (preferováno - funguje vždy)
  if (window.PLOTYS_DATABASE) {
    PRODUCTS = window.PLOTYS_DATABASE.products || [];
    COMPANY = window.PLOTYS_DATABASE.company || {};
  } else {
    // 2) Fallback na fetch (pokud běží přes server)
    try {
      const res = await fetch('database.json');
      const data = await res.json();
      PRODUCTS = data.products;
      COMPANY = data.company;
    } catch {
      console.warn('Databáze nenalezena, používám fallback');
      PRODUCTS = FALLBACK_PRODUCTS;
      COMPANY = FALLBACK_COMPANY;
    }
  }

  if (window.PLOTYS_IMAGES) {
    IMAGES = window.PLOTYS_IMAGES;
  } else {
    try {
      const res = await fetch('images.json');
      IMAGES = await res.json();
    } catch {
      console.warn('images.json nenalezeno, používám fallback');
      IMAGES = FALLBACK_IMAGES;
    }
  }
  return { products: PRODUCTS, company: COMPANY, images: IMAGES };
}

// Fallback obrázků (pro případ že nelze načíst images.json)
const FALLBACK_IMAGES = {
  hero: { slides: [
    { image: 'images/hero/hero-1-dratene.jpg', title:'Drátěné ploty' },
    { image: 'images/hero/hero-2-drevene.jpg', title:'Dřevěné ploty' },
    { image: 'images/hero/hero-3-ploty.jpg', title:'Ploty' },
    { image: 'images/hero/hero-4-stavba.jpg', title:'Stavba' }
  ]},
  categories: {
    dratene: { image:'images/categories/cat-pletivove.jpg', fallbackColor:'#475569' },
    betonove: { image:'images/categories/cat-betonove.jpg', fallbackColor:'#64748b' },
    drevene: { image:'images/categories/cat-drevene.jpg', fallbackColor:'#92400e' },
    mobilni: { image:'images/categories/cat-mobilni.jpg', fallbackColor:'#1e40af' },
    brany: { image:'images/categories/cat-brany.jpg', fallbackColor:'#1e293b' },
    prislusenstvi: { image:'images/categories/cat-prislusenstvi.jpg', fallbackColor:'#854d0e' }
  },
  gallery: { items: [
    { image:'images/hero/hero-1-dratene.jpg', title:'Drátěný plot' },
    { image:'images/hero/hero-2-drevene.jpg', title:'Dřevěný plot' },
    { image:'images/hero/hero-3-ploty.jpg', title:'Ploty' },
    { image:'images/hero/hero-4-stavba.jpg', title:'Stavba' },
    { image:'images/products/prod-plot1.jpg', title:'Realizace' },
    { image:'images/products/prod-plot2.jpg', title:'Detail' },
    { image:'images/categories/cat-betonove.jpg', title:'Betonový plot' },
    { image:'images/categories/cat-pletivove.jpg', title:'Pletivový plot' }
  ]}
};

// ===== FALLBACK DATA (kdyby database.json nešel načíst kvůli file://) =====
const FALLBACK_COMPANY = {
  name: "Plotys - Ploty Opava",
  address: "Otická 36, Opava 746 01",
  phone: "+420 732 287 136",
  email: "postavplot@gmail.com"
};

const FALLBACK_PRODUCTS = [
  { id:1, cat:'dratene', name:'Pletivo PVC 50×50×2.5mm, výška 150cm', desc:'Poplastované pletivo s povrchovou úpravou PVC.', price:103, unit:'/m', icon:'🔲', badge:'Bestseller', color:'#475569', stock:250 },
  { id:2, cat:'dratene', name:'Pletivo poplastované 60×60mm, výška 180cm', desc:'Klasické zahradní pletivo, zelené.', price:128, unit:'/m', icon:'🔲', color:'#334155', stock:180 },
  { id:3, cat:'dratene', name:'Svařované pletivo 50×100mm', desc:'Pevné svařované pletivo pro průmyslové využití.', price:185, unit:'/m', icon:'⊞', color:'#475569', stock:95 },
  { id:4, cat:'dratene', name:'Průmyslový panel 3D, 200×250cm', desc:'Robustní svařovaný panel s prolisy.', price:1290, unit:'/ks', icon:'▦', badge:'Nejprodávanější', color:'#334155', stock:42 },
  { id:5, cat:'dratene', name:'Chovatelské pletivo 13×25mm', desc:'Husté pletivo pro drobné zvířectvo.', price:78, unit:'/m', icon:'⊟', color:'#475569', stock:320 },
  { id:6, cat:'dratene', name:'Podhrabová deska 20×5cm, koncová', desc:'Betonová deska pod plot, koncový kus.', price:100, unit:'/ks', icon:'▬', color:'#64748b', stock:156 },
  { id:7, cat:'betonove', name:'Betonový plot - imitace dřeva 200×50cm', desc:'Dekorativní betonový plot s realistickou texturou.', price:890, unit:'/ks', icon:'🧱', badge:'Novinka', color:'#64748b', stock:28 },
  { id:8, cat:'betonove', name:'Betonová deska kámen, 200×50cm', desc:'Plotovka s imitací přírodního kamene.', price:790, unit:'/ks', icon:'🧱', color:'#94a3b8', stock:35 },
  { id:9, cat:'betonove', name:'Betonový sloupek 250cm', desc:'Sloupek pro betonový plot.', price:450, unit:'/ks', icon:'▌', color:'#64748b', stock:60 },
  { id:10, cat:'betonove', name:'Betonový plot hladký 200×50cm', desc:'Klasický hladký betonový panel.', price:690, unit:'/ks', icon:'▭', color:'#94a3b8', stock:40 },
  { id:11, cat:'drevene', name:'Dřevěná plotovka 90×9cm', desc:'Smrková plotovka, broušená, impregnovaná.', price:45, unit:'/ks', icon:'🪵', color:'#92400e', stock:400 },
  { id:12, cat:'drevene', name:'Dřevěný plot rustikální 180×100cm', desc:'Hotový dřevěný plot v rustikálním stylu.', price:1490, unit:'/ks', icon:'🪵', badge:'Akce', color:'#b45309', stock:18 },
  { id:13, cat:'drevene', name:'Dřevěný sloupek 9×9×200cm', desc:'Hranol z impregnovaného dřeva.', price:280, unit:'/ks', icon:'▌', color:'#92400e', stock:75 },
  { id:14, cat:'drevene', name:'Půlkulatina pro plot, průměr 8cm', desc:'Půlkulatý dřevěný díl pro plot.', price:38, unit:'/ks', icon:'🪵', color:'#b45309', stock:220 },
  { id:15, cat:'mobilni', name:'Mobilní oplocení 350×200cm', desc:'Standardní mobilní plot, pozinkovaný.', price:1290, unit:'/ks', icon:'⊞', color:'#1e40af', stock:22 },
  { id:16, cat:'mobilni', name:'Patka mobilního oplocení betonová', desc:'Betonová patka 25kg pro mobilní plot.', price:240, unit:'/ks', icon:'■', color:'#1d4ed8', stock:60 },
  { id:17, cat:'mobilni', name:'Spojka mobilního oplocení', desc:'Pozinkovaná spojka pro mobilní ploty.', price:65, unit:'/ks', icon:'🔗', color:'#1e40af', stock:130 },
  { id:18, cat:'brany', name:'Vjezdová brána 400×150cm dvoukřídlá', desc:'Pozinkovaná brána s výplní pletivem.', price:8990, unit:'/ks', icon:'🚪', badge:'Premium', color:'#1e293b', stock:6 },
  { id:19, cat:'brany', name:'Branka 100×150cm s pletivem', desc:'Vstupní branka s pevnou konstrukcí.', price:2490, unit:'/ks', icon:'🚪', color:'#334155', stock:14 },
  { id:20, cat:'brany', name:'Posuvná brána 400×170cm', desc:'Samonosná posuvná brána, antracit.', price:14900, unit:'/ks', icon:'🚪', color:'#1e293b', stock:4 },
  { id:21, cat:'prislusenstvi', name:'Sloupek 38×38×2000mm zelený', desc:'Plotový sloupek s povrchovou úpravou.', price:189, unit:'/ks', icon:'▌', color:'#854d0e', stock:200 },
  { id:22, cat:'prislusenstvi', name:'Vzpěra 38×38×2000mm', desc:'Vzpěra pro plotové sloupky.', price:195, unit:'/ks', icon:'╱', color:'#a16207', stock:150 },
  { id:23, cat:'prislusenstvi', name:'Napínací drát 3.4mm, 26m', desc:'Pozinkovaný napínací drát.', price:240, unit:'/role', icon:'〰', color:'#854d0e', stock:80 },
  { id:24, cat:'prislusenstvi', name:'Drátový spojovník se šroubem', desc:'Spojka pro napínací drát.', price:6, unit:'/ks', icon:'🔩', color:'#a16207', stock:1500 },
  { id:25, cat:'prislusenstvi', name:'Napínák drátu', desc:'Nástroj na napínání drátu.', price:22, unit:'/ks', icon:'🔧', color:'#854d0e', stock:60 },
  { id:26, cat:'prislusenstvi', name:'PVC krytka na sloupek 38mm', desc:'Plastová krytka, zelená.', price:8, unit:'/ks', icon:'●', color:'#a16207', stock:800 }
];

// ===== UTILITY =====
function formatPrice(price) {
  return price.toLocaleString('cs-CZ') + ' Kč';
}

function categoryLabel(cat) {
  const labels = {
    dratene:'Drátěné ploty', betonove:'Betonové ploty', drevene:'Dřevěné ploty',
    mobilni:'Mobilní oplocení', brany:'Brány a branky', prislusenstvi:'Příslušenství'
  };
  return labels[cat] || cat;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== HEADER & MENU =====
window.addEventListener('resize', positionBanner);
window.addEventListener('load', positionBanner);

function initHeader() {
  window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (!header) return;
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  });
}

function toggleMenu() {
  const nav = document.getElementById('nav');
  const toggle = document.querySelector('.menu-toggle');
  if (nav) nav.classList.toggle('active');
  if (toggle) toggle.classList.toggle('active');
}

document.addEventListener('click', e => {
  const nav = document.getElementById('nav');
  const toggle = document.querySelector('.menu-toggle');
  if (!nav || !toggle) return;
  if (nav.classList.contains('active') && !nav.contains(e.target) && !toggle.contains(e.target)) {
    nav.classList.remove('active');
    toggle.classList.remove('active');
  }
});

// ===== ESHOP RENDER =====
async function initEshop() {
  await loadDatabase();
  renderEshopCategories();
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  if (cat) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
  }
  renderProducts();
  renderCart();
}

// ===== KATEGORIE V E-SHOPU (filtrují místo navigace) =====
function renderEshopCategories() {
  const grid = document.getElementById('eshopCategoriesGrid');
  if (!grid) return;
  const cats = [
    { key:'dratene', name:'Drátěné ploty', desc:'Pletivové ploty, průmyslové panely' },
    { key:'betonove', name:'Betonové ploty', desc:'Pevné a odolné oplocení' },
    { key:'drevene', name:'Dřevěné ploty', desc:'Tradiční dřevěné oplocení' },
    { key:'mobilni', name:'Mobilní oplocení', desc:'Pro stavby a akce' },
    { key:'brany', name:'Brány a branky', desc:'Vjezdové i vstupní' },
    { key:'prislusenstvi', name:'Příslušenství', desc:'Sloupky, dráty, montážní prvky' }
  ];
  grid.innerHTML = cats.map(c => {
    const conf = (IMAGES.categories && IMAGES.categories[c.key]) || {};
    const img = conf.image || '';
    const fallbackBg = `linear-gradient(135deg,${conf.fallbackColor || '#1a1a1a'},#000)`;
    return `
      <a href="#" class="category-card fade-in" onclick="selectEshopCategory(event,'${c.key}')">
        <div class="category-img" data-img="${img}" style="background:${fallbackBg};"></div>
        <div class="category-body">
          <h3>${c.name}</h3>
          <p>${c.desc}</p>
          <span class="category-link">Zobrazit produkty →</span>
        </div>
      </a>
    `;
  }).join('');
  // Načíst pozadí kategorií s fallbackem
  document.querySelectorAll('#eshopCategoriesGrid .category-img[data-img]').forEach(el => {
    const img = el.dataset.img;
    if (!img) return;
    const test = new Image();
    test.onload = () => el.style.backgroundImage = `url('${img}')`;
    test.onerror = () => {};
    test.src = img;
  });
}

function selectEshopCategory(e, key) {
  e.preventDefault();
  filterProducts(key);
  // Plynulý scroll na produkty
  const target = document.querySelector('.eshop-section') || document.getElementById('productsGrid');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getFilteredProducts() {
  let list = currentFilter === 'all' ? [...PRODUCTS] : PRODUCTS.filter(p => p.cat === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  }
  if (currentSort === 'price-asc') list.sort((a,b) => a.price - b.price);
  else if (currentSort === 'price-desc') list.sort((a,b) => b.price - a.price);
  else if (currentSort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'cs'));
  return list;
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const noResults = document.getElementById('noResults');
  if (!grid) return;
  const filtered = getFilteredProducts();
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (noResults) noResults.style.display = 'block';
    return;
  }
  if (noResults) noResults.style.display = 'none';
  grid.innerHTML = filtered.map(p => {
    const hasImg = p.image && p.image.trim() !== '';
    const imgHtml = hasImg
      ? `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML=this.parentElement.dataset.fallback;">`
      : '';
    const fallbackHtml = `<div class="product-img-placeholder" style="background:linear-gradient(135deg,${p.color},${p.color}dd);"><span class="icon">${p.icon}</span></div>`;
    return `
    <div class="product-card fade-in" data-id="${p.id}">
      <div class="product-img" data-fallback='${fallbackHtml.replace(/'/g, "&apos;")}'>
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        ${p.stock > 0 ? `<span class="product-stock">✓ Skladem</span>` : ''}
        ${hasImg ? imgHtml : fallbackHtml}
      </div>
      <div class="product-body">
        <span class="product-cat">${categoryLabel(p.cat)}</span>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-footer">
          <div class="product-price">${formatPrice(p.price)}<small>${p.unit}</small></div>
          <button class="add-to-cart" onclick="addToCart(${p.id})" aria-label="Přidat do košíku">+</button>
        </div>
      </div>
    </div>
  `}).join('');
  initFadeIn();
}

function filterProducts(cat) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderProducts();
}

function searchProducts(q) {
  searchQuery = q.trim();
  renderProducts();
}

function sortProducts(value) {
  currentSort = value;
  renderProducts();
}

// ===== KOŠÍK =====
function addToCart(id) {
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id:product.id, name:product.name, price:product.price, unit:product.unit, icon:product.icon, image:product.image||'', qty:1 });
  }
  saveCart();
  renderCart();
  showToast(`✓ ${product.name} přidáno do košíku`, 'success');
  pulseCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else { saveCart(); renderCart(); }
}

function saveCart() {
  localStorage.setItem('plotys_cart', JSON.stringify(cart));
}

function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (!cartCount) return;
  const totalQty = cart.reduce((s,i) => s+i.qty, 0);
  cartCount.textContent = totalQty;
  cartCount.style.display = totalQty > 0 ? 'flex' : 'none';
}

function renderCart() {
  updateCartCount();
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  if (!cartItems) return;
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty"><p style="font-size:60px;margin-bottom:16px;">🛒</p><p>Váš košík je prázdný</p><p style="margin-top:16px;font-size:13px;color:var(--gray-500);">Přidejte produkty kliknutím na tlačítko +</p></div>';
    if (cartTotal) cartTotal.textContent = '0 Kč';
    return;
  }
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.image ? `<img src="${item.image}" alt="" onerror="this.outerHTML='${item.icon}'">` : item.icon}</div>
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
        <div class="qty-control">
          <button onclick="changeQty(${item.id},-1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${item.id},1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" aria-label="Odebrat">×</button>
    </div>
  `).join('');
  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);
  if (cartTotal) cartTotal.textContent = formatPrice(total);
}

function toggleCart() {
  document.getElementById('cartSidebar')?.classList.toggle('active');
  document.getElementById('cartOverlay')?.classList.toggle('active');
}

function pulseCart() {
  const btn = document.querySelector('.cart-btn');
  if (!btn) return;
  btn.style.transform = 'scale(1.2)';
  setTimeout(() => btn.style.transform = '', 300);
}

// ===== CHECKOUT & ORDER =====
function checkout() {
  if (cart.length === 0) {
    showToast('Košík je prázdný', 'error');
    return;
  }
  toggleCart();
  const summary = document.getElementById('checkoutSummary');
  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);
  summary.innerHTML = cart.map(i => `
    <div class="summary-row"><span>${i.name} × ${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></div>
  `).join('') + `<div class="summary-row total"><span>Celkem k platbě:</span><span>${formatPrice(total)}</span></div>`;
  document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckout() {
  document.getElementById('checkoutModal')?.classList.remove('active');
}

function generateOrderNumber() {
  const d = new Date();
  const ts = d.getFullYear().toString().slice(-2) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `OBJ-${ts}-${rnd}`;
}

async function finalizeOrder(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const orderNumber = generateOrderNumber();
  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const paymentFee = fd.get('payment') === 'Dobírka' ? 30 : 0;

  const order = {
    orderNumber,
    date: new Date().toISOString(),
    customer: {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      street: fd.get('street'),
      city: fd.get('city'),
      zip: fd.get('zip')
    },
    items: cart.map(i => ({
      id: i.id, name: i.name, qty: i.qty, price: i.price, total: i.price * i.qty, unit: i.unit
    })),
    payment: fd.get('payment'),
    paymentFee,
    note: fd.get('note') || '',
    total: total + paymentFee,
    status: 'Nová'
  };

  // Uložit do šifrované databáze objednávek
  const orders = await getOrdersDecrypted();
  orders.unshift(order);
  await saveOrdersEncrypted(orders);

  // Odeslat email notifikaci přes FormSubmit
  await sendOrderNotification(order);

  // Vyčistit košík
  cart = [];
  saveCart();
  renderCart();

  // Zobrazit úspěch
  closeCheckout();
  document.getElementById('orderNumber').textContent = orderNumber;
  document.getElementById('successModal').classList.add('active');
  form.reset();
}

async function sendOrderNotification(order) {
  const notifyEmail = localStorage.getItem('plotys_notify_email') || 'postavplot@gmail.com';
  const itemsList = order.items.map(i => `${i.name} - ${i.qty}× ${formatPrice(i.price)} = ${formatPrice(i.total)}`).join('\n');

  const formData = new FormData();
  formData.append('_subject', `Nová objednávka ${order.orderNumber} - Plotys`);
  formData.append('_template', 'table');
  formData.append('Číslo objednávky', order.orderNumber);
  formData.append('Datum', new Date(order.date).toLocaleString('cs-CZ'));
  formData.append('Jméno', `${order.customer.firstName} ${order.customer.lastName}`);
  formData.append('Telefon', order.customer.phone);
  formData.append('Email', order.customer.email);
  formData.append('Adresa', `${order.customer.street}, ${order.customer.city}, ${order.customer.zip}`);
  formData.append('Položky', itemsList);
  formData.append('Způsob platby', order.payment);
  formData.append('Poznámka', order.note || '-');
  formData.append('Celkem', formatPrice(order.total));

  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData
    });
  } catch (err) {
    console.warn('Email notifikace selhala (offline?):', err);
  }
}

// ===== KONTAKTNÍ FORMULÁŘ =====
async function submitContactForm(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const notifyEmail = localStorage.getItem('plotys_notify_email') || 'postavplot@gmail.com';
  const formData = new FormData();
  formData.append('_subject', 'Nová zpráva z webu Plotys');
  formData.append('Jméno', fd.get('name'));
  formData.append('Email', fd.get('email'));
  formData.append('Telefon', fd.get('phone') || '-');
  formData.append('Zpráva', fd.get('message'));
  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: 'POST', headers:{'Accept':'application/json'}, body: formData
    });
  } catch {}
  showToast('✓ Zpráva byla odeslána. Děkujeme!', 'success');
  form.reset();
}

// ===== STATUS BANNER =====
const STATUS_PRESETS = {
  open: { type:'open', text:'✓ Máme otevřeno - Po-Pá 8:00-16:00, So 8:00-12:00' },
  holiday: { type:'closed', text:'✕ Dovolená - obchod zavřen. Objednávky vyřídíme po návratu.' },
  busy: { type:'warning', text:'⚠ Zvýšený zájem - dodací doba se může prodloužit o 2-3 dny' },
  closed: { type:'closed', text:'✕ Dnes máme zavřeno' }
};

function positionBanner() {
  const banner = document.getElementById('statusBanner');
  const header = document.getElementById('header');
  if (banner && header && banner.style.display !== 'none') {
    banner.style.top = header.offsetHeight + 'px';
  }
}

function loadStatus() {
  const saved = JSON.parse(localStorage.getItem('plotys_status') || 'null');
  const banner = document.getElementById('statusBanner');
  const text = document.getElementById('statusText');
  if (!banner) return;
  if (!saved || saved.type === 'hidden') {
    banner.style.display = 'none';
    return;
  }
  banner.className = 'status-banner ' + (saved.type === 'open' ? '' : saved.type);
  banner.style.display = '';
  if (text) text.textContent = saved.text;
  requestAnimationFrame(positionBanner);
}

function closeStatus() {
  const banner = document.getElementById('statusBanner');
  if (banner) banner.style.display = 'none';
}

function openAdminPanel() {
  const saved = JSON.parse(localStorage.getItem('plotys_status') || '{"type":"open","text":"✓ Máme otevřeno - Po-Pá 8:00-16:00, So 8:00-12:00"}');
  document.getElementById('statusType').value = saved.type;
  document.getElementById('statusMessage').value = saved.text;
  document.getElementById('adminModal').classList.add('active');
}

function closeAdminPanel() {
  document.getElementById('adminModal')?.classList.remove('active');
}

function setPreset(key) {
  const preset = STATUS_PRESETS[key];
  document.getElementById('statusType').value = preset.type;
  document.getElementById('statusMessage').value = preset.text;
}

function saveStatus() {
  const type = document.getElementById('statusType').value;
  const text = document.getElementById('statusMessage').value;
  localStorage.setItem('plotys_status', JSON.stringify({type, text}));
  loadStatus();
  closeAdminPanel();
  showToast('✓ Status byl úspěšně aktualizován', 'success');
}

// ===== HOMEPAGE INIT =====
async function initHomepage() {
  await loadDatabase();
  renderHeroSlider();
  renderCategoriesHomepage();
  renderGallery();
  initFadeIn();
}

// ===== HERO SLIDER =====
let currentSlide = 0;
let slideInterval;

function renderHeroSlider() {
  const slides = (IMAGES.hero && IMAGES.hero.slides) || FALLBACK_IMAGES.hero.slides;
  const container = document.getElementById('heroSlides');
  const indicators = document.getElementById('heroIndicators');
  if (!container) return;
  container.innerHTML = slides.map((s, i) => `
    <div class="hero-slide ${i===0?'active':''}" data-img="${s.image}"></div>
  `).join('');
  if (indicators) {
    indicators.innerHTML = slides.map((_, i) => `
      <div class="hero-indicator ${i===0?'active':''}" onclick="goToSlide(${i})"></div>
    `).join('');
  }
  // Načíst obrázky s fallbackem
  document.querySelectorAll('.hero-slide').forEach(el => {
    const img = el.dataset.img;
    if (img) {
      const test = new Image();
      test.onload = () => el.style.backgroundImage = `url('${img}')`;
      test.onerror = () => el.style.background = 'linear-gradient(135deg,#1a1a1a,#2d6a4f)';
      test.src = img;
    }
  });
  if (slides.length > 1) {
    slideInterval = setInterval(nextSlide, 6000);
  }
}

function goToSlide(idx) {
  const slides = document.querySelectorAll('.hero-slide');
  const inds = document.querySelectorAll('.hero-indicator');
  slides.forEach(s => s.classList.remove('active'));
  inds.forEach(i => i.classList.remove('active'));
  slides[idx]?.classList.add('active');
  inds[idx]?.classList.add('active');
  currentSlide = idx;
  clearInterval(slideInterval);
  slideInterval = setInterval(nextSlide, 6000);
}

function nextSlide() {
  const slides = document.querySelectorAll('.hero-slide');
  goToSlide((currentSlide + 1) % slides.length);
}

// ===== KATEGORIE NA HLAVNÍ STRÁNCE =====
function renderCategoriesHomepage() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  const cats = [
    { key:'dratene', name:'Drátěné ploty', desc:'Pletivové ploty, průmyslové panely' },
    { key:'betonove', name:'Betonové ploty', desc:'Pevné a odolné oplocení' },
    { key:'drevene', name:'Dřevěné ploty', desc:'Tradiční dřevěné oplocení' },
    { key:'mobilni', name:'Mobilní oplocení', desc:'Pro stavby a akce' },
    { key:'brany', name:'Brány a branky', desc:'Vjezdové i vstupní' },
    { key:'prislusenstvi', name:'Příslušenství', desc:'Sloupky, dráty, montážní prvky' }
  ];
  grid.innerHTML = cats.map(c => {
    const conf = (IMAGES.categories && IMAGES.categories[c.key]) || {};
    const img = conf.image || '';
    const fallbackBg = `linear-gradient(135deg,${conf.fallbackColor || '#1a1a1a'},#000)`;
    return `
      <a href="eshop.html?cat=${c.key}" class="category-card fade-in">
        <div class="category-img" data-img="${img}" style="background:${fallbackBg};"></div>
        <div class="category-body">
          <h3>${c.name}</h3>
          <p>${c.desc}</p>
          <span class="category-link">Zobrazit produkty →</span>
        </div>
      </a>
    `;
  }).join('');
  // Lazy load category images with fallback
  document.querySelectorAll('.category-img[data-img]').forEach(el => {
    const img = el.dataset.img;
    if (!img) return;
    const test = new Image();
    test.onload = () => el.style.backgroundImage = `url('${img}')`;
    test.onerror = () => {}; // fallback gradient zůstane
    test.src = img;
  });
}

// ===== GALERIE =====
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const items = (IMAGES.gallery && IMAGES.gallery.items) || FALLBACK_IMAGES.gallery.items;
  grid.innerHTML = items.map(g => `
    <div class="gallery-item fade-in" data-title="${g.title}">
      <div class="gallery-img" data-img="${g.image}"></div>
    </div>
  `).join('');
  document.querySelectorAll('.gallery-img[data-img]').forEach(el => {
    const img = el.dataset.img;
    if (!img) return;
    const test = new Image();
    test.onload = () => el.style.backgroundImage = `url('${img}')`;
    test.onerror = () => { el.style.background = 'linear-gradient(135deg,#1a1a1a,#2d6a4f)'; };
    test.src = img;
  });
}

// ===== FADE IN =====
let observer;
function initFadeIn() {
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
  }
  
  // 1. Zacílí všechny elementy, co už mají fade-in (např. samotné produkty)
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
  
  // 2. TADY JE OPRAVA: Přidáno :not(.eshop-section), aby se neanimoval celý gigantický blok
  document.querySelectorAll('.section:not(.eshop-section), .about-card, .category-card, .service-item, .contact-item').forEach(el => {
    if (!el.classList.contains('fade-in')) el.classList.add('fade-in');
    observer.observe(el);
  });
}

// ===== ESC KEY =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    const cartEl = document.getElementById('cartSidebar');
    if (cartEl?.classList.contains('active')) toggleCart();
  }
});

// ============================
// AUTENTIFIKACE ADMIN
// ============================

async function initAuth() {
  // Kontrola zámku
  const lockUntil = parseInt(localStorage.getItem('plotys_auth_lockout') || '0');
  if (lockUntil > Date.now()) {
    showLockMessage(lockUntil);
  }

  const stored = localStorage.getItem('plotys_auth');
  if (!stored) {
    // První spuštění - setup
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('setupView').style.display = 'block';
    initPasswordStrength();
    return;
  }

  // Existující heslo - kontrola session
  const session = sessionStorage.getItem('plotys_session');
  if (session) {
    try {
      const s = JSON.parse(session);
      if (s.expires > Date.now() && s.token) {
        const valid = await verifySession(s);
        if (valid) {
          showAdmin();
          return;
        }
      }
    } catch {}
  }
  // Zobrazit přihlášení
  document.getElementById('loginPassword').focus();
}

async function verifySession(session) {
  const stored = JSON.parse(localStorage.getItem('plotys_auth') || '{}');
  const expectedToken = await sha256(stored.hash + session.created + APP_OBFUSCATION_KEY);
  return expectedToken === session.token;
}

function showLockMessage(lockUntil) {
  const minutes = Math.ceil((lockUntil - Date.now()) / 60000);
  const msg = document.getElementById('authLockMessage');
  if (msg) {
    msg.style.display = 'block';
    msg.innerHTML = `🔒 <strong>Účet je dočasně uzamčen</strong> z důvodu příliš mnoha chybných pokusů.<br>Zkuste to znovu za ${minutes} minut.`;
  }
  const form = document.getElementById('loginForm');
  if (form) form.style.opacity = '0.4';
  document.querySelectorAll('#loginForm input, #loginForm button').forEach(el => el.disabled = true);
}

async function handleSetup(e) {
  e.preventDefault();
  const pw1 = document.getElementById('newPassword').value;
  const pw2 = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('setupError');

  if (pw1 !== pw2) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Hesla se neshodují';
    return;
  }
  if (pw1.length < 8) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Heslo musí mít alespoň 8 znaků';
    return;
  }

  const salt = generateSalt();
  const hash = await hashPassword(pw1, salt);
  localStorage.setItem('plotys_auth', JSON.stringify({ hash, salt, created: Date.now() }));

  await createSession(pw1);
  showToast('✓ Heslo vytvořeno. Přihlášení proběhlo úspěšně.', 'success');
  setTimeout(() => showAdmin(), 800);
}

async function handleLogin(e) {
  e.preventDefault();
  const lockUntil = parseInt(localStorage.getItem('plotys_auth_lockout') || '0');
  if (lockUntil > Date.now()) {
    showLockMessage(lockUntil);
    return;
  }

  const pw = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const stored = JSON.parse(localStorage.getItem('plotys_auth') || '{}');

  const hash = await hashPassword(pw, stored.salt);
  if (hash === stored.hash) {
    // Úspěch
    localStorage.removeItem('plotys_auth_attempts');
    await createSession(pw);
    showAdmin();
    showToast('✓ Přihlášení úspěšné', 'success');
  } else {
    // Chyba
    const attempts = parseInt(localStorage.getItem('plotys_auth_attempts') || '0') + 1;
    localStorage.setItem('plotys_auth_attempts', attempts);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockTime = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem('plotys_auth_lockout', lockTime);
      localStorage.removeItem('plotys_auth_attempts');
      showLockMessage(lockTime);
      return;
    }
    errorEl.style.display = 'block';
    errorEl.textContent = `Nesprávné heslo. Zbývá ${MAX_LOGIN_ATTEMPTS - attempts} pokusů.`;
    document.getElementById('loginPassword').value = '';
  }
}

async function createSession(password) {
  const stored = JSON.parse(localStorage.getItem('plotys_auth'));
  const created = Date.now();
  const expires = created + SESSION_DURATION_MS;
  const token = await sha256(stored.hash + created + APP_OBFUSCATION_KEY);
  sessionStorage.setItem('plotys_session', JSON.stringify({ created, expires, token }));
}

function showAdmin() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('header').style.display = 'block';
  document.getElementById('adminPage').style.display = 'block';
  renderOrdersAdmin();
  loadNotifyEmail();
  if (typeof loadBannerAdmin === 'function') loadBannerAdmin();
  startActivityMonitor();
}

let activityTimeout;
function startActivityMonitor() {
  const reset = () => {
    clearTimeout(activityTimeout);
    const session = sessionStorage.getItem('plotys_session');
    if (session) {
      try {
        const s = JSON.parse(session);
        s.expires = Date.now() + SESSION_DURATION_MS;
        sessionStorage.setItem('plotys_session', JSON.stringify(s));
      } catch {}
    }
    activityTimeout = setTimeout(() => {
      showToast('Odhlášeno z důvodu neaktivity', 'error');
      logout();
    }, SESSION_DURATION_MS);
  };
  ['click','keydown','scroll','touchstart'].forEach(ev => document.addEventListener(ev, reset));
  reset();
}

function logout(e) {
  if (e) e.preventDefault();
  sessionStorage.removeItem('plotys_session');
  location.reload();
}

function resetPassword(e) {
  if (e) e.preventDefault();
  if (!confirm('VAROVÁNÍ: Reset hesla smaže všechna data včetně objednávek. Pokračovat?')) return;
  if (!confirm('Opravdu? Toto je nevratné!')) return;
  localStorage.removeItem('plotys_auth');
  localStorage.removeItem('plotys_orders');
  localStorage.removeItem('plotys_auth_attempts');
  localStorage.removeItem('plotys_auth_lockout');
  sessionStorage.clear();
  location.reload();
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function initPasswordStrength() {
  const input = document.getElementById('newPassword');
  const meter = document.getElementById('passwordStrength');
  if (!input || !meter) return;
  input.addEventListener('input', () => {
    const pw = input.value;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['Velmi slabé','Slabé','Středně silné','Silné','Velmi silné'];
    const colors = ['#ef4444','#f59e0b','#eab308','#10b981','#059669'];
    if (pw.length === 0) { meter.innerHTML = ''; return; }
    const idx = Math.min(score, 4);
    meter.innerHTML = `
      <div class="strength-bar"><div style="width:${(score/5)*100}%;background:${colors[idx]}"></div></div>
      <small style="color:${colors[idx]}">${labels[idx]}</small>
    `;
  });
}

function openChangePassword() {
  document.getElementById('changePasswordModal').classList.add('active');
}

function closeChangePassword() {
  document.getElementById('changePasswordModal').classList.remove('active');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPw = document.getElementById('oldPassword').value;
  const newPw = document.getElementById('newPasswordChange').value;
  const confirmPw = document.getElementById('confirmNewPassword').value;
  const errorEl = document.getElementById('changePasswordError');
  const stored = JSON.parse(localStorage.getItem('plotys_auth') || '{}');

  errorEl.style.display = 'none';
  const oldHash = await hashPassword(oldPw, stored.salt);
  if (oldHash !== stored.hash) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Současné heslo je nesprávné';
    return;
  }
  if (newPw !== confirmPw) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Nová hesla se neshodují';
    return;
  }
  if (newPw.length < 8) {
    errorEl.style.display = 'block';
    errorEl.textContent = 'Nové heslo musí mít alespoň 8 znaků';
    return;
  }

  // Uložit nové heslo
  const newSalt = generateSalt();
  const newHash = await hashPassword(newPw, newSalt);
  localStorage.setItem('plotys_auth', JSON.stringify({ hash: newHash, salt: newSalt, created: Date.now() }));

  await createSession(newPw);
  closeChangePassword();
  showToast('✓ Heslo bylo úspěšně změněno', 'success');
  e.target.reset();
}

// ============================
// ADMIN STRÁNKA - OBJEDNÁVKY
// ============================

async function getOrdersDecrypted() {
  let combined = [];
  // Šifrované objednávky
  const enc = localStorage.getItem('plotys_orders_enc');
  if (enc) {
    const decrypted = await decryptData(enc, APP_OBFUSCATION_KEY);
    if (decrypted) {
      try { combined = JSON.parse(decrypted); } catch {}
    }
  }
  // Nešifrované (legacy)
  const plain = JSON.parse(localStorage.getItem('plotys_orders') || '[]');
  if (plain.length) {
    combined = [...plain, ...combined];
    // Migrace na šifrované
    await saveOrdersEncrypted(combined);
    localStorage.removeItem('plotys_orders');
  }
  return combined;
}

async function renderOrdersAdmin() {
  const orders = await getOrdersDecrypted();
  const tbody = document.getElementById('ordersBody');
  const mobile = document.getElementById('ordersMobile');
  const noOrders = document.getElementById('noOrders');
  const table = document.getElementById('ordersTable');
  if (!tbody) return;

  document.getElementById('totalOrders').textContent = orders.length;
  const totalRev = orders.reduce((s,o) => s + o.total, 0);
  document.getElementById('totalRevenue').textContent = formatPrice(totalRev);
  const today = new Date().toDateString();
  const todayCount = orders.filter(o => new Date(o.date).toDateString() === today).length;
  document.getElementById('todayOrders').textContent = todayCount;
  document.getElementById('avgOrder').textContent = orders.length ? formatPrice(Math.round(totalRev / orders.length)) : '0 Kč';

  if (orders.length === 0) {
    if (table) table.style.display = 'none';
    if (mobile) mobile.style.display = 'none';
    if (noOrders) noOrders.style.display = 'block';
    return;
  }
  if (table) table.style.display = '';
  if (mobile) mobile.style.display = '';
  if (noOrders) noOrders.style.display = 'none';

  tbody.innerHTML = orders.map((o, idx) => `
    <tr>
      <td><strong class="order-link" onclick="showOrderDetail(${idx})">${o.orderNumber}</strong></td>
      <td>${new Date(o.date).toLocaleString('cs-CZ')}</td>
      <td>${o.customer.firstName} ${o.customer.lastName}</td>
      <td>${o.customer.phone}<br><small>${o.customer.email}</small></td>
      <td>${o.customer.street}, ${o.customer.city}</td>
      <td>${o.items.length} ks položek</td>
      <td>${o.payment}</td>
      <td><strong>${formatPrice(o.total)}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showOrderDetail(${idx})">Detail</button>
        <button class="btn btn-sm btn-outline btn-danger" onclick="deleteOrder(${idx})">×</button>
      </td>
    </tr>
  `).join('');

  // Mobile karty
  if (mobile) {
    mobile.innerHTML = orders.map((o, idx) => `
      <div class="order-card" onclick="showOrderDetail(${idx})">
        <div class="order-card-header">
          <strong>${o.orderNumber}</strong>
          <span class="order-card-total">${formatPrice(o.total)}</span>
        </div>
        <div class="order-card-meta">${new Date(o.date).toLocaleString('cs-CZ')}</div>
        <div class="order-card-row"><span>👤</span> ${o.customer.firstName} ${o.customer.lastName}</div>
        <div class="order-card-row"><span>📞</span> ${o.customer.phone}</div>
        <div class="order-card-row"><span>📍</span> ${o.customer.street}, ${o.customer.city}</div>
        <div class="order-card-row"><span>📦</span> ${o.items.length} položek · ${o.payment}</div>
        <div class="order-card-actions">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();showOrderDetail(${idx})">Detail</button>
          <button class="btn btn-sm btn-outline btn-danger" onclick="event.stopPropagation();deleteOrder(${idx})">Smazat</button>
        </div>
      </div>
    `).join('');
  }
}

async function showOrderDetail(idx) {
  const orders = await getOrdersDecrypted();
  const o = orders[idx];
  if (!o) return;
  const itemsHtml = o.items.map(i => `
    <div class="detail-items-row">
      <span>${i.name}</span>
      <span>${i.qty}× ${formatPrice(i.price)}</span>
      <strong>${formatPrice(i.total)}</strong>
    </div>
  `).join('');
  document.getElementById('detailContent').innerHTML = `
    <div class="order-detail">
      <h2>Objednávka ${o.orderNumber}</h2>
      <div class="order-meta">
        <span><strong>Datum:</strong> ${new Date(o.date).toLocaleString('cs-CZ')}</span>
        <span><strong>Stav:</strong> ${o.status}</span>
        <span><strong>Platba:</strong> ${o.payment}</span>
      </div>
      <div class="detail-section">
        <h3>Zákazník</h3>
        <div class="detail-grid">
          <div><strong>Jméno</strong>${o.customer.firstName} ${o.customer.lastName}</div>
          <div><strong>Telefon</strong><a href="tel:${o.customer.phone}">${o.customer.phone}</a></div>
          <div><strong>E-mail</strong><a href="mailto:${o.customer.email}">${o.customer.email}</a></div>
          <div><strong>Adresa</strong>${o.customer.street}, ${o.customer.city}, ${o.customer.zip}</div>
        </div>
      </div>
      <div class="detail-section">
        <h3>Položky objednávky</h3>
        <div class="detail-items">
          <div class="detail-items-row header">
            <span>Produkt</span><span>Množství</span><span>Cena</span>
          </div>
          ${itemsHtml}
          ${o.paymentFee ? `<div class="detail-items-row"><span>Poplatek za ${o.payment}</span><span></span><strong>${formatPrice(o.paymentFee)}</strong></div>` : ''}
          <div class="detail-items-row total">
            <span>CELKEM</span><span></span><strong>${formatPrice(o.total)}</strong>
          </div>
        </div>
      </div>
      ${o.note ? `<div class="detail-section"><h3>Poznámka</h3><p style="padding:14px;background:var(--cream);border-radius:8px;">${o.note}</p></div>` : ''}
    </div>
  `;
  document.getElementById('detailModal').classList.add('active');
}

function closeDetail() {
  document.getElementById('detailModal')?.classList.remove('active');
}

async function deleteOrder(idx) {
  if (!confirm('Opravdu chcete smazat tuto objednávku?')) return;
  const orders = await getOrdersDecrypted();
  orders.splice(idx, 1);
  await saveOrdersEncrypted(orders);
  renderOrdersAdmin();
  showToast('Objednávka byla smazána', 'success');
}

async function clearOrders() {
  if (!confirm('Opravdu chcete smazat VŠECHNY objednávky? Tuto akci nelze vrátit.')) return;
  localStorage.removeItem('plotys_orders');
  localStorage.removeItem('plotys_orders_enc');
  renderOrdersAdmin();
  showToast('Všechny objednávky byly smazány', 'success');
}

async function saveOrdersEncrypted(orders) {
  const encrypted = await encryptData(JSON.stringify(orders), APP_OBFUSCATION_KEY);
  if (encrypted) {
    localStorage.setItem('plotys_orders_enc', encrypted);
    localStorage.removeItem('plotys_orders');
  } else {
    localStorage.setItem('plotys_orders', JSON.stringify(orders));
  }
}

// ===== EXPORT DO EXCELU =====
async function exportToExcel() {
  const orders = await getOrdersDecrypted();
  if (orders.length === 0) {
    showToast('Žádné objednávky k exportu', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Knihovna XLSX nenalezena. Stahuji CSV.', 'error');
    return exportToCSV();
  }

  // List 1: Souhrn objednávek
  const summaryData = orders.map(o => ({
    'Číslo objednávky': o.orderNumber,
    'Datum': new Date(o.date).toLocaleString('cs-CZ'),
    'Jméno': o.customer.firstName,
    'Příjmení': o.customer.lastName,
    'Telefon': o.customer.phone,
    'Email': o.customer.email,
    'Ulice': o.customer.street,
    'Město': o.customer.city,
    'PSČ': o.customer.zip,
    'Způsob platby': o.payment,
    'Počet položek': o.items.length,
    'Celkem (Kč)': o.total,
    'Poznámka': o.note,
    'Stav': o.status
  }));

  // List 2: Detail položek
  const itemsData = [];
  orders.forEach(o => {
    o.items.forEach(i => {
      itemsData.push({
        'Číslo objednávky': o.orderNumber,
        'Datum': new Date(o.date).toLocaleString('cs-CZ'),
        'Zákazník': `${o.customer.firstName} ${o.customer.lastName}`,
        'Produkt': i.name,
        'Množství': i.qty,
        'Cena za kus (Kč)': i.price,
        'Celkem (Kč)': i.total
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  const ws2 = XLSX.utils.json_to_sheet(itemsData);
  ws1['!cols'] = [{wch:18},{wch:20},{wch:14},{wch:16},{wch:16},{wch:24},{wch:24},{wch:14},{wch:8},{wch:18},{wch:10},{wch:12},{wch:30},{wch:10}];
  ws2['!cols'] = [{wch:18},{wch:20},{wch:24},{wch:40},{wch:10},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Objednávky');
  XLSX.utils.book_append_sheet(wb, ws2, 'Položky');

  const fileName = `Plotys_objednavky_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('✓ Excel soubor byl stažen', 'success');
}

async function exportToCSV() {
  const orders = await getOrdersDecrypted();
  if (orders.length === 0) {
    showToast('Žádné objednávky k exportu', 'error');
    return;
  }
  const headers = ['Číslo objednávky','Datum','Jméno','Příjmení','Telefon','Email','Ulice','Město','PSČ','Platba','Položky','Celkem','Poznámka'];
  const rows = orders.map(o => [
    o.orderNumber,
    new Date(o.date).toLocaleString('cs-CZ'),
    o.customer.firstName,
    o.customer.lastName,
    o.customer.phone,
    o.customer.email,
    o.customer.street,
    o.customer.city,
    o.customer.zip,
    o.payment,
    o.items.map(i => `${i.name} ×${i.qty}`).join('; '),
    o.total,
    o.note || ''
  ]);
  const csv = '﻿' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Plotys_objednavky_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ CSV soubor byl stažen', 'success');
}

// ===== EMAIL NASTAVENÍ =====
function loadNotifyEmail() {
  const email = localStorage.getItem('plotys_notify_email') || '';
  const input = document.getElementById('notifyEmail');
  if (input) input.value = email;
}

function saveNotifyEmail() {
  const email = document.getElementById('notifyEmail').value.trim();
  if (!email || !email.includes('@')) {
    showToast('Zadejte platný e-mail', 'error');
    return;
  }
  localStorage.setItem('plotys_notify_email', email);
  showToast('✓ Notifikační e-mail uložen: ' + email, 'success');
}

// ============================
// INQUIRY (POPTÁVKA)
// ============================

function openInquiryModal() {
  document.getElementById('inquiryModal').classList.add('active');
}

function closeInquiryModal() {
  document.getElementById('inquiryModal')?.classList.remove('active');
}

async function submitInquiry(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const notifyEmail = localStorage.getItem('plotys_notify_email') || 'postavplot@gmail.com';

  const checkedTypes = [...form.querySelectorAll('input[name="fenceType"]:checked')]
    .map(cb => cb.value).join(', ') || '–';

  const formData = new FormData();
  formData.append('_subject', 'Nová poptávka - Plotys');
  formData.append('_template', 'table');
  formData.append('Jméno', fd.get('name'));
  formData.append('Telefon', fd.get('phone'));
  formData.append('Email', fd.get('email'));
  formData.append('Adresa', fd.get('address'));
  formData.append('Typ plotu', checkedTypes);
  formData.append('Požadavky', fd.get('requirements') || '–');

  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData
    });
    closeInquiryModal();
    showToast('✓ Poptávka byla odeslána. Brzy se vám ozveme.', 'success');
    form.reset();
  } catch (err) {
    console.warn('Poptávka selhala:', err);
    showToast('Nepodařilo se odeslat poptávku. Zkuste to prosím znovu.', 'error');
  }
}
