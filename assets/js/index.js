(function () {
    var c = document.getElementById('sky'), x = c.getContext('2d'), S = [], W, H, dpr = Math.min(devicePixelRatio || 1, 2);
    function size() {
        W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
        S = []; var n = Math.round(W * H / 5500); for (var i = 0; i < n; i++)S.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + .2, p: Math.random() * 6.28, v: Math.random() * .02 + .005, h: Math.random() < .2 ? '#9fe8ec' : Math.random() < .4 ? '#a9c9ff' : '#ffffff' })
    }
    function draw(t) {
        x.clearRect(0, 0, W, H); for (var i = 0; i < S.length; i++) { var s = S[i], a = .45 + .55 * Math.sin(s.p + t * s.v * .06); x.globalAlpha = a; x.fillStyle = s.h; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.28); x.fill() }
        x.globalAlpha = 1; if (!matchMedia('(prefers-reduced-motion:reduce)').matches) requestAnimationFrame(draw)
    }
    size(); addEventListener('resize', size); requestAnimationFrame(draw);
    var io = new IntersectionObserver(function (e) { e.forEach(function (k) { if (k.isIntersecting) { k.target.classList.add('on'); io.unobserve(k.target) } }) }, { threshold: .12 });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el) });
    var m = document.querySelector('.menu'), nv = document.getElementById('nav');
    m.onclick = function () { var o = nv.classList.toggle('open'); m.setAttribute('aria-expanded', o) };
    nv.onclick = function () { nv.classList.remove('open'); m.setAttribute('aria-expanded', false) };

    /* مدیریت فرم Web3Forms */
    var form = document.getElementById('f');
    var okBox = document.getElementById('ok');
    var submitBtn = document.getElementById('submit-btn');

    form.onsubmit = function (e) {
        e.preventDefault();

        var nameVal = form.n.value.trim();
        var classVal = form.c.value.trim();
        var idVal = form.id.value.trim();
        var messageVal = form.m.value.trim();

        // اعتبارسنجی فیلدهای اجباری
        if (!nameVal || !classVal || !idVal) {
            okBox.style.display = 'block';
            okBox.style.background = 'rgba(255, 99, 132, 0.2)';
            okBox.style.color = '#ffb3c1';
            okBox.textContent = 'لطفاً تمامی فیلدهای اجباری (نام، شماره کلاس و آیدی) را پر کنید.';
            return;
        }

        // اگر متن پیام خالی بود، مقدار پیش‌فرض تنظیم می‌شود
        var finalMessage = messageVal !== '' ? messageVal : 'درخواست عضویت دارند';

        // غیرفعال کردن دکمه هنگام ارسال
        submitBtn.disabled = true;
        submitBtn.textContent = 'در حال ارسال...';
        okBox.style.display = 'block';
        okBox.style.background = 'rgba(74, 168, 255, .15)';
        okBox.style.color = '#cfe6ff';
        okBox.textContent = 'در حال ثبت اطلاعات...';

        // ساخت داده‌های ارسال
        var formData = new FormData();
        formData.append('access_key', form.access_key.value);
        formData.append('subject', form.subject.value);
        formData.append('نام و نام خانوادگی', nameVal);
        formData.append('شماره کلاس', classVal);
        formData.append('آیدی شاد / ایتا', idVal);
        formData.append('درخواست یا پیشنهاد / پیام', finalMessage);

        fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: formData
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.success) {
                    okBox.style.background = 'rgba(79, 216, 232, 0.2)';
                    okBox.style.color = '#8fefe0';
                    okBox.textContent = 'اطلاعات شما با موفقیت ثبت شد. به‌زودی با شما ارتباط می‌گیریم.';
                    form.reset();
                } else {
                    throw new Error(data.message || 'خطا در ارسال');
                }
            })
            .catch(function (error) {
                okBox.style.background = 'rgba(255, 99, 132, 0.2)';
                okBox.style.color = '#ffb3c1';
                okBox.textContent = 'مشکلی در ارسال پیام پیش آمد. لطفاً دوباره تلاش کنید.';
            })
            .finally(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = 'ارسال پیام';
            });
    };
})()
/* مدیریت تغییر تم (Theme Toggle) */
document.addEventListener('DOMContentLoaded', function () {
    var toggleBtn = document.getElementById('themeToggleBtn');
    var themeIcon = document.getElementById('themeIcon');
    var htmlTag = document.documentElement;

    var savedTheme = localStorage.getItem('theme');
    var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    applyTheme(currentTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            var activeTheme = htmlTag.getAttribute('data-bs-theme');
            var newTheme = activeTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    function applyTheme(theme) {
        htmlTag.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);

        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
        }

        if (typeof size === 'function') {
            size();
        }
    }
});