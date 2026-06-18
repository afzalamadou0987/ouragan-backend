// ✅ AJOUTER UN PRODUIT OURAGAN
exports.addOuraganProduct = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      salePrice,
      stock,
      sku,
      brand,
      weight,
      dimensions,
      tags,
      specifications,
      isFeatured,
      isOuragan,
      images
    } = req.body;

    if (!categoryId || !name || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Catégorie, nom, description et prix sont obligatoires'
      });
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();

    const product = await Product.create({
      sellerId: null,
      categoryId,
      name,
      slug,
      description,
      price,
      salePrice: salePrice || null,
      stock: stock || 0,
      sku: sku || null,
      brand: brand || null,
      weight: weight || null,
      dimensions: dimensions || null,
      tags: tags || null,
      specifications: specifications || null,
      isOuragan: isOuragan !== undefined ? isOuragan : true,
      isFeatured: isFeatured || false
    });

    // ✅ Créer les images si fournies
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
      message: 'Produit OURAGAN ajouté !',
      product: fullProduct
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};