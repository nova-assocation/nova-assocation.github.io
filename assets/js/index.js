(function () {
// ۱. تنظیمات بوم ستاره‌ها (Canvas) - ۶۰ فریم فوق‌العاده روان بدون کوچک‌ترین لگ در حرکت کند
// ۱. تنظیمات بوم ستاره‌ها (Canvas) - دنباله‌دارتر + قطع هوشمند کشیدگی برای صفر کردن لگ
try {
    var c = document.getElementById('sky'), x, S = [], W, H, dpr = Math.min(devicePixelRatio || 1, 2);
    var mouse = { 
        x: -1000, 
        y: -1000, 
        isMoving: false, 
        radius: 200,
        speedThreshold: 0.8 // آستانه سرعت برای قطع کشیدگی در حرکت‌های خیلی کند
    };
    var mouseTimer = null;

    window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.isMoving = true;

        clearTimeout(mouseTimer);
        mouseTimer = setTimeout(function () {
            mouse.isMoving = false;
        }, 25);
    });

    window.addEventListener('mouseleave', function () {
        mouse.x = -1000;
        mouse.y = -1000;
        mouse.isMoving = false;
    });

    function size() {
        if (!c) return;
        x = c.getContext('2d');
        W = innerWidth; H = innerHeight; 
        c.width = W * dpr; 
        c.height = H * dpr; 
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        S = []; 
        var n = Math.round(W * H / 2000); 
        for (var i = 0; i < n; i++) {
            var rx = Math.random() * W;
            var ry = Math.random() * H;
            S.push({ 
                x: rx, 
                y: ry, 
                ox: rx, 
                oy: ry, 
                vx: 0, 
                vy: 0, 
                r: Math.random() * 1.3 + .3, 
                p: Math.random() * 6.28, 
                v: Math.random() * .02 + .005, 
                h: Math.random() < .25 ? '#9fe8ec' : Math.random() < .5 ? '#a9c9ff' : '#ffffff' 
            });
        }
    }

    function draw(t) {
        if (!x) return;
        
        var isDark = document.documentElement.getAttribute('data-bs-theme') !== 'light';

        x.clearRect(0, 0, W, H);

        for (var i = 0; i < S.length; i++) { 
            var s = S[i];
            
            var dx = mouse.x - s.x;
            var dy = mouse.y - s.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            // ۱. اعمال نیروی جذب تنها زمانی که موس فعالانه و با سرعت مناسب حرکت می‌کند
            if (isDark && mouse.isMoving && dist < mouse.radius && dist > 2) {
                var force = (mouse.radius - dist) / mouse.radius;
                var angle = Math.atan2(dy, dx);
                s.vx += Math.cos(angle) * force * 1.8;
                s.vy += Math.sin(angle) * force * 1.8;
            }

            // ۲. بازگشت نرم به جایگاه اولیه
            s.vx += (s.ox - s.x) * 0.14;
            s.vy += (s.oy - s.y) * 0.14;

            // ۳. اصطکاک روان
            s.vx *= 0.70;
            s.vy *= 0.70;

            s.x += s.vx;
            s.y += s.vy;

            var a = .55 + .45 * Math.sin(s.p + t * s.v * .06); 
            x.globalAlpha = a;
            x.strokeStyle = s.h;
            x.fillStyle = s.h;
            x.lineWidth = s.r * 2;
            x.lineCap = 'round';

            // ۴. محاسبه سرعت جابه‌جایی ستاره
            var speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);

            // ۵. قطع کشیدگی در سرعت‌های پایین جهت صفر کردن احساس لگ
            if (speed > mouse.speedThreshold) {
                // رسم دنباله کشیده‌تر (ضریب ۳.۵ برای ایجاد جلوه ستاره دنباله‌دار)
                x.beginPath();
                x.moveTo(s.x - s.vx * 3.5, s.y - s.vy * 3.5);
                x.lineTo(s.x, s.y);
                x.stroke();
            } else {
                // تبدیل به نقطه ثابت در صورت کند بودن یا ایستادن موس
                x.beginPath();
                x.arc(s.x, s.y, s.r, 0, 6.28);
                x.fill();
            }
        }
        
        x.globalAlpha = 1; 
        if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {
            requestAnimationFrame(draw);
        }
    }

    if (c) {
        size(); 
        addEventListener('resize', size); 
        requestAnimationFrame(draw);
    }
} catch (err) {
    console.warn('Star canvas effect skipped:', err);
}// ۲. انیمیشن هنگام اسکرول (Intersection Observer)
    var io = new IntersectionObserver(function (e) { 
        e.forEach(function (k) { if (k.isIntersecting) { k.target.classList.add('on'); io.unobserve(k.target); } }); 
    }, { threshold: .12 });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

    // ۳. مدیریت منوی کشویی و اسکرول سالم لینک‌ها
    var m = document.querySelector('.menu');
    var nv = document.getElementById('nav');
    var overlay = document.getElementById('navOverlay');
    var closeBtn = document.getElementById('navCloseBtn');

    function openMenu(e) {
        if (e) e.stopPropagation();
        if (nv) nv.classList.add('open');
        if (overlay) overlay.classList.add('active');
        if (m) m.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
        if (nv) nv.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        if (m) m.setAttribute('aria-expanded', 'false');
    }

    if (m) m.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // بستن منو موقع کلیک روی لینک‌ها و اسکرول به بخش مربوطه
    if (nv) {
        var links = nv.querySelectorAll('a');
        links.forEach(function (link) {
            link.addEventListener('click', function (e) {
                var href = this.getAttribute('href');

                // اگر لینک داخلی سایت است (#about یا ...)
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    closeMenu(); // اول منو بسته میشه

                    var target = document.querySelector(href);
                    if (target) {
                        setTimeout(function () {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }, 100); // اسکرول روان بعد از بسته شدن منو
                    }
                } else {
                    closeMenu();
                }
            });
        });
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
