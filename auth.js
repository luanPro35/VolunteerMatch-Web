const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./frontend/public/backend/models/User');

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  try {
    // Validate input
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được đăng ký.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: { name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
});

module.exports = router;