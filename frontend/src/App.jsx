import { useState, useRef } from "react";

import useProducts from "./hooks/useProducts";
import "./App.css";
import ProductCard from "./components/ProductCard";

function App() {
  const {
    products,
    pagination,
    currentPage,
    setCurrentPage,

    filterCategory,
    setFilterCategory,

    sort,
    setSort,

    order,
    setOrder,

    addProduct,
    updateProduct,
    deleteProduct,

    loading,
    error,
  } = useProducts();

  // ==========================================
  // STATE: SEARCH
  // ==========================================
  const [search, setSearch] = useState("");

  // ==========================================
  // REF: INPUT PRODUCT NAME
  // ==========================================
  const productNameRef = useRef(null);

  // ==========================================
  // STATE: FORM INPUT
  // ==========================================
  const [productName, setProductName] = useState("");
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");

  // ==========================================
  // STATE: ERROR FORM
  // ==========================================
  const [productNameError, setProductNameError] = useState("");

  const [stockError, setStockError] = useState("");

  const [priceError, setPriceError] = useState("");

  const [categoryError, setCategoryError] = useState("");

  // ==========================================
  // STATE: PRODUCT YANG SEDANG DIEDIT
  // ==========================================
  const [editProductId, setEditProductId] = useState(null);

  // ==========================================
  // SEARCH / FILTER
  // ==========================================
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ==========================================
  // VALIDASI PRODUCT
  // ==========================================
  function validateProduct() {
    let isValid = true;

    if (productName.trim() === "") {
      setProductNameError("Nama produk wajib diisi!");
      isValid = false;
    } else {
      setProductNameError("");
    }

    if (stock === "" || stock < 0) {
      setStockError("Stock wajib diisi dan tidak boleh negatif!");
      isValid = false;
    } else {
      setStockError("");
    }

    if (price === "" || price <= 0) {
      setPriceError("Harga wajib diisi dan harus lebih besar dari 0!");
      isValid = false;
    } else {
      setPriceError("");
    }

    if (category.trim() === "") {
      setCategoryError("Kategori wajib diisi!");
      isValid = false;
    } else {
      setCategoryError("");
    }

    return isValid;
  }

  // ==========================================
  // RESET FORM
  // ==========================================
  function resetForm() {
    setProductName("");
    setStock("");
    setPrice("");
    setCategory("");

    setProductNameError("");
    setStockError("");
    setPriceError("");
    setCategoryError("");
  }

  // ==========================================
  // CREATE PRODUCT
  // ==========================================
  function handleAddProduct() {
    if (!validateProduct()) {
      return;
    }

    const newProduct = {
      name: productName,
      stock: Number(stock),
      price: Number(price),
      category: category,
    };

    addProduct(newProduct);

    resetForm();

    productNameRef.current?.focus();
  }

  // ==========================================
  // EDIT PRODUCT
  // ==========================================
  function editProduct(id) {
    const selectedProduct = products.find((product) => product.id === id);

    if (!selectedProduct) {
      return;
    }

    setEditProductId(id);
    setProductName(selectedProduct.name);
    setStock(selectedProduct.stock);
    setPrice(selectedProduct.price);
    setCategory(selectedProduct.category);
  }

  // ==========================================
  // UPDATE PRODUCT
  // ==========================================
  function handleUpdateProduct() {
    if (!validateProduct()) {
      return;
    }

    const updatedProduct = {
      name: productName,
      stock: Number(stock),
      price: Number(price),
      category: category,
    };

    updateProduct(editProductId, updatedProduct);

    setEditProductId(null);

    resetForm();
  }

  // ==========================================
  // CANCEL EDIT
  // ==========================================
  function cancelEdit() {
    setEditProductId(null);
    resetForm();
  }

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return <p>Loading products...</p>;
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (error) {
    return <p>Error: {error}</p>;
  }

  // ==========================================
  // UI
  // ==========================================
  return (
    <>
      {/* FORM PRODUCT */}

      <input
        ref={productNameRef}
        placeholder="Nama Barang"
        type="text"
        value={productName}
        onChange={(e) => {
          setProductName(e.target.value);
          setProductNameError("");
        }}
      />

      {productNameError && <p>{productNameError}</p>}

      <input
        type="number"
        placeholder="Stok"
        value={stock}
        onChange={(e) => {
          setStock(e.target.value);
          setStockError("");
        }}
      />

      {stockError && <p>{stockError}</p>}

      <input
        placeholder="Harga"
        type="number"
        value={price}
        onChange={(e) => {
          setPrice(e.target.value);
          setPriceError("");
        }}
      />

      {priceError && <p>{priceError}</p>}

      <input
        placeholder="Kategori"
        type="text"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          setCategoryError("");
        }}
      />

      {categoryError && <p>{categoryError}</p>}

      {/* CREATE / UPDATE */}

      <button
        onClick={
          editProductId === null ? handleAddProduct : handleUpdateProduct
        }
      >
        {editProductId === null ? "Tambah Barang" : "Update Barang"}
      </button>

      {editProductId !== null && <button onClick={cancelEdit}>Batal</button>}

      {/* SEARCH */}

      <input
        type="text"
        placeholder="Cari produk..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        value={filterCategory}
        onChange={(e) => {
          setFilterCategory(e.target.value);
          setCurrentPage(1);
        }}
      >
        <option value="">All Categories</option>
        <option value="Electronics">Electronics</option>
        <option value="Accessories">Accessories</option>
        <option value="Office">Office</option>
      </select>

      <select
        value={sort}
        onChange={(e) => {
          setSort(e.target.value);
          setCurrentPage(1);
        }}
      >
        <option value="id">Sort by ID</option>
        <option value="name">Sort by Name</option>
        <option value="stock">Sort by Stock</option>
        <option value="price">Sort by Price</option>
      </select>

      <select
        value={order}
        onChange={(e) => {
          setOrder(e.target.value);
          setCurrentPage(1);
        }}
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>

      {/* PRODUCT LIST */}

      <div className="product-grid">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            stock={product.stock}
            price={product.price}
            category={product.category}
            deleteProduct={deleteProduct}
            editProduct={editProduct}
          />
        ))}
      </div>
      <button
        onClick={() => setCurrentPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span>
        Page {currentPage} of {pagination.totalPages}
      </span>
      <button
        onClick={() => setCurrentPage(currentPage + 1)}
        disabled={currentPage === pagination.totalPages}
      >
        Next
      </button>
    </>
  );
}

export default App;
