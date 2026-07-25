# Core Architecture Rule: SKU is IMEI

**PRINCIPLE:**
In this system (Silmin Banana POS & Audit System), **`SKU` is strictly synonymous and equal to `IMEI`** (`SKU == IMEI`).

1. Every physical item unit is uniquely identified by its **`IMEI`**, which acts directly as its **`SKU`**.
2. `SKU` and `IMEI` must always match and be unique across the entire database.
3. POS barcode scanning, stock audits, goods receipts, transfers, and inventory tracking operate on **`IMEI`** as the primary item SKU identifier.
4. `Product` model represents the Product Model Spec catalog (Brand, Model, Capacity, Color, Category), while individual stock items are serialized by `IMEI` (`sku = imei`).
