const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const loadLocalEnv = () => {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match || process.env[match[1]] !== undefined) continue;

        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
};

loadLocalEnv();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'shop_lru',
});
const dbp = db.promise();

const query = (sql, params = []) => dbp.query(sql, params);

const hashResetCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const PASSWORD_HASH_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:0[689]\d{8}|\+66[689]\d{8})$/;

const cleanText = (value) => String(value ?? '').trim();
const cleanPhone = (value) => cleanText(value).replace(/[\s-]/g, '');
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''));
const hashPassword = (password) => bcrypt.hash(String(password), PASSWORD_HASH_ROUNDS);
const verifyPassword = async (password, storedPassword) => {
    if (isBcryptHash(storedPassword)) return bcrypt.compare(String(password), storedPassword);
    return String(password) === String(storedPassword || '');
};

const getFirstRegisterValidationMessage = ({ username, full_name, email, phone, password, confirm_password }) => {
    if (!cleanText(username)) return 'กรุณากรอกชื่อผู้ใช้';
    if (!cleanText(full_name)) return 'กรุณากรอกชื่อ-นามสกุล';
    if (!cleanText(email)) return 'กรุณากรอกอีเมล';
    if (!EMAIL_REGEX.test(cleanText(email))) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (!cleanText(phone)) return 'กรุณากรอกเบอร์โทร';
    if (!PHONE_REGEX.test(cleanPhone(phone))) return 'รูปแบบเบอร์โทรไม่ถูกต้อง';
    if (!String(password || '')) return 'กรุณากรอกรหัสผ่าน';
    if (String(password).length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    if (!String(confirm_password || '')) return 'กรุณากรอกยืนยันรหัสผ่าน';
    if (String(password) !== String(confirm_password)) return 'รหัสผ่านไม่ตรงกัน';
    return '';
};

const getThaiAddressData = (() => {
    let cached = null;
    return () => {
        if (cached) return cached;

        const jsonDir = path.join(__dirname, '..', 'frontend', 'public', 'api-thai', 'json');
        const readJson = (fileName) => JSON.parse(fs.readFileSync(path.join(jsonDir, fileName), 'utf8'));
        try {
            cached = {
                provinces: readJson('provinces.json').filter((item) => !item.deleted_at),
                districts: readJson('districts.json').filter((item) => !item.deleted_at),
                subDistricts: readJson('sub_districts.json').filter((item) => !item.deleted_at),
            };
        } catch (err) {
            console.warn('โหลดข้อมูลจังหวัด/อำเภอ/ตำบลไม่สำเร็จ:', err.message);
            cached = { provinces: [], districts: [], subDistricts: [] };
        }
        return cached;
    };
})();

const getNameTh = (item) => item?.name_th || '';
const getZipCode = (item) => (item?.zip_code ? String(item.zip_code) : '');
const normalizeAddressPayload = (body = {}) => ({
    receiver_name: cleanText(body.receiver_name),
    phone: cleanPhone(body.receiver_phone ?? body.phone),
    address_detail: cleanText(body.address ?? body.address_detail),
    subdistrict: cleanText(body.subdistrict),
    district: cleanText(body.district),
    province: cleanText(body.province),
    postal_code: cleanText(body.postcode ?? body.postal_code),
    address_type: cleanText(body.address_type),
    is_default: Boolean(body.set_default_address ?? body.is_default),
});

const getFirstAddressValidationMessage = (payload) => {
    if (!payload.receiver_name) return 'กรุณากรอกชื่อผู้รับ';
    if (!payload.phone) return 'กรุณากรอกเบอร์โทรผู้รับ';
    if (!PHONE_REGEX.test(payload.phone)) return 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง';
    if (!payload.address_detail) return 'กรุณากรอกที่อยู่';
    if (!payload.province) return 'กรุณาเลือกจังหวัด';
    if (!payload.district) return 'กรุณาเลือกอำเภอ/เขต';
    if (!payload.subdistrict) return 'กรุณาเลือกตำบล/แขวง';
    if (!payload.postal_code) return 'กรุณาเลือกรหัสไปรษณีย์';
    if (!payload.address_type) return 'กรุณากรอกประเภทที่อยู่';

    const { provinces, districts, subDistricts } = getThaiAddressData();
    if (provinces.length === 0) return '';

    const province = provinces.find((item) => getNameTh(item) === payload.province);
    if (!province) return 'จังหวัดไม่ถูกต้อง';

    const district = districts.find((item) => item.province_id === province.id && getNameTh(item) === payload.district);
    if (!district) return 'อำเภอ/เขตไม่ตรงกับจังหวัด';

    const subDistrict = subDistricts.find((item) => item.district_id === district.id && getNameTh(item) === payload.subdistrict);
    if (!subDistrict) return 'ตำบล/แขวงไม่ตรงกับอำเภอ/เขต';

    if (getZipCode(subDistrict) !== String(payload.postal_code)) return 'รหัสไปรษณีย์ไม่ตรงกับตำบล/แขวง';
    return '';
};

const getSmtpTransport = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

const sendPasswordResetEmail = async ({ email, fullName, code }) => {
    const transport = getSmtpTransport();
    if (!transport) return { sent: false };

    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'รหัสยืนยันสำหรับรีเซ็ตรหัสผ่าน',
        text: `สวัสดี ${fullName || 'ผู้ใช้งาน'}\n\nรหัสยืนยันของคุณคือ ${code}\nรหัสนี้จะหมดอายุภายใน 10 นาที\n\nหากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาไม่ต้องดำเนินการใด ๆ`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #2b2725; line-height: 1.6;">
                <h2>รหัสยืนยันสำหรับรีเซ็ตรหัสผ่าน</h2>
                <p>สวัสดี ${fullName || 'ผู้ใช้งาน'}</p>
                <p>ใช้รหัสด้านล่างเพื่อยืนยันตัวตนและตั้งรหัสผ่านใหม่</p>
                <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #a9472f; margin: 18px 0;">${code}</div>
                <p>รหัสนี้จะหมดอายุภายใน 10 นาที</p>
                <p style="color: #6f6a66;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาไม่ต้องดำเนินการใด ๆ</p>
            </div>
        `,
    });

    return { sent: true };
};

const getPublicMailErrorMessage = (errorMessage = '') => {
    const message = String(errorMessage || '');
    if (/Invalid login|BadCredentials|Username and Password not accepted/i.test(message)) {
        return 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบ SMTP_USER และ SMTP_PASS โดย Gmail ต้องใช้ App password';
    }
    return 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า SMTP';
};

const respondError = (res, err, fallback = 'เกิดข้อผิดพลาดที่ฐานข้อมูล') => {
    console.error(fallback, err);
    res.status(500).json({ error: err.message || fallback });
};

const saveBase64Image = async (imageData, fileName, folderName, options = {}) => {
    if (!imageData) return null;
    if (!imageData.startsWith('data:image/')) {
        throw new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น');
    }

    const allowedMimeTypes = options.allowedMimeTypes || ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
        throw new Error(options.invalidTypeMessage || 'รองรับเฉพาะไฟล์รูปภาพเท่านั้น');
    }

    const extensionMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    const mimeType = match[1];
    if (!allowedMimeTypes.includes(mimeType)) {
        throw new Error(options.invalidTypeMessage || 'ประเภทไฟล์รูปภาพไม่ถูกต้อง');
    }

    const imageBuffer = Buffer.from(match[2], 'base64');
    if (options.maxSizeBytes && imageBuffer.length > options.maxSizeBytes) {
        throw new Error(options.maxSizeMessage || 'ไฟล์รูปภาพมีขนาดใหญ่เกินไป');
    }

    const extension = extensionMap[mimeType] || 'jpg';
    const originalName = path.parse(fileName || folderName).name.replace(/[^a-zA-Z0-9-_]/g, '-');
    const uploadDir = path.join(__dirname, 'uploads', folderName);
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const savedFileName = `${Date.now()}-${uniqueSuffix}-${originalName || folderName}.${extension}`;
    const savedPath = path.join(uploadDir, savedFileName);

    fs.mkdirSync(uploadDir, { recursive: true });
    await fs.promises.writeFile(savedPath, imageBuffer);
    return `/uploads/${folderName}/${savedFileName}`;
};

const normalizeProduct = (product) => ({
    ...product,
    id: product.product_id,
    name: product.product_name,
    image_url: product.product_image,
    stock: product.quantity,
});

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

const getAuditRequestMeta = (req) => {
    if (!req) return {};
    const userAgent = String(req.headers?.['user-agent'] || '');
    const browser = /edg/i.test(userAgent) ? 'Microsoft Edge'
        : /chrome/i.test(userAgent) ? 'Google Chrome'
            : /firefox/i.test(userAgent) ? 'Mozilla Firefox'
                : /safari/i.test(userAgent) ? 'Safari' : 'Unknown';
    const device = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile / Tablet' : 'Desktop';
    return {
        ipAddress: String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
        device,
        browser,
    };
};

const writeSystemLog = async (userId, action, remark = '', details = {}) => {
    if (!userId) return;

    try {
        await query(
            `INSERT INTO system_log
                (user_id, action, remark, before_data, after_data, ip_address, device, browser, session_duration)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                action,
                remark,
                details.beforeData ? JSON.stringify(details.beforeData) : null,
                details.afterData ? JSON.stringify(details.afterData) : null,
                details.ipAddress || null,
                details.device || null,
                details.browser || null,
                details.sessionDuration || null,
            ],
        );
    } catch (err) {
        console.error('บันทึก system_log ไม่สำเร็จ:', err.message);
    }
};

const writeOrderStatusHistory = async (orderId, status, userId = null, note = '') => {
    if (!orderId || !status) return;
    await query(
        'INSERT INTO order_status_history (order_id, status, user_id, note) VALUES (?, ?, ?, ?)',
        [orderId, status, userId || null, note || null],
    );
};

const MANUAL_STOCK_CHANGE_TYPES = new Set(['รับสินค้าเข้า', 'คืนสินค้า', 'สินค้าชำรุด', 'ปรับยอด']);

const getUserSnapshot = async (userId, executor = dbp) => {
    if (!userId) {
        return {
            actorName: 'ระบบ',
            actorRole: 'system',
        };
    }

    const [users] = await executor.query(
        'SELECT full_name, username, role FROM `user` WHERE user_id = ? LIMIT 1',
        [userId],
    );
    const user = users[0];
    return {
        actorName: cleanText(user?.full_name) || cleanText(user?.username) || `ผู้ใช้ #${userId}`,
        actorRole: user?.role || 'user',
    };
};

const applyStockChange = async ({
    productId,
    changeType,
    changeQuantity,
    reason = '',
    userId = null,
    orderDetailId = null,
    executor = dbp,
}) => {
    const normalizedType = cleanText(changeType);
    const normalizedReason = cleanText(reason);
    const quantityDelta = Number(changeQuantity);

    if (!productId) throw new Error('ไม่พบรหัสสินค้า');
    if (!normalizedType) throw new Error('กรุณาระบุประเภทการเปลี่ยนแปลงสต๊อก');
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
        throw new Error('จำนวนที่เปลี่ยนต้องเป็นจำนวนเต็มและห้ามเป็นศูนย์');
    }

    const [products] = await executor.query(
        'SELECT product_id, product_name, quantity FROM product WHERE product_id = ? LIMIT 1',
        [productId],
    );
    if (products.length === 0) {
        throw new Error('ไม่พบสินค้าในระบบ');
    }

    const beforeQuantity = Number(products[0].quantity) || 0;
    const afterQuantity = beforeQuantity + quantityDelta;
    if (afterQuantity < 0) {
        throw new Error(`สต็อกสินค้า ${products[0].product_name} ไม่เพียงพอ`);
    }

    const actor = await getUserSnapshot(userId, executor);

    await executor.query(
        'UPDATE product SET quantity = ?, updated_stock = NOW() WHERE product_id = ?',
        [afterQuantity, productId],
    );
    await executor.query(
        `INSERT INTO stock_logs
            (product_id, change_type, quantity, before_quantity, change_quantity, after_quantity, reason, order_detail_id, user_id, actor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            productId,
            normalizedType,
            Math.abs(quantityDelta),
            beforeQuantity,
            quantityDelta,
            afterQuantity,
            normalizedReason || null,
            orderDetailId || null,
            userId || null,
            actor.actorName,
        ],
    );

    return {
        productName: products[0].product_name,
        beforeQuantity,
        afterQuantity,
        changeQuantity: quantityDelta,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
    };
};

const PAID_PAYMENT_STATUS = 'ชำระเงินแล้ว';
const PAYMENT_REVIEW_STATUS = 'รอตรวจสอบ';
const PAYMENT_REJECTED_STATUS = 'ถูกปฏิเสธ';
const ORDER_PAYMENT_REVIEW_STATUS = 'รอตรวจสอบการชำระเงิน';
const ORDER_WAITING_PAYMENT_STATUS = 'รอชำระเงิน';
const RECEIPT_UPLOAD_OPTIONS = {
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    invalidTypeMessage: 'รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP เท่านั้น',
    maxSizeBytes: 5 * 1024 * 1024,
    maxSizeMessage: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB',
};
const BLOCKED_FULFILLMENT_STATUSES = ['เตรียมสินค้า', 'กำลังจัดส่ง', 'พร้อมรับสินค้า', 'จัดส่งแล้ว', 'เสร็จสิ้น'];

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

const seedUniversityProducts = async () => {
    const categoryNames = [
        'เครื่องแบบนักศึกษา',
        'ชุดกีฬา',
        'ชุดพิธีการ',
        'เครื่องหมายและเครื่องประดับ',
        'รองเท้าและถุงเท้า',
        'กระเป๋า',
        'อุปกรณ์การเรียน',
        'ของที่ระลึกมหาวิทยาลัย',
    ];
    const categoryIds = {};

    for (const categoryName of categoryNames) {
        const [existing] = await query(
            'SELECT category_id FROM category WHERE category_name = ? LIMIT 1',
            [categoryName],
        );

        if (existing.length > 0) {
            categoryIds[categoryName] = existing[0].category_id;
            await query('UPDATE category SET status_category = 1 WHERE category_id = ?', [existing[0].category_id]);
        } else {
            const [result] = await query(
                'INSERT INTO category (category_name, status_category) VALUES (?, 1)',
                [categoryName],
            );
            categoryIds[categoryName] = result.insertId;
        }
    }

    const products = [
        ['เครื่องแบบนักศึกษา', 'เสื้อนักศึกษาชาย', 'เสื้อเชิ้ตแขนสั้นนักศึกษาชาย', 350.00],
        ['เครื่องแบบนักศึกษา', 'เสื้อนักศึกษาหญิง', 'เสื้อเชิ้ตนักศึกษาหญิง', 350.00],
        ['เครื่องแบบนักศึกษา', 'กางเกงนักศึกษาชาย', 'กางเกงขายาวสีดำ', 450.00],
        ['เครื่องแบบนักศึกษา', 'กระโปรงนักศึกษาหญิง', 'กระโปรงทรงเอสีดำ', 450.00],
        ['ชุดกีฬา', 'เสื้อกีฬามหาวิทยาลัย', 'เสื้อกีฬาประจำมหาวิทยาลัย', 300.00],
        ['ชุดกีฬา', 'กางเกงกีฬา', 'กางเกงกีฬาขาสั้น', 250.00],
        ['ชุดพิธีการ', 'ครุยวิทยฐานะ', 'ครุยสำหรับพิธีรับปริญญา', 1500.00],
        ['เครื่องหมายและเครื่องประดับ', 'เข็มมหาวิทยาลัย', 'เข็มติดเสื้อนักศึกษา', 80.00],
        ['เครื่องหมายและเครื่องประดับ', 'เนกไทนักศึกษา', 'เนกไทสำหรับนักศึกษาชาย', 180.00],
        ['เครื่องหมายและเครื่องประดับ', 'เข็มขัดนักศึกษา', 'เข็มขัดพร้อมหัวเข็มขัด', 250.00],
        ['รองเท้าและถุงเท้า', 'รองเท้าหนังนักศึกษา', 'รองเท้าหนังสีดำ', 890.00],
        ['รองเท้าและถุงเท้า', 'ถุงเท้านักศึกษา', 'ถุงเท้าสีขาว', 60.00],
        ['กระเป๋า', 'กระเป๋าสะพายมหาวิทยาลัย', 'กระเป๋าสะพายโลโก้มหาวิทยาลัย', 590.00],
        ['กระเป๋า', 'เป้มหาวิทยาลัย', 'กระเป๋าเป้สำหรับนักศึกษา', 790.00],
        ['อุปกรณ์การเรียน', 'สมุดมหาวิทยาลัย', 'สมุดปกโลโก้มหาวิทยาลัย', 40.00],
        ['อุปกรณ์การเรียน', 'แฟ้มเอกสาร', 'แฟ้มใส่เอกสาร A4', 50.00],
        ['ของที่ระลึกมหาวิทยาลัย', 'แก้วน้ำมหาวิทยาลัย', 'แก้วน้ำสแตนเลส', 199.00],
        ['ของที่ระลึกมหาวิทยาลัย', 'พวงกุญแจมหาวิทยาลัย', 'พวงกุญแจโลโก้มหาวิทยาลัย', 79.00],
    ];

    for (const [categoryName, productName, description, price] of products) {
        const [existing] = await query(
            'SELECT product_id FROM product WHERE product_name = ? LIMIT 1',
            [productName],
        );

        if (existing.length > 0) continue;

        const [result] = await query(
            `INSERT INTO product
                (category_id, product_name, description, price, product_image, product_status, quantity, updated_stock)
             VALUES (?, ?, ?, ?, NULL, 1, 0, NOW())`,
            [categoryIds[categoryName], productName, description, price],
        );
        await applyStockChange({
            productId: result.insertId,
            changeType: 'รับสินค้าเข้า',
            changeQuantity: 20,
            reason: 'ตั้งต้นข้อมูลสินค้า',
        });
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
            privacy_notice_acknowledged tinyint DEFAULT '0',
            privacy_notice_acknowledged_at datetime DEFAULT NULL,
            consent_analytics tinyint DEFAULT '0',
            consent_analytics_at datetime DEFAULT NULL,
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
            quantity int DEFAULT '0',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_stock datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (product_id),
            KEY fk_product_category (category_id)
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
            receipt_file_name varchar(255) DEFAULT NULL,
            verified_amount decimal(10,2) DEFAULT NULL,
            transaction_ref varchar(120) DEFAULT NULL,
            reviewed_by int DEFAULT NULL,
            reviewed_at datetime DEFAULT NULL,
            review_note text,
            PRIMARY KEY (payment_id),
            KEY fk_payment_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS stock_logs (
            stock_log_id int NOT NULL AUTO_INCREMENT,
            product_id int NOT NULL,
            change_type varchar(50) NOT NULL,
            quantity int NOT NULL,
            before_quantity int DEFAULT NULL,
            change_quantity int DEFAULT NULL,
            after_quantity int DEFAULT NULL,
            reason text,
            order_detail_id int DEFAULT NULL,
            user_id int DEFAULT NULL,
            actor_name varchar(255) DEFAULT NULL,
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
            before_data longtext,
            after_data longtext,
            ip_address varchar(64) DEFAULT NULL,
            device varchar(120) DEFAULT NULL,
            browser varchar(120) DEFAULT NULL,
            session_duration varchar(50) DEFAULT NULL,
            PRIMARY KEY (log_id),
            KEY fk_systemlog_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS order_status_history (
            history_id int NOT NULL AUTO_INCREMENT,
            order_id int NOT NULL,
            status varchar(50) NOT NULL,
            user_id int DEFAULT NULL,
            note text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (history_id),
            KEY idx_order_status_history_order (order_id),
            KEY idx_order_status_history_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS order_admin_notes (
            note_id int NOT NULL AUTO_INCREMENT,
            order_id int NOT NULL,
            user_id int DEFAULT NULL,
            note text NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (note_id),
            KEY idx_order_admin_notes_order (order_id),
            KEY idx_order_admin_notes_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        `CREATE TABLE IF NOT EXISTS password_reset_codes (
            reset_id int NOT NULL AUTO_INCREMENT,
            user_id int NOT NULL,
            code_hash varchar(64) NOT NULL,
            expires_at datetime NOT NULL,
            used_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (reset_id),
            KEY idx_password_reset_user (user_id),
            KEY idx_password_reset_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ];

    for (const schema of schemas) {
        await query(schema);
    }

    if (await tableExists('product_color')) {
        await query('DROP TABLE product_color');
    }
    if (await columnExists('order_detail', 'selected_color')) {
        await query('ALTER TABLE order_detail DROP COLUMN selected_color');
    }
    if (await columnExists('order_detail', 'selected_size')) {
        await query('ALTER TABLE order_detail DROP COLUMN selected_size');
    }
    if (await columnExists('product', 'has_color')) {
        await query('ALTER TABLE product DROP COLUMN has_color');
    }
    if (await columnExists('product', 'has_size')) {
        await query('ALTER TABLE product DROP COLUMN has_size');
    }
    if (!(await columnExists('stock_logs', 'user_id'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN user_id int DEFAULT NULL AFTER order_detail_id');
    }
    if (!(await columnExists('stock_logs', 'before_quantity'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN before_quantity int DEFAULT NULL AFTER quantity');
    }
    if (!(await columnExists('stock_logs', 'change_quantity'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN change_quantity int DEFAULT NULL AFTER before_quantity');
    }
    if (!(await columnExists('stock_logs', 'after_quantity'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN after_quantity int DEFAULT NULL AFTER change_quantity');
    }
    if (!(await columnExists('stock_logs', 'reason'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN reason text DEFAULT NULL AFTER after_quantity');
    }
    if (!(await columnExists('stock_logs', 'actor_name'))) {
        await query('ALTER TABLE stock_logs ADD COLUMN actor_name varchar(255) DEFAULT NULL AFTER user_id');
    }
    await query(`
        UPDATE stock_logs
        SET
            change_quantity = CASE
                WHEN change_quantity IS NOT NULL THEN change_quantity
                WHEN change_type IN ('ขายออก', 'ขายสินค้า', 'ขายหน้าร้าน', 'สินค้าชำรุด') THEN -quantity
                ELSE quantity
            END,
            reason = CASE
                WHEN reason IS NOT NULL AND TRIM(reason) <> '' THEN reason
                WHEN change_type IN ('รับสินค้าเข้า', 'ขายสินค้า', 'คืนสินค้า', 'สินค้าชำรุด', 'ปรับยอด') THEN reason
                ELSE change_type
            END
        WHERE change_quantity IS NULL OR reason IS NULL
    `);
    if (!(await columnExists('system_log', 'before_data'))) {
        await query('ALTER TABLE system_log ADD COLUMN before_data longtext DEFAULT NULL AFTER remark');
    }
    if (!(await columnExists('system_log', 'after_data'))) {
        await query('ALTER TABLE system_log ADD COLUMN after_data longtext DEFAULT NULL AFTER before_data');
    }
    if (!(await columnExists('system_log', 'ip_address'))) {
        await query('ALTER TABLE system_log ADD COLUMN ip_address varchar(64) DEFAULT NULL AFTER after_data');
    }
    if (!(await columnExists('system_log', 'device'))) {
        await query('ALTER TABLE system_log ADD COLUMN device varchar(120) DEFAULT NULL AFTER ip_address');
    }
    if (!(await columnExists('system_log', 'browser'))) {
        await query('ALTER TABLE system_log ADD COLUMN browser varchar(120) DEFAULT NULL AFTER device');
    }
    if (!(await columnExists('system_log', 'session_duration'))) {
        await query('ALTER TABLE system_log ADD COLUMN session_duration varchar(50) DEFAULT NULL AFTER browser');
    }
    if (!(await columnExists('category', 'created_at'))) {
        await query('ALTER TABLE category ADD COLUMN created_at datetime DEFAULT CURRENT_TIMESTAMP AFTER status_category');
    }
    if (!(await columnExists('category', 'updated_at'))) {
        await query('ALTER TABLE category ADD COLUMN updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    }
    if (!(await columnExists('payment', 'verified_amount'))) {
        await query('ALTER TABLE payment ADD COLUMN verified_amount decimal(10,2) DEFAULT NULL AFTER receipt_image');
    }
    if (!(await columnExists('payment', 'receipt_file_name'))) {
        await query('ALTER TABLE payment ADD COLUMN receipt_file_name varchar(255) DEFAULT NULL AFTER receipt_image');
    }
    if (!(await columnExists('payment', 'transaction_ref'))) {
        await query('ALTER TABLE payment ADD COLUMN transaction_ref varchar(120) DEFAULT NULL AFTER verified_amount');
    }
    if (!(await columnExists('payment', 'reviewed_by'))) {
        await query('ALTER TABLE payment ADD COLUMN reviewed_by int DEFAULT NULL AFTER transaction_ref');
    }
    if (!(await columnExists('payment', 'reviewed_at'))) {
        await query('ALTER TABLE payment ADD COLUMN reviewed_at datetime DEFAULT NULL AFTER reviewed_by');
    }
    if (!(await columnExists('payment', 'review_note'))) {
        await query('ALTER TABLE payment ADD COLUMN review_note text DEFAULT NULL AFTER reviewed_at');
    }
    if (!(await columnExists('user', 'privacy_notice_acknowledged'))) {
        await query("ALTER TABLE `user` ADD COLUMN privacy_notice_acknowledged tinyint DEFAULT 0 AFTER phone");
    }
    if (!(await columnExists('user', 'privacy_notice_acknowledged_at'))) {
        await query('ALTER TABLE `user` ADD COLUMN privacy_notice_acknowledged_at datetime DEFAULT NULL AFTER privacy_notice_acknowledged');
    }
    if (!(await columnExists('user', 'consent_analytics'))) {
        await query("ALTER TABLE `user` ADD COLUMN consent_analytics tinyint DEFAULT 0 AFTER privacy_notice_acknowledged_at");
    }
    if (!(await columnExists('user', 'consent_analytics_at'))) {
        await query('ALTER TABLE `user` ADD COLUMN consent_analytics_at datetime DEFAULT NULL AFTER consent_analytics');
    }

    await query("UPDATE `user` SET role = 'user' WHERE role IS NULL OR role NOT IN ('user', 'admin')");
    await getDefaultCategoryId();
    await migrateLegacyTables();
    await seedUniversityProducts();

    const [admins] = await query('SELECT user_id FROM `user` WHERE role = ? LIMIT 1', ['admin']);
    if (admins.length === 0) {
        const adminPasswordHash = await hashPassword('admin123');
        await query(
            'INSERT INTO `user` (username, password, full_name, email, phone, role, status_user) VALUES (?, ?, ?, ?, ?, ?, 1)',
            ['admin', adminPasswordHash, 'System Administrator', 'admin@example.com', '0812345678', 'admin'],
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
        res.json(results.map(normalizeProduct));
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

app.get('/api/store/contact', async (req, res) => {
    try {
        const [admins] = await query(
            `SELECT full_name, email, phone
             FROM \`user\`
             WHERE role = 'admin' AND status_user = 1
             ORDER BY created_at ASC, user_id ASC
             LIMIT 1`,
        );

        res.json(admins[0] || { full_name: '', email: '', phone: '' });
    } catch (err) {
        respondError(res, err, 'โหลดข้อมูลติดต่อร้านไม่สำเร็จ');
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
        const { name, description, price, image_url, stock, category_id, category_name, user_id } = req.body;
        const categoryId = await resolveActiveCategoryId({ categoryId: category_id, categoryName: category_name });
        if (!categoryId) return res.status(400).json({ error: 'กรุณาเลือกหมวดหมู่สินค้าที่มีอยู่ในระบบ' });

        const stockAmount = Number(stock);
        if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
            return res.status(400).json({ error: 'สต็อกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
        }

        const [result] = await query(
            `INSERT INTO product
                (category_id, product_name, description, price, product_image, product_status, quantity, updated_stock)
             VALUES (?, ?, ?, ?, ?, 1, 0, NOW())`,
            [categoryId, name, description || null, price, image_url || null],
        );

        await applyStockChange({
            productId: result.insertId,
            changeType: 'รับสินค้าเข้า',
            changeQuantity: stockAmount,
            reason: 'สต็อกเริ่มต้นตอนสร้างสินค้า',
            userId: user_id || null,
        });
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
        const loginIdentifier = String(req.body.username || req.body.email || '').trim();
        const password = String(req.body.password || '');

        if (!loginIdentifier || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้หรืออีเมลและรหัสผ่าน' });
        }

        const [results] = await query(
            `SELECT user_id AS id, username, password, full_name, email, phone, role, status_user, created_at
             FROM \`user\`
             WHERE (username = ? OR LOWER(email) = ?) AND status_user = 1
             LIMIT 1`,
            [loginIdentifier, loginIdentifier.toLowerCase()],
        );

        if (results.length === 0 || !(await verifyPassword(password, results[0].password))) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้ อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
        }

        if (!isBcryptHash(results[0].password)) {
            await query('UPDATE `user` SET password = ? WHERE user_id = ?', [await hashPassword(password), results[0].id]);
        }

        await writeSystemLog(results[0].id, 'เข้าสู่ระบบ', 'ผู้ใช้เข้าสู่ระบบ', getAuditRequestMeta(req));
        delete results[0].password;
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', user: results[0] });
    } catch (err) {
        respondError(res, err, 'เข้าสู่ระบบไม่สำเร็จ');
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const { user_id, session_duration } = req.body;
        await writeSystemLog(user_id, 'ออกจากระบบ', 'ผู้ใช้ออกจากระบบ', {
            ...getAuditRequestMeta(req),
            sessionDuration: session_duration || null,
        });
        res.json({ success: true });
    } catch (err) {
        respondError(res, err, 'บันทึกการออกจากระบบไม่สำเร็จ');
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const {
            username,
            password,
            confirm_password,
            full_name,
            email,
            phone,
            privacy_notice_acknowledged,
            consent_analytics,
        } = req.body;

        const validationMessage = getFirstRegisterValidationMessage({
            username,
            full_name,
            email,
            phone,
            password,
            confirm_password: confirm_password ?? req.body.confirmPassword,
        });
        if (validationMessage) {
            return res.status(400).json({ success: false, message: validationMessage });
        }

        if (!privacy_notice_acknowledged) {
            return res.status(400).json({ success: false, message: 'กรุณารับทราบประกาศนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก' });
        }

        const hasAnalyticsConsent = Boolean(consent_analytics);
        const passwordHash = await hashPassword(password);

        const [result] = await query(
            `INSERT INTO \`user\`
                (username, password, full_name, email, phone, privacy_notice_acknowledged, privacy_notice_acknowledged_at, consent_analytics, consent_analytics_at, role, status_user)
             VALUES (?, ?, ?, ?, ?, 1, NOW(), ?, ?, ?, 1)`,
            [
                cleanText(username),
                passwordHash,
                cleanText(full_name),
                cleanText(email),
                cleanPhone(phone),
                hasAnalyticsConsent ? 1 : 0,
                hasAnalyticsConsent ? new Date() : null,
                'user',
            ],
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

app.post('/api/password-reset/request', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!email) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลที่ลงทะเบียนไว้' });
        }

        const [users] = await query(
            `SELECT user_id AS id, username, full_name, email
             FROM \`user\`
             WHERE LOWER(email) = ? AND status_user = 1
             LIMIT 2`,
            [email],
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบบัญชีที่ใช้อีเมลนี้' });
        }
        if (users.length > 1) {
            return res.status(409).json({ success: false, message: 'พบมากกว่าหนึ่งบัญชีที่ใช้อีเมลนี้ กรุณาติดต่อผู้ดูแลระบบ' });
        }

        const user = users[0];
        const code = String(crypto.randomInt(100000, 1000000));
        const expiresAt = new Date(Date.now() + (10 * 60 * 1000));

        await query(
            'UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
            [user.id],
        );
        await query(
            'INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)',
            [user.id, hashResetCode(code), expiresAt],
        );

        let mailResult = { sent: false };
        let mailError = '';

        try {
            mailResult = await sendPasswordResetEmail({
                email: user.email,
                fullName: user.full_name || user.username,
                code,
            });
        } catch (err) {
            mailError = err.message || 'ไม่สามารถเชื่อมต่อ SMTP ได้';
            console.error('ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ:', mailError);
        }

        const response = {
            success: true,
            mail_sent: mailResult.sent,
            message: mailResult.sent
                ? 'ส่งรหัสยืนยันไปยังอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย'
                : mailError
                    ? getPublicMailErrorMessage(mailError)
                    : 'สร้างรหัสยืนยันแล้ว แต่ยังไม่ได้ตั้งค่า SMTP สำหรับส่งอีเมล',
        };

        if (!mailResult.sent && process.env.NODE_ENV !== 'production') {
            response.dev_code = code;
            if (mailError) response.smtp_error = mailError;
        }

        res.json(response);
    } catch (err) {
        respondError(res, err, 'ส่งรหัสยืนยันไม่สำเร็จ');
    }
});

const findValidResetCode = async ({ email, code }) => {
    const [rows] = await query(
        `SELECT pr.reset_id, u.user_id AS user_id
         FROM password_reset_codes pr
         JOIN \`user\` u ON u.user_id = pr.user_id
         WHERE LOWER(u.email) = ?
            AND pr.code_hash = ?
            AND pr.used_at IS NULL
            AND pr.expires_at > NOW()
            AND u.status_user = 1
         ORDER BY pr.created_at DESC
         LIMIT 1`,
        [email, hashResetCode(code)],
    );

    return rows[0] || null;
};

app.post('/api/password-reset/verify', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const code = String(req.body.code || '').trim();

        if (!email || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัส 6 หลักให้ครบถ้วน' });
        }

        const resetCode = await findValidResetCode({ email, code });
        if (!resetCode) {
            return res.status(400).json({ success: false, message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' });
        }

        res.json({ success: true, message: 'ยืนยันรหัสสำเร็จ กรุณาตั้งรหัสผ่านใหม่' });
    } catch (err) {
        respondError(res, err, 'ตรวจสอบรหัสยืนยันไม่สำเร็จ');
    }
});

app.post('/api/password-reset/complete', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const code = String(req.body.code || '').trim();
        const password = String(req.body.password || '');

        if (!email || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ success: false, message: 'ข้อมูลยืนยันไม่ครบถ้วน' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
        }

        const resetCode = await findValidResetCode({ email, code });
        if (!resetCode) {
            return res.status(400).json({ success: false, message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว' });
        }

        await query('UPDATE `user` SET password = ? WHERE user_id = ?', [await hashPassword(password), resetCode.user_id]);
        await query('UPDATE password_reset_codes SET used_at = NOW() WHERE reset_id = ?', [resetCode.reset_id]);
        await writeSystemLog(resetCode.user_id, 'รีเซ็ตรหัสผ่าน', 'ผู้ใช้รีเซ็ตรหัสผ่านผ่านอีเมล', getAuditRequestMeta(req));

        res.json({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสใหม่' });
    } catch (err) {
        respondError(res, err, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
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

app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const allowedIntervals = ['day', 'week', 'month', 'year'];
        const interval = allowedIntervals.includes(req.query.interval) ? req.query.interval : 'day';
        const dateFrom = req.query.date_from ? new Date(req.query.date_from) : new Date(Date.now() - (29 * 86400000));
        const dateTo = req.query.date_to ? new Date(req.query.date_to) : new Date();
        if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
            return res.status(400).json({ error: 'รูปแบบช่วงวันที่ไม่ถูกต้อง' });
        }
        dateFrom.setHours(0, 0, 0, 0);
        dateTo.setHours(23, 59, 59, 999);
        const rangeParams = [dateFrom, dateTo];
        const groupExpression = {
            day: 'DATE(o.order_date)',
            week: 'DATE(DATE_SUB(o.order_date, INTERVAL WEEKDAY(o.order_date) DAY))',
            month: "DATE_FORMAT(o.order_date, '%Y-%m-01')",
            year: "DATE_FORMAT(o.order_date, '%Y-01-01')",
        }[interval];

        const [
            [periodSummary],
            [salesSeries],
            [orderStatuses],
            [paymentStatuses],
            [memberSummary],
            [productSummary],
            [topProducts],
            [topCategories],
            [topCustomers],
        ] = await Promise.all([
            query(
                `SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(final_price), 0) AS total_revenue,
                    COALESCE(AVG(final_price), 0) AS average_order_value
                 FROM orders
                 WHERE order_status <> 'ยกเลิก' AND order_date BETWEEN ? AND ?`,
                rangeParams,
            ),
            query(
                `SELECT
                    ${groupExpression} AS period,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(o.final_price), 0) AS revenue
                 FROM orders o
                 WHERE o.order_status <> 'ยกเลิก' AND o.order_date BETWEEN ? AND ?
                 GROUP BY ${groupExpression}
                 ORDER BY period ASC`,
                rangeParams,
            ),
            query(
                `SELECT order_status AS status, COUNT(*) AS total
                 FROM orders
                 GROUP BY order_status`,
            ),
            query(
                `SELECT payment_status AS status, COUNT(*) AS total
                 FROM orders
                 GROUP BY payment_status`,
            ),
            query(
                `SELECT
                    COUNT(*) AS total_members,
                    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_members_today
                 FROM \`user\`
                 WHERE role = 'user'`,
            ),
            query(
                `SELECT
                    COUNT(*) AS total_products,
                    SUM(CASE WHEN quantity > 0 AND quantity <= 5 THEN 1 ELSE 0 END) AS low_stock,
                    SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock
                 FROM product
                 WHERE product_status = 1`,
            ),
            query(
                `SELECT
                    p.product_id,
                    p.product_name,
                    p.product_image,
                    SUM(od.quantity) AS units_sold,
                    COALESCE(SUM(od.quantity * od.price), 0) AS revenue
                 FROM order_detail od
                 JOIN orders o ON o.order_id = od.order_id
                 JOIN product p ON p.product_id = od.product_id
                 WHERE o.order_status <> 'ยกเลิก' AND o.order_date BETWEEN ? AND ?
                 GROUP BY p.product_id, p.product_name, p.product_image
                 ORDER BY units_sold DESC, revenue DESC
                 LIMIT 5`,
                rangeParams,
            ),
            query(
                `SELECT
                    c.category_id,
                    c.category_name,
                    SUM(od.quantity) AS units_sold,
                    COALESCE(SUM(od.quantity * od.price), 0) AS revenue
                 FROM order_detail od
                 JOIN orders o ON o.order_id = od.order_id
                 JOIN product p ON p.product_id = od.product_id
                 JOIN category c ON c.category_id = p.category_id
                 WHERE o.order_status <> 'ยกเลิก' AND o.order_date BETWEEN ? AND ?
                 GROUP BY c.category_id, c.category_name
                 ORDER BY revenue DESC, units_sold DESC
                 LIMIT 5`,
                rangeParams,
            ),
            query(
                `SELECT
                    u.user_id,
                    u.username,
                    u.full_name,
                    COUNT(o.order_id) AS order_count,
                    COALESCE(SUM(o.final_price), 0) AS total_spent
                 FROM orders o
                 JOIN \`user\` u ON u.user_id = o.user_id
                 WHERE o.order_status <> 'ยกเลิก' AND o.order_date BETWEEN ? AND ?
                 GROUP BY u.user_id, u.username, u.full_name
                 ORDER BY total_spent DESC, order_count DESC
                 LIMIT 5`,
                rangeParams,
            ),
        ]);

        const statusMap = orderStatuses.reduce((result, item) => ({
            ...result,
            [item.status || 'ไม่ระบุ']: Number(item.total) || 0,
        }), {});
        const paymentStatusMap = paymentStatuses.reduce((result, item) => ({
            ...result,
            [item.status || 'ไม่ระบุ']: Number(item.total) || 0,
        }), {});
        const todayOrders = await query(
            'SELECT COUNT(*) AS total FROM orders WHERE DATE(order_date) = CURDATE()',
        );

        res.json({
            range: { from: dateFrom, to: dateTo, interval },
            summary: {
                total_revenue: Number(periodSummary[0]?.total_revenue) || 0,
                total_orders: Number(periodSummary[0]?.total_orders) || 0,
                average_order_value: Number(periodSummary[0]?.average_order_value) || 0,
                total_members: Number(memberSummary[0]?.total_members) || 0,
                new_members_today: Number(memberSummary[0]?.new_members_today) || 0,
                total_products: Number(productSummary[0]?.total_products) || 0,
                low_stock: Number(productSummary[0]?.low_stock) || 0,
                out_of_stock: Number(productSummary[0]?.out_of_stock) || 0,
            },
            notifications: {
                new_orders: Number(todayOrders[0][0]?.total) || 0,
                waiting_payment: paymentStatusMap['รอชำระ'] || 0,
                waiting_review: paymentStatusMap['รอตรวจสอบ'] || 0,
                low_stock: Number(productSummary[0]?.low_stock) || 0,
                out_of_stock: Number(productSummary[0]?.out_of_stock) || 0,
            },
            sales_series: salesSeries.map((item) => ({
                period: item.period,
                revenue: Number(item.revenue) || 0,
                order_count: Number(item.order_count) || 0,
            })),
            top_products: topProducts,
            top_categories: topCategories,
            top_customers: topCustomers,
        });
    } catch (err) {
        respondError(res, err, 'โหลดข้อมูล Dashboard ไม่สำเร็จ');
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
                pay.payment_type,
                pay.payment_amount,
                pay.payment_date,
                pay.receipt_image,
                pay.receipt_file_name,
                pay.reviewed_at,
                pay.review_note
            FROM orders o
            LEFT JOIN \`user\` u ON o.user_id = u.user_id
            LEFT JOIN address a ON a.address_id = (
                SELECT MAX(address_id)
                FROM address
                WHERE user_id = o.user_id
            )
            LEFT JOIN payment pay ON pay.payment_id = (
                SELECT MAX(payment_id)
                FROM payment
                WHERE order_id = o.order_id
            )
            ORDER BY o.order_date DESC
        `);
        const orderIds = results.map((order) => order.order_id).filter(Boolean);
        let itemsByOrder = {};

        if (orderIds.length > 0) {
            const [items] = await query(
                `SELECT
                    od.order_id,
                    od.order_detail_id,
                    od.product_id,
                    od.quantity,
                    od.price,
                    p.product_name,
                    p.product_image
                 FROM order_detail od
                 LEFT JOIN product p ON p.product_id = od.product_id
                 WHERE od.order_id IN (?)
                 ORDER BY od.order_id DESC, od.order_detail_id ASC`,
                [orderIds],
            );

            itemsByOrder = items.reduce((grouped, item) => {
                const orderId = item.order_id;
                if (!grouped[orderId]) grouped[orderId] = [];
                grouped[orderId].push({
                    order_detail_id: item.order_detail_id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    name: item.product_name,
                    product_image: item.product_image,
                    quantity: item.quantity,
                    qty: item.quantity,
                    price: item.price,
                });
                return grouped;
            }, {});
        }

        res.json(results.map((order) => ({
            ...normalizeOrder(order),
            items: itemsByOrder[order.order_id] || [],
        })));
    } catch (err) {
        respondError(res, err, 'โหลดคำสั่งซื้อไม่สำเร็จ');
    }
});

app.get('/api/admin/orders/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        const [orders] = await query(
            `SELECT
                o.*,
                u.username,
                u.full_name,
                u.email,
                u.phone AS customer_phone,
                a.receiver_name,
                a.phone AS shipping_phone,
                a.address_detail,
                a.subdistrict,
                a.district,
                a.province,
                a.postal_code,
                pay.payment_type,
                pay.payment_amount,
                pay.payment_date,
                pay.receipt_image,
                pay.receipt_file_name,
                pay.verified_amount,
                pay.transaction_ref,
                pay.reviewed_at,
                pay.review_note,
                reviewer.username AS reviewer_username,
                reviewer.full_name AS reviewer_full_name
             FROM orders o
             LEFT JOIN \`user\` u ON u.user_id = o.user_id
             LEFT JOIN address a ON a.address_id = (
                SELECT MAX(address_id) FROM address WHERE user_id = o.user_id
             )
             LEFT JOIN payment pay ON pay.payment_id = (
                SELECT MAX(payment_id) FROM payment WHERE order_id = o.order_id
             )
             LEFT JOIN \`user\` reviewer ON reviewer.user_id = pay.reviewed_by
             WHERE o.order_id = ?`,
            [id],
        );
        if (orders.length === 0) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });

        const [items] = await query(
            `SELECT
                od.order_detail_id,
                od.product_id,
                od.quantity,
                od.price,
                p.product_name,
                p.product_image
             FROM order_detail od
             LEFT JOIN product p ON p.product_id = od.product_id
             WHERE od.order_id = ?
             ORDER BY od.order_detail_id`,
            [id],
        );
        const [history] = await query(
            `SELECT
                h.history_id,
                h.status,
                h.note,
                h.created_at,
                u.username,
                u.full_name
             FROM order_status_history h
             LEFT JOIN \`user\` u ON u.user_id = h.user_id
             WHERE h.order_id = ?
             ORDER BY h.created_at DESC, h.history_id DESC`,
            [id],
        );
        const [notes] = await query(
            `SELECT
                n.note_id,
                n.note,
                n.created_at,
                u.username,
                u.full_name
             FROM order_admin_notes n
             LEFT JOIN \`user\` u ON u.user_id = n.user_id
             WHERE n.order_id = ?
             ORDER BY n.created_at DESC, n.note_id DESC`,
            [id],
        );

        res.json({
            order: normalizeOrder(orders[0]),
            items,
            history: history.length ? history : [{
                history_id: `current-${id}`,
                status: orders[0].order_status,
                note: 'สถานะปัจจุบันของออเดอร์เดิม',
                created_at: orders[0].order_date,
                username: null,
                full_name: null,
            }],
            notes,
        });
    } catch (err) {
        respondError(res, err, 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ');
    }
});

app.post('/api/admin/orders/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { note, user_id } = req.body;
        const cleanNote = String(note || '').trim();
        if (!cleanNote) return res.status(400).json({ error: 'กรุณากรอกหมายเหตุ' });
        const [orders] = await query('SELECT order_id FROM orders WHERE order_id = ?', [id]);
        if (orders.length === 0) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        const [result] = await query(
            'INSERT INTO order_admin_notes (order_id, user_id, note) VALUES (?, ?, ?)',
            [id, user_id || null, cleanNote],
        );
        await writeSystemLog(user_id, 'เพิ่มหมายเหตุออเดอร์', `เพิ่มหมายเหตุคำสั่งซื้อ #${id}`);
        res.json({ success: true, note_id: result.insertId });
    } catch (err) {
        respondError(res, err, 'เพิ่มหมายเหตุไม่สำเร็จ');
    }
});

app.post('/api/admin/orders/delete', async (req, res) => {
    try {
        const { order_id, user_id } = req.body;
        if (!order_id) return res.status(400).json({ error: 'กรุณาระบุรหัสคำสั่งซื้อที่ต้องการลบ' });

        const [orders] = await query('SELECT order_status, payment_status FROM orders WHERE order_id = ?', [order_id]);
        if (orders.length === 0) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        if (orders[0].order_status === 'ยกเลิก' || orders[0].payment_status === 'ยกเลิก') {
            return res.status(403).json({ error: 'ไม่สามารถลบออเดอร์ที่ยกเลิกแล้วได้' });
        }
        if (['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(orders[0].payment_status)) {
            return res.status(403).json({ error: 'ไม่สามารถลบออเดอร์ที่ชำระเงินแล้วได้' });
        }

        const [items] = await query('SELECT product_id, quantity FROM order_detail WHERE order_id = ?', [order_id]);
        if (orders[0].order_status !== 'ยกเลิก') {
            for (const item of items) {
                await applyStockChange({
                    productId: item.product_id,
                    changeType: 'คืนสินค้า',
                    changeQuantity: item.quantity,
                    reason: `ลบคำสั่งซื้อ #${order_id}`,
                    userId: user_id || null,
                });
            }
        }
        await query('DELETE FROM order_status_history WHERE order_id = ?', [order_id]);
        await query('DELETE FROM order_admin_notes WHERE order_id = ?', [order_id]);
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
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(5, Number.parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const role = ['admin', 'user'].includes(req.query.role) ? req.query.role : '';
        const status = ['0', '1', '2'].includes(String(req.query.status)) ? Number(req.query.status) : null;
        const sortColumns = {
            id: 'u.user_id',
            name: "COALESCE(NULLIF(u.full_name, ''), u.username)",
            created_at: 'u.created_at',
        };
        const sort = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort) ? req.query.sort : '';
        const order = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        const orderSql = sort
            ? `ORDER BY (u.role = 'admin') DESC, ${sortColumns[sort]} ${order}, u.user_id ${order}`
            : "ORDER BY is_main_admin DESC, (u.role = 'admin') DESC, total_spent DESC, u.created_at DESC";
        const conditions = [];
        const params = [];

        if (search) {
            conditions.push(`(
                u.username LIKE ?
                OR u.full_name LIKE ?
                OR u.email LIKE ?
                OR u.phone LIKE ?
                OR CAST(u.user_id AS CHAR) LIKE ?
            )`);
            const keyword = `%${search}%`;
            params.push(keyword, keyword, keyword, keyword, keyword);
        }
        if (role) {
            conditions.push('u.role = ?');
            params.push(role);
        }
        if (status !== null) {
            conditions.push('u.status_user = ?');
            params.push(status);
        }

        const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [mainAdmins] = await query(
            "SELECT user_id FROM `user` WHERE role = 'admin' ORDER BY created_at ASC, user_id ASC LIMIT 1",
        );
        const mainAdminId = mainAdmins[0]?.user_id || null;
        const [countRows] = await query(
            `SELECT COUNT(*) AS total FROM \`user\` u ${whereSql}`,
            params,
        );
        const [summaryRows] = await query(`
            SELECT
                COUNT(*) AS total_members,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
                SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS total_users
            FROM \`user\`
        `);
        const [spentRows] = await query(`
            SELECT COALESCE(SUM(final_price), 0) AS total_spent
            FROM orders
            WHERE order_status <> 'ยกเลิก'
        `);
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
                IFNULL(SUM(CASE WHEN o.order_status <> 'ยกเลิก' THEN o.final_price ELSE 0 END), 0) AS total_spent,
                CASE WHEN u.user_id = ? THEN 1 ELSE 0 END AS is_main_admin
            FROM \`user\` u
            LEFT JOIN orders o ON u.user_id = o.user_id
            ${whereSql}
            GROUP BY u.user_id
            ${orderSql}
            LIMIT ? OFFSET ?
        `, [mainAdminId, ...params, limit, offset]);

        const total = Number(countRows[0]?.total || 0);
        res.json({
            items: results,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.max(1, Math.ceil(total / limit)),
            },
            summary: {
                total_members: Number(summaryRows[0]?.total_members || 0),
                total_admins: Number(summaryRows[0]?.total_admins || 0),
                total_users: Number(summaryRows[0]?.total_users || 0),
                total_spent: Number(spentRows[0]?.total_spent || 0),
            },
        });
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
        const { user_id, new_role, actor_id } = req.body;
        const nextRole = normalizeRole(new_role);
        const [users] = await query('SELECT user_id, username, role FROM `user` WHERE user_id = ? LIMIT 1', [user_id]);
        if (users.length === 0) return res.status(404).json({ error: 'ไม่พบสมาชิกนี้' });

        const [mainAdmins] = await query(
            "SELECT user_id FROM `user` WHERE role = 'admin' ORDER BY created_at ASC, user_id ASC LIMIT 1",
        );
        if (Number(mainAdmins[0]?.user_id) === Number(user_id)) {
            return res.status(403).json({ error: 'ไม่สามารถเปลี่ยนสิทธิ์ของ Admin หลักได้' });
        }

        await query('UPDATE `user` SET role = ? WHERE user_id = ?', [nextRole, user_id]);
        await writeSystemLog(actor_id, 'เปลี่ยนสิทธิ์', `เปลี่ยนสิทธิ์ ${users[0].username} เป็น ${nextRole}`);
        res.json({ success: true, message: 'เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ' });
    } catch (err) {
        respondError(res, err, 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.query.actor_id || null;
        const [users] = await query('SELECT user_id, username FROM `user` WHERE user_id = ? LIMIT 1', [id]);
        if (users.length === 0) return res.status(404).json({ error: 'ไม่พบสมาชิกนี้' });

        const [mainAdmins] = await query(
            "SELECT user_id FROM `user` WHERE role = 'admin' ORDER BY created_at ASC, user_id ASC LIMIT 1",
        );
        if (Number(mainAdmins[0]?.user_id) === Number(id)) {
            return res.status(403).json({ error: 'ไม่สามารถลบหรือระงับ Admin หลักได้' });
        }

        await query('UPDATE `user` SET status_user = 0 WHERE user_id = ?', [id]);
        await writeSystemLog(actorId, 'ปิดใช้งานสมาชิก', `ปิดใช้งานสมาชิก ${users[0].username}`);
        res.json({ success: true, message: 'ปิดใช้งานสมาชิกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ลบสมาชิกไม่สำเร็จ');
    }
});

app.put('/api/admin/users/:id/reactivate', async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.body.actor_id || null;
        const [users] = await query(
            'SELECT user_id, username, status_user FROM `user` WHERE user_id = ? LIMIT 1',
            [id],
        );
        if (users.length === 0) return res.status(404).json({ error: 'ไม่พบสมาชิกนี้' });
        if (Number(users[0].status_user) === 1) {
            return res.json({ success: true, message: 'บัญชีนี้เปิดใช้งานอยู่แล้ว' });
        }

        await query('UPDATE `user` SET status_user = 1 WHERE user_id = ?', [id]);
        await writeSystemLog(actorId, 'ยกเลิกการระงับสมาชิก', `เปิดใช้งานสมาชิก ${users[0].username} อีกครั้ง`);
        res.json({ success: true, message: 'ยกเลิกการระงับสมาชิกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ยกเลิกการระงับสมาชิกไม่สำเร็จ');
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, full_name, email, phone } = req.body;
        const hasPassword = password && password.trim() !== '';
        if (hasPassword && password.length < 8) {
            return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
        }
        const passwordHash = hasPassword ? await hashPassword(password) : '';
        const sql = hasPassword
            ? 'UPDATE `user` SET username = ?, password = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?'
            : 'UPDATE `user` SET username = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?';
        const params = hasPassword
            ? [username, passwordHash, full_name || username, email || null, phone || null, id]
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
        if (hasPassword && password.length < 8) {
            return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
        }
        const passwordHash = hasPassword ? await hashPassword(password) : '';

        const sql = hasPassword
            ? 'UPDATE `user` SET username = ?, password = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?'
            : 'UPDATE `user` SET username = ?, full_name = ?, email = ?, phone = ? WHERE user_id = ?';
        const params = hasPassword
            ? [username, passwordHash, full_name || username, email || null, phone || null, id]
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
        const addressPayload = normalizeAddressPayload(req.body);
        const validationMessage = getFirstAddressValidationMessage(addressPayload);

        if (validationMessage) {
            return res.status(400).json({ error: validationMessage });
        }

        if (addressPayload.is_default) {
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
                addressPayload.receiver_name,
                addressPayload.phone,
                addressPayload.address_detail,
                addressPayload.subdistrict,
                addressPayload.district,
                addressPayload.province,
                addressPayload.postal_code,
                addressPayload.address_type,
                addressPayload.is_default ? 1 : 0,
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
        const addressPayload = normalizeAddressPayload(req.body);
        const validationMessage = getFirstAddressValidationMessage(addressPayload);

        if (validationMessage) {
            return res.status(400).json({ error: validationMessage });
        }

        if (addressPayload.is_default) {
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
                addressPayload.receiver_name,
                addressPayload.phone,
                addressPayload.address_detail,
                addressPayload.subdistrict,
                addressPayload.district,
                addressPayload.province,
                addressPayload.postal_code,
                addressPayload.address_type,
                addressPayload.is_default ? 1 : 0,
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
                l.before_quantity,
                l.change_quantity,
                l.after_quantity,
                l.reason,
                l.order_detail_id,
                l.user_id,
                l.actor_name,
                l.created_at,
                p.product_name AS product_name,
                COALESCE(
                    l.actor_name,
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
            remark: item.reason || item.change_type,
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
                l.before_data,
                l.after_data,
                l.ip_address,
                l.device,
                l.browser,
                l.session_duration,
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
        const {
            product_id,
            amount,
            reason,
            user_id,
            change_type,
            operation,
        } = req.body;
        const stockAmount = Number(amount);
        if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
            return res.status(400).json({ error: 'จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
        }
        const normalizedType = cleanText(change_type);
        const normalizedReason = cleanText(reason);
        if (!MANUAL_STOCK_CHANGE_TYPES.has(normalizedType)) {
            if (normalizedType === 'ขายสินค้า') {
                return res.status(400).json({ error: 'ประเภทขายสินค้าจะถูกบันทึกจากออเดอร์หรือ POS เท่านั้น ห้ามปรับยอดขายโดยตรง' });
            }
            return res.status(400).json({ error: 'ประเภทการเปลี่ยนแปลงสต๊อกไม่ถูกต้อง' });
        }
        let changeQuantity = stockAmount;
        if (normalizedType === 'สินค้าชำรุด') {
            changeQuantity = -stockAmount;
        } else if (normalizedType === 'ปรับยอด') {
            changeQuantity = cleanText(operation) === 'decrease' ? -stockAmount : stockAmount;
        }

        const result = await applyStockChange({
            productId: product_id,
            changeType: normalizedType,
            changeQuantity,
            reason: normalizedReason,
            userId: user_id || null,
        });
        await writeSystemLog(
            user_id,
            'ปรับสต๊อก',
            normalizedReason ? `${normalizedType}: ${normalizedReason}` : normalizedType,
            {
            beforeData: {
                product_id,
                before_quantity: result.beforeQuantity,
            },
            afterData: {
                product_id,
                change_type: normalizedType,
                change_quantity: result.changeQuantity,
                after_quantity: result.afterQuantity,
                reason: normalizedReason,
            },
            },
        );

        res.json({ success: true, message: 'ปรับปรุงสต็อกสำเร็จ' });
    } catch (err) {
        respondError(res, err, 'ปรับสต็อกไม่สำเร็จ');
    }
});

app.post('/api/admin/stock-logs/delete', async (req, res) => {
    res.status(403).json({ error: 'ไม่อนุญาตให้ลบหรือแก้ไขประวัติ stock_logs' });
});

app.post('/api/admin/products/edit', async (req, res) => {
    try {
        const { id, name, price, description, image_url, category_id, category_name, product_status } = req.body;
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
                 product_status = COALESCE(?, product_status)
             WHERE product_id = ?`,
            [
                name,
                price,
                description || null,
                image_url || null,
                categoryId || null,
                product_status ?? null,
                id,
            ],
        );
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

        const [stockLogUsage] = await query(
            'SELECT COUNT(*) AS usage_count FROM stock_logs WHERE product_id = ?',
            [id],
        );
        if (Number(stockLogUsage[0]?.usage_count) > 0) {
            return res.status(409).json({
                error: 'ไม่สามารถลบสินค้าที่มีประวัติ stock log ได้ กรุณาปิดใช้งานสินค้าแทน',
            });
        }

        await query('DELETE FROM product WHERE product_id = ?', [id]);
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

app.post('/api/admin/pos/checkout', async (req, res) => {
    let transactionStarted = false;
    try {
        const {
            user_id,
            payment_method,
            cash_received,
            cart_items,
        } = req.body;

        if (!user_id) return res.status(400).json({ error: 'ไม่พบข้อมูลพนักงานขาย' });
        if (!Array.isArray(cart_items) || cart_items.length === 0) {
            return res.status(400).json({ error: 'ไม่มีสินค้าในรายการขาย' });
        }
        if (!['เงินสด', 'QR'].includes(payment_method)) {
            return res.status(400).json({ error: 'รองรับการชำระเงินสดหรือ QR เท่านั้น' });
        }

        const [admins] = await query(
            'SELECT user_id, username, full_name FROM `user` WHERE user_id = ? AND role = ? AND status_user = 1 LIMIT 1',
            [user_id, 'admin'],
        );
        if (admins.length === 0) return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้นที่บันทึกการขายหน้าร้านได้' });

        await dbp.beginTransaction();
        transactionStarted = true;

        const receiptItems = [];
        let totalPrice = 0;
        let itemCount = 0;

        for (const item of cart_items) {
            const productId = item.id || item.product_id || item.p_id;
            const quantity = Number.parseInt(item.qty ?? item.selected_quantity ?? 1, 10);

            if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
                throw new Error('ข้อมูลสินค้าในรายการขายไม่ถูกต้อง');
            }

            const [products] = await dbp.query(
                'SELECT product_id, product_name, price, quantity FROM product WHERE product_id = ? AND product_status = 1 FOR UPDATE',
                [productId],
            );
            if (products.length === 0) throw new Error('ไม่พบสินค้าในระบบ');

            const product = products[0];
            if ((Number(product.quantity) || 0) < quantity) {
                throw new Error(`สินค้า ${product.product_name} มีจำนวนไม่พอ`);
            }

            const price = Number(product.price) || 0;
            totalPrice += price * quantity;
            itemCount += quantity;
            receiptItems.push({
                product_id: product.product_id,
                name: product.product_name,
                price,
                quantity,
            });
        }

        const receivedAmount = Number(cash_received) || 0;
        if (payment_method === 'เงินสด' && receivedAmount < totalPrice) {
            throw new Error('จำนวนเงินที่รับมาไม่เพียงพอ');
        }

        const [orderResult] = await dbp.query(
            `INSERT INTO orders
                (user_id, total_price, shipping_fee, discount, final_price, order_status, payment_method, payment_status, delivery_type, tracking_no)
             VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, NULL)`,
            [user_id, totalPrice, totalPrice, 'เสร็จสิ้น', payment_method, PAID_PAYMENT_STATUS, 'ขายหน้าร้าน'],
        );
        const orderId = orderResult.insertId;

        for (const item of receiptItems) {
            const [detailResult] = await dbp.query(
                'INSERT INTO order_detail (product_id, order_id, quantity, price) VALUES (?, ?, ?, ?)',
                [item.product_id, orderId, item.quantity, item.price],
            );
            await applyStockChange({
                productId: item.product_id,
                changeType: 'ขายสินค้า',
                changeQuantity: -item.quantity,
                reason: `ขายหน้าร้าน #${orderId}`,
                userId: user_id,
                orderDetailId: detailResult.insertId,
                executor: dbp,
            });
        }

        await dbp.query(
            'INSERT INTO payment (order_id, payment_type, payment_amount, receipt_image) VALUES (?, ?, ?, NULL)',
            [orderId, payment_method, totalPrice],
        );
        await dbp.query(
            'INSERT INTO order_status_history (order_id, status, user_id, note) VALUES (?, ?, ?, ?)',
            [orderId, 'เสร็จสิ้น', user_id, `ขายหน้าร้าน ชำระด้วย${payment_method}`],
        );
        await dbp.query(
            'INSERT INTO system_log (user_id, action, remark) VALUES (?, ?, ?)',
            [user_id, 'ขายหน้าร้าน', `คำสั่งซื้อ #${orderId} ชำระด้วย${payment_method}`],
        );

        await dbp.commit();
        transactionStarted = false;

        const orderDate = new Date();
        res.json({
            success: true,
            receipt: {
                order_id: orderId,
                order_date: orderDate.toISOString(),
                payment_method,
                total: totalPrice,
                cash_received: payment_method === 'เงินสด' ? receivedAmount : totalPrice,
                change: payment_method === 'เงินสด' ? Math.max(receivedAmount - totalPrice, 0) : 0,
                item_count: itemCount,
                items: receiptItems,
                cashier: admins[0].full_name || admins[0].username,
            },
        });
    } catch (err) {
        if (transactionStarted) {
            try {
                await dbp.rollback();
            } catch (rollbackError) {
                console.error('Rollback POS sale failed', rollbackError);
            }
        }
        const status = /ไม่พบ|ไม่ถูกต้อง|ไม่พอ|ไม่เพียงพอ/.test(err.message) ? 400 : 500;
        console.error('บันทึกการขายหน้าร้านไม่สำเร็จ', err);
        res.status(status).json({ error: err.message || 'บันทึกการขายหน้าร้านไม่สำเร็จ' });
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
            receiver_name,
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
        const receiptPath = await saveBase64Image(receipt_image_data, receipt_file_name, 'receipts', RECEIPT_UPLOAD_OPTIONS);
        const receiptUrl = receiptPath ? `${req.protocol}://${req.get('host')}${receiptPath}` : null;
        const initialOrderStatus = receiptUrl ? ORDER_PAYMENT_REVIEW_STATUS : ORDER_WAITING_PAYMENT_STATUS;
        const initialPaymentStatus = receiptUrl ? PAYMENT_REVIEW_STATUS : 'รอชำระ';
        const shippingAddressPayload = normalizeAddressPayload({
            receiver_name: receiver_name || username || 'ลูกค้า',
            phone,
            address_detail: shipping_method === 'รับหน้าร้าน' ? 'รับสินค้าเองที่หน้าร้าน' : address,
            subdistrict,
            district,
            province,
            postal_code,
            address_type: shipping_method || 'ส่งสินค้า',
            is_default: true,
        });

        if (shipping_method === 'ส่งสินค้า') {
            const validationMessage = getFirstAddressValidationMessage(shippingAddressPayload);
            if (validationMessage) return res.status(400).json({ error: validationMessage });
        } else if (!shippingAddressPayload.phone || !PHONE_REGEX.test(shippingAddressPayload.phone)) {
            return res.status(400).json({ error: shippingAddressPayload.phone ? 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง' : 'กรุณากรอกเบอร์โทรผู้รับ' });
        }

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
                    shippingAddressPayload.receiver_name,
                    shippingAddressPayload.phone,
                    shippingAddressPayload.address_detail,
                    shippingAddressPayload.subdistrict || null,
                    shippingAddressPayload.district || null,
                    shippingAddressPayload.province || null,
                    shippingAddressPayload.postal_code || null,
                    shippingAddressPayload.address_type,
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
                    shippingAddressPayload.receiver_name,
                    shippingAddressPayload.phone,
                    shippingAddressPayload.address_detail,
                    shippingAddressPayload.subdistrict || null,
                    shippingAddressPayload.district || null,
                    shippingAddressPayload.province || null,
                    shippingAddressPayload.postal_code || null,
                    shippingAddressPayload.address_type,
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
                initialPaymentStatus,
                shipping_method || 'ส่งสินค้า',
                null,
            ],
        );

        const orderId = orderResult.insertId;
        await writeOrderStatusHistory(orderId, initialOrderStatus, user_id, receiptUrl ? 'สร้างคำสั่งซื้อพร้อมแนบหลักฐานการชำระเงิน' : 'สร้างคำสั่งซื้อ รอชำระเงิน');

        for (const item of cart_items) {
            const productId = item.id || item.product_id || item.p_id;
            const quantity = Number.parseInt(item.qty ?? item.selected_quantity ?? 1, 10);
            const itemPrice = parseFloat(String(item.price || 0).replace(/[^\d.]/g, '')) || 0;

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
                'INSERT INTO order_detail (product_id, order_id, quantity, price) VALUES (?, ?, ?, ?)',
                [productId, orderId, quantity, itemPrice],
            );
            await applyStockChange({
                productId,
                changeType: 'ขายสินค้า',
                changeQuantity: -quantity,
                reason: `คำสั่งซื้อ #${orderId}`,
                userId,
                orderDetailId: detailResult.insertId,
            });
        }

        await query(
            'INSERT INTO payment (order_id, payment_type, payment_amount, receipt_image, receipt_file_name) VALUES (?, ?, ?, ?, ?)',
            [orderId, payment_method || 'โอนเงินผ่านธนาคาร', finalPrice, receiptUrl, receipt_file_name || null],
        );
        await writeSystemLog(user_id, 'สั่งซื้อสินค้า', `คำสั่งซื้อ #${orderId}`);
        if (receiptUrl) {
            await writeSystemLog(user_id, 'ส่งหลักฐานการชำระเงิน', `คำสั่งซื้อ #${orderId}: มีหลักฐานการชำระเงินใหม่รอตรวจสอบ`, {
                afterData: {
                    order_id: orderId,
                    user_id,
                    receipt_image: receiptUrl,
                    uploaded_at: new Date().toISOString(),
                    payment_status: initialPaymentStatus,
                },
            });
        }

        res.json({ success: true, message: 'สั่งซื้อสำเร็จ', order_id: orderId });
    } catch (err) {
        respondError(res, err, 'บันทึกคำสั่งซื้อไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/receipt', async (req, res) => {
    try {
        const { id } = req.params;
        const { receipt_image_data, receipt_file_name, note } = req.body;
        const cleanNote = String(note || '').trim();
        const [orders] = await query('SELECT order_id, user_id, final_price, payment_method, payment_status, order_status FROM orders WHERE order_id = ?', [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const order = orders[0];
        if ([PAID_PAYMENT_STATUS, 'ชำระแล้ว'].includes(order.payment_status)) {
            return res.status(403).json({ error: 'ออเดอร์นี้ชำระเงินแล้ว ไม่สามารถแทนที่สลิปได้' });
        }

        const [currentPayments] = await query(
            'SELECT payment_id, receipt_image FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
            [id],
        );
        if (order.payment_status === PAYMENT_REVIEW_STATUS && currentPayments[0]?.receipt_image) {
            return res.status(409).json({ error: 'มีสลิปที่กำลังรอตรวจสอบอยู่แล้ว กรุณายกเลิกสลิปเดิมก่อนส่งใหม่' });
        }

        const receiptPath = await saveBase64Image(receipt_image_data, receipt_file_name, 'receipts', RECEIPT_UPLOAD_OPTIONS);
        if (!receiptPath) {
            return res.status(400).json({ error: 'กรุณาแนบรูปสลิปโอนเงิน' });
        }

        const receiptUrl = `${req.protocol}://${req.get('host')}${receiptPath}`;
        const [paymentResult] = await query(
            'UPDATE payment SET receipt_image = ?, receipt_file_name = ?, payment_date = NOW(), verified_amount = NULL, transaction_ref = NULL, reviewed_by = NULL, reviewed_at = NULL, review_note = ? WHERE order_id = ?',
            [receiptUrl, receipt_file_name || null, cleanNote || null, id],
        );

        if (paymentResult.affectedRows === 0) {
            await query(
                'INSERT INTO payment (order_id, payment_type, payment_amount, receipt_image, receipt_file_name, review_note) VALUES (?, ?, ?, ?, ?, ?)',
                [id, order.payment_method || 'โอนเงินผ่านธนาคาร', order.final_price || 0, receiptUrl, receipt_file_name || null, cleanNote || null],
            );
        }

        await query(
            'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
            [ORDER_PAYMENT_REVIEW_STATUS, PAYMENT_REVIEW_STATUS, id],
        );
        await writeOrderStatusHistory(id, ORDER_PAYMENT_REVIEW_STATUS, order.user_id, cleanNote || 'ลูกค้าแนบหลักฐานการชำระเงิน รอแอดมินตรวจสอบ');
        await writeSystemLog(order.user_id, 'ส่งหลักฐานการชำระเงิน', `คำสั่งซื้อ #${id}: มีหลักฐานการชำระเงินใหม่รอตรวจสอบ`, {
            beforeData: {
                order_status: order.order_status,
                payment_status: order.payment_status,
            },
            afterData: {
                order_id: Number(id),
                user_id: order.user_id,
                receipt_image: receiptUrl,
                uploaded_at: new Date().toISOString(),
                order_status: ORDER_PAYMENT_REVIEW_STATUS,
                payment_status: PAYMENT_REVIEW_STATUS,
                note: cleanNote || null,
            },
        });

        res.json({
            success: true,
            message: 'ส่งหลักฐานการชำระเงินเรียบร้อย กรุณารอแอดมินตรวจสอบ',
            receipt_image: receiptUrl,
            receipt_file_name: receipt_file_name || null,
            order_status: ORDER_PAYMENT_REVIEW_STATUS,
            payment_status: PAYMENT_REVIEW_STATUS,
        });
    } catch (err) {
        respondError(res, err, 'แนบสลิปไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/receipt/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;
        const [orders] = await query(
            'SELECT order_id, user_id, order_status, payment_status FROM orders WHERE order_id = ?',
            [id],
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const order = orders[0];
        if ([PAID_PAYMENT_STATUS, 'ชำระแล้ว'].includes(order.payment_status)) {
            return res.status(403).json({ error: 'แอดมินอนุมัติการชำระเงินแล้ว ไม่สามารถยกเลิกหรือเปลี่ยนสลิปได้' });
        }

        if (order.payment_status !== PAYMENT_REVIEW_STATUS) {
            return res.status(400).json({ error: 'ยกเลิกได้เฉพาะสลิปที่กำลังรอตรวจสอบเท่านั้น' });
        }

        const [payments] = await query(
            'SELECT payment_id, receipt_image FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
            [id],
        );

        if (!payments[0]?.receipt_image) {
            return res.status(400).json({ error: 'ไม่พบสลิปที่ต้องยกเลิก' });
        }

        await query(
            `UPDATE payment
             SET receipt_image = NULL,
                 verified_amount = NULL,
                 transaction_ref = NULL,
                 reviewed_by = NULL,
                 reviewed_at = NULL,
                 receipt_file_name = NULL,
                 review_note = ?
             WHERE payment_id = ?`,
            ['ลูกค้ายกเลิกสลิปเดิมก่อนส่งใหม่', payments[0].payment_id],
        );
        await query(
            'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
            [ORDER_WAITING_PAYMENT_STATUS, 'รอชำระ', id],
        );
        await writeOrderStatusHistory(id, ORDER_WAITING_PAYMENT_STATUS, user_id || order.user_id, 'ลูกค้ายกเลิกสลิปเดิมก่อนส่งใหม่');
        await writeSystemLog(user_id || order.user_id, 'ยกเลิกสลิปการชำระเงิน', `คำสั่งซื้อ #${id}: ลูกค้ายกเลิกสลิปเดิม`, {
            beforeData: {
                order_status: order.order_status,
                payment_status: order.payment_status,
                receipt_image: payments[0].receipt_image,
            },
            afterData: {
                order_status: ORDER_WAITING_PAYMENT_STATUS,
                payment_status: 'รอชำระ',
                receipt_image: null,
                receipt_file_name: null,
            },
        });

        res.json({
            success: true,
            message: 'ยกเลิกสลิปเดิมแล้ว สามารถอัปโหลดสลิปใหม่ได้',
            order_status: ORDER_WAITING_PAYMENT_STATUS,
            payment_status: 'รอชำระ',
        });
    } catch (err) {
        respondError(res, err, 'ยกเลิกสลิปไม่สำเร็จ');
    }
});

app.put('/api/admin/orders/:id/payment-review', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            action,
            user_id,
            verified_amount,
            transaction_ref,
            review_note,
        } = req.body;
        const cleanAction = String(action || '').trim();
        const cleanNote = String(review_note || '').trim();
        const cleanRef = String(transaction_ref || '').trim();
        const actionMap = {
            approve: { paymentStatus: PAID_PAYMENT_STATUS, label: 'อนุมัติการชำระเงิน', requiresNote: false },
            reject: { paymentStatus: PAYMENT_REJECTED_STATUS, label: 'ปฏิเสธหลักฐาน', requiresNote: true },
            request_new: { paymentStatus: PAYMENT_REJECTED_STATUS, label: 'ปฏิเสธหลักฐานและขอหลักฐานใหม่', requiresNote: true },
            suspicious: { paymentStatus: PAYMENT_REJECTED_STATUS, label: 'ปฏิเสธหลักฐาน: สงสัยสลิปปลอม', requiresNote: true },
        };
        const review = actionMap[cleanAction];

        if (!review) {
            return res.status(400).json({ error: 'คำสั่งตรวจสอบหลักฐานไม่ถูกต้อง', field: 'action' });
        }

        if (review.requiresNote && !cleanNote) {
            return res.status(400).json({ error: 'กรุณากรอกเหตุผลการตรวจสอบ', field: 'review_note' });
        }

        const [orders] = await query('SELECT order_id, delivery_type, order_status, payment_status FROM orders WHERE order_id = ?', [id]);
        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }
        const order = orders[0];

        const [payments] = await query(
            'SELECT payment_id, receipt_image FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
            [id],
        );

        if (!payments[0]?.receipt_image) {
            return res.status(400).json({ error: 'ยังไม่มีหลักฐานการชำระเงินให้ตรวจสอบ', field: 'receipt_image' });
        }

        const detectedAmount = verified_amount === '' || verified_amount === null || verified_amount === undefined
            ? null
            : Number(verified_amount);

        if (detectedAmount !== null && Number.isNaN(detectedAmount)) {
            return res.status(400).json({ error: 'ยอดที่ตรวจพบไม่ถูกต้อง', field: 'verified_amount' });
        }

        await query(
            `UPDATE payment
             SET verified_amount = ?, transaction_ref = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?
             WHERE payment_id = ?`,
            [detectedAmount, cleanRef || null, user_id || null, cleanNote || null, payments[0].payment_id],
        );
        const nextOrderStatus = cleanAction === 'approve'
            ? (order.delivery_type === 'รับหน้าร้าน' ? 'พร้อมรับสินค้า' : 'เตรียมสินค้า')
            : ORDER_WAITING_PAYMENT_STATUS;
        await query(
            'UPDATE orders SET payment_status = ?, order_status = ? WHERE order_id = ?',
            [review.paymentStatus, nextOrderStatus, id],
        );
        await writeOrderStatusHistory(
            id,
            nextOrderStatus,
            user_id,
            [
                review.label,
                `สถานะชำระเงิน: ${review.paymentStatus}`,
                detectedAmount !== null ? `ยอดที่ตรวจพบ ฿${detectedAmount.toFixed(2)}` : '',
                cleanRef ? `เลขอ้างอิง ${cleanRef}` : '',
                cleanNote,
            ].filter(Boolean).join(' / '),
        );
        await writeSystemLog(
            user_id,
            'ตรวจสอบหลักฐานการชำระเงิน',
            `คำสั่งซื้อ #${id}: ${review.label} (${review.paymentStatus})`,
            {
                beforeData: {
                    order_status: order.order_status,
                    payment_status: order.payment_status,
                },
                afterData: {
                    order_status: nextOrderStatus,
                    payment_status: review.paymentStatus,
                    verified_amount: detectedAmount,
                    transaction_ref: cleanRef || null,
                    review_note: cleanNote || null,
                },
            },
        );

        res.json({
            success: true,
            order_status: nextOrderStatus,
            payment_status: review.paymentStatus,
            review_note: cleanNote || null,
            message: cleanAction === 'approve' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธหลักฐานการชำระเงินแล้ว',
        });
    } catch (err) {
        respondError(res, err, 'ตรวจสอบหลักฐานการชำระเงินไม่สำเร็จ');
    }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, username } = req.body;
        const cancelableStatuses = [ORDER_WAITING_PAYMENT_STATUS, ORDER_PAYMENT_REVIEW_STATUS, 'รอจัดการ', 'เตรียมสินค้า'];

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
            await applyStockChange({
                productId: item.product_id,
                changeType: 'คืนสินค้า',
                changeQuantity: item.quantity,
                reason: `ยกเลิกคำสั่งซื้อ #${id}`,
                userId: order.user_id,
                orderDetailId: item.order_detail_id,
            });
        }

        await query(
            'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
            ['ยกเลิก', 'ยกเลิก', id],
        );
        await writeOrderStatusHistory(id, 'ยกเลิก', order.user_id, 'ลูกค้ายกเลิกคำสั่งซื้อ');
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
        const [orders] = await query('SELECT order_id, delivery_type, order_status, payment_status FROM orders WHERE order_id = ?', [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
        }

        const order = orders[0];
        const deliveryType = order.delivery_type || 'ส่งสินค้า';
        const trackingNo = String(tracking_no || '').trim();
        const requestedStatus = String(status || '').trim();
        const allowedStatuses = ['เตรียมสินค้า', 'กำลังจัดส่ง', 'พร้อมรับสินค้า', 'จัดส่งแล้ว', 'เสร็จสิ้น'];
        const flowStatuses = deliveryType === 'รับหน้าร้าน'
            ? [ORDER_WAITING_PAYMENT_STATUS, ORDER_PAYMENT_REVIEW_STATUS, 'รอจัดการ', 'เตรียมสินค้า', 'พร้อมรับสินค้า', 'เสร็จสิ้น']
            : [ORDER_WAITING_PAYMENT_STATUS, ORDER_PAYMENT_REVIEW_STATUS, 'รอจัดการ', 'เตรียมสินค้า', 'กำลังจัดส่ง', 'จัดส่งแล้ว', 'เสร็จสิ้น'];
        const currentStatus = order.order_status;

        if (order.order_status === 'ยกเลิก') {
            return res.status(400).json({ error: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะต่อได้', field: 'status' });
        }

        if (!allowedStatuses.includes(requestedStatus)) {
            return res.status(400).json({ error: 'สถานะคำสั่งซื้อไม่ถูกต้อง', field: 'status' });
        }

        if (BLOCKED_FULFILLMENT_STATUSES.includes(requestedStatus) && order.payment_status !== PAID_PAYMENT_STATUS) {
            return res.status(400).json({
                error: 'ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง',
                field: 'payment_status',
            });
        }

        const currentStep = flowStatuses.indexOf(currentStatus);
        const requestedStep = flowStatuses.indexOf(requestedStatus);

        if (currentStep === -1 || requestedStep !== currentStep + 1) {
            return res.status(400).json({ error: 'กรุณาอัปเดตสถานะตามลำดับขั้นตอนที่กำหนด', field: 'status' });
        }

        const [payments] = await query(
            'SELECT receipt_image FROM payment WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1',
            [id],
        );
        const hasReceipt = Boolean(payments[0]?.receipt_image);

        if (!hasReceipt) {
            return res.status(400).json({ error: 'ต้องมีสลิปก่อนยืนยันคำสั่งซื้อ', field: 'receipt_image' });
        }

        if (deliveryType === 'รับหน้าร้าน' && requestedStatus === 'กำลังจัดส่ง') {
            return res.status(400).json({ error: 'ออเดอร์รับหน้าร้านต้องใช้สถานะพร้อมรับสินค้าหรือเสร็จสิ้น', field: 'status' });
        }

        if (deliveryType === 'รับหน้าร้าน' && requestedStatus === 'จัดส่งแล้ว') {
            return res.status(400).json({ error: 'ออเดอร์รับหน้าร้านต้องใช้สถานะพร้อมรับสินค้าหรือเสร็จสิ้น', field: 'status' });
        }

        if (deliveryType !== 'รับหน้าร้าน' && requestedStatus === 'พร้อมรับสินค้า') {
            return res.status(400).json({ error: 'ออเดอร์จัดส่งต้องใช้สถานะกำลังจัดส่งหรือจัดส่งแล้ว', field: 'status' });
        }

        if (requestedStatus === 'กำลังจัดส่ง' && deliveryType !== 'รับหน้าร้าน' && !trackingNo) {
            return res.status(400).json({ error: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นกำลังจัดส่ง', field: 'tracking_no' });
        }

        await query(
            'UPDATE orders SET order_status = ?, tracking_no = COALESCE(?, tracking_no) WHERE order_id = ?',
            [requestedStatus, trackingNo || null, id],
        );
        await writeOrderStatusHistory(
            id,
            requestedStatus,
            user_id,
            trackingNo ? `เลขพัสดุ ${trackingNo}` : 'แอดมินอัปเดตสถานะ',
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
        const [rows] = await query(`
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
                pay.payment_date,
                pay.receipt_image,
                pay.receipt_file_name,
                pay.reviewed_at,
                pay.review_note,
                od.product_id,
                od.quantity,
                od.price,
                p.product_name AS product_name
            FROM orders o
            JOIN \`user\` u ON o.user_id = u.user_id
            LEFT JOIN payment pay ON pay.payment_id = (
                SELECT MAX(payment_id)
                FROM payment
                WHERE order_id = o.order_id
            )
            LEFT JOIN order_detail od ON o.order_id = od.order_id
            LEFT JOIN product p ON od.product_id = p.product_id
            WHERE LOWER(u.username) = LOWER(?)
            ORDER BY o.order_date DESC, o.order_id DESC, od.order_detail_id ASC
        `, [username]);

        const orderMap = new Map();
        rows.forEach((row) => {
            if (!orderMap.has(row.id)) {
                orderMap.set(row.id, {
                    id: row.id,
                    username: row.username,
                    total_price: row.total_price,
                    shipping_fee: row.shipping_fee,
                    discount: row.discount,
                    final_price: row.final_price,
                    status: row.status,
                    payment_method: row.payment_method,
                    payment_status: row.payment_status,
                    shipping_method: row.shipping_method,
                    tracking_no: row.tracking_no,
                    created_at: row.created_at,
                    payment_date: row.payment_date,
                    receipt_image: row.receipt_image,
                    receipt_file_name: row.receipt_file_name,
                    reviewed_at: row.reviewed_at,
                    review_note: row.review_note,
                    items: [],
                });
            }

            if (row.product_id) {
                orderMap.get(row.id).items.push({
                    product_id: row.product_id,
                    quantity: row.quantity,
                    price: row.price,
                    product_name: row.product_name,
                });
            }
        });

        const results = Array.from(orderMap.values()).map((order) => {
            const firstItem = order.items[0] || {};
            return {
                ...order,
                product_id: firstItem.product_id || null,
                quantity: firstItem.quantity || 0,
                price: firstItem.price || 0,
                product_name: firstItem.product_name || null,
            };
        });

        res.json(results);
    } catch (err) {
        console.error('Order history SQL error:', err);
        res.status(500).json([]);
    }
});

app.listen(port, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${port}`);
});
