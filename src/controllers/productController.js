const Product = require('../models/Product');
const Stock = require('../models/Stock');
const AuditLog = require('../models/AuditLog');
const { uploadToCloudinary } = require('../config/cloudinary');

const getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ brand: 1, name: 1 });
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
    const { name, brand, model, capacity, color, variation, category, purchase_price, selling_price, hasImei } = req.body;

    if (!name || !brand || !model || !category || purchase_price === undefined || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสินค้า Master ให้ครบถ้วน' });
    }

    const existingCatalog = await Product.findOne({ 
      brand: brand.trim(), 
      model: model.trim(), 
      capacity: (capacity || '').trim(), 
      color: (color || '').trim() 
    });
    if (existingCatalog) {
      return res.status(400).json({ success: false, message: `มีแคตตาล็อกสินค้า (${brand} ${model} ${capacity} ${color}) ในระบบอยู่แล้ว` });
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
      details: { name: product.name, brand: product.brand, model: product.model }
    });

    res.status(201).json({
      success: true,
      message: `บันทึกข้อมูลหลักสินค้า Master "${product.name}" สำเร็จ`,
      product
    });
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, brand, model, capacity, color, variation, category, purchase_price, selling_price, hasImei } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลหลักสินค้าที่ต้องการแก้ไข' });
    }

    let finalVariation = variation || '';
    if (capacity && color) {
      finalVariation = `${capacity} - ${color}`;
    } else if (capacity) {
      finalVariation = capacity;
    } else if (color) {
      finalVariation = color;
    } else {
      finalVariation = product.variation;
    }

    if (name) product.name = name.trim();
    if (brand) product.brand = brand.trim();
    if (model) product.model = model.trim();
    if (capacity !== undefined) product.capacity = capacity.trim();
    if (color !== undefined) product.color = color.trim();
    product.variation = finalVariation;
    if (category) product.category = category.trim();
    if (purchase_price !== undefined) product.purchase_price = Number(purchase_price);
    if (selling_price !== undefined) product.selling_price = Number(selling_price);
    if (hasImei !== undefined) product.hasImei = Boolean(hasImei);

    await product.save();

    await AuditLog.create({
      user: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action: 'UPDATE_PRODUCT_MASTER',
      entity: 'Product',
      entityId: product._id.toString(),
      details: { name: product.name, brand: product.brand, model: product.model }
    });

    res.json({
      success: true,
      message: `แก้ไขข้อมูลหลักสินค้า Master "${product.name}" สำเร็จ`,
      product
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct
};
