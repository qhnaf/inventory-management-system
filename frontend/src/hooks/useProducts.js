import { useEffect, useState, useCallback } from "react";

import {
  getProducts,
  createProduct,
  updateProduct as updateProductAPI,
  deleteProduct as deleteProductAPI,
} from "../services/productService";

function useProducts() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);

  const [filterCategory, setFilterCategory] = useState("");

  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState("asc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProducts = useCallback(
    async (page, category, sort, order) => {
      setLoading(true);
      setError("");

      try {
        const response = await getProducts(page, 10, category, sort, order);

        setProducts(response.data);
        setPagination(response.pagination);

        return response;
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchProducts(currentPage, filterCategory, sort, order);
  }, [fetchProducts, currentPage, filterCategory, sort, order]);

  const refreshProducts = useCallback(() => {
    return fetchProducts(currentPage, filterCategory, sort, order);
  }, [fetchProducts, currentPage, filterCategory, sort, order]);

  const addProduct = useCallback(
    async (productData) => {
      await createProduct(productData);
      await refreshProducts();
    },
    [refreshProducts]
  );

  const deleteProduct = useCallback(
    async (id) => {
      await deleteProductAPI(id);

      const response = await refreshProducts();

      if (currentPage > response.pagination.totalPages) {
        setCurrentPage(Math.max(1, response.pagination.totalPages));
      }
    },
    [refreshProducts, currentPage]
  );

  const updateProduct = useCallback(
    async (id, productData) => {
      await updateProductAPI(id, productData);
      await refreshProducts();
    },
    [refreshProducts]
  );

  return {
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
  };
}

export default useProducts;