const tourList = document.querySelector('.tv-list');
const prevButton = document.querySelector('.prev');
const nextButton = document.querySelector('.next');
let currentIndex = 0;

// Kích thước mỗi card + gap giữa các card
const cardWidth = 350; // 330px width + 20px gap

const totalCards = document.querySelectorAll('.tv-card').length;
const visibleCards = 3; // Số card hiện thị cùng lúc (bạn có thể điều chỉnh theo thiết kế)

nextButton.addEventListener('click', () => {
    currentIndex++;
    if (currentIndex > totalCards - visibleCards) {
        currentIndex = 0; // Quay lại đầu khi đến cuối
    }
    tourList.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
});

prevButton.addEventListener('click', () => {
    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = totalCards - visibleCards; // Quay lại cuối khi lướt ngược từ đầu
    }
    tourList.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
});
