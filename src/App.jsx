import { useEffect, useMemo, useState } from "react";
import { supabase } from './supabase';
import "./index.css";
import Admin from "./Admin";

// IndexedDB can store large product images without localStorage's small quota.
const PRODUCT_DB = "almadhoun-store-cache";
const PRODUCT_STORE = "data";

function openProductCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(PRODUCT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PRODUCT_STORE)) {
        request.result.createObjectStore(PRODUCT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCachedProducts() {
  const db = await openProductCache();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRODUCT_STORE, "readonly");
    const request = transaction.objectStore(PRODUCT_STORE).get("products");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function writeCachedProducts(products) {
  const db = await openProductCache();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRODUCT_STORE, "readwrite");
    transaction.objectStore(PRODUCT_STORE).put(products, "products");
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}
function formatProduct(product) {
  const image = product.image || "";

  return {
    ...product,
    price: Number(product.price),
    oldPrice: product.old_price ?? null,
    image: image.startsWith("http://")
      ? image.replace("http://", "https://")
      : image,
  };
}


const categories = ["الكل", "الطناجر وأواني الطبخ", "الصحون وأطقم التقديم", "إكسسوارات الغاز", "الأجهزة الكهربائية" , "إكسسوارات المطبخ"];


function App() {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("almadhoun-cart")) || [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
const [category, setCategory] = useState("الكل");
const [search, setSearch] = useState("");

 
const [adminProducts, setAdminProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  const [customerName, setCustomerName] = useState("");


useEffect(() => {
  let cancelled = false;

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("id", { ascending: true });

      if (error) throw error;
      if (!cancelled) {
        setAdminProducts((data || []).map(formatProduct));
        setProductsError("");
      }
    } catch (error) {
      console.error("خطأ في تحميل المنتجات من Supabase:", error);
      if (!cancelled) setProductsError(error.message || "تعذر تحميل المنتجات");
    } finally {
      if (!cancelled) setProductsLoading(false);
    }
  }

  loadProducts();
  return () => { cancelled = true; };
}, []);

const [customerPhone, setCustomerPhone] = useState("");
const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    localStorage.setItem("almadhoun-cart", JSON.stringify(cart));
  }, [cart]);


const filteredProducts = useMemo(() => {
  const normalizedSearch = search.trim().toLowerCase();
  return adminProducts.filter((product) => {
    const matchesCategory =
      category === "الكل" || String(product.category || "").trim() === category.trim();
    const matchesSearch = String(product.name || "")
      .toLowerCase()
      .includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });
}, [category, search, adminProducts]);
if (window.location.pathname.startsWith("/admin")) {
  return <Admin />;
}

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function changeQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  


async function checkout() {
  if (!cart.length) return alert("السلة فارغة!");
  if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
    return alert("يرجى تعبئة جميع بيانات التوصيل");
  }

  try {
    const { data, error } = await supabase.functions.invoke("create-order", {
      body: {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      },
    });
    if (error) {
      let message = error.message || "تعذر تسجيل الطلب";
      try {
        const details = await error.context?.json();
        if (details?.message) message = details.message;
      } catch { /* ignore non-JSON error */ }
      throw new Error(message);
    }
    if (!data?.order?.id) throw new Error("لم يتم تأكيد حفظ الطلب");

    const order = data.order;
    const items = order.items || [];
    const orderDetails = items.map((item, index) =>
      `${index + 1}- ${item.product_name}\nالكمية: ${item.quantity}\nالسعر: ${item.price} شيكل`
    ).join("\n\n");
    const message = `طلب جديد من متجر المدهون

رقم الطلب: ${order.id}

اسم العميل: ${customerName}
رقم الهاتف: ${customerPhone}
عنوان التوصيل: ${customerAddress}

المنتجات:
${orderDetails}

الإجمالي: ${order.total} شيكل`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=972595635789&text=${encodeURIComponent(message)}`;
    setCart([]);
    setCartOpen(false);
    window.location.href = whatsappUrl;
  } catch (error) {
    console.error("خطأ في تسجيل الطلب:", error);
    alert("حدث خطأ أثناء تسجيل الطلب: " + error.message);
  }
}


  return (
    <div className="store" dir="rtl">
      <div className="topbar">
        <p>أهلاً بك في متجر المدهون للأدوات المنزلية</p>
        <span>جودة تختارها.. وأناقة تستحقها</span>
      </div>

      <header className="header">
        <a href="#home" className="logo">
          <span className="logo-icon">م</span>
          <span>
            <strong>المدهون</strong>
            <small>للأدوات المنزلية</small>
          </span>
        </a>

        <nav className="navigation">
          <a href="#home">الرئيسية</a>
          <a href="#categories">الأقسام</a>
          <a href="#products">منتجاتنا</a>
          <a href="#about">من نحن</a>
        </nav>

        <div className="header-actions">
          <input
            className="search"
            type="search"
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="cart-button" onClick={() => setCartOpen(true)}>
            🛒 <span>السلة</span>
            <b>{cartCount}</b>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="eyebrow">التميز يبدأ من منزلك</span>
            <h1>
              اجعل منزلك
              <br />
              <span>أكثر أناقة وجمالاً</span>
            </h1>
            <p>
              اكتشف مجموعتنا المختارة من الأدوات المنزلية
              التي تجمع بين الجودة والتصميم العصري.
            </p>
            <a href="#products" className="primary-button">
              تسوق الآن <span>←</span>
            </a>
          </div>

          <div className="hero-visual">
            <div className="hero-circle"></div>
            <img
              src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1000"
              alt="ديكور منزل أنيق"
            />
            <div className="hero-note">
              <strong>اختيارات مميزة</strong>
              <span>لتفاصيل منزلك الجميلة</span>
            </div>
          </div>
        </section>

        <section className="categories-section" id="categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">تسوق حسب احتياجك</span>
              <h2>تصفح أقسامنا</h2>
            </div>
          </div>

          <div className="category-list">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "category active" : "category"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <span className="eyebrow">مختارة بعناية لأجلك</span>
              <h2>منتجاتنا المميزة</h2>
            </div>
            <span className="product-count">
              {filteredProducts.length} منتجات
            </span>
          </div>

          {productsLoading && adminProducts.length === 0 && <p>جاري تحميل المنتجات...</p>}
          {productsError && (
            <p role="alert">
              {adminProducts.length > 0
                ? `تعذر تحديث المنتجات حالياً؛ يتم عرض آخر نسخة محفوظة. ${productsError}`
                : `تعذر تحميل المنتجات: ${productsError}`}
            </p>
          )}
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span>لا توجد صورة</span>
                  )}
                </div>

                <div className="product-info">
                  <span className="product-category">{product.category}</span>
                  <h3>{product.name}</h3>

                  <div className="price-row">
                    <strong>{product.price} ₪</strong>
                    
                  </div>

                  <button
                    className="add-button"
                    onClick={() => addToCart(product)}
                  >
                    + أضف إلى السلة
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!productsLoading && !productsError && filteredProducts.length === 0 && (
            <p className="empty-search">لم نعثر على منتجات مطابقة للبحث.</p>
          )}
        </section>

        <section className="about-section" id="about">
          <span className="eyebrow">المدهون للأدوات المنزلية</span>
          <h2>كل ما يحتاجه منزلك في مكان واحد</h2>
          <p>
            نختار لك منتجات تجمع بين العملية والأناقة لتجعل تفاصيل منزلك أجمل.
          </p>
        </section>
      </main>

      <footer className="footer">
        <strong>المدهون للأدوات المنزلية</strong>
        <p>الجودة والأناقة في كل تفصيل</p>
        <small>© 2026 جميع الحقوق محفوظة</small>
      </footer>

      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-heading">
              <div>
                <span className="eyebrow">تسوق براحة</span>
                <h2>سلة المشتريات ({cartCount})</h2>
              </div>
              <button
                className="close-cart"
                onClick={() => setCartOpen(false)}
                aria-label="إغلاق السلة"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span>🛒</span>
                <h3>سلتك فارغة حالياً</h3>
                <p>اكتشف منتجاتنا وأضف ما يناسب منزلك.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  متابعة التسوق
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      {item.image ? <img src={item.image} alt={item.name} /> : <span>لا توجد صورة</span>}

                      <div className="cart-item-info">
                        <h3>{item.name}</h3>
                        <strong>{item.price} ₪</strong>

                        <div className="quantity">
                          <button onClick={() => changeQuantity(item.id, -1)}>
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button onClick={() => changeQuantity(item.id, 1)}>
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className="remove-item"
                        onClick={() => removeItem(item.id)}
                        aria-label="حذف المنتج"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">

<div className="customer-form">
  <h3>بيانات التوصيل</h3>

  <input
    type="text"
    placeholder="الاسم الكامل"
    value={customerName}
    onChange={(e) => setCustomerName(e.target.value)}
  />

  <input
    type="tel"
    placeholder="رقم الهاتف"
    value={customerPhone}
    onChange={(e) => setCustomerPhone(e.target.value)}
  />

  <textarea
    placeholder="عنوان التوصيل بالتفصيل"
    value={customerAddress}
    onChange={(e) => setCustomerAddress(e.target.value)}
    rows="3"
  />
</div>

                  <div className="total-row">
                    <span>المجموع</span>
                    <strong>{total} ₪</strong>
                  </div>
                  <p>تكلفة التوصيل تُحدد عند تأكيد الطلب.</p>
                  <button className="checkout-button" onClick={checkout}>
                    إتمام الطلب — {total} ₪
                  </button>
                  <button
                    className="continue-button"
                    onClick={() => setCartOpen(false)}
                  >
                    متابعة التسوق
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
