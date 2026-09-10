const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'shop_lru',
};

const productOrderSql = `
  CASE
    WHEN c.category_name = 'เครื่องแบบนักศึกษา' THEN 1
    WHEN c.category_name = 'ชุดกีฬา' THEN 2
    WHEN c.category_name = 'ชุดพิธีการ' THEN 3
    WHEN c.category_name = 'เครื่องหมายและเครื่องประดับ' THEN 4
    WHEN c.category_name = 'รองเท้าและถุงเท้า' THEN 5
    WHEN c.category_name = 'กระเป๋า' THEN 6
    WHEN c.category_name = 'อุปกรณ์การเรียน' THEN 7
    WHEN c.category_name = 'ของที่ระลึกมหาวิทยาลัย' THEN 8
    ELSE 99
  END,
  CASE
    WHEN p.product_name LIKE 'เสื้อนักศึกษาชาย%' THEN 1
    WHEN p.product_name LIKE 'เสื้อนักศึกษาหญิง%' THEN 2
    WHEN p.product_name LIKE 'กางเกงนักศึกษาชาย%' THEN 3
    WHEN p.product_name LIKE 'กระโปรงทรงเอ%' OR p.product_name = 'กระโปรงนักศึกษาหญิง' THEN 4
    WHEN p.product_name LIKE 'กระโปรงพลีท%' THEN 5
    WHEN p.product_name LIKE 'เสื้อกีฬา%' OR p.product_name LIKE 'เสื้อเฟรชชี้ ปี2569%' THEN 6
    WHEN p.product_name LIKE 'กางเกงกีฬา%' THEN 7
    WHEN p.product_name LIKE 'ครุย%' THEN 8
    WHEN p.product_name LIKE 'กระดุม%' THEN 9
    WHEN p.product_name LIKE 'เข็มมหาวิทยาลัย%' THEN 10
    WHEN p.product_name LIKE 'เนกไท%' THEN 11
    WHEN p.product_name LIKE 'เข็มขัด%' OR p.product_name LIKE 'สายเข็มขัด%' OR p.product_name LIKE 'หัวเข็มขัด%' THEN 12
    ELSE 90
  END,
  CASE
    WHEN p.product_name NOT LIKE '%ไซซ์%' THEN 0
    WHEN p.product_name LIKE '%ไซซ์ S' THEN 1
    WHEN p.product_name LIKE '%ไซซ์ M' THEN 2
    WHEN p.product_name LIKE '%ไซซ์ L' THEN 3
    WHEN p.product_name LIKE '%ไซซ์ XL' THEN 4
    WHEN p.product_name LIKE '%ไซซ์ 2XL' THEN 5
    WHEN p.product_name LIKE '%ไซซ์ 3XL' THEN 6
    ELSE 9
  END,
  p.product_id ASC
`;

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const [products] = await connection.query(
      `SELECT p.product_id, p.product_name, p.description, p.product_status, p.created_at, c.category_name
       FROM product p
       LEFT JOIN category c ON p.category_id = c.category_id
       ORDER BY p.product_id`,
    );
    const [orderDetails] = await connection.query('SELECT order_detail_id, product_id FROM order_detail ORDER BY order_detail_id');
    const [stockLogs] = await connection.query('SELECT stock_log_id, product_id FROM stock_logs ORDER BY stock_log_id');

    const backupDir = path.join(__dirname, '..', 'backups', `product-renumber-all-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, 'product-before.json'), JSON.stringify(products, null, 2), 'utf8');
    await fs.writeFile(path.join(backupDir, 'order-detail-before.json'), JSON.stringify(orderDetails, null, 2), 'utf8');
    await fs.writeFile(path.join(backupDir, 'stock-logs-before.json'), JSON.stringify(stockLogs, null, 2), 'utf8');

    const [orderedProducts] = await connection.query(
      `SELECT p.product_id, p.product_name
       FROM product p
       LEFT JOIN category c ON p.category_id = c.category_id
       ORDER BY ${productOrderSql}`,
    );

    const mapping = orderedProducts.map((product, index) => ({
      oldId: Number(product.product_id),
      newId: index + 1,
      product_name: product.product_name,
    })).filter((item) => item.oldId !== item.newId);

    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const item of mapping) {
      await connection.query('UPDATE product SET product_id = ? WHERE product_id = ?', [-item.newId, item.oldId]);
      await connection.query('UPDATE order_detail SET product_id = ? WHERE product_id = ?', [-item.newId, item.oldId]);
      await connection.query('UPDATE stock_logs SET product_id = ? WHERE product_id = ?', [-item.newId, item.oldId]);
    }

    for (const item of mapping) {
      await connection.query('UPDATE product SET product_id = ? WHERE product_id = ?', [item.newId, -item.newId]);
      await connection.query('UPDATE order_detail SET product_id = ? WHERE product_id = ?', [item.newId, -item.newId]);
      await connection.query('UPDATE stock_logs SET product_id = ? WHERE product_id = ?', [item.newId, -item.newId]);
    }

    const nextAutoIncrement = orderedProducts.length + 1;
    await connection.query(`ALTER TABLE product AUTO_INCREMENT = ${nextAutoIncrement}`);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    console.log(JSON.stringify({ backupDir, nextAutoIncrement, changedCount: mapping.length, mapping }, null, 2));
  } catch (error) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
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
