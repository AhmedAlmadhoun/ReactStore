
import { useEffect, useState } from "react";

function Admin() {
 const [products, setProducts] = useState([]);
 const [orders, setOrders] = useState([]);
 const [searchOrder, setSearchOrder] = useState("");

useEffect(() => {
  const loadProducts = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL}/products`;
      console.log("Products URL:", url);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      console.log("Products HTTP status:", response.status);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log("Products response:", data);
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setProducts(list);
    } catch (error) {
      console.error("Products loading failed:", error);
    }
  };
  loadProducts();
}, []);
useEffect(() => {
fetch(`${import.meta.env.VITE_API_URL}/orders`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("فشل تحميل الطلبات");
      }

      return response.json();
    })
    .then((data) => {
      setOrders(data);
      console.log("تم تحميل الطلبات:", data);
    })
    .catch((error) => {
      console.error("خطأ في تحميل الطلبات:", error);
    });
}, []);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
 const [category, setCategory] = useState("الطناجر وأواني الطبخ");
  const [image, setImage] = useState("");
  const [editingId, setEditingId] = useState(null);

async function updateOrderStatus(orderId, newStatus) {
  try {
const response = await fetch(
  `${import.meta.env.VITE_API_URL}/orders/${orderId}/status`,
  {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "فشل تحديث حالة الطلب");
    }

    setOrders((previousOrders) =>
      previousOrders.map((order) =>
        order.id === orderId
          ? { ...order, status: newStatus }
          : order
      )
    );

    alert("تم تحديث حالة الطلب بنجاح");
  } catch (error) {
    console.error("خطأ في تحديث الطلب:", error);
    alert(error.message);
  }
}



async function addProduct(e) {
  e.preventDefault();

  if (!name.trim() || !price || Number(price) <= 0) {
    alert("يرجى إدخال اسم المنتج وسعر صحيح");
    return;
  }

  try {
    const isEditing = editingId !== null;

    const currentProduct = isEditing
      ? products.find((product) => product.id === editingId)
      : null;

    const formData = new FormData();

    formData.append("name", name);
    formData.append("price", Number(price));
    formData.append("category", category);
    formData.append("stock", currentProduct?.stock ?? 0);

    if (image instanceof File) {
      formData.append("image", image);
    } else if (image) {
      formData.append("image", image);
    }

    if (isEditing) {
      formData.append("_method", "PUT");
    }

    const response = await fetch(
  isEditing
    ? `${import.meta.env.VITE_API_URL}/products/${editingId}`
    : `${import.meta.env.VITE_API_URL}/products`,
  {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    if (isEditing) {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingId ? data.product : product
        )
      );

      alert("تم تعديل المنتج بنجاح");
    } else {
      setProducts((currentProducts) => [
        data.product,
        ...currentProducts,
      ]);

      alert("تمت إضافة المنتج بنجاح");
    }

    setEditingId(null);
    setName("");
    setPrice("");
    setImage("");
    setCategory("الطناجر وأواني الطبخ");

  } catch (error) {
    console.error("خطأ:", error);
    alert("حدث خطأ: " + error.message);
  }
}


function editProduct(product) {
  setEditingId(product.id);
  setName(product.name);
  setPrice(product.price);
  setCategory(product.category);
  setImage("");
}

  
async function deleteProduct(id) {
  if (!window.confirm("هل تريد حذف هذا المنتج؟")) return;

  try {
const response = await fetch(
  `${import.meta.env.VITE_API_URL}/products/${id}`,
  {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "فشل حذف المنتج");
    }

    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== id)
    );

    alert("تم حذف المنتج بنجاح");
  } catch (error) {
    console.error("خطأ في حذف المنتج:", error);
    alert("تعذر حذف المنتج: " + error.message);
  }
}


  return (
    <div className="admin-page" dir="rtl">
      <header className="admin-header">
        <h1>لوحة تحكم المدهون</h1>
        <p>إدارة منتجات المتجر</p>
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
          <h2>إضافة منتج جديد</h2>

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

          {products.length === 0 ? (
            <p>لا توجد منتجات مضافة من لوحة التحكم حتى الآن.</p>
          ) : (
            products.map((product) => (
              <div className="admin-product" key={product.id}>
                {/* <img src={product.image} alt={product.name} /> */}
<img
  src={product.image?.replace(/^http:\/\//, "https://")}
  alt={product.name}
  onError={(e) => {
    console.error("Image failed:", e.currentTarget.src);
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
