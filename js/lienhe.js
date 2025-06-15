// Đảm bảo toàn bộ nội dung chỉ chạy sau khi trang đã tải xong DOM
document.addEventListener('DOMContentLoaded', () => {

    // ============================================
    // Hiệu ứng mờ dần khi xuất hiện (Fade-in Effect)
    // ============================================

    // Chọn tất cả phần tử có class 'fade-in'
    const sections = document.querySelectorAll('.fade-in');

    // Tùy chọn cho IntersectionObserver
    const observerOptions = {
        threshold: 0.2, // Phần tử phải hiển thị ít nhất 20% mới kích hoạt
        rootMargin: '0px', // Không thêm lề quan sát
    };

    // Tạo một IntersectionObserver để quan sát các phần tử
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            // Nếu phần tử nằm trong vùng quan sát
            if (entry.isIntersecting) {
                // Thêm class 'visible' để kích hoạt hiệu ứng (CSS cần định nghĩa sẵn .visible)
                entry.target.classList.add('visible');
                // Ngừng quan sát phần tử này sau khi đã hiện
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Gán quan sát cho từng phần tử
    sections.forEach((section) => {
        observer.observe(section);
    });

    // ============================================
    // Nút quay lại đầu trang (Back to Top Button)
    // ============================================

    // Lấy phần tử nút back-to-top nếu có
    const backToTopButton = document.getElementById('back-to-top');

    if (backToTopButton) {
        // Khi người dùng cuộn trang
        window.addEventListener('scroll', () => {
            // Nếu cuộn xuống quá 300px thì hiển thị nút
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });

        // Khi nhấn vào nút, cuộn trang mượt về đầu trang
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth', // Cuộn mượt
            });
        });
    }
});
