import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const BUCKET = "product-images";
const CATEGORIES = ["الطناجر وأواني الطبخ", "الصحون وأطقم التقديم", "إكسسوارات الغاز", "الأجهزة الكهربائية", "إكسسوارات المطبخ"];

function Admin() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchOrder, setSearchOrder] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function check(currentSession) {
      if (!active) return;
      setAuthLoading(true);
      setSession(currentSession);
      setAuthorized(false);
      if (currentSession?.user) {
        const { data, error } = await supabase.from("admin_users")
          .select("user_id").eq("user_id", currentSession.user.id).maybeSingle();
        if (active) {
          setAuthorized(!error && !!data);
          if (error) setAuthError(error.message);
        }
      }
      if (active) setAuthLoading(false);
    }
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer database queries outside the auth callback.
      setTimeout(() => { if (active) check(nextSession); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (authorized) { loadProducts(); loadOrders(); }
  }, [authorized]);

  async function login(e) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setProducts([]);
    setOrders([]);
  }

  async function loadProducts() {
    setProductsLoading(true);
    setProductsError("");
    const { data, error } = await supabase.from("products").select("*").order("id", { ascending: false });
    if (error) setProductsError(error.message);
    else setProducts(data || []);
    setProductsLoading(false);
  }

  async function loadOrders() {
    setOrdersLoading(true);
    setOrdersError("");
    const { data, error } = await supabase.from("orders")
      .select("*, items:order_items(id, product_name, price, quantity)")
      .order("id", { ascending: false });
    if (error) setOrdersError(error.message);
    else setOrders(data || []);
    setOrdersLoading(false);
  }

  async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase.from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) return alert("تعذر تحديث الطلب: " + error.message);
    setOrders(current => current.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  }

  async function uploadImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("يرجى اختيار ملف صورة صالح");
    if (file.size > 5 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 5MB");
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type, upsert: false
    });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function addProduct(e) {
    e.preventDefault();
    if (!name.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      return alert("يرجى إدخال اسم المنتج وسعر صحيح");
    }
    setSaving(true);
    try {
      const currentProduct = editingId !== null ? products.find(p => p.id === editingId) : null;
      const imageUrl = image instanceof File ? await uploadImage(image) : (currentProduct?.image || null);
      const values = {
        name: name.trim(), price: Number(price), category: category.trim(),
        image: imageUrl, updated_at: new Date().toISOString()
      };
      let result;
      if (editingId !== null) {
        result = await supabase.from("products").update(values).eq("id", editingId).select("id").single();
      } else {
        result = await supabase.from("products").insert({
          ...values, stock: 0, is_active: true, created_at: new Date().toISOString()
        }).select("id").single();
      }
      if (result.error) throw result.error;
      alert(editingId !== null ? "تم تعديل المنتج بنجاح" : "تمت إضافة المنتج بنجاح");
      setEditingId(null); setName(""); setPrice(""); setCategory(CATEGORIES[0]); setImage(null);
      await loadProducts();
    } catch (error) {
      alert("تعذر حفظ المنتج: " + error.message);
    } finally { setSaving(false); }
  }

  function editProduct(product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setCategory(product.category);
    setImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!window.confirm("هل تريد حذف هذا المنتج؟")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return alert("تعذر حذف المنتج: " + error.message);
    setProducts(current => current.filter(p => p.id !== id));
  }

  if (authLoading) return <div className="admin-page" dir="rtl"><p>جاري التحقق من صلاحية المسؤول...</p></div>;
  if (!session || !authorized) return (
    <div className="admin-page" dir="rtl">
      <header className="admin-header"><h1>لوحة تحكم المدهون</h1><p>تسجيل دخول المسؤول</p></header>
      {!session ? (
        <form className="admin-content" onSubmit={login} style={{ maxWidth: 440, margin: "40px auto" }}>
          <label>البريد الإلكتروني</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <label>كلمة المرور</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">تسجيل الدخول</button>
        </form>
      ) : (
        <main className="admin-content"><p>هذا الحساب ليس لديه صلاحية إدارة المتجر.</p>
          <button type="button" onClick={logout}>تسجيل الخروج</button></main>
      )}
      {authError && <p role="alert">{authError}</p>}
    </div>
  );

  return (
    <div className="admin-page" dir="rtl">
      <header className="admin-header">
        <h1>لوحة تحكم المدهون</h1>
        <p>إدارة منتجات المتجر</p>
        <button type="button" onClick={logout}>تسجيل الخروج</button>
      </header>

      <main className="admin-content">
        <section className="admin-stats">

  <div className="stat-card">
    <span>إجمالي المنتجات</span>
    <strong>{products.length}</strong>
  </div>

  <div className="stat-card">
    <span>إجمالي الطلبات</span>
    <strong>{orders.length}</strong>
  </div>

  <div className="stat-card">
    <span>طلبات جديدة</span>
    <strong>
      {orders.filter(order => order.status === "new").length}
    </strong>
  </div>

  <div className="stat-card">
    <span>قيد التجهيز</span>
    <strong>
      {orders.filter(order => order.status === "processing").length}
    </strong>
  </div>

  <div className="stat-card">
    <span>طلبات مكتملة</span>
    <strong>
      {orders.filter(order => order.status === "completed").length}
    </strong>
  </div>

</section>

  <section className="admin-section">
  <h2>طلبات العملاء</h2>
  <input
  type="text"
  placeholder="ابحث باسم العميل أو رقم الطلب أو الهاتف..."
  value={searchOrder}
  onChange={(e) => setSearchOrder(e.target.value)}
  style={{
    width: "100%",
    padding: "12px",
    margin: "15px 0",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "15px",
    boxSizing: "border-box",
  }}
/>

  {orders.length === 0 ? (
    <p>لا توجد طلبات حالياً</p>
  ) : (
    <div className="orders-list">
      {orders
  .filter((order) => {
    const search = searchOrder.trim().toLowerCase();

    return (
      String(order.id).includes(search) ||
      String(order.customer_name ?? "").toLowerCase().includes(search) ||
      String(order.customer_phone ?? "").includes(search)
    );
  })
  .map((order) => (
        <div className="order-card" key={order.id}>
          <h3>طلب رقم #{order.id}</h3>

          <p>
            <strong>اسم العميل:</strong> {order.customer_name}
          </p>

          <p>
            <strong>رقم الهاتف:</strong> {order.customer_phone}
          </p>

          <p>
            <strong>العنوان:</strong> {order.customer_address}
          </p>

          <p>
            <strong>الإجمالي:</strong> {order.total} شيكل
          </p>

          <div style={{ margin: "12px 0" }}>
  <strong>حالة الطلب:</strong>

  <select
    value={order.status}
    onChange={(e) =>
      updateOrderStatus(order.id, e.target.value)
    }
    style={{
      marginRight: "10px",
      padding: "8px",
      borderRadius: "6px",
      border: "1px solid #ccc",
    }}
  >
    <option value="new">طلب جديد</option>
    <option value="processing">قيد التجهيز</option>
    <option value="completed">تم التسليم</option>
    <option value="cancelled">ملغي</option>
  </select>
</div>

          <h4>المنتجات:</h4>

          {(order.items ?? []).map((item) => (
            <p key={item.id}>
              {item.product_name} - الكمية: {item.quantity}
              - السعر: {item.price} شيكل
            </p>
          ))}
        </div>
            ))}
    </div>
  )}
</section>

        <section className="admin-form-section">
          <h2>{editingId !== null ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>

          <form onSubmit={addProduct}>
            <label>اسم المنتج</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: طقم أواني الطهي"
            />

            <label>السعر بالشيكل</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="أدخل السعر"
            />

            <label>القسم</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>الطناجر وأواني الطبخ</option>
              <option>الصحون وأطقم التقديم</option>
              <option>إكسسوارات الغاز</option>
              <option>الأجهزة الكهربائية</option>
              <option>إكسسوارات المطبخ </option>
            </select>

            <label>رابط صورة المنتج</label>
            <input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files[0];

    if (file) {
      setImage(file);
      console.log("تم اختيار الصورة:", file.name);
    }
  }}
/>

            <button type="submit">
  {editingId !== null ? "حفظ التعديلات" : "إضافة المنتج"}
</button>
{editingId !== null && (
  <button
    type="button"
    onClick={() => {
      setEditingId(null);
      setName("");
      setPrice("");
      setImage("");
      setCategory("الطناجر وأواني الطبخ");
    }}
  >
    إلغاء التعديل
  </button>
)}
          </form>
        </section>

        <section className="admin-products">
          <h2>المنتجات المضافة ({products.length})</h2>
          <button type="button" onClick={loadProducts} disabled={productsLoading}>
            {productsLoading ? "جاري تحميل المنتجات..." : "تحديث المنتجات من قاعدة البيانات"}
          </button>
          {productsError && (
            <p role="alert" style={{ color: "#b91c1c" }}>
              فشل تحميل المنتجات: {productsError}
            </p>
          )}

          {products.length === 0 ? (
            <p>لا توجد منتجات مضافة من لوحة التحكم حتى الآن.</p>
          ) : (
            products.map((product) => (
              <div className="admin-product" key={product.id}>
                {/* <img src={product.image} alt={product.name} /> */}
<img
  src={product.image || ""}
  alt={product.name}
  onError={(e) => {
    e.currentTarget.style.display = "none";
  }}
/>
                <div>
                  <strong>{product.name}</strong>
                  <p>{product.price} شيكل</p>
                  <small>{product.category}</small>
                </div>

                <div className="admin-product-actions">
  <button onClick={() => editProduct(product)}>
    تعديل
  </button>

  <button onClick={() => deleteProduct(product.id)}>
    حذف
  </button>
</div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

export default Admin;
