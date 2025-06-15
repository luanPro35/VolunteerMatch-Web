// Counter Animation for Journey Section
document.addEventListener('DOMContentLoaded', () => {
    const counters = document.querySelectorAll('.counter'); // Lấy tất cả phần tử có class 'counter'
    counters.forEach(counter => {
        const updateCount = () => {
            const target = +counter.innerText.replace('+', '').replace(',', ''); // Lấy giá trị mục tiêu, loại bỏ dấu + và dấu phẩy
            let count = 0; // Biến đếm bắt đầu từ 0
            const increment = target / 50; // Tăng dần theo bước bằng target chia 50 (để animation mượt)
            const update = () => {
                if (count < target) { // Nếu chưa đạt target
                    count += increment; // Tăng count
                    // Cập nhật số đếm trong phần tử, thêm '+' nếu target >= 1000
                    counter.innerText = Math.ceil(count) + (target >= 1000 ? '+' : '');
                    setTimeout(update, 20); // Gọi lại hàm update sau 20ms để tiếp tục animation
                } else {
                    // Khi đạt target, set giá trị chính xác và dấu '+'
                    counter.innerText = target + (target >= 1000 ? '+' : '');
                }
            };
            update(); // Bắt đầu animation đếm số
        };
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) { // Khi phần tử counter xuất hiện trên viewport
                updateCount(); // Bắt đầu đếm
                observer.disconnect(); // Ngừng quan sát để tránh chạy lại nhiều lần
            }
        });
        observer.observe(counter); // Bắt đầu quan sát phần tử counter
    });

    // Interactive Map with Leaflet
    try {
        var map = L.map('map').setView([16.0, 108.0], 6); // Khởi tạo bản đồ tại vị trí trung tâm Việt Nam, zoom level 6
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors' // Nguồn bản đồ
        }).addTo(map);

        // Sample markers (replace with real data)
        const markers = [
            { lat: 21.0, lng: 105.8, popup: 'Trường học mới tại Hà Nội' }, // Marker ở Hà Nội
            { lat: 16.0, lng: 108.0, popup: 'Cầu mới tại Đà Nẵng' }, // Marker ở Đà Nẵng
            { lat: 10.8, lng: 106.7, popup: 'Thư viện tại TP.HCM' } // Marker ở TP.HCM
        ];

        markers.forEach(marker => {
            L.marker([marker.lat, marker.lng]) // Thêm marker lên bản đồ
                .addTo(map)
                .bindPopup(marker.popup) // Gán popup với nội dung mô tả
                .on('mouseover', function() { this.openPopup(); }) // Mở popup khi hover chuột vào marker
                .on('mouseout', function() { this.closePopup(); }); // Đóng popup khi chuột rời marker
        });
    } catch (error) {
        console.error('Map initialization failed:', error); // Hiển thị lỗi nếu khởi tạo bản đồ thất bại
        document.getElementById('map-error').style.display = 'block'; // Hiện phần tử báo lỗi bản đồ trên trang
    }
});
