const API_URL = "http://localhost:5000/api/products";

export async function getProducts(page = 1, limit = 10, category = "", sort = "id", order = "asc") {
  const params = new URLSearchParams({
    page,
    limit,
    sort,
    order,
  });

  if (category) {
    params.append("category", category);
  }

  const response = await fetch(`${API_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Gagal mengambil data product.");
  }

  const data = await response.json();

  return data;
}

export async function createProduct(productData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    throw new Error("Gagal menambahkan product.");
  }

  const data = await response.json();

  return data;
}

export async function updateProduct(id, productData) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    throw new Error("Gagal mengupdate product.");
  }

  const data = await response.json();

  return data;
}

export async function deleteProduct(id) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Gagal menghapus product.");
  }

  const data = await response.json();

  return data;
}
