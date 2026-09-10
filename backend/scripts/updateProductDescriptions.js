const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'shop_lru',
};

const sizedDescription = (name, prefix) => {
  const size = String(name || '').match(/ไซซ์\s*(S|M|L|XL|2XL|3XL)$/i)?.[0] || '';
  return size ? `${prefix} ${size}` : prefix;
};

const getDescription = (productName) => {
  const name = String(productName || '').trim();

  if (name.startsWith('เสื้อนักศึกษาชาย')) return sizedDescription(name, 'เสื้อเครื่องแบบนักศึกษาชาย');
  if (name.startsWith('เสื้อนักศึกษาหญิง')) return sizedDescription(name, 'เสื้อเครื่องแบบนักศึกษาหญิง');
  if (name.startsWith('กางเกงนักศึกษาชาย')) return sizedDescription(name, 'กางเกงขายาวสีดำนักศึกษาชาย');
  if (name.startsWith('กระโปรงทรงเอ')) return sizedDescription(name, 'กระโปรงทรงเอสีดำนักศึกษาหญิง');
  if (name.startsWith('กระโปรงนักศึกษาหญิง')) return sizedDescription(name, 'กระโปรงทรงเอสีดำนักศึกษาหญิง');
  if (name.startsWith('กระโปรงพลีท')) return sizedDescription(name, 'กระโปรงพลีทสีดำนักศึกษาหญิง');
  if (name.startsWith('เสื้อเฟรชชี้ ปี2569')) return sizedDescription(name, 'เสื้อเฟรชชี้ ปี2569');
  if (name.startsWith('เสื้อกีฬามหาวิทยาลัย')) return 'เสื้อกีฬาประจำมหาวิทยาลัย';
  if (name.startsWith('กางเกงกีฬา')) return 'กางเกงกีฬาขาสั้น';
  if (name.startsWith('ครุยวิทยฐานะ')) return 'ครุยสำหรับพิธีรับปริญญา';
  if (name.startsWith('เข็มมหาวิทยาลัย')) return 'เข็มตรามหาวิทยาลัยสำหรับติดเสื้อนักศึกษา';
  if (name.startsWith('เนกไทนักศึกษา')) return 'เนกไทสีสุภาพสำหรับนักศึกษาชาย';
  if (name.startsWith('เข็มขัดนักศึกษา')) return 'ชุดเข็มขัดนักศึกษาพร้อมหัวเข็มขัดตรามหาวิทยาลัย';
  if (name.startsWith('กระดุมตรามหาวิทยาลัย')) return 'กระดุมตรามหาวิทยาลัยสำหรับเครื่องแบบนักศึกษา';
  if (name.startsWith('สายเข็มขัดนักศึกษา')) return 'สายเข็มขัดสีดำสำหรับนักศึกษา';
  if (name.startsWith('หัวเข็มขัดนักศึกษา')) return 'หัวเข็มขัดตรามหาวิทยาลัยสำหรับนักศึกษา';
  if (name.startsWith('เข็มตุ้งติ้ง')) return 'เข็มตุ้งติ้งตรามหาวิทยาลัย';
  if (name.startsWith('พวงกุญแจมหาวิทยาลัย')) return 'พวงกุญแจโลโก้มหาวิทยาลัย';
  if (name.startsWith('รองเท้าหนังนักศึกษา')) return 'รองเท้าหนังสีดำสำหรับนักศึกษา';
  if (name.startsWith('ถุงเท้านักศึกษา')) return 'ถุงเท้าสีขาวสำหรับนักศึกษา';
  if (name.startsWith('กระเป๋าสะพายมหาวิทยาลัย')) return 'กระเป๋าสะพายโลโก้มหาวิทยาลัย';
  if (name.startsWith('เป้มหาวิทยาลัย')) return 'กระเป๋าเป้สำหรับนักศึกษา';
  if (name.startsWith('สมุดมหาวิทยาลัย')) return 'สมุดปกโลโก้มหาวิทยาลัย';
  if (name.startsWith('แฟ้มเอกสาร')) return 'แฟ้มใส่เอกสารขนาด A4';
  if (name.startsWith('แก้วน้ำมหาวิทยาลัย')) return 'แก้วน้ำสแตนเลสโลโก้มหาวิทยาลัย';
  if (name.startsWith('สินค้าทดลอง')) return 'สินค้าทดลองสำหรับทดสอบระบบ';

  return name || null;
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const [products] = await connection.query(
      'SELECT product_id, product_name, description FROM product ORDER BY product_id',
    );
    const backupDir = path.join(__dirname, '..', 'backups', `product-description-update-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, 'product-before.json'), JSON.stringify(products, null, 2), 'utf8');

    await connection.beginTransaction();

    const changed = [];
    for (const product of products) {
      const description = getDescription(product.product_name);
      if (!description || description === product.description) continue;

      await connection.query(
        'UPDATE product SET description = ? WHERE product_id = ?',
        [description, product.product_id],
      );
      changed.push({
        product_id: product.product_id,
        product_name: product.product_name,
        before: product.description,
        after: description,
      });
    }

    await connection.commit();
    console.log(JSON.stringify({ backupDir, changedCount: changed.length, changed }, null, 2));
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
