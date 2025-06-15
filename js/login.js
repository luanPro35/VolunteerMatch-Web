// Khi tài liệu HTML đã tải xong
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger'); // Nút menu di động
  const menu = document.querySelector('.menu'); // Menu điều hướng
  const authBtn = document.getElementById('auth-btn'); // Nút đăng nhập / đăng xuất

  updateAuthButton(); // Cập nhật nút xác thực khi tải trang

  // Sự kiện click vào hamburger để mở/đóng menu
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      menu.classList.toggle('active'); // Toggle class để hiện/ẩn menu
    });
  }

  // Xử lý chuyển đổi giữa đăng nhập và đăng ký trên trang login.html
  const loginToggle = document.getElementById('login-toggle');
  const registerToggle = document.getElementById('register-toggle');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Nếu các thành phần tồn tại thì gán sự kiện chuyển đổi
  if (loginToggle && registerToggle && loginForm && registerForm) {
    loginToggle.addEventListener('click', () => {
      loginToggle.classList.add('active');         // Gán class active cho nút đăng nhập
      registerToggle.classList.remove('active');   // Gỡ class active khỏi nút đăng ký
      loginForm.classList.add('active');           // Hiện form đăng nhập
      registerForm.classList.remove('active');     // Ẩn form đăng ký
    });

    registerToggle.addEventListener('click', () => {
      registerToggle.classList.add('active');       // Gán class active cho nút đăng ký
      loginToggle.classList.remove('active');       // Gỡ class active khỏi nút đăng nhập
      registerForm.classList.add('active');         // Hiện form đăng ký
      loginForm.classList.remove('active');         // Ẩn form đăng nhập
    });
  }

  // Gắn sự kiện click cho nút authBtn để xử lý đăng nhập / đăng xuất
  if (authBtn) {
    authBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Ngăn chuyển hướng mặc định
      const user = JSON.parse(localStorage.getItem('user') || '{}'); // Lấy user từ localStorage
      if (user && user.email) {
        logout(); // Nếu đã đăng nhập → đăng xuất
      } else {
        window.location.href = 'login.html'; // Nếu chưa → chuyển đến trang login
      }
    });
  }

  // Cập nhật giao diện nút đăng nhập / đăng xuất
  function updateAuthButton() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (authBtn) {
      if (user && user.email) {
        authBtn.textContent = 'Đăng xuất'; // Đã đăng nhập
        authBtn.href = '#';
      } else {
        authBtn.textContent = 'Đăng nhập'; // Chưa đăng nhập
        authBtn.href = 'login.html';
        localStorage.removeItem('user'); // Xóa user không hợp lệ nếu có
      }
    }
  }

  // Đăng xuất người dùng
  function logout() {
    localStorage.removeItem('user'); // Xóa dữ liệu user
    updateAuthButton();              // Cập nhật nút
    try {
      window.location.href = '../header.html'; // Chuyển hướng đến trang chủ
    } catch (error) {
      console.error('Logout redirect failed:', error);
      window.location.assign('../header.html'); // Fallback redirect
    }
  }
});

// Nút quay về đầu trang
const backToTopButton = document.getElementById('back-to-top');

// Nếu có nút back-to-top
if (backToTopButton) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      backToTopButton.classList.add('visible'); // Hiện nút nếu cuộn đủ xa
      backToTopButton.style.animation = 'bounce 1s ease'; // Hiệu ứng
    } else {
      backToTopButton.classList.remove('visible'); // Ẩn nếu chưa cuộn xa
    }
  });

  // Khi click vào nút thì cuộn về đầu trang
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // Cuộn mượt
    });
  });
}

// Xử lý xác thực form đăng nhập
async function validateLoginForm(event) {
  event.preventDefault(); // Ngăn reload trang khi submit

  const form = document.getElementById('login-form-element');
  const message = document.getElementById('login-message');
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();
  const authBtn = document.getElementById('auth-btn');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex kiểm tra email hợp lệ

  message.textContent = '';
  message.classList.remove('success', 'error');

  // Kiểm tra các trường bắt buộc
  if (!email || !password) {
    message.textContent = 'Vui lòng điền đầy đủ các trường bắt buộc.';
    message.classList.add('error');
    return false;
  }

  // Kiểm tra định dạng email
  if (!emailRegex.test(email)) {
    message.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
    message.classList.add('error');
    return false;
  }

  // Kiểm tra độ dài mật khẩu
  if (password.length < 6) {
    message.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
    message.classList.add('error');
    return false;
  }

  // Hiển thị thông báo đang xử lý
  message.textContent = 'Đang đăng nhập...';

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Đăng nhập thành công
      message.textContent = data.message;
      message.classList.add('success');
      form.reset(); // Xóa nội dung form
      
      // Thêm log để debug toàn bộ phản hồi từ server và token
      console.log('Login successful, server response data:', data);
      console.log('User data from server:', data.user);
      console.log('Token from server:', data.token);
      console.log('Is admin?', data.user && data.user.isAdmin); // data.user.isAdmin vẫn đúng
      
      // Gộp token vào đối tượng user trước khi lưu vào localStorage
      const userToStore = { ...data.user, token: data.token };
      localStorage.setItem('user', JSON.stringify(userToStore));

      window.dispatchEvent(new CustomEvent('authChange', { detail: { loggedIn: true } }));
      // Kiểm tra nếu là admin thì chuyển đến trang admin
      if (userToStore && userToStore.isAdmin) { // Sử dụng userToStore đã có token và isAdmin
        console.log('Redirecting to admin page...');
        setTimeout(() => {
          window.location.href = '../html/admin.html'; // Đường dẫn tương đối đến thư mục html
        }, 1000);
      } else {
        console.log('Redirecting to home page...');
        setTimeout(() => {
          window.location.href = '../header.html'; // Chuyển hướng đến trang chủ
        }, 1000);
      }
    } else {
      // Đăng nhập thất bại
      message.textContent = data.message;
      message.classList.add('error');
    }
  } catch (error) {
    message.textContent = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    message.classList.add('error');
    console.error('Login Error:', error);
  }

  return false;
}

// Xử lý xác thực form đăng ký
async function validateRegisterForm(event) {
  event.preventDefault(); // Ngăn reload trang khi submit

  const form = document.getElementById('register-form-element');
  const message = document.getElementById('register-message');
  const name = document.getElementById('register-name')?.value.trim();
  const email = document.getElementById('register-email')?.value.trim();
  const password = document.getElementById('register-password')?.value.trim();
  const confirmPassword = document.getElementById('register-confirm-password')?.value.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  message.textContent = '';
  message.classList.remove('success', 'error');

  // Kiểm tra các trường bắt buộc
  if (!name || !email || !password || !confirmPassword) {
    message.textContent = 'Vui lòng điền đầy đủ các trường bắt buộc.';
    message.classList.add('error');
    return false;
  }

  // Kiểm tra định dạng email
  if (!emailRegex.test(email)) {
    message.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
    message.classList.add('error');
    return false;
  }

  // Kiểm tra độ dài mật khẩu
  if (password.length < 6) {
    message.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
    message.classList.add('error');
    return false;
  }

  // Kiểm tra mật khẩu xác nhận
  if (password !== confirmPassword) {
    message.textContent = 'Mật khẩu xác nhận không khớp.';
    message.classList.add('error');
    return false;
  }

  // Hiển thị thông báo đang xử lý
  message.textContent = 'Đang đăng ký...';

  try {
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    });

    const data = await response.json();

    if (response.ok) {
      // Đăng ký thành công
      message.textContent = data.message;
      message.classList.add('success');
      form.reset(); // Xóa nội dung form
      setTimeout(() => {
        document.getElementById('login-toggle').click(); // Tự động chuyển sang form đăng nhập
      }, 1000);
    } else {
      // Đăng ký thất bại
      message.textContent = data.message;
      message.classList.add('error');
    }
  } catch (error) {
    message.textContent = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    message.classList.add('error');
    console.error('Register Error:', error);
  }

  return false;
}
