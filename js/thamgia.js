document.addEventListener("DOMContentLoaded", () => {
  // Hamburger Menu Toggle
  const hamburger = document.querySelector(".hamburger");
  const menu = document.querySelector(".menu");

  if (hamburger && menu) {
    hamburger.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent click event from bubbling up
      menu.classList.toggle("active"); // Toggle the 'active' class to show/hide menu
      console.log(
        "Hamburger clicked, menu active:",
        menu.classList.contains("active")
      );
    });

    // Close menu if clicking outside of menu or hamburger
    document.addEventListener("click", function (e) {
      if (
        menu.classList.contains("active") &&
        !menu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        menu.classList.remove("active"); // Hide the menu
      }
    });

    // Close menu when a link is clicked
    document.querySelectorAll(".menu a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("active"); // Hide the menu after clicking a link
      });
    });
  } else {
    console.error("Hamburger or menu element not found");
  }

  // Existing code for fade-in and back-to-top
  const sections = document.querySelectorAll(".fade-in");
  const observerOptions = {
    threshold: 0.2,
    rootMargin: "0px",
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  sections.forEach((section) => {
    observer.observe(section);
  });

  const backToTopButton = document.getElementById("back-to-top");
  if (backToTopButton) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        backToTopButton.classList.add("visible");
      } else {
        backToTopButton.classList.remove("visible");
      }
    });

    backToTopButton.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
});
