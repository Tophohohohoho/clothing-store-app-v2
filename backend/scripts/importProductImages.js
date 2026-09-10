const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const SOURCE_DIR = 'C:\\Users\\user\\OneDrive\\เดสก์ท็อป\\งาน\\รูปสินค้า';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');
const PUBLIC_BASE_URL = process.env.PUBLIC_API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'shop_lru',
};

const categoryNames = {
  uniform: 'เครื่องแบบนักศึกษา',
  sport: 'ชุดกีฬา',
  accessory: 'เครื่องหมายและเครื่องประดับ',
  souvenir: 'ของที่ระลึกมหาวิทยาลัย',
};

const products = [
  { source: 'ส.นศs.png', file: 'student-shirt-male-s.png', name: 'เสื้อนักศึกษาชาย ไซซ์ S', baseName: 'เสื้อนักศึกษาชาย', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ S', price: 350 },
  { source: 'ส.นศm.png', file: 'student-shirt-male-m.png', name: 'เสื้อนักศึกษาชาย ไซซ์ M', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ M', price: 350 },
  { source: 'ส.นศl.png', file: 'student-shirt-male-l.png', name: 'เสื้อนักศึกษาชาย ไซซ์ L', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ L', price: 350 },
  { source: 'ส.นศxl.png', file: 'student-shirt-male-xl.png', name: 'เสื้อนักศึกษาชาย ไซซ์ XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ XL', price: 350 },
  { source: 'ส.นศ2xl.png', file: 'student-shirt-male-2xl.png', name: 'เสื้อนักศึกษาชาย ไซซ์ 2XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ 2XL', price: 350 },
  { source: 'ส.นศ3xl.png', file: 'student-shirt-male-3xl.png', name: 'เสื้อนักศึกษาชาย ไซซ์ 3XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาชาย ไซซ์ 3XL', price: 350 },

  { source: 'สนศญs.png', file: 'student-shirt-female-s.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ S', baseName: 'เสื้อนักศึกษาหญิง', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ S', price: 350 },
  { source: 'สนศญm.png', file: 'student-shirt-female-m.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ M', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ M', price: 350 },
  { source: 'สนศญl.png', file: 'student-shirt-female-l.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ L', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ L', price: 350 },
  { source: 'สนศญxl.png', file: 'student-shirt-female-xl.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ XL', price: 350 },
  { source: 'สนศญ2xl.png', file: 'student-shirt-female-2xl.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ 2XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ 2XL', price: 350 },
  { source: 'สนศญ3xl.png', file: 'student-shirt-female-3xl.png', name: 'เสื้อนักศึกษาหญิง ไซซ์ 3XL', category: 'uniform', description: 'เสื้อเครื่องแบบนักศึกษาหญิง ไซซ์ 3XL', price: 350 },

  { source: 'ก.นศs.png', file: 'student-pants-male-s.png', name: 'กางเกงนักศึกษาชาย ไซซ์ S', baseName: 'กางเกงนักศึกษาชาย', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ S', price: 450 },
  { source: 'ก.นศm.png', file: 'student-pants-male-m.png', name: 'กางเกงนักศึกษาชาย ไซซ์ M', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ M', price: 450 },
  { source: 'ก.นศl.png', file: 'student-pants-male-l.png', name: 'กางเกงนักศึกษาชาย ไซซ์ L', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ L', price: 450 },
  { source: 'ก.นศxl.png', file: 'student-pants-male-xl.png', name: 'กางเกงนักศึกษาชาย ไซซ์ XL', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ XL', price: 450 },
  { source: 'ก.นศ2xl.png', file: 'student-pants-male-2xl.png', name: 'กางเกงนักศึกษาชาย ไซซ์ 2XL', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ 2XL', price: 450 },
  { source: 'ก.นศ3xl.png', file: 'student-pants-male-3xl.png', name: 'กางเกงนักศึกษาชาย ไซซ์ 3XL', category: 'uniform', description: 'กางเกงขายาวสีดำนักศึกษาชาย ไซซ์ 3XL', price: 450 },

  { source: 'อนศญs.png', file: 'student-skirt-a-s.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ S', baseName: 'กระโปรงนักศึกษาหญิง', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ S', price: 450 },
  { source: 'อนศญm.png', file: 'student-skirt-a-m.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ M', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ M', price: 450 },
  { source: 'อนศญl.png', file: 'student-skirt-a-l.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ L', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ L', price: 450 },
  { source: 'อนศญxl.png', file: 'student-skirt-a-xl.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ XL', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ XL', price: 450 },
  { source: 'อนศญ2xl.png', file: 'student-skirt-a-2xl.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ 2XL', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ 2XL', price: 450 },
  { source: 'อนศญ3xl.png', file: 'student-skirt-a-3xl.png', name: 'กระโปรงทรงเอ นักศึกษาหญิง ไซซ์ 3XL', category: 'uniform', description: 'กระโปรงทรงเอสีดำนักศึกษาหญิง ไซซ์ 3XL', price: 450 },

  { source: 'พนศญs.png', file: 'student-skirt-pleated-s.png', name: 'กระโปรงพลีท นักศึกษาหญิง ไซซ์ S', category: 'uniform', description: 'กระโปรงพลีทสีดำนักศึกษาหญิง ไซซ์ S', price: 450 },
  { source: 'พนศญm.png', file: 'student-skirt-pleated-m.png', name: 'กระโปรงพลีท นักศึกษาหญิง ไซซ์ M', category: 'uniform', description: 'กระโปรงพลีทสีดำนักศึกษาหญิง ไซซ์ M', price: 450 },
  { source: 'พนศญl.png', file: 'student-skirt-pleated-l.png', name: 'กระโปรงพลีท นักศึกษาหญิง ไซซ์ L', category: 'uniform', description: 'กระโปรงพลีทสีดำนักศึกษาหญิง ไซซ์ L', price: 450 },
  { source: 'พนศญxl.png', file: 'student-skirt-pleated-xl.png', name: 'กระโปรงพลีท นักศึกษาหญิง ไซซ์ XL', category: 'uniform', description: 'กระโปรงพลีทสีดำนักศึกษาหญิง ไซซ์ XL', price: 450 },
  { source: 'พนศญ2xl.png', file: 'student-skirt-pleated-2xl.png', name: 'กระโปรงพลีท นักศึกษาหญิง ไซซ์ 2XL', category: 'uniform', description: 'กระโปรงพลีทสีดำนักศึกษาหญิง ไซซ์ 2XL', price: 450 },

  { source: 'สฟชs.png', file: 'sport-shirt-blue-pink-s.png', name: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ S', baseName: 'เสื้อกีฬามหาวิทยาลัย', category: 'sport', description: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ S', price: 300 },
  { source: 'สฟชm.png', file: 'sport-shirt-blue-pink-m.png', name: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ M', category: 'sport', description: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ M', price: 300 },
  { source: 'สฟชl.png', file: 'sport-shirt-blue-pink-l.png', name: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ L', category: 'sport', description: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ L', price: 300 },
  { source: 'สฟชxl.png', file: 'sport-shirt-blue-pink-xl.png', name: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ XL', category: 'sport', description: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ XL', price: 300 },
  { source: 'สฟช2xl.png', file: 'sport-shirt-blue-pink-2xl.png', name: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ 2XL', category: 'sport', description: 'เสื้อเฟรชชี้ ปี2569 ไซซ์ 2XL', price: 300 },

  { source: 'กด.png', file: 'university-buttons.png', name: 'กระดุมตรามหาวิทยาลัย', category: 'accessory', description: 'กระดุมตรามหาวิทยาลัยสำหรับเครื่องแบบนักศึกษา', price: 20 },
  { source: 'ขก.png', file: 'university-pin.png', name: 'เข็มมหาวิทยาลัย', baseName: 'เข็มมหาวิทยาลัย', category: 'accessory', description: 'เข็มตรามหาวิทยาลัยสำหรับติดเสื้อนักศึกษา', price: 80 },
  { source: 'ตต.png', file: 'university-keychain.png', name: 'เข็มตุ้งติ้ง', baseName: 'เข็มตุ้งติ้ง', category: 'accessory', description: 'เข็มตุ้งติ้งตรามหาวิทยาลัย', price: 79 },
  { source: 'นท.png', file: 'student-necktie.png', name: 'เนกไทนักศึกษา', baseName: 'เนกไทนักศึกษา', category: 'accessory', description: 'เนกไทสีสุภาพสำหรับนักศึกษาชาย', price: 180 },
  { source: 'สขข.png', file: 'student-belt-strap.png', name: 'สายเข็มขัดนักศึกษา', category: 'accessory', description: 'สายเข็มขัดสีดำสำหรับนักศึกษา', price: 120 },
  { source: 'หขข.png', file: 'student-belt-buckle.png', name: 'หัวเข็มขัดนักศึกษา', baseName: 'เข็มขัดนักศึกษา', category: 'accessory', description: 'หัวเข็มขัดตรามหาวิทยาลัยสำหรับนักศึกษา', price: 130 },
];

const imageUrl = (file) => `${PUBLIC_BASE_URL}/uploads/products/${encodeURIComponent(file)}`;

async function ensureCategory(connection, categoryName) {
  const [existing] = await connection.query(
    'SELECT category_id FROM category WHERE category_name = ? LIMIT 1',
    [categoryName],
  );
  if (existing.length) {
    await connection.query('UPDATE category SET status_category = 1 WHERE category_id = ?', [existing[0].category_id]);
    return existing[0].category_id;
  }

  const [created] = await connection.query(
    'INSERT INTO category (category_name, status_category) VALUES (?, 1)',
    [categoryName],
  );
  return created.insertId;
}

async function main() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const connection = await mysql.createConnection(dbConfig);

  try {
    const [beforeProducts] = await connection.query('SELECT * FROM product ORDER BY product_id');
    const backupDir = path.join(__dirname, '..', 'backups', `product-image-import-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, 'product-before.json'), JSON.stringify(beforeProducts, null, 2), 'utf8');

    const categoryIds = {};
    for (const key of Object.keys(categoryNames)) {
      categoryIds[key] = await ensureCategory(connection, categoryNames[key]);
    }

    let copied = 0;
    let inserted = 0;
    let updated = 0;

    await connection.beginTransaction();

    for (const product of products) {
      const from = path.join(SOURCE_DIR, product.source);
      const to = path.join(UPLOAD_DIR, product.file);
      await fs.copyFile(from, to);
      copied += 1;

      const url = imageUrl(product.file);
      const categoryId = categoryIds[product.category];
      const [existing] = await connection.query(
        'SELECT product_id FROM product WHERE product_name = ? LIMIT 1',
        [product.name],
      );

      if (existing.length) {
        await connection.query(
          `UPDATE product
           SET category_id = ?, description = ?, price = ?, product_image = ?, product_status = 1
           WHERE product_id = ?`,
          [categoryId, product.description, product.price, url, existing[0].product_id],
        );
        updated += 1;
      } else {
        await connection.query(
          `INSERT INTO product
             (category_id, product_name, description, price, product_image, product_status, quantity, updated_stock)
           VALUES (?, ?, ?, ?, ?, 1, 20, NOW())`,
          [categoryId, product.name, product.description, product.price, url],
        );
        inserted += 1;
      }

      if (product.baseName) {
        const [baseProducts] = await connection.query(
          'SELECT product_id FROM product WHERE product_name = ? LIMIT 1',
          [product.baseName],
        );
        if (baseProducts.length) {
          await connection.query(
            'UPDATE product SET product_image = ? WHERE product_id = ?',
            [url, baseProducts[0].product_id],
          );
          updated += 1;
        }
      }
    }

    await connection.commit();

    console.log(JSON.stringify({ backupDir, copied, inserted, updated }, null, 2));
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
