// ==============================
// Đa ngôn ngữ (Language Translations)
// ==============================

// Đối tượng chứa nội dung tiếng Việt (vi) và tiếng Anh (en)
const translations = {
  vi: {
    title: "Giúp đỡ Việt Nam",
    logo: "Volunteer Match",
    slogan: "Kết nối Việt Nam",
    impact: "68 người đã tham gia",
    "menu-home": "Trang chủ",
    "menu-about": "Về chúng tôi",
    "menu-journey": "Hành trình",
    "menu-join": "Tham gia",
    "menu-contact": "Liên hệ",
    login: "Đăng nhập",
    donate: "Hỗ trợ ngay",
    "carousel-title": "Giúp người – Giúp đời – Giúp chính mình",
    "carousel-subtitle": "Hãy bắt đầu từ hôm nay.",
    "carousel-cta": "Hỗ trợ ngay",
  },
  en: {
    title: "Help Vietnam",
    logo: "Volunteer Match",
    slogan: "Connecting Vietnam",
    impact: "68 people have joined",
    "menu-home": "Home",
    "menu-about": "About Us",
    "menu-journey": "Journey",
    "menu-join": "Join",
    "menu-contact": "Contact",
    login: "Log In",
    donate: "Donate Now",
    "carousel-title": "Help Others – Help Life – Help Yourself",
    "carousel-subtitle": "Start today.",
    "carousel-cta": "Donate Now",
  },
};

// Ngôn ngữ hiện tại mặc định là tiếng Việt
let currentLanguage = "vi";

// Hàm cập nhật nội dung trang dựa trên ngôn ngữ được chọn
function updateLanguage(lang) {
  currentLanguage = lang;

  // Cập nhật từng phần tử có thuộc tính [data-translate]
  document.querySelectorAll("[data-translate]").forEach((element) => {
    const key = element.getAttribute("data-translate");
    element.textContent = translations[lang][key];
  });

  // Cập nhật thuộc tính lang của thẻ <html>
  document.documentElement.lang = lang;

  // Cập nhật tiêu đề trang
  document.title = translations[lang]["title"];
  updateHeaderAuthDisplay(); // Cập nhật nút Đăng nhập/Icon khi đổi ngôn ngữ
}

// Bắt sự kiện chuyển ngôn ngữ khi nhấn nút toggle
document.getElementById("languageToggle").addEventListener("click", () => {
  const newLanguage = currentLanguage === "vi" ? "en" : "vi";
  updateLanguage(newLanguage);
});

// Hàm cập nhật hiển thị nút Đăng nhập/Icon người dùng trong header
function updateHeaderAuthDisplay() {
  const authBtn = document.getElementById('auth-btn'); // Nút Đăng nhập/Icon trong header
  if (!authBtn) {
    console.warn('Auth button with ID "auth-btn" not found in header.');
    return;
  }

  const userString = localStorage.getItem('user');
  let user = null;
  try {
    user = userString ? JSON.parse(userString) : null;
  } catch (e) {
    console.error("Error parsing user data from localStorage:", e);
    localStorage.removeItem('user'); // Xóa dữ liệu user không hợp lệ
  }

  if (user && user.email) {
    // Người dùng đã đăng nhập
    authBtn.innerHTML = '<i class="fas fa-user"></i>'; // Hiển thị icon người dùng (cần có Font Awesome)
    authBtn.href = '#'; // Không điều hướng khi click, xử lý bằng onclick
    authBtn.title = 'Tài khoản / Đăng xuất'; // Tooltip cho icon
    authBtn.onclick = (e) => {
      e.preventDefault();
      if (confirm('Bạn có muốn đăng xuất không?')) {
        localStorage.removeItem('user');
        // Gửi sự kiện để các thành phần khác (bao gồm cả chính nó) cập nhật
        window.dispatchEvent(new CustomEvent('authChange', { detail: { loggedIn: false } }));
        window.location.href = 'header.html'; // Hoặc trang chủ của bạn, ví dụ: '/' hoặc 'index.html'
      }
    };
  } else {
    // Người dùng chưa đăng nhập
    // Sử dụng key 'login' từ translations object, đảm bảo nó tồn tại
    authBtn.innerHTML = translations[currentLanguage]?.login || 'Đăng nhập';
    authBtn.href = 'login.html'; // Đường dẫn đến trang đăng nhập
    authBtn.title = translations[currentLanguage]?.login || 'Đăng nhập';
    authBtn.onclick = null; // Xóa sự kiện onclick nếu có từ trạng thái đăng nhập trước đó
  }
}




// ==============================
// Chức năng Carousel (Slide tự động)
// ==============================

// Lấy container chứa các slide
const carouselContainer = document.getElementById("carouselContainer");

// Lấy các nút chấm (dot) điều khiển chuyển slide
const dots = document.querySelectorAll(".dot");

// Biến theo dõi slide hiện tại
let currentIndex = 0;

// Thêm hiệu ứng chuyển slide
carouselContainer.style.transition = 'transform 0.5s ease-in-out';

// Hàm cập nhật trạng thái dot (chấm tròn)
function updateDots() {
  dots.forEach((dot, header) => {
    dot.style.transition = 'background-color 0.3s ease';
    dot.classList.toggle("active", header === currentIndex);
  });
}

// Hàm di chuyển slide
function moveCarousel(header = null) {
  if (header !== null) {
    currentIndex = header; // Di chuyển tới slide chỉ định
  } else {
    currentIndex++; // Chuyển slide tự động
    if (currentIndex >= 6) {
      currentIndex = 0; // Quay lại slide đầu tiên nếu vượt quá số lượng
    }
  }

  // Di chuyển container sang trái theo chiều ngang
  const slideWidth = window.innerWidth;
  carouselContainer.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
  updateDots();
}

// Thiết lập tự động chuyển slide mỗi 3 giây
let autoSlide = setInterval(moveCarousel, 3000);

// Xử lý sự kiện khi người dùng nhấn vào dot (chấm tròn)
dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    clearInterval(autoSlide); // Dừng chuyển tự động
    const slideIndex = parseInt(dot.getAttribute("data-slide"));
    moveCarousel(slideIndex); // Di chuyển tới slide được chọn
    autoSlide = setInterval(moveCarousel, 3000); // Khởi động lại auto slide
  });
});

// Cập nhật vị trí slide khi người dùng thay đổi kích thước trình duyệt
window.addEventListener("resize", () => {
  const slideWidth = window.innerWidth;
  carouselContainer.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
});

// Thêm hiệu ứng fade-in/fade-out cho từng slide
const slides = document.querySelectorAll('.carousel-slide');
slides.forEach(slide => {
  slide.style.transition = 'opacity 0.5s ease-in-out';
});

// Khởi tạo khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  updateLanguage("vi"); // Khởi tạo ngôn ngữ (sẽ gọi updateHeaderAuthDisplay)

  // Lắng nghe sự kiện thay đổi trạng thái đăng nhập từ các nơi khác (ví dụ: login.js)
  window.addEventListener('authChange', () => {
    updateHeaderAuthDisplay();
  });
});
