(function () {
// ۱. تنظیمات بوم ستاره‌ها (Canvas) - جذب نرم و بدون کشیدگی
    try {
        var c = document.getElementById('sky'), x, S = [], W, H, dpr = Math.min(devicePixelRatio || 1, 2);
        var mouse = { x: null, y: null, radius: 120 };

        window.addEventListener('mousemove', function (e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', function () {
            mouse.x = null;
            mouse.y = null;
        });

        function size() {
            if (!c) return;
            x = c.getContext('2d');
            W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
            S = []; var n = Math.round(W * H / 5500); 
            for (var i = 0; i < n; i++) {
                var rx = Math.random() * W;
                var ry = Math.random() * H;
                S.push({ 
                    x: rx, 
                    y: ry, 
                    ox: rx, 
                    oy: ry, 
                    r: Math.random() * 1.3 + .2, 
                    p: Math.random() * 6.28, 
                    v: Math.random() * .02 + .005, 
                    h: Math.random() < .2 ? '#9fe8ec' : Math.random() < .4 ? '#a9c9ff' : '#ffffff' 
                });
            }
        }

        function draw(t) {
            if (!x) return;
            x.clearRect(0, 0, W, H); 
            var isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';

            for (var i = 0; i < S.length; i++) { 
                var s = S[i];

                if (isDark && mouse.x !== null && mouse.y !== null) {
                    var dx = mouse.x - s.x;
                    var dy = mouse.y - s.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < mouse.radius && dist > 0) {
                        var force = (mouse.radius - dist) / mouse.radius;
                        // استفاده از حرکت نرم (Lerp) با جابه‌جایی بسیار کم جهت جلوگیری از کشیدگی
                        s.x += (dx / dist) * force * 0.8;
                        s.y += (dy / dist) * force * 0.8;
                    } else {
                        // بازگشت ملایم به نقطه اصلی
                        s.x += (s.ox - s.x) * 0.03;
                        s.y += (s.oy - s.y) * 0.03;
                    }
                } else {
                    s.x += (s.ox - s.x) * 0.03;
                    s.y += (s.oy - s.y) * 0.03;
                }

                var a = .45 + .55 * Math.sin(s.p + t * s.v * .06); 
                x.globalAlpha = a; 
                x.fillStyle = s.h; 
                x.beginPath(); 
                x.arc(s.x, s.y, s.r, 0, 6.28); 
                x.fill(); 
            }
            x.globalAlpha = 1; 
            if (!matchMedia('(prefers-reduced-motion:reduce)').matches) requestAnimationFrame(draw);
        }

        if (c) {
            size(); 
            addEventListener('resize', size); 
            requestAnimationFrame(draw);
        }
    } catch (err) {
        console.warn('Star canvas effect skipped:', err);
    }

    // ۲. انیمیشن هنگام اسکرول (Intersection Observer)
    var io = new IntersectionObserver(function (e) { 
        e.forEach(function (k) { if (k.isIntersecting) { k.target.classList.add('on'); io.unobserve(k.target); } }); 
    }, { threshold: .12 });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

    // ۳. مدیریت منوی موبایل
    var m = document.querySelector('.menu'), nv = document.getElementById('nav');
    if (m && nv) {
        m.onclick = function () { var o = nv.classList.toggle('open'); m.setAttribute('aria-expanded', o); };
        nv.onclick = function () { nv.classList.remove('open'); m.setAttribute('aria-expanded', false); };
    }

    // ۴. مدیریت فرم Web3Forms (فقط در صورت وجود فرم در صفحه)
    var form = document.getElementById('f');
    var okBox = document.getElementById('ok');
    var submitBtn = document.getElementById('submit-btn');

    if (form && submitBtn && okBox) {
        form.onsubmit = function (e) {
            e.preventDefault();

            var nameVal = form.n.value.trim();
            var classVal = form.c.value.trim();
            var idVal = form.id.value.trim();
            var messageVal = form.m.value.trim();

            if (!nameVal || !classVal || !idVal) {
                okBox.style.display = 'block';
                okBox.style.background = 'rgba(255, 99, 132, 0.2)';
                okBox.style.color = '#ffb3c1';
                okBox.textContent = 'لطفاً تمامی فیلدهای اجباری (نام، شماره کلاس و آیدی) را پر کنید.';
                return;
            }

            var finalMessage = messageVal !== '' ? messageVal : 'درخواست عضویت دارند';

            submitBtn.disabled = true;
            submitBtn.textContent = 'در حال ارسال...';
            okBox.style.display = 'block';
            okBox.style.background = 'rgba(74, 168, 255, .15)';
            okBox.style.color = '#cfe6ff';
            okBox.textContent = 'در حال ثبت اطلاعات...';

            var formData = new FormData();
            formData.append('access_key', form.access_key.value);
            formData.append('subject', form.subject.value);
            formData.append('نام و نام خانوادگی', nameVal);
            formData.append('شماره کلاس', classVal);
            formData.append('آیدی شاد / ایتا', idVal);
            formData.append('درخواست یا پیشنهاد / پیام', finalMessage);

            fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success) {
                        okBox.style.background = 'rgba(79, 216, 232, 0.2)';
                        okBox.style.color = '#8fefe0';
                        okBox.textContent = 'اطلاعات شما با موفقیت ثبت شد. به‌زودی با شما ارتباط می‌گیریم.';
                        form.reset();
                    } else { throw new Error(data.message || 'خطا در ارسال'); }
                })
                .catch(function () {
                    okBox.style.background = 'rgba(255, 99, 132, 0.2)';
                    okBox.style.color = '#ffb3c1';
                    okBox.textContent = 'مشکلی در ارسال پیام پیش آمد. لطفاً دوباره تلاش کنید.';
                })
                .finally(function () {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'ارسال پیام';
                });
        };
    }

    // ۵. مدیریت کامل و ایمن تغییر تم (Theme Toggle)
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

        // تغییر میزان شفافیت ستاره‌ها بر اساس تم
        if (c) {
            c.style.opacity = theme === 'dark' ? '1' : '0.2';
        }

        if (typeof size === 'function') {
            size();
        }
    }
})();
