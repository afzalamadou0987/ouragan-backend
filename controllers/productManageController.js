const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const { Product, ProductImage, Category } = require('../models/index');

// ✅ CRÉER UN PRODUIT
exports.createProduct = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      salePrice,
      stock,
      brand,
      isOuragan,
      isFeatured,
      images
    } = req.body;

    if (!categoryId || !name || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Catégorie, nom, description et prix sont obligatoires'
      });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }

    let baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await Product.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const sellerId = req.user.role === 'seller' ? req.user.sellerId || null : null;

    const product = await Product.create({
      sellerId,
      categoryId,
      name,
      slug,
      description,
      price,
      salePrice: salePrice || null,
      stock: stock || 0,
      brand: brand || null,
      isOuragan: req.user.role === 'admin' ? (isOuragan || false) : false,
      isFeatured: isFeatured || false
    });

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await ProductImage.create({
          productId: product.id,
          url: images[i].url,
          publicId: images[i].publicId || null,
          isMain: i === 0,
          order: i
        });
      }
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès !',
      product: fullProduct
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER UN PRODUIT
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      name,
      description,
      price,
      salePrice,
      stock,
      brand,
      isActive,
      isFeatured
    } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    await product.update({
      categoryId: categoryId || product.categoryId,
      name: name || product.name,
      description: description || product.description,
      price: price || product.price,
      salePrice: salePrice !== undefined ? salePrice : product.salePrice,
      stock: stock !== undefined ? stock : product.stock,
      brand: brand !== undefined ? brand : product.brand,
      isActive: isActive !== undefined ? isActive : product.isActive,
      isFeatured: isFeatured !== undefined ? isFeatured : product.isFeatured
    });

    const fullProduct = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    res.status(200).json({
      success: true,
      message: 'Produit mis à jour !',
      product: fullProduct
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ AJOUTER UNE IMAGE À UN PRODUIT EXISTANT
exports.addProductImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, publicId, isMain } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    if (isMain) {
      await ProductImage.update(
        { isMain: false },
        { where: { productId: id } }
      );
    }

    const existingCount = await ProductImage.count({ where: { productId: id } });

    const image = await ProductImage.create({
      productId: id,
      url,
      publicId: publicId || null,
      isMain: isMain || existingCount === 0,
      order: existingCount
    });

    res.status(201).json({
      success: true,
      message: 'Image ajoutée !',
      image
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UNE IMAGE
exports.deleteProductImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image introuvable' });
    }

    await image.destroy();

    res.status(200).json({ success: true, message: 'Image supprimée !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UN PRODUIT
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    await product.update({ isActive: false });

    res.status(200).json({ success: true, message: 'Produit désactivé !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};