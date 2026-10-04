import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/products.json');

// Ensure data directory and file exist
async function initStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

// Read all products from disk
export async function getAllProducts() {
  await initStore();
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading products file:', err);
    return [];
  }
}

// Atomic write to avoid partial writes or race conditions
async function saveProducts(products) {
  await initStore();
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(products, null, 2), 'utf-8');
  await fs.rename(tempFile, DATA_FILE);
}

// Find product by ID
export async function getProductById(id) {
  const products = await getAllProducts();
  return products.find(p => p.id === id) || null;
}

// Create new product
export async function createProduct(productData) {
  const products = await getAllProducts();
  const newProduct = {
    id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: productData.name.trim(),
    description: productData.description ? productData.description.trim() : '',
    price: Number(productData.price),
    category: productData.category.trim(),
    stock: Number(productData.stock ?? 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  products.push(newProduct);
  await saveProducts(products);
  return newProduct;
}

// Update existing product
export async function updateProduct(id, updates, isPartial = false) {
  const products = await getAllProducts();
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return null;
  }

  const existing = products[index];
  const updatedProduct = isPartial
    ? {
        ...existing,
        name: updates.name !== undefined ? updates.name.trim() : existing.name,
        description: updates.description !== undefined ? updates.description.trim() : existing.description,
        price: updates.price !== undefined ? Number(updates.price) : existing.price,
        category: updates.category !== undefined ? updates.category.trim() : existing.category,
        stock: updates.stock !== undefined ? Number(updates.stock) : existing.stock,
        updatedAt: new Date().toISOString()
      }
    : {
        id: existing.id,
        name: updates.name.trim(),
        description: updates.description ? updates.description.trim() : '',
        price: Number(updates.price),
        category: updates.category.trim(),
        stock: Number(updates.stock ?? 0),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

  products[index] = updatedProduct;
  await saveProducts(products);
  return updatedProduct;
}

// Delete product
export async function deleteProduct(id) {
  const products = await getAllProducts();
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return false;
  }

  const [removed] = products.splice(index, 1);
  await saveProducts(products);
  return removed;
}
