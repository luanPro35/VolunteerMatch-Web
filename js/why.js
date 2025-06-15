document.addEventListener('DOMContentLoaded', function () {
    const tourList = document.querySelector('.why-track'); // Container chứa các thẻ slide
    const prevButton = document.querySelector('.why-prev'); // Nút lướt slide trước
    const nextButton = document.querySelector('.why-next'); // Nút lướt slide tiếp
    const dotsContainer = document.querySelector('.why-dots'); // Container chứa các chấm chỉ báo
    const cards = document.querySelectorAll('.why-item'); // Tất cả các thẻ slide
    const totalCards = cards.length; // Tổng số thẻ gốc
    const cardWidth = 380; // Chiều rộng mỗi thẻ (360px thẻ + 20px khoảng cách)
    const visibleCards = 3; // Số thẻ hiển thị cùng lúc

    const whySlider = document.querySelector('.why-slider'); // Phần tử cha chứa slider
    if (whySlider) {
        console.log('Phần tử .why-slider đã được tìm thấy'); // Debug: phần tử slider tồn tại
    } else {
        console.error('Phần tử .why-slider không tồn tại'); // Debug: phần tử slider không tồn tại
    }

    // Nhân đôi các thẻ để tạo hiệu ứng vòng tròn liên tục (clone sang cuối)
    cards.forEach(card => {
        const clone = card.cloneNode(true);
        tourList.appendChild(clone);
    });
    // Nhân đôi các thẻ clone ngược lại phía đầu để khi trượt về đầu vẫn mượt (clone sang đầu)
    for (let i = totalCards - 1; i >= 0; i--) {
        const clone = cards[i].cloneNode(true);
        tourList.insertBefore(clone, tourList.firstChild);
    }

    const totalClonedCards = tourList.children.length; // Tổng số thẻ hiện tại (gồm thẻ gốc và thẻ clone)
    let currentIndex = totalCards; // Vị trí bắt đầu là thẻ gốc đầu tiên (giữa dãy clone)

    // Tạo các chấm chỉ báo tương ứng với số thẻ gốc
    for (let i = 0; i < totalCards; i++) {
        const dot = document.createElement('div');
        dot.classList.add('why-dot');
        if (i === 0) dot.classList.add('active'); // Đánh dấu chấm đầu tiên đang active
        dot.addEventListener('click', () => {
            currentIndex = totalCards + i; // Khi click chấm, chuyển đến slide tương ứng (cộng offset clone)
            updateCarousel();
        });
        dotsContainer.appendChild(dot);
    }

    const dots = document.querySelectorAll('.why-dot'); // Lấy tất cả chấm chỉ báo

    // Hàm cập nhật vị trí carousel theo currentIndex
    function updateCarousel() {
        tourList.style.transition = 'transform 0.5s ease'; // Hiệu ứng trượt mượt
        tourList.style.transform = `translateX(-${currentIndex * cardWidth}px)`; // Dịch chuyển container theo vị trí hiện tại

        // Cập nhật chấm chỉ báo active dựa trên vị trí hiện tại, modulo để vòng lặp chấm
        const activeDotIndex = (currentIndex - totalCards + totalCards) % totalCards;
        dots.forEach((dot, index) => {
            dot.classList.remove('active');
            if (index === activeDotIndex) dot.classList.add('active');
        });

        // Xử lý vòng tròn liên tục: nếu đi qua đầu hoặc cuối clone thì reset không animation để tạo hiệu ứng vô hạn
        if (currentIndex >= totalClonedCards - totalCards) { 
            setTimeout(() => {
                tourList.style.transition = 'none';
                currentIndex = totalCards; // Đặt lại vị trí về đầu thẻ gốc
                tourList.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
            }, 500); // delay bằng thời gian transition để ẩn việc nhảy lại
        } else if (currentIndex <= totalCards - 1) {
            setTimeout(() => {
                tourList.style.transition = 'none';
                currentIndex = totalCards * 2 - 1; // Đặt lại vị trí về cuối thẻ gốc
                tourList.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
            }, 500);
        }
    }

    // Hàm lướt slide tiếp theo
    function slideNext() {
        currentIndex++;
        updateCarousel();
    }

    // Hàm lướt slide trước đó
    function slidePrev() {
        currentIndex--;
        updateCarousel();
    }

    nextButton.addEventListener('click', slideNext); // Bắt sự kiện click nút next
    prevButton.addEventListener('click', slidePrev); // Bắt sự kiện click nút prev

    // Tự động lướt slide sau mỗi 2 giây
    let autoplayInterval = setInterval(slideNext, 2000);

    // Khi hover vào slider, dừng autoplay
    const carouselWrapper = document.querySelector('.why-sliderbox');
    carouselWrapper.addEventListener('mouseenter', () => {
        clearInterval(autoplayInterval);
    });
    // Khi rời hover, tiếp tục autoplay
    carouselWrapper.addEventListener('mouseleave', () => {
        autoplayInterval = setInterval(slideNext, 2000);
    });

    // Khởi tạo carousel lần đầu (đặt vị trí ban đầu)
    updateCarousel();
});
