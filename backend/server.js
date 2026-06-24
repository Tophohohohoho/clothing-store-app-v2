const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'show',
});
const dbp = db.promise();

const query = (sql, params = []) => dbp.query(sql, params);

const respondError = (res, err, fallback = 'เกิดข้อผิดพลาดที่ฐานข้อมูล') => {
    console.error(fallback, err);
    res.status(500).json({ error: err.message || fallback });
};

const saveBase64Image = async (imageData, fileName, folderName) => {
    if (!imageData) return null;
    if (!imageData.startsWith('data:image/')) {
        throw new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น');
    }

    const match = imageData.match(/^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/);
    if (!match) {
        throw new Error('รองรับเฉพาะไฟล์ PNG, JPG, WEBP หรือ GIF');
    }

    const extensionMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    const mimeType = match[1];
    const extension = extensionMap[mimeType] || 'jpg';
    const originalName = path.parse(fileName || folderName).name.replace(/[^a-zA-Z0-9-_]/g, '-');
    const uploadDir = path.join(__dirname, 'uploads', folderName);
    const savedFileName = `${Date.now()}-${originalName || folderName}.${extension}`;
    const savedPath = path.join(uploadDir, savedFileName);

    fs.mkdirSync(uploadDir, { recursive: true });
    await fs.promises.writeFile(savedPath, Buffer.from(match[3], 'base64'));
    return `/uploads/${folderName}/${savedFileName}`;
};

const normalizeProduct = (product) => ({
    ...product,
    id: product.product_id,
    name: product.product_name,
    image_url: product.product_image,
    stock: product.quantity,
    colors: product.colors || [],
});

const normalizeColors = (colors) => {
    if (!Array.isArray(colors)) return [];

    const seen = new Set();
    return colors.reduce((result, color) => {
        const name = String(color?.name || color?.color_name || '').trim();
        const hex = String(color?.hex || color?.color_hex || '#000000').trim();
        const key = name.toLocaleLowerCase('th-TH');

        if (!name || seen.has(key)) return result;
        seen.add(key);
        result.push({
            name: name.slice(0, 50),
            hex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : '#000000',
        });
        return result;
    }, []);
};

const replaceProductColors = async (productId, colors) => {
    const cleanColors = normalizeColors(colors);
    await query('DELETE FROM product_color WHERE product_id = ?', [productId]);

    if (cleanColors.length > 0) {
        await query(
            'INSERT INTO product_color (product_id, color_name, color_hex) VALUES ?',
            [cleanColors.map((color) => [productId, color.name, color.hex])],
        );
    }
};

const normalizeOrder = (order) => ({
    ...order,
    id: order.order_id,
    status: order.order_status,
    shipping_method: order.delivery_type,
    created_at: order.order_date,
});

const getDefaultCategoryId = async () => {
    const [existing] = await query('SELECT category_id FROM category ORDER BY category_id LIMIT 1');
    if (existing.length > 0) return existing[0].category_id;

    const [result] = await query(
        'INSERT INTO category (category_name, status_category) VALUES (?, 1)',
        ['ทั่วไป'],
    );
    return result.insertId;
};

const resolveActiveCategoryId = async ({ categoryId, categoryName }) => {
    if (categoryId) {
        const [rows] = await query(
            'SELECT category_id FROM category WHERE category_id = ? AND status_category = 1 LIMIT 1',
            [categoryId],
        );
        return rows[0]?.category_id || null;
    }

    const cleanName = String(categoryName || '').trim();
    if (!cleanName) return null;

    const [rows] = await query(
        'SELECT category_id FROM category WHERE category_name = ? AND status_category = 1 LIMIT 1',
        [cleanName],
    );
    return rows[0]?.category_id || null;
};

const writeSystemLog = async (userId, action, remark = '') => {
    if (!userId) return;

    try {
        await query(
            'INSERT INTO system_log (user_id, action, remark) VALUES (?, ?, ?)',
            [userId, action, remark],
        );
    } catch (err) {
        console.error('บันทึก system_log ไม่สำเร็จ:', err.message);
    }
};

const normalizeRole = (role) => (role === 'admin' ? 'admin' : 'user');

const tableExists = async (tableName) => {
    const [rows] = await query(
        `
            SELECT COUNT(*) AS count
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ?
        `,
        [tableName],
    );
    return Number(rows[0]?.count || 0) > 0;
};

const columnExists = async (tableName, columnName) => {
    const [rows] = await query(
        `
            SELECT COUNT(*) AS count
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
        `,
        [tableName, columnName],
    );
    return Number(rows[0]?.count || 0) > 0;
};

const migrateLegacyTables = async () => {
    const categoryId = await getDefaultCategoryId();

    if (await tableExists('products')) {
        await query(
            `
                INSERT INTO product
                    (product_id, category_id, product_name, description, price, product_image, product_status, quantity, created_at, updated_stock)
                SELECT
                    old_products.id,
                    ?,
                    old_products.name,
                    old_products.description,
                    old_products.price,
                    old_products.image_url,
                    1,
                    old_products.stock,
                    old_products.created_at,
                    old_products.created_at
                FROM products old_products
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM product p
                    WHERE p.product_id = old_products.id
                )
            `,
            [categoryId],
        );
    }

    if (await tableExists('order_items')) {
        await query(
            `
                INSERT INTO order_detail
                    (order_detail_id, product_id, order_id, quantity, price)
                SELECT
                    old_items.id,
                    old_items.product_id,
                    old_items.order_id,
                    old_items.quantity,
                    old_items.price
                FROM order_items old_items
                JOIN product p ON p.product_id = old_items.product_id
                JOIN orders o ON o.order_id = old_items.order_id
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM order_detail od
                    WHERE od.order_detail_id = old_items.id
                )
            `,
        );
    }
};

const initializeDatabase = async () => {
    const schemas = [
        `CREATE TABLE IF NOT EXISTS \`user\` (
            user_id int NOT NULL AUTO_INCREMENT,
            username varchar(100) NOT NULL,
            password varchar(255) NOT NULL,
            full_name varchar(255) NOT NULL,
            email varchar(150) DEFAULT NULL,
            phone varchar(20) DEFAULT NULL,
            role varchar(50) DEFAULT NULL,
            status_user tinyint DEFAULT '1',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            UNIQUE KEY username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS address (
            address_id int NOT NULL AUTO_INCREMENT,
            user_id int NOT NULL,
            receiver_name varchar(255) NOT NULL,
            phone varchar(20) DEFAULT NULL,
            address_detail text,
            subdistrict varchar(100) DEFAULT NULL,
            district varchar(100) DEFAULT NULL,
            province varchar(100) DEFAULT NULL,
            postal_code varchar(10) DEFAULT NULL,
            address_type varchar(50) DEFAULT NULL,
            is_default tinyint DEFAULT '0',
            PRIMARY KEY (address_id),
            KEY fk_address_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS category (
            category_id int NOT NULL AUTO_INCREMENT,
            category_name varchar(255) NOT NULL,
            status_category tinyint DEFAULT '1',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS product (
            product_id int NOT NULL AUTO_INCREMENT,
            category_id int NOT NULL,
            product_name varchar(255) NOT NULL,
            description text,
            price decimal(10,2) NOT NULL,
            product_image varchar(255) DEFAULT NULL,
            product_status tinyint DEFAULT '1',
            has_size tinyint DEFAULT '1',
            has_color tinyint DEFAULT '0',
            quantity int DEFAULT '0',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_stock datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (product_id),
            KEY fk_product_category (category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS product_color (
            product_color_id int NOT NULL AUTO_INCREMENT,
            product_id int NOT NULL,
            color_name varchar(50) NOT NULL,
            color_hex varchar(7) DEFAULT '#000000',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (product_color_id),
            UNIQUE KEY uq_product_color_name (product_id, color_name),
            KEY fk_product_color_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS orders (
            order_id int NOT NULL AUTO_INCREMENT,
            user_id int NOT NULL,
            order_date datetime DEFAULT CURRENT_TIMESTAMP,
            total_price decimal(10,2) DEFAULT '0.00',
            shipping_fee decimal(10,2) DEFAULT '0.00',
            discount decimal(10,2) DEFAULT '0.00',
            final_price decimal(10,2) DEFAULT '0.00',
            order_status varchar(50) DEFAULT NULL,
            payment_method varchar(50) DEFAULT NULL,
            payment_status varchar(50) DEFAULT NULL,
            delivery_type varchar(50) DEFAULT NULL,
            tracking_no varchar(100) DEFAULT NULL,
            PRIMARY KEY (order_id),
            KEY fk_order_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS order_detail (
            order_detail_id int NOT NULL AUTO_INCREMENT,
            product_id int NOT NULL,
            order_id int NOT NULL,
            quantity int NOT NULL,
            price decimal(10,2) NOT NULL,
            selected_size varchar(20) DEFAULT NULL,
            selected_color varchar(50) DEFAULT NULL,
            PRIMARY KEY (order_detail_id),
            KEY fk_orderdetail_product (product_id),
            KEY fk_orderdetail_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS payment (
            payment_id int NOT NULL AUTO_INCREMENT,
            order_id int NOT NULL,
            payment_type varchar(50) NOT NULL,
            payment_amount decimal(10,2) NOT NULL,
            payment_date datetime DEFAULT CURRENT_TIMESTAMP,
            receipt_image varchar(255) DEFAULT NULL,
            PRIMARY KEY (payment_id),
            KEY fk_payment_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS stock_logs (
            stock_log_id int NOT NULL AUTO_INCREMENT,
            product_id int NOT NULL,
            change_type varchar(50) NOT NULL,
            quantity int NOT NULL,
            order_detail_id int DEFAULT NULL,
            user_id int DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (stock_log_id),
            KEY fk_stock_product (product_id),
            KEY fk_stock_orderdetail (order_detail_id),
            KEY fk_stock_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS system_log (
            log_id int NOT NULL AUTO_INCREMENT,
            user_id int NOT NULL,
            action varchar(255) NOT NULL,
            log_date datetime DEFAULT CURRENT_TIMESTAMP,
            remark text,
            PRIMARY KEY (log_id),
            KEY fk_systemlog_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ];

    for (const schema of schemas) {
        await query(schema);
    }

    if (!(await columnExists('order_detail', 'selected_size'))) {
        await query('ALTER TABLE order_detail ADD COLUMN selected_size varchar(20) DEFAULT NULL AFTER price');
    }
    if (!(await columnExists('order_detail', 'selected_color'))) {
        await query('ALTER TABLE order_detail ADD COLUMN selected_color varchar(50) DEFAULT NULL AFTER selected_size');
    }
    if (!(await columnExists('product', 'has_size'))) {
        await query('ALTER TABLE product ADD COLUMN has_size tinyint DEFAULT 1 AFTER product_status');
    }
    if (!(await columnExists('product', 'has_color'))) {
        await query('ALTER TABLE product ADD COLUMN has_color tinyint DEFAULT 0 AFTER has_size');
    }
    if (!(await columnExists('stock_logs', 'user_id'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN user_id int DEFAULT NULL AFTER order_detail_id');
    }
    if (!(await columnExists('category', 'created_at'))) {
        await query('ALTER TABLE category ADD COLUMN created_at datetime DEFAULT CURRENT_TIMESTAMP AFTER status_category');
    }
    if (!(await columnExists('category', 'updated_at'))) {
        await query('ALTER TABLE category ADD COLUMN updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    }

    await query("UPDATE `user` SET role = 'user' WHERE role IS NULL OR role NOT IN ('user', 'admin')");
    await getDefaultCategoryId();
    await migrateLegacyTables();

    const [admins] = await query('SELECT user_id FROM `user` WHERE role = ? LIMIT 1', ['admin']);
    if (admins.length === 0) {
        await query(
            'INSERT INTO `user` (username, password, full_name, email, phone, role, status_user) VALUES (?, ?, ?, ?, ?, ?, 1)',
            ['admin', 'admin123', 'System Administrator', 'admin@example.com', '0812345678', 'admin'],
        );
    }
};

db.connect((err) => {
    if (err) {
        console.error('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล:', err);
        return;
    }

    console.log('เชื่อมต่อฐานข้อมูล MySQL สำเร็จ');
    initializeDatabase().catch((schemaErr) => {
        console.error('ตั้งค่าโครงสร้างฐานข้อมูลไม่สำเร็จ:', schemaErr);
    });
});

app.get('/api/products', async (req, res) => {
    try {
        const keyword = String(req.query.search || '').trim();
        const includeInactive = String(req.query.include_inactive || '') === '1';
        const sql = `
            SELECT p.*, c.category_name
            FROM product p
            LEFT JOIN category c ON p.category_id = c.category_id
            WHERE ${includeInactive ? '1 = 1' : 'p.product_status = 1'}
            ${keyword ? 'AND (p.product_name LIKE ? OR p.description LIKE ? OR c.category_name LIKE ?)' : ''}
            ORDER BY p.created_at DESC
        `;
        const params = keyword ? [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`] : [];
        const [results] = await query(sql, params);
        const productIds = results.map((product) => product.product_id);
        let colorsByProduct = {};

        if (productIds.length > 0) {
            const [colorRows] = await query(
                `SELECT product_id, color_name, color_hex
                 FROM product_color
                 WHERE product_id IN (?)
                 ORDER BY product_color_id`,
                [productIds],
            );
            colorsByProduct = colorRows.reduce((groups, color) => {
                if (!groups[color.product_id]) groups[color.product_id] = [];
                groups[color.product_id].push({ name: color.color_name, hex: color.color_hex });
                return groups;
            }, {});
        }

        res.json(results.map((product) => normalizeProduct({
            ...product,
            colors: colorsByProduct[product.product_id] || [],
        })));
    } catch (err) {
        respondError(res, err, 'โหลดสินค้าไม่สำเร็จ');
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const includeInactive = String(req.query.include_inactive || '') === '1';
        const [results] = await query(
            `SELECT
                c.*,
                (SELECT COUNT(*) FROM product p WHERE p.category_id = c.category_id) AS product_count
             FROM category c
             ${includeInactive ? '' : 'WHERE c.status_category = 1'}
             ORDER BY c.category_name`,
        );
        res.json(results);
    } catch (err) {
        respondError(res, err, 'โหลดหมวดหมู่ไม่สำเร็จ');
    }
});

app.post('/api/admin/categories', async (req, res) => {
    try {
        const categoryName = String(req.body.category_name || '').trim();
        if (!categoryName) return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่สินค้า' });

        const [existing] = await query('SELECT category_id FROM category WHERE category_name = ? LIMIT 1', [categoryName]);
        if (existing.length > 0) {
            await query('UPDATE category SET status_category = 1 WHERE category_id = ?', [existing[0].category_id]);
            return res.json({ success: true, message: 'เปิดใช้งานหมวดหมู่สินค้านี้แล้ว', id: existing[0].category_id });
        }

        const [result] = await query(
            'INSERT INTO category (category_name, status_category) VALUES (?, 1)',
            [categoryName],
        );
        res.json({ success: true, message: 'เพิ่มหมวดหมู่สินค้าสำเร็จ', id: result.insertId });
    } catch (err) {
        respondError(res, err, 'เพิ่มหมวดหมู่สินค้าไม่สำเร็จ');
    }
});

app.put('/api/admin/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const categoryName = String(req.body.category_name || '').trim();
        const statusCategory = req.body.status_category;

        if (!id) return res.status(400).json({ error: 'ไม่พบรหัสหมวดหมู่สินค้า' });
        if (!categoryName) return res.status(400).json({ error: 'กรุณากรอกชื่อหมวดหมู่สินค้า' });

        await query(
            'UPDATE category SET category_name = ?, status_category = COALESCE(?, status_category) WHERE category_id = ?',
            [categoryName, statusCategory ?? null, id],
        );
        res.json({ success: true, message: 'อัปเดตหมวดหมู่สินค้าสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'อัปเดตหมวดหมู่สินค้าไม่สำเร็จ');
    }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'ไม่พบรหัสหมวดหมู่สินค้า' });

        const [categories] = await query(
            `SELECT
                c.category_id,
                (SELECT COUNT(*) FROM product p WHERE p.category_id = c.category_id) AS product_count
             FROM category c
             WHERE c.category_id = ?`,
            [id],
        );
        if (categories.length === 0) {
            return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้านี้' });
        }
        if (Number(categories[0].product_count) > 0) {
            return res.status(409).json({
                error: 'ไม่สามารถลบหมวดหมู่ที่ยังมีสินค้าอยู่ได้ กรุณาย้ายหรือลบสินค้าในหมวดหมู่นี้ก่อน',
            });
        }

        await query('DELETE FROM category WHERE category_id = ?', [id]);
        res.json({ success: true, message: 'ลบหมวดหมู่สินค้าแล้ว' });
    } catch (err) {
        respondError(res, err, 'ลบหมวดหมู่สินค้าไม่สำเร็จ');
    }
});

app.post('/api/products/upload-image', (req, res) => {
    const { imageData, fileName } = req.body;

    saveBase64Image(imageData, fileName, 'products')
        .then((imagePath) => {
        res.json({
            success: true,
            imageUrl: `${req.protocol}://${req.get('host')}${imagePath}`,
        });
        })
        .catch((err) => res.status(400).json({ error: err.message || 'อัปโหลดรูปภาพไม่สำเร็จ' }));
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, description, price, image_url, stock, category_id, category_name, user_id, has_size, has_color, colors } = req.body;
        const categoryId = await resolveActiveCategoryId({ categoryId: category_id, categoryName: category_name });
        if (!categoryId) return res.status(400).json({ error: 'กรุณาเลือกหมวดหมู่สินค้าที่มีอยู่ในระบบ' });
        const cleanColors = normalizeColors(colors);
        if (Number(has_color) === 1 && cleanColors.length === 0) {
            return res.status(400).json({ error: 'กรุณาเพิ่มสีสินค้าอย่างน้อย 1 สี' });
        }

        const stockAmount = Number(stock);
        if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
            return res.status(400).json({ error: 'สต็อกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
        }

        const [result] = await query(
            `INSERT INTO product
                (category_id, product_name, description, price, product_image, product_status, has_size, has_color, quantity, updated_stock)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, NOW())`,
            [categoryId, name, description || null, price, image_url || null, Number(has_size) ? 1 : 0, Number(has_color) ? 1 : 0, stockAmount],
        );

        await query(
            'INSERT INTO stock_logs (product_id, change_type, quantity, user_id) VALUES (?, ?, ?, ?)',
            [result.insertId, 'รับเข้า', stockAmount, user_id || null],
        );
        await replaceProductColors(result.insertId, Number(has_color) === 1 ? cleanColors : []);
        await writeSystemLog(user_id, 'เพิ่มสินค้า', `เพิ่มสินค้า ${name}`);

        res.json({ success: true, message: 'เพิ่มสินค้าสำเร็จ', insertId: result.insertId, id: result.insertId });
    } catch (err) {
        respondError(res, err, 'เพิ่มสินค้าไม่สำเร็จ');
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('UPDATE product SET product_status = 0 WHERE product_id = ?', [id]);
        res.json({ success: true, message: 'ปิดใช้งานสินค้าและไม่แสดงหน้าขายแล้ว' });
    } catch (err) {
        respondError(res, err, 'ปิดใช้งานสินค้าไม่สำเร็จ');
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [results] = await query(
            `SELECT user_id AS id, username, full_name, email, phone, role, status_user, created_at
             FROM \`user\`
             WHERE username = ? AND password = ? AND status_user = 1`,
            [username, password],
        );

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        await writeSystemLog(results[0].id, 'เข้าสู่ระบบ', 'ผู้ใช้เข้าสู่ระบบ');
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', user: results[0] });
    } catch (err) {
        respondError(res, err, 'เข้าสู่ระบบไม่สำเร็จ');
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, full_name, email, phone } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        const [result] = await query(
            'INSERT INTO `user` (username, password, full_name, email, phone, role, status_user) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [username, password, full_name || username, email || null, phone || null, 'user'],
        );
        await writeSystemLog(result.insertId, 'สมัครสมาชิก', `สมัครสมาชิก ${username}`);

        res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ คุณสามารถเข้าสู่ระบบได้เลย' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีคนใช้งานแล้ว กรุณาใช้ชื่ออื่น' });
        }

        respondError(res, err, 'สมัครสมาชิกไม่สำเร็จ');
    }
});

app.get('/api/admin/summary', async (req, res) => {
    try {
        const [result] = await query(
            "SELECT COUNT(order_id) AS total_orders, COALESCE(SUM(final_price), 0) AS total_revenue FROM orders WHERE order_status <> 'ยกเลิก'",
        );
        res.json(result[0]);
    } catch (err) {
        respondError(res, err, 'โหลดสรุปไม่สำเร็จ');
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const [results] = await query(`
            SELECT
                o.*,
                u.username,
                u.full_name,
                a.address_detail AS address,
                a.phone,
                pay.receipt_image
            FROM orders o
            LEFT JOIN \`user\` u ON o.user_id = u.user_id
            LEFT JOIN address a ON a.address_id = (
                SELECT MAX(address_id)
                FROM address
                WHERE user_id = o.user_id
            )
            LEFT JOIN payment pay ON pay.order_id = o.order_id
            ORDER BY o.order_date DESC
        `);
        res.json(results.map(normalizeOrder));
    } catch (err) {
        respondError(res, err, 'โหลดคำสั่งซื้อไม่สำเร็จ');
    }
});

app.post('/api/admin/orders/delete', async (req, res) => {
    try {
        const { order_id, user_id } = req.body;
        if (!order_id) return res.status(400).json({ error: 'กรุณาระบุรหัสคำสั่งซื้อที่ต้องการลบ' });

        const [orders] = await query('SELECT order_status FROM orders WHERE order_id = ?', [order_id]);
        if (orders.length === 0) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

        const [items] = await query('SELECT product_id, quantity FROM order_detail WHERE order_id = ?', [order_id]);
        if (orders[0].order_status !== 'ยกเลิก') {
            for (const item of items) {
                await query(
                    'UPDATE product SET quantity = quantity + ?, updated_stock = NOW() WHERE product_id = ?',
                    [item.quantity, item.product_id],
                );
            }
        }
        await query('DELETE FROM stock_logs WHERE order_detail_id IN (SELECT order_detail_id FROM order_detail WHERE order_id = ?)', [order_id]);
        await query('DELETE FROM payment WHERE order_id = ?', [order_id]);
        await query('DELETE FROM order_detail WHERE order_id = ?', [order_id]);
        await query('DELETE FROM orders WHERE order_id = ?', [order_id]);
        await writeSystemLog(user_id, 'ลบคำสั่งซื้อ', `ลบคำสั่งซื้อ #${order_id}`);
        res.json({ success: true, message: 'ลบคำสั่งซื้อสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ลบคำสั่งซื้อไม่สำเร็จ');
    }
});

app.get('/api/admin/customers', async (req, res) => {
    try {
        const [results] = await query(`
            SELECT
                u.user_id AS id,
                u.username,
                u.full_name,
                u.email,
                u.phone,
                u.role,
                u.status_user,
                u.created_at,
                COUNT(o.order_id) AS total_orders,
                IFNULL(SUM(o.final_price), 0) AS total_spent
            FROM \`user\` u
            LEFT JOIN orders o ON u.user_id = o.user_id
            WHERE u.status_user = 1
            GROUP BY u.user_id
            ORDER BY total_spent DESC
        `);
        res.json(results);
    } catch (err) {
        respondError(res, err, 'โหลดสมาชิกไม่สำเร็จ');
    }
});

app.get('/api/admin/order-items/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const [results] = await query(`
            SELECT od.*, p.product_name AS name
            FROM order_detail od
            JOIN product p ON od.product_id = p.product_id
            WHERE od.order_id = ?
        `, [orderId]);
        res.json(results);
    } catch (err) {
        respondError(res, err, 'โหลดรายการสินค้าในออเดอร์ไม่สำเร็จ');
    }
});

app.post('/api/admin/change-role', async (req, res) => {
    try {
        const { user_id, new_role } = req.body;
        const nextRole = normalizeRole(new_role);
        await query('UPDATE `user` SET role = ? WHERE user_id = ?', [nextRole, user_id]);
        await writeSystemLog(user_id, 'เปลี่ยนสิทธิ์', `เปลี่ยนสิทธิ์เป็น ${nextRole}`);
        res.json({ success: true, message: 'เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ' });
    } catch (err) {
        respondError(res, err, 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('UPDATE `user` SET status_user = 0 WHERE user_id = ?', [id]);
        await writeSystemLog(id, 'ปิดใช้งานสมาชิก', 'ปิดใช้งานสมาชิกจากหน้า Admin');
        res.json({ success: true, message: 'ปิดใช้งานสมาชิกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ลบสมาชิกไม่สำเร็จ');
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, full_name, email, phone } = req.body;
        const hasPassword = password && password.trim() !== '';
        const sql = hasPassword
            ? 'UPDATE `user` SET username = ?, password = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?'
            : 'UPDATE `user` SET username = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?';
        const params = hasPassword
            ? [username, password, full_name || username, email || null, phone || null, id]
            : [username, full_name || username, email || null, phone || null, id];

        await query(sql, params);
        await writeSystemLog(id, 'แก้ไขสมาชิก', `แก้ไขข้อมูล ${username}`);
        res.json({ success: true, message: 'แก้ไขข้อมูลสมาชิกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'แก้ไขสมาชิกไม่สำเร็จ');
    }
});

app.put('/api/users/:id/profile', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, full_name, email, phone } = req.body;

        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้' });
        }

        const hasPassword = password && password.trim() !== '';
        const sql = hasPassword
            ? 'UPDATE `user` SET username = ?, password = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?'
            : 'UPDATE `user` SET username = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?';
        const params = hasPassword
            ? [username, password, full_name || username, email || null, phone || null, id]
            : [username, full_name || username, email || null, phone || null, id];

        await query(sql, params);
        await writeSystemLog(id, 'แก้ไขโปรไฟล์', 'ผู้ใช้แก้ไขข้อมูลส่วนตัว');

        const [results] = await query(
            'SELECT user_id AS id, username, full_name, email, phone, role, status_user, created_at FROM `user` WHERE user_id = ?',
            [id],
        );
        res.json({ success: true, message: 'อัปเดตข้อมูลโปรไฟล์สำเร็จ', user: results[0] });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีคนใช้งานแล้ว' });
        }

        respondError(res, err, 'อัปเดตโปรไฟล์ไม่สำเร็จ');
    }
});

app.get('/api/users/:id/addresses', async (req, res) => {
    try {
        const { id } = req.params;
        const [results] = await query(
            `
                SELECT *
                FROM address
                WHERE user_id = ?
                ORDER BY is_default DESC, address_id DESC
            `,
            [id],
        );
        res.json(results);
    } catch (err) {
        respondError(res, err, 'โหลดที่อยู่ไม่สำเร็จ');
    }
});

app.post('/api/users/:id/addresses', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            receiver_name,
            phone,
            address_detail,
            subdistrict,
            district,
            province,
            postal_code,
            address_type,
            is_default,
        } = req.body;

        if (!receiver_name || !address_detail) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้รับและที่อยู่' });
        }

        if (is_default) {
            await query('UPDATE address SET is_default = 0 WHERE user_id = ?', [id]);
        }

        const [result] = await query(
            `
                INSERT INTO address
                    (user_id, receiver_name, phone, address_detail, subdistrict, district, province, postal_code, address_type, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                id,
                receiver_name,
                phone || null,
                address_detail,
                subdistrict || null,
                district || null,
                province || null,
                postal_code || null,
                address_type || 'บ้าน',
                is_default ? 1 : 0,
            ],
        );
        await writeSystemLog(id, 'เพิ่มที่อยู่', `เพิ่มที่อยู่ #${result.insertId}`);
        res.json({ success: true, message: 'บันทึกที่อยู่สำเร็จ', address_id: result.insertId });
    } catch (err) {
        respondError(res, err, 'บันทึกที่อยู่ไม่สำเร็จ');
    }
});

app.put('/api/users/:id/addresses/:addressId', async (req, res) => {
    try {
        const { id, addressId } = req.params;
        const {
            receiver_name,
            phone,
            address_detail,
            subdistrict,
            district,
            province,
            postal_code,
            address_type,
            is_default,
        } = req.body;

        if (!receiver_name || !address_detail) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้รับและที่อยู่' });
        }

        if (is_default) {
            await query('UPDATE address SET is_default = 0 WHERE user_id = ?', [id]);
        }

        await query(
            `
                UPDATE address
                SET receiver_name = ?,
                    phone = ?,
                    address_detail = ?,
                    subdistrict = ?,
                    district = ?,
                    province = ?,
                    postal_code = ?,
                    address_type = ?,
                    is_default = ?
                WHERE address_id = ? AND user_id = ?
            `,
            [
                receiver_name,
                phone || null,
                address_detail,
                subdistrict || null,
                district || null,
                province || null,
                postal_code || null,
                address_type || 'บ้าน',
                is_default ? 1 : 0,
                addressId,
                id,
            ],
        );
        await writeSystemLog(id, 'แก้ไขที่อยู่', `แก้ไขที่อยู่ #${addressId}`);
        res.json({ success: true, message: 'อัปเดตที่อยู่สำเร็จ' });
    } catch (err) {
        respondError(res, err, 'อัปเดตที่อยู่ไม่สำเร็จ');
    }
});

app.delete('/api/users/:id/addresses/:addressId', async (req, res) => {
    try {
        const { id, addressId } = req.params;
        const [addresses] = await query(
            'SELECT address_id, is_default FROM address WHERE address_id = ? AND user_id = ?',
            [addressId, id],
        );

        if (addresses.length === 0) {
            return res.status(404).json({ error: 'ไม่พบที่อยู่นี้' });
        }

        const deletedAddress = addresses[0];
        await query('DELETE FROM address WHERE address_id = ? AND user_id = ?', [addressId, id]);

        if (Number(deletedAddress.is_default) === 1) {
            const [remaining] = await query(
                'SELECT address_id FROM address WHERE user_id = ? ORDER BY address_id DESC LIMIT 1',
                [id],
            );

            if (remaining.length > 0) {
                await query('UPDATE address SET is_default = 1 WHERE address_id = ? AND user_id = ?', [remaining[0].address_id, id]);
            }
        }

        await writeSystemLog(id, 'ลบที่อยู่', `ลบที่อยู่ #${addressId}`);
        res.json({ success: true, message: 'ลบที่อยู่สำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ลบที่อยู่ไม่สำเร็จ');
    }
});

app.post('/api/users/:id/addresses/:addressId/default', async (req, res) => {
    try {
        const { id, addressId } = req.params;
        await query('UPDATE address SET is_default = 0 WHERE user_id = ?', [id]);
        await query('UPDATE address SET is_default = 1 WHERE address_id = ? AND user_id = ?', [addressId, id]);
        await writeSystemLog(id, 'ตั้งที่อยู่หลัก', `ตั้งที่อยู่ #${addressId} เป็นที่อยู่หลัก`);
        res.json({ success: true, message: 'ตั้งที่อยู่หลักสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ตั้งที่อยู่หลักไม่สำเร็จ');
    }
});

app.get('/api/admin/stock-logs', async (req, res) => {
    try {
        const [results] = await query(`
            SELECT
                l.stock_log_id AS id,
                l.stock_log_id,
                l.change_type,
                l.quantity AS amount,
                l.quantity,
                l.order_detail_id,
                l.user_id,
                l.created_at,
                p.product_name AS product_name,
                COALESCE(
                    CASE WHEN stock_user.role = 'admin' THEN COALESCE(stock_user.full_name, stock_user.username) END,
                    CASE WHEN order_user.role = 'admin' THEN COALESCE(order_user.full_name, order_user.username) END,
                    CASE WHEN inferred_user.role = 'admin' THEN COALESCE(inferred_user.full_name, inferred_user.username) END
                ) AS admin_name,
                COALESCE(
                    CASE WHEN stock_user.role = 'admin' THEN stock_user.username END,
                    CASE WHEN order_user.role = 'admin' THEN order_user.username END,
                    CASE WHEN inferred_user.role = 'admin' THEN inferred_user.username END
                ) AS username,
                COALESCE(stock_user.role, order_user.role, inferred_user.role) AS actor_role
            FROM stock_logs l
            LEFT JOIN product p ON l.product_id = p.product_id
            LEFT JOIN \`user\` stock_user ON l.user_id = stock_user.user_id
            LEFT JOIN order_detail od ON l.order_detail_id = od.order_detail_id
            LEFT JOIN orders o ON od.order_id = o.order_id
            LEFT JOIN \`user\` order_user ON o.user_id = order_user.user_id
            LEFT JOIN system_log inferred_log ON inferred_log.log_id = (
                SELECT sl.log_id
                FROM system_log sl
                WHERE l.user_id IS NULL
                    AND l.order_detail_id IS NULL
                    AND ABS(TIMESTAMPDIFF(SECOND, sl.log_date, l.created_at)) <= 300
                    AND (
                        (sl.action = 'ปรับสต็อก' AND sl.remark = CONCAT(l.change_type, ': ', l.quantity))
                        OR (sl.action = 'เพิ่มสินค้า' AND l.change_type = 'รับเข้า' AND sl.remark = CONCAT('เพิ่มสินค้า ', p.product_name))
                    )
                ORDER BY ABS(TIMESTAMPDIFF(SECOND, sl.log_date, l.created_at)), sl.log_id DESC
                LIMIT 1
            )
            LEFT JOIN \`user\` inferred_user ON inferred_log.user_id = inferred_user.user_id
            ORDER BY l.created_at DESC
        `);
        res.json(results.map((item) => ({
            ...item,
            remark: item.change_type,
        })));
    } catch (err) {
        respondError(res, err, 'โหลดประวัติสต็อกไม่สำเร็จ');
    }
});

app.get('/api/admin/system-logs', async (req, res) => {
    try {
        const [results] = await query(`
            SELECT
                l.log_id AS id,
                l.log_id,
                l.user_id,
                l.action,
                l.remark,
                l.log_date,
                u.username,
                u.full_name,
                u.role
            FROM system_log l
            JOIN \`user\` u ON l.user_id = u.user_id
            WHERE u.role = 'admin'
            ORDER BY l.log_date DESC, l.log_id DESC
        `);
        res.json(results);
    } catch (err) {
        respondError(res, err, 'โหลดบันทึกแอดมินไม่สำเร็จ');
    }
});

app.post('/api/products/update-stock', async (req, res) => {
    try {
        const { product_id, amount, remark, user_id } = req.body;
        const stockAmount = Number(amount);
        if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
            return res.status(400).json({ error: 'จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
        }
        const stockRemark = String(remark || '').trim();
        if (!stockRemark) {
            return res.status(400).json({ error: 'กรุณากรอกหมายเหตุทุกครั้งเมื่อรับสต็อก' });
        }

        await query(
            'INSERT INTO stock_logs (product_id, change_type, quantity, user_id) VALUES (?, ?, ?, ?)',
            [product_id, stockRemark, stockAmount, user_id || null],
        );
        await query(
            'UPDATE product SET quantity = quantity + ?, updated_stock = NOW() WHERE product_id = ?',
            [stockAmount, product_id],
        );
        await writeSystemLog(user_id, 'ปรับสต็อก', `${stockRemark}: ${stockAmount}`);

        res.json({ success: true, message: 'ปรับปรุงสต็อกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ปรับสต็อกไม่สำเร็จ');
    }
});

app.post('/api/admin/stock-logs/delete', async (req, res) => {
    try {
        const { log_id, user_id, remark } = req.body;
        if (!log_id) return res.status(400).json({ error: 'ไม่พบรหัสรายการประวัติสต็อก' });

        const [results] = await query(
            'SELECT product_id, change_type, quantity FROM stock_logs WHERE stock_log_id = ?',
            [log_id],
        );
        if (results.length === 0) return res.status(404).json({ error: 'ไม่พบรายการประวัติสต็อก' });

        const { product_id, change_type, quantity } = results[0];
        const restoreAmount = change_type === 'ขายออก' ? quantity : -quantity;
        await query('DELETE FROM stock_logs WHERE stock_log_id = ?', [log_id]);
        await query(
            'UPDATE product SET quantity = quantity + ?, updated_stock = NOW() WHERE product_id = ?',
            [restoreAmount, product_id],
        );
        await writeSystemLog(user_id, 'ลบประวัติสต็อก', `${remark || 'ไม่ระบุเหตุผล'} (#${log_id})`);
        res.json({ success: true, message: 'ลบประวัติสต็อกและปรับยอดคืนสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ลบประวัติสต็อกไม่สำเร็จ');
    }
});

app.post('/api/admin/products/edit', async (req, res) => {
    try {
        const { id, name, price, description, image_url, category_id, category_name, product_status, has_size, has_color, colors } = req.body;
        const cleanColors = normalizeColors(colors);
        if (Number(has_color) === 1 && cleanColors.length === 0) {
            return res.status(400).json({ error: 'กรุณาเพิ่มสีสินค้าอย่างน้อย 1 สี' });
        }
        const shouldUpdateCategory = Boolean(category_id || String(category_name || '').trim());
        const categoryId = shouldUpdateCategory
            ? await resolveActiveCategoryId({ categoryId: category_id, categoryName: category_name })
            : null;
        if (shouldUpdateCategory && !categoryId) {
            return res.status(400).json({ error: 'กรุณาเลือกหมวดหมู่สินค้าที่มีอยู่ในระบบ' });
        }

        await query(
            `UPDATE product
             SET product_name = ?,
                 price = ?,
                 description = ?,
                 product_image = COALESCE(?, product_image),
                 category_id = COALESCE(?, category_id),
                 product_status = COALESCE(?, product_status),
                 has_size = COALESCE(?, has_size),
                 has_color = COALESCE(?, has_color)
             WHERE product_id = ?`,
            [
                name,
                price,
                description || null,
                image_url || null,
                categoryId || null,
                product_status ?? null,
                has_size ?? null,
                has_color ?? null,
                id,
            ],
        );
        await replaceProductColors(id, Number(has_color) === 1 ? cleanColors : []);
        res.json({ success: true, message: 'แก้ไขสินค้าสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'แก้ไขสินค้าไม่สำเร็จ');
    }
});

app.post('/api/admin/products/delete', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ไม่พบรหัสสินค้า' });

        await query('UPDATE product SET product_status = 0 WHERE product_id = ?', [id]);
        res.json({ success: true, message: 'ปิดใช้งานสินค้าและไม่แสดงหน้าขายแล้ว' });
    } catch (err) {
        respondError(res, err, 'ปิดใช้งานสินค้าไม่สำเร็จ');
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ไม่พบรหัสสินค้า' });

    try {
        const [products] = await query(
            'SELECT product_id, product_name FROM product WHERE product_id = ? LIMIT 1',
            [id],
        );
        if (products.length === 0) {
            return res.status(404).json({ error: 'ไม่พบสินค้าในระบบ' });
        }

        const [orderUsage] = await query(
            'SELECT COUNT(*) AS usage_count FROM order_detail WHERE product_id = ?',
            [id],
        );
        if (Number(orderUsage[0]?.usage_count) > 0) {
            return res.status(409).json({
                error: 'ไม่สามารถลบสินค้าที่มีประวัติคำสั่งซื้อได้ กรุณาปิดใช้งานสินค้าแทน',
            });
        }

        await dbp.beginTransaction();
        try {
            await query('DELETE FROM stock_logs WHERE product_id = ?', [id]);
            await query('DELETE FROM product_color WHERE product_id = ?', [id]);
            await query('DELETE FROM product WHERE product_id = ?', [id]);
            await dbp.commit();
        } catch (transactionError) {
            await dbp.rollback();
            throw transactionError;
        }

        res.json({ success: true, message: 'ลบสินค้าออกจากระบบแล้ว' });
    } catch (err) {
        respondError(res, err, 'ลบสินค้าไม่สำเร็จ');
    }
});

app.post('/api/admin/products/status', async (req, res) => {
    try {
        const { id, product_status } = req.body;
        const nextStatus = Number(product_status);

        if (!id) return res.status(400).json({ error: 'ไม่พบรหัสสินค้า' });
        if (![0, 1].includes(nextStatus)) {
            return res.status(400).json({ error: 'สถานะสินค้าต้องเป็น 0 หรือ 1' });
        }

        const [result] = await query(
            'UPDATE product SET product_status = ? WHERE product_id = ?',
            [nextStatus, id],
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'ไม่พบสินค้าในระบบ' });
        }

        res.json({
            success: true,
            product_status: nextStatus,
            message: nextStatus === 1 ? 'เปิดใช้งานสินค้าแล้ว' : 'ปิดใช้งานสินค้าแล้ว',
        });
    } catch (err) {
        respondError(res, err, 'เปลี่ยนสถานะสินค้าไม่สำเร็จ');
    }
});

app.post('/api/orders/checkout', async (req, res) => {
    try {
        const {
            user_id,
            username,
            total_price,
            shipping_fee,
            discount: requested_discount,
            address,
            address_id,
            phone,
            subdistrict,
            district,
            province,
            postal_code,
            payment_method,
            shipping_method,
            receipt_image_data,
            receipt_file_name,
            cart_items,
        } = req.body;

        if (!user_id) return res.status(400).json({ error: 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ' });
        if (!cart_items || cart_items.length === 0) return res.status(400).json({ error: 'ไม่มีสินค้าในตะกร้า' });

        const cleanTotal = String(total_price).replace(/[^\d.]/g, '');
        const totalPrice = parseFloat(cleanTotal) || 0;
        const requestedShippingFee = parseFloat(String(shipping_fee ?? '').replace(/[^\d.]/g, ''));
        const shippingFee = shipping_method === 'รับหน้าร้าน' ? 0 : (Number.isFinite(requestedShippingFee) ? requestedShippingFee : 50);
        const requestedDiscount = parseFloat(String(requested_discount ?? '').replace(/[^\d.]/g, '')) || 0;
        const discount = Math.min(Math.max(requestedDiscount, 0), totalPrice + shippingFee);
        const finalPrice = Math.max(totalPrice + shippingFee - discount, 0);
        const receiptPath = await saveBase64Image(receipt_image_data, receipt_file_name, 'receipts');
        const receiptUrl = receiptPath ? `${req.protocol}://${req.get('host')}${receiptPath}` : null;
        // ถ้ายังไม่มีสลิป ให้รอชำระก่อน ถ้ามีสลิปแล้วค่อยส่งให้แอดมินตรวจสอบ
        const initialOrderStatus = receiptUrl ? 'รอตรวจสอบ' : 'รอชำระ';

        if (address_id) {
            await query(
                `
                    UPDATE address
                    SET receiver_name = ?,
                        phone = ?,
                        address_detail = ?,
                        subdistrict = ?,
                        district = ?,
                        province = ?,
                        postal_code = ?,
                        address_type = ?,
                        is_default = 1
                    WHERE address_id = ? AND user_id = ?
                `,
                [
                    username || 'ลูกค้า',
                    phone || null,
                    shipping_method === 'รับหน้าร้าน' ? 'รับสินค้าเองที่หน้าร้าน' : address,
                    subdistrict || null,
                    district || null,
                    province || null,
                    postal_code || null,
                    shipping_method,
                    address_id,
                    user_id,
                ],
            );
        } else {
            await query(
                `INSERT INTO address
                    (user_id, receiver_name, phone, address_detail, subdistrict, district, province, postal_code, address_type, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    user_id,
                    username || 'ลูกค้า',
                    phone || null,
                    shipping_method === 'รับหน้าร้าน' ? 'รับสินค้าเองที่หน้าร้าน' : address,
                    subdistrict || null,
                    district || null,
                    province || null,
                    postal_code || null,
                    shipping_method,
                ],
            );
        }

        const [orderResult] = await query(
            `INSERT INTO orders
                (user_id, total_price, shipping_fee, discount, final_price, order_status, payment_method, payment_status, delivery_type, tracking_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                totalPrice,
                shippingFee,
                discount,
                finalPrice,
                initialOrderStatus,
                payment_method || 'โอนเงินผ่านธนาคาร',
                initialOrderStatus,
                shipping_method || 'ส่งสินค้า',
                null,
            ],
        );

        const orderId = orderResult.insertId;

        for (const item of cart_items) {
            const productId = item.id || item.product_id || item.p_id;
            const quantity = Number.parseInt(item.qty ?? item.selected_quantity ?? 1, 10);
            const itemPrice = parseFloat(String(item.price || 0).replace(/[^\d.]/g, '')) || 0;
            const selectedSize = String(item.selected_size || item.size || '').trim() || null;
            const selectedColor = String(item.selected_color || item.color || '').trim() || null;

            if (!productId) continue;
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return res.status(400).json({ error: 'จำนวนสินค้าที่สั่งซื้อต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
            }

            const [products] = await query(
                'SELECT quantity, product_name FROM product WHERE product_id = ? AND product_status = 1',
                [productId],
            );
            if (products.length === 0) {
                return res.status(400).json({ error: 'ไม่พบสินค้าในระบบ' });
            }
            if ((Number(products[0].quantity) || 0) < quantity) {
                return res.status(400).json({ error: `สินค้า ${products[0].product_name} มีจำนวนไม่พอ` });
            }

            const [detailResult] = await query(
                'INSERT INTO order_detail (product_id, order_id, quantity, price, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?)',
                [productId, orderId, quantity, itemPrice, selectedSize, selectedColor],
            );
            await query(
                'UPDATE product SET quantity = quantity - ?, updated_stock = NOW() WHERE product_id = ?',
                [quantity, productId],
            );
            await query(
                'INSERT INTO stock_logs (product_id, change_type, quantity, order_detail_id, user_id) VALUES (?, ?, ?, ?, ?)',
                [productId, 'ขายออก', quantity, detailResult.insertId, user_id],
            );
        }

        await query(
            'INSERT INTO payment (order_id, payment_type, payment_amount, receipt_image) VALUES (?, ?, ?, ?)',
            [orderId, payment_method || 'โอนเงินผ่านธนาคาร', finalPrice, receiptUrl],
        );
        await writeSystemLog(user_id, 'สั่งซื้อสินค้า', `คำสั่งซื้อ #${orderId}`);

        res.json({ success: true, message: 'สั่งซื้อสำเร็จ', order_id: orderId });
    } catch (err) {
        respondError(res, err, 'บันทึกคำสั่งซื้อไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/receipt', async (req, res) => {
    try {
        const { id } = req.params;
        const { receipt_image_data, receipt_file_name } = req.body;
        const [orders] = await query('SELECT order_id, final_price, payment_method FROM orders WHERE order_id = ?', [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const receiptPath = await saveBase64Image(receipt_image_data, receipt_file_name, 'receipts');
        if (!receiptPath) {
            return res.status(400).json({ error: 'กรุณาแนบรูปสลิปโอนเงิน' });
        }

        const receiptUrl = `${req.protocol}://${req.get('host')}${receiptPath}`;
        const order = orders[0];
        const [paymentResult] = await query(
            'UPDATE payment SET receipt_image = ? WHERE order_id = ?',
            [receiptUrl, id],
        );

        if (paymentResult.affectedRows === 0) {
            await query(
                'INSERT INTO payment (order_id, payment_type, payment_amount, receipt_image) VALUES (?, ?, ?, ?)',
                [id, order.payment_method || 'โอนเงินผ่านธนาคาร', order.final_price || 0, receiptUrl],
            );
        }

        await query(
            'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
            ['รอตรวจสอบ', 'รอตรวจสอบ', id],
        );

        res.json({ success: true, message: 'แนบสลิปเรียบร้อยแล้ว', receipt_image: receiptUrl });
    } catch (err) {
        respondError(res, err, 'แนบสลิปไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, username } = req.body;
        const cancelableStatuses = ['รอชำระ', 'รอตรวจสอบ'];

        const [orders] = await query(`
            SELECT o.order_id, o.user_id, o.order_status, u.username
            FROM orders o
            JOIN \`user\` u ON o.user_id = u.user_id
            WHERE o.order_id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const order = orders[0];
        const isOwnerById = user_id && Number(user_id) === Number(order.user_id);
        const isOwnerByUsername = username && String(username).toLowerCase() === String(order.username).toLowerCase();

        if (!isOwnerById && !isOwnerByUsername) {
            return res.status(403).json({ error: 'ไม่สามารถยกเลิกคำสั่งซื้อของบัญชีอื่นได้' });
        }

        if (order.order_status === 'ยกเลิก') {
            return res.json({ success: true, message: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว' });
        }

        if (!cancelableStatuses.includes(order.order_status)) {
            return res.status(400).json({ error: 'คำสั่งซื้อนี้เริ่มดำเนินการแล้ว ไม่สามารถยกเลิกเองได้' });
        }

        const [items] = await query(
            'SELECT order_detail_id, product_id, quantity FROM order_detail WHERE order_id = ?',
            [id],
        );

        for (const item of items) {
            await query(
                'UPDATE product SET quantity = quantity + ?, updated_stock = NOW() WHERE product_id = ?',
                [item.quantity, item.product_id],
            );
            await query(
                'INSERT INTO stock_logs (product_id, change_type, quantity, order_detail_id, user_id) VALUES (?, ?, ?, ?, ?)',
                [item.product_id, 'คืนสต็อกจากการยกเลิกคำสั่งซื้อ', item.quantity, item.order_detail_id, order.user_id],
            );
        }

        await query(
            'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
            ['ยกเลิก', 'ยกเลิก', id],
        );
        await writeSystemLog(order.user_id, 'ยกเลิกคำสั่งซื้อ', `ลูกค้ายกเลิกคำสั่งซื้อ #${id}`);

        res.json({ success: true, message: 'ยกเลิกคำสั่งซื้อและคืนสต็อกเรียบร้อยแล้ว' });
    } catch (err) {
        respondError(res, err, 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tracking_no, user_id } = req.body;
        const [orders] = await query('SELECT order_id, delivery_type, order_status FROM orders WHERE order_id = ?', [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const order = orders[0];
        const deliveryType = order.delivery_type || 'ส่งสินค้า';
        const trackingNo = String(tracking_no || '').trim();
        const requestedStatus = String(status || '').trim();
        const allowedStatuses = ['รอชำระ', 'รอตรวจสอบ', 'กำลังจัดส่ง', 'เตรียมสินค้า', 'พร้อมรับ', 'จัดส่งแล้ว'];
        const approvedOrderStatuses = ['กำลังจัดส่ง', 'เตรียมสินค้า', 'พร้อมรับ', 'จัดส่งแล้ว'];

        if (order.order_status === 'ยกเลิก') {
            return res.status(400).json({ error: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะต่อได้', field: 'status' });
        }

        if (!allowedStatuses.includes(requestedStatus)) {
            return res.status(400).json({ error: 'สถานะคำสั่งซื้อไม่ถูกต้อง', field: 'status' });
        }

        const [payments] = await query(
            'SELECT receipt_image FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
            [id],
        );
        const hasReceipt = Boolean(payments[0]?.receipt_image);

        if (approvedOrderStatuses.includes(requestedStatus) && !hasReceipt) {
            return res.status(400).json({ error: 'ต้องมีสลิปก่อนยืนยันคำสั่งซื้อ', field: 'receipt_image' });
        }

        if (deliveryType === 'รับหน้าร้าน' && ['กำลังจัดส่ง', 'จัดส่งแล้ว'].includes(requestedStatus)) {
            return res.status(400).json({ error: 'ออเดอร์รับหน้าร้านต้องใช้สถานะเตรียมสินค้าหรือพร้อมรับ', field: 'status' });
        }

        if (deliveryType !== 'รับหน้าร้าน' && ['เตรียมสินค้า', 'พร้อมรับ'].includes(requestedStatus)) {
            return res.status(400).json({ error: 'ออเดอร์จัดส่งต้องใช้สถานะกำลังจัดส่งหรือจัดส่งแล้ว', field: 'status' });
        }

        if (requestedStatus === 'จัดส่งแล้ว' && !trackingNo) {
            return res.status(400).json({ error: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นจัดส่งแล้ว', field: 'tracking_no' });
        }

        const paymentStatus = approvedOrderStatuses.includes(requestedStatus)
            ? 'ชำระเงินแล้ว'
            : requestedStatus;

        await query(
            'UPDATE orders SET order_status = ?, payment_status = ?, tracking_no = COALESCE(?, tracking_no) WHERE order_id = ?',
            [requestedStatus, paymentStatus, trackingNo || null, id],
        );
        await writeSystemLog(
            user_id,
            'อัปเดตสถานะคำสั่งซื้อ',
            `คำสั่งซื้อ #${id} เป็น ${requestedStatus}${trackingNo ? ` / เลขพัสดุ ${trackingNo}` : ''}`,
        );
        res.json({ success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
    } catch (err) {
        respondError(res, err, 'อัปเดตสถานะไม่สำเร็จ');
    }
});

app.get('/api/orders/history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const [results] = await query(`
            SELECT
                o.order_id AS id,
                u.username,
                o.total_price,
                o.shipping_fee,
                o.discount,
                o.final_price,
                o.order_status AS status,
                o.payment_method,
                o.payment_status,
                o.delivery_type AS shipping_method,
                o.tracking_no,
                o.order_date AS created_at,
                od.product_id,
                od.quantity,
                od.price,
                od.selected_size,
                od.selected_color,
                p.product_name AS product_name
            FROM orders o
            JOIN \`user\` u ON o.user_id = u.user_id
            LEFT JOIN order_detail od ON o.order_id = od.order_id
            LEFT JOIN product p ON od.product_id = p.product_id
            WHERE LOWER(u.username) = LOWER(?)
            ORDER BY o.order_date DESC, o.order_id DESC
        `, [username]);
        res.json(results);
    } catch (err) {
        console.error('Order history SQL error:', err);
        res.status(500).json([]);
    }
});

app.listen(port, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${port}`);
});
