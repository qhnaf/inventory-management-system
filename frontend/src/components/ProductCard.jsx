import React from "react";

const ProductCard = React.memo(
  ({
    id,
    name,
    stock,
    price,
    category,
    deleteProduct,
    editProduct,
  }) => {
    console.log("ProductCard render", name);

    return (
      <div>
        <h2>{name}</h2>
        <p>Stock: {stock}</p>
        <p>Price: {price}</p>
        <p>Category: {category}</p>

        <button onClick={() => editProduct(id)}>
          Edit
        </button>

        <button onClick={() => deleteProduct(id)}>
          Delete
        </button>
      </div>
    );
  }
);

export default ProductCard;