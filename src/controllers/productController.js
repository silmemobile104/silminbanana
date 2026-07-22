const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { uploadToCloudinary } = require('../config/cloudinary');

const getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ sku: 1 });
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    next(err);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสินค้าที่ระบุ' });
    }
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { sku, name, brand, model, capacity, color, variation, category, purchase_price, selling_price, hasImei } = req.body;

    if (!sku || !name || !brand || !model || !category || purchase_price === undefined || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสินค้า Master ให้ครบถ้วน' });
    }

    const existingSKU = await Product.findOne({ sku: sku.trim().toUpperCase() });
    if (existingSKU) {
      return res.status(400).json({ success: false, message: `รหัส SKU "${sku}" มีในระบบอยู่แล้ว` });
    }

    let imageUrls = [];
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'pos_products');
      imageUrls.push(uploadResult.secure_url);
    }

    let finalVariation = variation || '';
    if (capacity && color) {
      finalVariation = `${capacity} - ${color}`;
    } else if (capacity) {
      finalVariation = capacity;
    } else if (color) {
      finalVariation = color;
    }

    const product = await Product.create({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      brand: brand.trim(),
      model: model.trim(),
      capacity: capacity ? capacity.trim() : '',
      color: color ? color.trim() : '',
      variation: finalVariation || 'มาตรฐาน',
      category: category.trim(),
      purchase_price: Number(purchase_price),
      selling_price: Number(selling_price),
      images: imageUrls,
      hasImei: hasImei !== undefined ? Boolean(hasImei) : true
    });

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'CREATE_PRODUCT_MASTER',
      entity: 'Product',
      entityId: product._id.toString(),
      details: { sku: product.sku, name: product.name }
    });

    res.status(201).json({
      success: true,
      message: `บันทึกข้อมูลหลักสินค้า Master SKU "${product.sku}" สำเร็จ`,
      product
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct
};
