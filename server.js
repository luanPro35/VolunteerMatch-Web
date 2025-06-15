const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const path = require('path');
const OpenAI = require('openai');
const multer = require('multer'); // Thêm multer
const fs = require('fs'); // Thêm fs để làm việc với file system (nếu cần tạo thư mục)

// Load environment variables from .env
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));
// Tạo thư mục uploads nếu chưa có để lưu ảnh
const uploadDir = path.join(__dirname, 'uploads/aid_posts');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Root route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'header.html')); // Sửa thành header.html nếu đây là file chính
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.status(200).json({ status: 'OK', message: 'Server and MySQL are running' });
  } catch (error) {
    console.error('Health Check Error:', error.message);
    res.status(500).json({ status: 'ERROR', message: 'MySQL connection failed' });
  }
});

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// OpenAI Initialization for chat
let openai;
if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
  });
} else {
  console.warn("OPENROUTER_API_KEY is not set in .env file. AI chat features will use default responses.");
}

// Middleware xác thực JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Không có token xác thực' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token đã hết hạn. Vui lòng đăng nhập lại.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ message: 'Token không hợp lệ.' });
    }
    req.user = user;
    next();
  });
};

// Middleware kiểm tra quyền admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
  }
  next();
};

function normalizeProvinceNameForQuery(nameFromRequest) {
  if (!nameFromRequest || typeof nameFromRequest !== 'string') {
    return '';
  }
  console.log('[DEBUG] normalizeProvinceNameForQuery - Input:', nameFromRequest);
  let normalized = nameFromRequest.toLowerCase();

  // Specific common mappings first
  if (normalized.includes('hồ chí minh') || normalized.includes('ho chi minh')) {
    console.log('[DEBUG] normalizeProvinceNameForQuery - Output (HCM):', 'hochiminh');
    return 'hochiminh';
  }
  if (normalized.includes('huế') || normalized.includes('hue')) { // Thêm điều kiện cho Huế
    console.log('[DEBUG] normalizeProvinceNameForQuery - Output (Huế):', 'hue');
    return 'hue';
  }
  // Add other specific mappings if needed, e.g., "brvt" for "Bà Rịa - Vũng Tàu"

  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
  normalized = normalized.replace(/đ/g, "d"); // Convert 'đ' to 'd'
  return normalized.replace(/[^a-z0-9]/g, ''); // Remove spaces and special characters
}

// Cấu hình Multer cho việc upload ảnh bài đăng hỗ trợ
const aidPostStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Thư mục lưu ảnh
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')); // Đặt tên file duy nhất
  }
});

const aidPostUpload = multer({
  storage: aidPostStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Chỉ cho phép upload file ảnh (jpeg, jpg, png, gif)!"));
  }
});


// Register route
app.post('/api/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  try {
    console.log('Received register request:', { name, email });

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
    }

    console.log('Checking for existing user:', email);
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email đã được đăng ký.' });
    }

    console.log('Hashing password');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('Inserting user into MySQL:', { name, email });
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, hashedPassword]
    );
    console.log('User inserted successfully, affected rows:', result.affectedRows);

    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
  } catch (error) {
    console.error('Register Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi đăng ký. Vui lòng thử lại sau.' });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Received login request:', { email });

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    console.log('Checking user in MySQL:', email);
    let [users] = await pool.query('SELECT *, FALSE as isFromAdminTable FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      [users] = await pool.query('SELECT *, TRUE as isFromAdminTable FROM administrators WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng.' });
      }
    }

    const user = users[0];
    console.log('Comparing password for user:', email);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const userIsAdmin = email === 'quangluan0305@gmail.com' || user.isFromAdminTable ? true : (user.isAdmin || false);

    console.log('Generating JWT for user:', email);
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: userIsAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('User data for token:', { userId: user.id, name: user.name, email: user.email, isAdmin: userIsAdmin });

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: { id: user.id, name: user.name, email: user.email, isAdmin: userIsAdmin },
      token,
    });
  } catch (error) {
    console.error('Login Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi đăng nhập. Vui lòng thử lại sau.' });
  }
});

// Email route
app.post('/send-email', async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  try {
    console.log('Received email request:', { name, email, subject });

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Liên hệ từ ${name}: ${subject}`,
      text: `
        Họ và Tên: ${name}
        Email: ${email}
        Số Điện Thoại: ${phone || 'Không cung cấp'}
        Chủ Đề: ${subject}
        Tin Nhắn: ${message}
      `,
    };

    console.log('Sending email to:', process.env.EMAIL_USER);
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Tin nhắn của bạn đã được gửi thành công!' });
  } catch (error) {
    console.error('Email Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi gửi tin nhắn.' });
  }
});


// --- START: API CHO QUY TRÌNH ĐĂNG VÀ DUYỆT BÀI HỖ TRỢ ---

// API khách hàng gửi bài đăng hỗ trợ
// Form action là /api/admin/submit-aid-post, nhưng đây là form cho khách hàng.
// Để rõ ràng hơn, có thể đổi action của form và tên route này thành /api/aid-requests/submit
app.post('/api/admin/submit-aid-post', authenticateJWT, aidPostUpload.array('image', 5), async (req, res) => { // Cho phép upload tối đa 5 ảnh
    const { province, title, content } = req.body;
    const userId = req.user.userId; // Lấy userId từ token sau khi xác thực

    if (!province || !title || !content) {
        // Nếu có file đã upload, cần xóa đi
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => fs.unlinkSync(file.path));
        }
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin tỉnh, tiêu đề và nội dung.' });
    }

    let imagePaths = null;
    if (req.files && req.files.length > 0) {
        imagePaths = req.files.map(file => `/uploads/aid_posts/${file.filename}`).join(','); // Lưu các đường dẫn ảnh, cách nhau bằng dấu phẩy
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO aid_posts (user_id, province, title, content, image_paths, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [userId, province, title, content, imagePaths, 'pending_approval']
        );
        res.status(201).json({ message: 'Bài viết của bạn đã được gửi và đang chờ duyệt.', postId: result.insertId });
    } catch (error) {
        console.error('Lỗi khi gửi bài đăng hỗ trợ:', error);
        // Xóa file đã upload nếu có lỗi DB
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => fs.unlinkSync(file.path));
        }
        res.status(500).json({ message: 'Đã có lỗi xảy ra, không thể gửi bài viết.' });
    }
});

// API Admin lấy danh sách bài đăng chờ duyệt
app.get('/api/admin/pending-aid-posts', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT ap.*, u.name as author_name, u.email as author_email 
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.status = ? 
             ORDER BY ap.created_at DESC`,
            ['pending_approval']
        );
        res.status(200).json(posts);
    } catch (error) {
        console.error('Lỗi lấy bài chờ duyệt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bài viết.' });
    }
});

// API Admin duyệt (đồng ý) bài đăng
app.post('/api/admin/aid-posts/:postId/approve', authenticateJWT, isAdmin, async (req, res) => {
    const { postId } = req.params;
    try {
        const [result] = await pool.query(
            'UPDATE aid_posts SET status = ? WHERE id = ? AND status = ?',
            ['approved', postId, 'pending_approval']
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết hoặc bài viết đã được xử lý.' });
        }
        res.status(200).json({ message: 'Bài viết đã được duyệt thành công.' });
    } catch (error) {
        console.error('Lỗi duyệt bài viết:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi duyệt bài viết.' });
    }
});

// API Admin từ chối bài đăng
app.post('/api/admin/aid-posts/:postId/reject', authenticateJWT, isAdmin, async (req, res) => {
    const { postId } = req.params;

    try {
        const [result] = await pool.query(
            'UPDATE aid_posts SET status = ? WHERE id = ? AND status = ?',
            ['rejected', postId, 'pending_approval']
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết hoặc bài viết đã được xử lý.' });
        }
        res.status(200).json({ message: 'Bài viết đã bị từ chối.' });
    } catch (error) {
        console.error('Lỗi từ chối bài viết:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi từ chối bài viết.' });
    }
});

// API Admin lấy TẤT CẢ bài đăng (bao gồm các trạng thái)
app.get('/api/admin/all-aid-posts', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT ap.*, u.name as author_name, u.email as author_email 
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             ORDER BY ap.created_at DESC`
        );
        res.status(200).json(posts);
    } catch (error) {
        console.error('Lỗi lấy tất cả bài đăng cho admin:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bài viết.' });
    }
});

// API Admin lấy các bài đăng ĐÃ DUYỆT
app.get('/api/admin/approved-aid-posts', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT ap.*, u.name as author_name, u.email as author_email 
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.status = ? 
             ORDER BY ap.created_at DESC`,
            ['approved']
        );
        res.status(200).json(posts);
    } catch (error) {
        console.error('Lỗi lấy bài đã duyệt cho admin:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bài viết đã duyệt.' });
    }
});

// API Admin lấy các bài đăng ĐÃ TỪ CHỐI
app.get('/api/admin/rejected-aid-posts', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT ap.*, u.name as author_name, u.email as author_email 
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.status = ? 
             ORDER BY ap.created_at DESC`,
            ['rejected']
        );
        res.status(200).json(posts);
    } catch (error) {
        console.error('Lỗi lấy bài đã từ chối cho admin:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bài viết đã từ chối.' });
    }
});

// API lấy các bài đăng đã được duyệt để hiển thị công khai
app.get('/api/public/approved-aid-posts', async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT ap.id, ap.province, ap.title, ap.content, ap.image_paths, ap.created_at, u.name as author_name
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.status = ? 
             ORDER BY ap.created_at DESC`,
            ['approved']
        );
        res.status(200).json(posts);
    } catch (error) {
        console.error('Lỗi lấy bài đã duyệt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách bài viết công khai.' });
    }
});

// API lấy chi tiết một bài đăng công khai (đã duyệt)
app.get('/api/public/aid-posts/:postId', async (req, res) => {
    const { postId } = req.params;
    try {
        const [posts] = await pool.query(
            `SELECT ap.id, ap.province, ap.title, ap.content, ap.image_paths, ap.created_at, u.name as author_name, u.email as author_email
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.id = ? AND ap.status = ?`, // Chỉ lấy bài đã duyệt
            [postId, 'approved']
        );
        if (posts.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng hoặc bài đăng chưa được duyệt.' });
        }
        res.status(200).json(posts[0]); // Trả về chi tiết bài đăng
    } catch (error) {
        console.error('Lỗi lấy chi tiết bài đăng công khai:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết bài viết.' });
    }
});

// API lấy các bài đăng ĐÃ DUYỆT theo TÊN TỈNH (cho panel trên bản đồ)
app.get('/api/posts/approved', async (req, res) => {
    const { province: provinceName } = req.query; // Lấy 'province' từ query params

    if (!provinceName) {
        return res.status(400).json({ message: 'Tên tỉnh là bắt buộc.' });
    }
    console.log(`[API /api/posts/approved] Lấy bài đăng đã duyệt cho tỉnh: ${provinceName}`);
    const normalizedQueryProvince = normalizeProvinceNameForQuery(provinceName);


    try {
        // Câu lệnh SQL để lấy các bài đăng đã duyệt cho một tỉnh cụ thể
        // Giống với /api/public/approved-aid-posts nhưng thêm điều kiện lọc theo tỉnh
        // Sử dụng LOWER() để so sánh không phân biệt chữ hoa/thường cho tên tỉnh
        const [posts] = await pool.query(
            `SELECT ap.id, ap.province, ap.title, ap.content, ap.image_paths, ap.created_at, u.name as author_name
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE LOWER(ap.province) = LOWER(?) AND ap.status = ?
             ORDER BY ap.created_at DESC`,
            [normalizedQueryProvince, 'approved'] // Sử dụng tên tỉnh đã chuẩn hóa
        );

        // Trả về danh sách bài đăng (có thể rỗng nếu không tìm thấy)
        res.status(200).json(posts);
    } catch (error) {
        console.error(`Lỗi khi lấy bài đăng đã duyệt cho tỉnh ${provinceName}:`, error);
        res.status(500).json({ message: `Lỗi máy chủ khi lấy danh sách bài viết cho tỉnh ${provinceName}.` });
    }
});

// API lấy các bài đăng đã duyệt theo TÊN TỈNH để hiển thị công khai
app.get('/api/public/approved-aid-posts/by-province/:provinceName', async (req, res) => {
    const { provinceName } = req.params;
    const normalizedQueryProvince = normalizeProvinceNameForQuery(provinceName);

    console.log(`API /by-province/:provinceName called with original: "${provinceName}", normalized to: "${normalizedQueryProvince}"`);
    try {
        const [posts] = await pool.query(
          `SELECT ap.id, ap.title, ap.created_at
            FROM aid_posts ap
      WHERE ap.province = ? AND ap.status = ?
     ORDER BY ap.created_at DESC`,
        [normalizedQueryProvince, 'approved']
);
        console.log(`Kết quả query cho tỉnh ${provinceName} (sử dụng giá trị đã chuẩn hóa ${normalizedQueryProvince}):`, posts);
        // Chỉ trả về các thông tin cần thiết cho tooltip/popup trên bản đồ
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            // created_at: post.created_at // Có thể thêm nếu cần hiển thị ngày
        }));
        res.status(200).json(formattedPosts);
    } catch (error) {
        console.error(`Lỗi lấy bài đã duyệt cho tỉnh ${provinceName}:`, error);
        res.status(500).json({ message: `Lỗi máy chủ khi lấy danh sách bài viết cho tỉnh ${provinceName}.` });
    }
});

// API Admin lấy chi tiết một bài đăng
app.get('/api/admin/aid-posts/:postId', authenticateJWT, isAdmin, async (req, res) => {
    const { postId } = req.params;
    try {
        const [posts] = await pool.query(
            `SELECT ap.*, u.name as author_name, u.email as author_email 
             FROM aid_posts ap
             JOIN users u ON ap.user_id = u.id
             WHERE ap.id = ?`,
            [postId]
        );
        if (posts.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài đăng.' });
        }
        res.status(200).json(posts[0]);
    } catch (error) {
        console.error('Lỗi lấy chi tiết bài đăng cho admin:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết bài viết.' });
    }
});

// API endpoint để lưu đăng ký tour
app.post('/api/tour-registrations', async (req, res) => {
  try {
    const {
      tour_id,
      full_name,
      birthdate,
      phone,
      id_card, 
      email,
      trip_name,
      departure_date
    } = req.body;

    // Validate dữ liệu
    if (!tour_id || !full_name || !birthdate || !phone || !id_card || !email || !trip_name || !departure_date) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    // Lấy ngày giờ hiện tại theo múi giờ Việt Nam
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const registration_date = vietnamTime.toISOString().split('T')[0];
    const registration_time = vietnamTime.toTimeString().split(' ')[0];

    // Thêm vào database
    const [result] = await pool.query(
      `INSERT INTO tour_registrations (
        tour_id, full_name, birthdate, phone, id_card, email, 
        trip_name, departure_date, registration_date, registration_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tour_id, full_name, birthdate, phone, id_card, email,
        trip_name, departure_date, registration_date, registration_time
      ]
    );

    res.status(201).json({ 
      message: 'Đăng ký tour thành công!',
      registrationId: result.insertId 
    });

  } catch (error) {
    console.error('Lỗi khi lưu đăng ký tour:', error);
    res.status(500).json({ message: 'Đã có lỗi xảy ra khi đăng ký tour.' });
  }
});

// API để lấy danh sách đăng ký tour
app.get('/api/tour-registrations', authenticateJWT, async (req, res) => {
  console.log(`[API /api/tour-registrations] Accessed by user: ${req.user ? req.user.email : 'Unknown (error in auth?)'}`);
  try {
    console.log('[API /api/tour-registrations] Attempting to query database...');
    const query = `
      SELECT 
        id,
        tour_id,
        full_name,
        birthdate,
        phone,
        id_card,
        email,
        trip_name,
        departure_date,
        registration_date,
        registration_time,
        created_at
      FROM tour_registrations 
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(query);

    console.log(`[API /api/tour-registrations] Query successful. Number of rows fetched: ${rows.length}`);
    if (rows.length > 0) {
        // Log chi tiết hơn cho bản ghi đầu tiên nếu có dữ liệu
        console.log('[API /api/tour-registrations] First row data example:', JSON.stringify(rows[0], null, 2));
    }

    res.json(rows);
  } catch (error) {
    console.error('[API /api/tour-registrations] Error fetching tour registrations:', error.message, error.stack);
    res.status(500).json({ message: `Đã xảy ra lỗi khi lấy danh sách đăng ký tour: ${error.message}` });
  }
});

// Chat Server Logic
//-------------------------------------------------------------------
// ... (Phần code chat của bạn giữ nguyên) ...
let lastAdminPing = 0;
const ADMIN_EMAIL_FOR_CHAT_STATUS = 'quangluan0305@gmail.com';

async function getAdminChatOnlineStatusFromDB() {
  try {
    const [rows] = await pool.query('SELECT is_chat_online FROM users WHERE email = ? AND isAdmin = TRUE', [ADMIN_EMAIL_FOR_CHAT_STATUS]);
    if (rows.length > 0) {
      return Boolean(rows[0].is_chat_online);
    }
    console.warn(`Không tìm thấy admin với email ${ADMIN_EMAIL_FOR_CHAT_STATUS} (hoặc không có quyền admin) để lấy trạng thái chat.`);
    return false;
  } catch (error) {
    console.error("Lỗi đọc trạng thái chat của admin từ DB:", error);
    return false;
  }
}

async function initializeAdminPingStatus() {
  try {
    const adminIsSetOnlineInDB = await getAdminChatOnlineStatusFromDB();
    if (adminIsSetOnlineInDB) {
      lastAdminPing = Date.now();
      console.log(`Admin chat status is ON in DB at startup. Initialized lastAdminPing for ${ADMIN_EMAIL_FOR_CHAT_STATUS}.`);
    } else {
      console.log(`Admin chat status is OFF in DB at startup for ${ADMIN_EMAIL_FOR_CHAT_STATUS}.`);
    }
  } catch (error) {
    console.error('Error initializing admin ping status at startup:', error);
  }
}

async function isAdminActive() {
  const fifteenSecondsInMs = 15000;
  const adminIsSetOnlineInDB = await getAdminChatOnlineStatusFromDB();
  const active = adminIsSetOnlineInDB && (Date.now() - lastAdminPing < fifteenSecondsInMs);
  return active;
}

app.post('/api/admin-status', authenticateJWT, isAdmin, async (req, res) => {
  const newOnlineStatus = Boolean(req.body.online);
  try {
    await pool.query('UPDATE users SET is_chat_online = ? WHERE email = ? AND isAdmin = TRUE', [newOnlineStatus, ADMIN_EMAIL_FOR_CHAT_STATUS]);
    if (newOnlineStatus) {
      lastAdminPing = Date.now();
    }
    console.log(`Admin chat status changed in DB: is_chat_online=${newOnlineStatus} for admin email ${ADMIN_EMAIL_FOR_CHAT_STATUS}`);
    res.json({ status: 'ok', isAdminOnline: newOnlineStatus });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái chat của admin vào DB:", err);
    res.status(500).json({ message: "Lỗi máy chủ khi cập nhật trạng thái."});
  }
});

app.get('/api/admin-ping', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const isOnlineInDB = await getAdminChatOnlineStatusFromDB();
    if (isOnlineInDB) {
      lastAdminPing = Date.now();
    }
  } catch (error) {
    console.error("Lỗi trong admin-ping khi kiểm tra DB:", error);
  }
  res.sendStatus(200);
});

app.get('/api/get-messages', authenticateJWT, async (req, res) => {
  try {
    const customerId = req.user.userId;
    if (!customerId) {
      return res.status(400).json({ message: 'Không xác định được người dùng.' });
    }
    const [results] = await pool.query('SELECT * FROM messages WHERE user_id = ? ORDER BY id ASC', [customerId]);
    res.json(results);
  } catch (err) {
    console.error('Lỗi truy vấn lấy tin nhắn:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy tin nhắn.' });
  }
});

app.post('/api/send-message', authenticateJWT, async (req, res) => {
  const { text } = req.body;
  const customerId = req.user.userId;

  if (!customerId) {
    return res.status(400).json({ message: 'Không thể gửi tin nhắn, người dùng không xác định.' });
  }

  try {
    await pool.query('INSERT INTO messages (sender, text, user_id, created_at) VALUES (?, ?, ?, NOW())', ['user', text, customerId]);

    const adminActive = await isAdminActive();
    if (adminActive) {
      return res.json({ status: 'wait', reply: null, message: 'Tin nhắn đã được gửi tới admin. Vui lòng chờ phản hồi.' });
    }

    let botText;
    const defaultOfflineMessage = "Xin lỗi bạn, hiện tại admin đang offline. Chúng tôi sẽ phản hồi bạn sớm nhất có thể.\nCảm ơn bạn đã liên hệ, bạn vui lòng chờ admin hoạt động lại nhé.";

    if (openai && process.env.OPENROUTER_API_KEY) {
      const lowerText = text.toLowerCase();
      const travelKeywords = ['du lịch', 'chuyến đi', 'vé', 'đặt phòng', 'khách sạn', 'tour', 'tham quan', 'đi chơi', 'hỗ trợ', 'địa điểm'];
      const isTravelRelated = travelKeywords.some(keyword => lowerText.includes(keyword));

      if (isTravelRelated) {
        try {
          console.log("Attempting to get AI response for: ", text);
          const completion = await openai.chat.completions.create({
            model: "openai/gpt-3.5-turbo",
            messages: [
              { role: "system", content: "Bạn là một trợ lý ảo hữu ích cho một công ty du lịch tình nguyện. Quản trị viên hiện đang ngoại tuyến. Hãy cố gắng trả lời các câu hỏi liên quan đến du lịch, tour tình nguyện, đặt vé một cách ngắn gọn, lịch sự và hữu ích. Nếu không chắc chắn hoặc câu hỏi quá phức tạp, hãy thông báo rằng admin sẽ trả lời sau." },
              { role: "user", content: text }
            ],
            max_tokens: 150,
          });
          botText = completion.choices[0].message.content.trim();
          if (!botText) botText = defaultOfflineMessage;
        } catch (aiError) {
          console.error('OpenAI API Error:', aiError.message);
          botText = "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn lúc này. Admin sẽ trả lời bạn khi online sớm nhất.\nCảm ơn bạn đã liên hệ.";
        }
      } else {
        botText = defaultOfflineMessage;
      }
    } else {
      console.warn("OpenAI client not initialized or API key missing. Using default offline message.");
      botText = defaultOfflineMessage;
    }

    await pool.query('INSERT INTO messages (sender, text, user_id, created_at) VALUES (?, ?, ?, NOW())', ['bot', botText, customerId]);
    res.json({ status: 'ok', reply: botText });

  } catch (error) {
    console.error('Lỗi gửi tin nhắn hoặc xử lý bot:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi máy chủ khi gửi tin nhắn.' });
  }
});

app.post('/api/admin-send-message', authenticateJWT, isAdmin, async (req, res) => {
  const { text, targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ message: 'Cần có ID của người dùng đích.' });
  }
  try {
    const isOnlineInDB = await getAdminChatOnlineStatusFromDB();
    if (isOnlineInDB) {
        lastAdminPing = Date.now();
    }

    await pool.query('INSERT INTO messages (sender, text, user_id, created_at) VALUES (?, ?, ?, NOW())', ['admin', text, targetUserId]);
    res.json({ status: 'ok', message: 'Tin nhắn admin đã được gửi.' });
  } catch (err) {
    console.error('Lỗi lưu tin nhắn admin:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lưu tin nhắn admin.' });
  }
});

app.get('/api/admin/chat-sessions', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const [sessions] = await pool.query(`
      SELECT 
        u.id as userId, 
        u.name as userName, 
        u.email as userEmail, 
        MAX(m.created_at) as lastMessageTime,
        (SELECT ms.text FROM messages ms WHERE ms.user_id = u.id ORDER BY ms.created_at DESC LIMIT 1) as lastMessageText,
        (SELECT COUNT(*) FROM messages ms_unread WHERE ms_unread.user_id = u.id AND ms_unread.sender = 'user' AND ms_unread.is_read_by_admin = 0) as unreadCount
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.user_id IS NOT NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY lastMessageTime DESC
    `);
    res.json(sessions);
  } catch (error) {
    console.error('Lỗi lấy danh sách phiên chat của admin:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách phiên chat.' });
  }
});

app.get('/api/admin/messages/:customerId', authenticateJWT, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  try {
    await pool.query('UPDATE messages SET is_read_by_admin = 1 WHERE user_id = ? AND sender = ?', [customerId, 'user']);
    
    const [results] = await pool.query('SELECT * FROM messages WHERE user_id = ? ORDER BY id ASC', [customerId]);
    res.json(results);
  } catch (err) {
    console.error('Lỗi truy vấn lấy tin nhắn cho admin:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy tin nhắn.' });
  }
});

app.get('/api/admin/get-chat-status', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const isOnline = await getAdminChatOnlineStatusFromDB();
    res.json({ isAdminOnline: isOnline });
  } catch (error) {
    console.error("Lỗi lấy trạng thái chat của admin:", error);
    res.status(500).json({ message: "Lỗi máy chủ."});
  }
});
//-------------------------------------------------------------------

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database');
    connection.release();
    await initializeAdminPingStatus();
  } catch (err) {
    console.error('MySQL connection error or chat init error:', err.message, err.stack);
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${PORT}`);
});

// One-time admin account creation endpoint
app.post('/create-admin', async (req, res) => {
  const { secretKey } = req.body;
  const ADMIN_CREATION_SECRET = process.env.ADMIN_CREATION_SECRET;
  
  if (!ADMIN_CREATION_SECRET) {
    return res.status(500).json({ message: 'Chức năng tạo admin chưa được cấu hình trên server.' });
  }
  if (secretKey !== ADMIN_CREATION_SECRET) {
    return res.status(403).json({ message: 'Không được phép thực hiện hành động này.' });
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('0905622341luan', salt);
    
    const [result] = await pool.query(
      'INSERT INTO administrators (name, email, password, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password)',
      ['Admin Default', 'quangluan0305@gmail.com', hashedPassword]
    );
    
    res.status(201).json({ message: 'Tài khoản admin đã được tạo/cập nhật thành công!' });
  } catch (error) {
    console.error('Create Admin Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi tạo tài khoản admin.' });
  }
});

app.post('/api/make-admin', authenticateJWT, isAdmin, async (req, res) => {
  const { emailToMakeAdmin } = req.body;
  
  if (!emailToMakeAdmin) {
    return res.status(400).json({ message: 'Cần cung cấp email của người dùng để cấp quyền admin.' });
  }

  try {
    const [result] = await pool.query('UPDATE users SET isAdmin = TRUE WHERE email = ?', [emailToMakeAdmin]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng với email này trong bảng users.' });
    }
    
    res.status(200).json({ message: 'Đã cấp quyền admin thành công cho người dùng!' });
  } catch (error) {
    console.error('Make Admin Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi cấp quyền admin.' });
  }
});

app.get('/api/users', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = totalRows[0].total;

    const [users] = await pool.query(
      'SELECT id, name, email, created_at as createdAt, isAdmin, status FROM users ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const formattedUsers = users.map(user => ({
      ...user,
      status: user.status || 'active',
      isAdmin: Boolean(user.isAdmin)
    }));

    res.status(200).json({
      users: formattedUsers,
      pagination: {
        totalUsers,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Get Users Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi lấy danh sách người dùng.' });
  }
});

app.get('/api/users/:id', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, created_at as createdAt, isAdmin, status FROM users WHERE id = ?',
      [req.params.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const user = users[0];
    res.status(200).json({ 
        user: {
            ...user,
            isAdmin: Boolean(user.isAdmin)
        }
    });
  } catch (error) {
    console.error('Get User Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi lấy thông tin người dùng.' });
  }
});

app.post('/api/users', authenticateJWT, isAdmin, async (req, res) => {
  const { name, email, password, isAdmin: userIsAdminRequest, status } = req.body;
  
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc' });
    }
    
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email đã được đăng ký' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const finalIsAdmin = userIsAdminRequest === true || userIsAdminRequest === 'true' || userIsAdminRequest === 1;

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, created_at, isAdmin, status) VALUES (?, ?, ?, NOW(), ?, ?)',
      [name, email, hashedPassword, finalIsAdmin, status || 'active']
    );
    
    res.status(201).json({ 
      message: 'Thêm người dùng thành công',
      user: {
        id: result.insertId,
        name,
        email,
        isAdmin: finalIsAdmin,
        status: status || 'active',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Add User Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi thêm người dùng.' });
  }
});

app.put('/api/users/:id', authenticateJWT, isAdmin, async (req, res) => {
  const { name, email, password, isAdmin: userIsAdminRequest, status } = req.body;
  const userId = req.params.id;
  
  try {
    if (!name || !email) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc' });
    }
    
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    if (email !== existingUsers[0].email) {
        const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (emailCheck.length > 0) {
            return res.status(400).json({ message: 'Email này đã được sử dụng bởi một tài khoản khác.' });
        }
    }

    const finalIsAdmin = userIsAdminRequest === true || userIsAdminRequest === 'true' || userIsAdminRequest === 1;

    let query = 'UPDATE users SET name = ?, email = ?, isAdmin = ?, status = ?';
    let params = [name, email, finalIsAdmin, status || 'active'];
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    
    query += ' WHERE id = ?';
    params.push(userId);
    
    await pool.query(query, params);
    
    res.status(200).json({ 
      message: 'Cập nhật người dùng thành công',
      user: {
        id: parseInt(userId),
        name,
        email,
        isAdmin: finalIsAdmin,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.error('Update User Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi cập nhật người dùng.' });
  }
});

app.delete('/api/users/:id', authenticateJWT, isAdmin, async (req, res) => {
  const userId = req.params.id;
  
  try {
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    if (req.user.userId == userId && req.user.isAdmin) {
        return res.status(403).json({ message: 'Không thể xóa tài khoản admin đang sử dụng.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    
    res.status(200).json({ message: 'Xóa người dùng thành công' });
  } catch (error) {
    console.error('Delete User Error:', error.message, error.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi xóa người dùng.' });
  }
});
