const SUPABASE_URL = "https://srfrzrdfeuprjfzsklxi.supabase.co";
const SUPABASE_KEY = "sb_publishable_5jWoi-g_R6d0CGqrDPYugg_kghdZZ8-";

let db;
let currentUser = null;
let allAdminTasks = [];
let cachedUsersList = [];

function getStatusFarsi(status) {
    switch (status) {
        case 'not_started': return 'شروع نشده';
        case 'pending': return 'در انتظار بررسی ادمین';
        case 'approved_published': return 'تایید و منتشر شده';
        case 'approved_draft': return 'تایید شده (پیش‌نویس)';
        case 'rejected': return 'رد شده / نیاز به اصلاح';
        default: return status;
    }
}

function convertToShamsiString(dateInput) {
    if (!dateInput) return 'تنظیم نشده';
    if (typeof dateInput === 'string' && dateInput.includes('/')) return dateInput;
    try {
        const dateObj = new Date(dateInput);
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'persian' };
        let formatted = new Intl.DateTimeFormat('fa-IR', options).format(dateObj);
        let clean = formatted.replace(/٫/g, '/').replace(/\\/g, '/');
        const p2e = s => s.replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
        return p2e(clean);
    } catch (e) {
        return dateInput;
    }
}

function updateLiveClock() {
    const now = new Date();
    const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', calendar: 'persian' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    document.getElementById('live-clock').innerText = `⏱️ امروز: ${new Intl.DateTimeFormat('fa-IR', optionsDate).format(now)} | ساعت: ${new Intl.DateTimeFormat('fa-IR', optionsTime).format(now)}`;
}
setInterval(updateLiveClock, 1000);

setTimeout(async () => {
    updateLiveClock();
    const statusBox = document.getElementById('connection-status');
    if (typeof window.supabase === 'undefined') { return; }
    try {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        // تست اتصال با جدول profiles
        const { error } = await db.from('profiles').select('id').limit(1);
        if (!error && statusBox) { 
            statusBox.style.color = 'var(--accent-green)'; 
            statusBox.innerText = '🟢 اتصال به سامانه مرکزی برقرار است'; 
        }
    } catch (err) { }

    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-create-user').addEventListener('click', createNewUser);
    document.getElementById('btn-create-task').addEventListener('click', createNewTask);
    document.getElementById('btn-change-pass').addEventListener('click', changeMemberPassword);
    document.getElementById('search-input').addEventListener('input', searchUserActivity);

    document.getElementById('tab-member-urgent').addEventListener('click', () => switchTab('member-urgent'));
    document.getElementById('tab-member-current').addEventListener('click', () => switchTab('member-current'));
    document.getElementById('tab-member-archive').addEventListener('click', () => switchTab('member-archive'));
    document.getElementById('tab-member-profile').addEventListener('click', () => switchTab('member-profile'));

    document.getElementById('tab-admin-today').addEventListener('click', () => switchTab('admin-today'));
    document.getElementById('tab-admin-future').addEventListener('click', () => switchTab('admin-future'));
    document.getElementById('tab-admin-expired').addEventListener('click', () => switchTab('admin-expired'));
    document.getElementById('tab-admin-search').addEventListener('click', () => switchTab('admin-search'));
    document.getElementById('tab-admin-manage').addEventListener('click', () => { switchTab('admin-manage'); loadUsersManagementSection(); });

    try {
        const { data: { session } } = await db.auth.getSession();
        if (session && session.user) {
            const { data: profile } = await db.from('profiles').select('username, role').eq('id', session.user.id).single();
            if (profile) {
                currentUser = {
                    id: session.user.id,
                    username: profile.username,
                    role: profile.role,
                    email: session.user.email
                };
                document.getElementById('auth-panel').classList.add('hidden');
                document.getElementById('main-dashboard').classList.remove('hidden');
                document.getElementById('user-welcome').innerText = `${currentUser.username} (${currentUser.role === 'admin' ? 'مدیر' : 'عضو'})`;
                
                if (currentUser.role === 'admin') {
                    document.getElementById('admin-tabs').classList.remove('hidden');
                    switchTab('admin-today');
                    fetchAdminDataFromServer();
                } else {
                    document.getElementById('member-tabs').classList.remove('hidden');
                    switchTab('member-urgent');
                    loadMemberData();
                }
            }
        }
    } catch (e) {
        console.log("خطا در بازیابی نشست:", e);
    }
    setTimeout(() => {
        const todayField = document.getElementById('single-task-date');
        if (todayField) todayField.value = convertToShamsiString(new Date());
    }, 500);
}, 1000);

window.checkAndUploadFile = async function (fileInputId, targetInputId, btnId, taskId) {
    const fileInput = document.getElementById(fileInputId);
    const targetInput = document.getElementById(targetInputId);
    const btn = document.getElementById(btnId);

    if (!fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const fileSizeInMB = file.size / (1024 * 1024);

    if (fileSizeInMB > 50) {
        alert("چنانچه فایل شما بالای 50 مگ هست لطفا حجم ان را کاهش دهید یا با مدیر صحبت کنید.");
        fileInput.value = "";
        return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    btn.innerText = '🔄 در حال آپلود فایل...';
    btn.style.pointerEvents = 'none';

    try {
        const { data, error } = await db.storage.from('robo-files').upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });
        if (error) throw error;

        // ایجاد Signed URL امن با اعتبار ۱ ساله (برای دانلود فایل‌های خصوصی)
        const { data: signedData, error: signedError } = await db.storage
            .from('robo-files')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365); // ۶۰ ثانیه * ۶۰ دقیقه * ۲۴ ساعت * ۳۶۵ روز

        if (signedError) throw signedError;

        targetInput.value = signedData.signedUrl;
        btn.innerText = '✅ آپلود موفقیت‌آمیز بود';
        btn.style.borderColor = 'var(--accent-green)';
        btn.style.color = 'var(--accent-green)';
    } catch (err) {
        alert('خطا در آپلود: ' + err.message);
        btn.innerText = '📁 انتخاب و آپلود مستقیم فایل در سرور';
        btn.style.pointerEvents = 'auto';
    }
}

async function handleLogin() {
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    
    if (!usernameInput || !pass) return alert('لطفاً اطلاعات را کامل وارد کنید.');

    // ساخت ایمیل معتبر (جلوگیری از تکرار @nova.local)
    const email = usernameInput.includes('@') ? usernameInput : `${usernameInput}@nova.local`;

    try {
        // ۱. احراز هویت از طریق Supabase Auth
        const { data: authData, error: authError } = await db.auth.signInWithPassword({
            email: email,
            password: pass
        });

        if (authError) {
            console.error("خطای Auth:", authError.message);
            return alert('نام کاربری یا رمز عبور اشتباه است.');
        }

        const authUser = authData.user;

        // ۲. دریافت نقش کاربر از جدول profiles
        const { data: profileData, error: profileError } = await db
            .from('profiles')
            .select('role, username')
            .eq('id', authUser.id)
            .single();

        if (profileError || !profileData) {
            console.error("خطای پروفایل:", profileError);
            return alert('حساب کاربری یافت شد اما پروفایل (نقش) برای آن ثبت نشده است.');
        }

        currentUser = {
            id: authUser.id,
            username: profileData.username,
            role: profileData.role,
            email: authUser.email
        };

        // بروزرسانی رابط کاربری
        document.getElementById('auth-panel').classList.add('hidden');
        document.getElementById('main-dashboard').classList.remove('hidden');
        document.getElementById('user-welcome').innerText = `${currentUser.username} (${currentUser.role === 'admin' ? 'مدیر' : 'عضو'})`;

        if (currentUser.role === 'admin') {
            document.getElementById('admin-tabs').classList.remove('hidden');
            switchTab('admin-today');
            fetchAdminDataFromServer();
        } else {
            document.getElementById('member-tabs').classList.remove('hidden');
            switchTab('member-urgent');
            loadMemberData();
        }
    } catch (e) {
        console.error("خطای غیرمنتظره:", e);
        alert('خطای غیرمنتظره در فرآیند ورود: ' + e.message);
    }
}
async function handleLogout() {
    await db.auth.signOut();
    currentUser = null;
    document.getElementById('main-dashboard').classList.add('hidden');
    document.getElementById('auth-panel').classList.remove('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.zone').forEach(z => z.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const zone = document.getElementById(tabId + '-zone');
    if (zone) zone.classList.remove('hidden');
    const btn = document.getElementById('tab-' + tabId);
    if (btn) btn.classList.add('active');
}

async function changeMemberPassword() {
    const newPass = document.getElementById('member-new-pass').value;
    if (!newPass || newPass.length < 6) return alert('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');

    const { error } = await db.auth.updateUser({ password: newPass });
    if (!error) { 
        alert('رمز عبور با موفقیت بروزرسانی شد.'); 
        document.getElementById('member-new-pass').value = ''; 
    } else {
        alert('خطا در تغییر رمز: ' + error.message);
    }
}

// تابع کمکی برای تشخیص ایمیل یا نام کاربری
function getFormattedEmail() {
    const rawInput = document.getElementById('login-username').value.trim();
    if (!rawInput) return null;
    return rawInput.includes('@') ? rawInput : `${rawInput}@robo.local`;
}

// ۲. درخواست ارسال کد OTP به ایمیل
async function handleSendOTP() {
    const email = getFormattedEmail();
    if (!email) return alert('لطفاً ابتدا نام کاربری یا ایمیل خود را در کادر بالا وارد کنید.');

    try {
        const { error } = await db.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: false // عدم ثبت‌نام کاربر جدید در صورت اشتباه بودن ایمیل
            }
        });

        if (error) {
            if (error.message.includes('Signups not allowed') || error.message.includes('User not found')) {
                alert('❌ این کاربر یا ایمیل در سامانه ثبت نشده است.');
            } else {
                alert('خطا در ارسال کد: ' + error.message);
            }
            return;
        }

        alert('✅ کد تأیید ۶ رقمی به ایمیل شما ارسال شد.');
        document.getElementById('otp-verify-section').style.display = 'block';

    } catch (err) {
        alert('خطا در اتصال: ' + err.message);
    }
}

// ۳. بررسی و تأیید کد ۶ رقمی
async function handleVerifyOTP() {
    const email = getFormattedEmail();
    const token = document.getElementById('otp-code-input').value.trim();

    if (!token) return alert('لطفاً کد ۶ رقمی را وارد کنید.');

    try {
        const { data, error } = await db.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) throw error;

        alert('✅ ورود موفقیت‌آمیز بود.');
        location.reload();

    } catch (err) {
        alert('❌ کد وارد شده اشتباه یا منقضی شده است.');
    }
}

async function loadUsersManagementSection() {
    const select = document.getElementById('select-task-user');
    const tableBody = document.getElementById('admin-users-table-body');
    const lastSelectedUser = select ? select.value : '';

    const { data: users, error } = await db.from('profiles').select('id, username, role');
    if (error) {
        console.error("خطا در دریافت لیست کاربران:", error);
        return;
    }

    cachedUsersList = users || [];

    if (select) {
        select.innerHTML = '<option value="">انتخاب عضو انجمن...</option>';
        users?.forEach(u => {
            select.innerHTML += `<option value="${u.id}">${u.username}</option>`;
        });
        if (lastSelectedUser) select.value = lastSelectedUser;
    }

    if (tableBody) {
        tableBody.innerHTML = '';
        users?.forEach(u => {
            tableBody.innerHTML += `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.role === 'admin' ? '💼 مدیر ادمین' : '👤 عضو عادی'}</td>
                    <td><code style="background:#222; padding:3px 6px; border-radius:4px; color:var(--accent-blue);">محفوظ در Supabase Auth</code></td>
                    <td><button class="btn-small" style="background-color: var(--accent-blue); padding:4px 8px;" onclick="resetUserPasswordPrompt('${u.id}', '${u.username}')">✏️ تغییر رمز عبور</button></td>
                </tr>
            `;
        });
    }
}

// برای هم‌خوانی با فراخوانی‌های قدیمی
window.loadUsersToSelect = loadUsersManagementSection;

window.resetUserPasswordPrompt = async function (userId, username) {
    const newPass = prompt(`رمز عبور جدید را برای کاربر "${username}" وارد کنید (حداقل ۶ کاراکتر):`);
    if (!newPass) return;
    if (newPass.length < 6) return alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');

    try {
        const { data, error } = await db.functions.invoke('admin-change-password', {
            body: { userId: userId, newPassword: newPass }
        });

        if (error) {
            alert('خطا در تغییر رمز: ' + error.message);
        } else {
            alert(`✅ رمز عبور کاربر "${username}" با موفقیت تغییر یافت.`);
        }
    } catch (err) {
        alert('خطای اتصال: ' + err.message);
    }
}

async function createNewUser() {
    const usernameInput = document.getElementById('new-user-name').value.trim().toLowerCase();
    const password = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;
    if (!usernameInput || !password) return alert('نام کاربری و رمز عبور را مشخص کنید.');

    const email = usernameInput.includes('@') ? usernameInput : `${usernameInput}@nova.local`;;

    try {
        // ارسال مشخصات به سیستم Auth (تریگر دیتابیس خودکار پروفایل را می‌سازد)
        const { data: authData, error: authError } = await db.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { username: usernameInput, role: role }
            }
        });

        if (authError) return alert('خطا در ایجاد کاربر: ' + authError.message);

        alert(`حساب "${usernameInput}" با موفقیت ایجاد شد.`);
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-pass').value = '';
        loadUsersManagementSection();
    } catch (e) {
        alert('خطای غیرمنتظره: ' + e.message);
    }
}

// تغییر متد به مولتی تسک متوالی (چند تسک برای یک نفر بدون ریست شدن منو)
async function createNewTask() {
    const userId = document.getElementById('select-task-user').value;
    const title = document.getElementById('single-task-title').value.trim();
    const taskType = document.getElementById('single-task-type').value;
    const shamsiDateValue = document.getElementById('single-task-date').value.trim();

    if (!userId || !title || !shamsiDateValue) {
        return alert('⚠️ تکمیل تمامی فیلدها اجباری است.');
    }

    const { error } = await db.from('robo_tasks').insert({
        user_id: userId, // این شناسه اکنون همان UUID کاربر از جدول profiles است
        title: title,
        task_type: taskType,
        due_date: shamsiDateValue,
        status: 'not_started'
    });

    if (!error) {
        alert('✅ تسک با موفقیت ثبت شد.');
        document.getElementById('single-task-title').value = '';
        document.getElementById('single-task-date').value = convertToShamsiString(new Date());
        if (currentUser.role === 'admin') fetchAdminDataFromServer();
    } else {
        alert('خطایی در دیتابیس رخ داد: ' + error.message);
    }
}

function isPastDeadline(shamsiDateStr) {
    if (!shamsiDateStr || !shamsiDateStr.includes('/')) return false;
    try {
        const todayStr = convertToShamsiString(new Date());
        return todayStr > shamsiDateStr;
    } catch (e) { return false; }
}

// تابع کمکی برای باز و بسته کردن پنل تسک اعضا (آکاردئون)
window.toggleTaskFold = function (id) {
    const el = document.getElementById(`fold-body-${id}`);
    if (el) el.classList.toggle('hidden');
}

async function loadMemberData() {
    const { data: tasks } = await db.from('robo_tasks').select('*').eq('user_id', currentUser.id).order('due_date', { ascending: true });

    const listUrgent = document.getElementById('list-urgent');
    const listCurrent = document.getElementById('list-current');
    const listArchive = document.getElementById('list-archive');

    listUrgent.innerHTML = ''; listCurrent.innerHTML = ''; listArchive.innerHTML = '';
    const todayShamsi = convertToShamsiString(new Date());

    tasks?.forEach(task => {
        const isOverdue = isPastDeadline(task.due_date);
        const typeLabel = task.task_type || 'ویدیو';
        const farsiStatus = getStatusFarsi(task.status);

        let itemHtml = `<div class="task-item">
                ${task.has_blue_dot ? '<span class="dot dot-blue"></span>' : ''}
                ${task.has_red_dot ? '<span class="dot dot-red"></span>' : ''}
                
                <!-- هدر قابل کلیک برای باز شدن بخش انجام تسک -->
                <div class="task-header-click" onclick="toggleTaskFold('${task.id}')">
                    <h4><span class="task-badge">${typeLabel}</span> ${task.title} <i class="fa fa-chevron-down" style="font-size:11px; margin-right:5px; color:var(--text-muted);"></i></h4>
                    <div style="font-size:13px; color:var(--text-muted);">📅 مهلت نهایی (شمسی): <strong style="color:#fff;">${task.due_date}</strong> | وضعیت: <span style="color:var(--accent-blue);">${farsiStatus}</span></div>
                </div>`;

        if (task.status === 'rejected' && task.admin_comment) {
            itemHtml += `<div class="msg-box">⚠️ علت رد فعالیت توسط ادمین: ${task.admin_comment}</div>`;
        }

        // باکس محتوایی که با کلیک روی تسک باز می‌شود
        itemHtml += `<div id="fold-body-${task.id}" class="task-body-fold hidden">`;

        if ((task.status === 'not_started' || task.status === 'rejected') && !isOverdue) {
            itemHtml += `
                    <input type="text" id="utitle-${task.id}" placeholder="عنوان اختصاصی مطلب شما">
                    <div class="warn-box">کاهش حجم ویدیو آنلاین یا استخراج صوت در صورت نیاز فراموش نشود. حداکثر حجم فایل ۵۰ مگابایت است.</div>
                    <textarea id="ucontent-${task.id}" placeholder="کپشن مورد نظر شما..."></textarea>
                    <div class="file-upload-wrapper">
                        <input type="file" id="file-picker-${task.id}" style="display:none;" onchange="checkAndUploadFile('file-picker-${task.id}', 'ufile-${task.id}', 'up-btn-${task.id}', '${task.id}')">
                        <label id="up-btn-${task.id}" class="file-upload-btn" for="file-picker-${task.id}">📁 انتخاب و آپلود مستقیم فایل در سرور</label>
                    </div>
                    <input type="text" id="ufile-${task.id}" value="" placeholder="لینک فایل آپلود شده (در صورت وجود)" readonly style="background:#222; color:var(--accent-blue);">
                    <button onclick="submitTask('${task.id}')">ارسال فعالیت جهت بررسی ادمین</button>
                `;
        } else if (task.status === 'approved_published' || task.status === 'approved_draft') {
            itemHtml += `<p style="color: var(--accent-green); font-size:13px;">✓ این فعالیت تایید شده و غیرقابل ویرایش است.</p>`;
        } else if (isOverdue && task.status !== 'approved_published') {
            itemHtml += `<p style="color: var(--accent-red); font-size:13px;">⚠️ مهلت ارسال این فعالیت به پایان رسیده است.</p>`;
        }

        itemHtml += `</div></div>`;

        if (task.status === 'approved_published' || task.status === 'approved_draft' || (isOverdue && task.status !== 'rejected')) {
            listArchive.innerHTML += itemHtml;
        } else if (task.due_date === todayShamsi || task.status === 'rejected' || task.is_extended) {
            listUrgent.innerHTML += itemHtml;
        } else {
            listCurrent.innerHTML += itemHtml;
        }
    });
}

window.submitTask = async function (taskId) {
    const uTitle = document.getElementById(`utitle-${taskId}`).value.trim();
    const uContent = document.getElementById(`ucontent-${taskId}`).value.trim();
    const uFile = document.getElementById(`ufile-${taskId}`).value.trim();

    if (!uContent) return alert('🔴 وارد کردن کپشن برای ارسال تسک الزامی است.');

    await db.from('robo_tasks').update({
        user_id: currentUser.id,
        user_title: uTitle || 'فعالیت بی‌نام',
        task_content: uContent,
        file_url: uFile || null,
        status: 'pending',
        has_blue_dot: false,
        has_red_dot: false
    }).eq('id', taskId);

    alert('فعالیت با موفقیت برای مدیریت ارسال شد.');
    loadMemberData();
}

async function fetchAdminDataFromServer() {
    try {
        // ۱. دریافت تمامی تسک‌ها
        const { data: tasks, error: tasksError } = await db
            .from('robo_tasks')
            .select('*')
            .order('due_date', { ascending: true });

        if (tasksError) throw tasksError;

        // ۲. دریافت تمامی پروفایل‌ها برای تشخیص نام کاربران
        const { data: profiles, error: profilesError } = await db
            .from('profiles')
            .select('id, username');

        if (profilesError) throw profilesError;

        // ایجاد یک مپ سریع از ID به نام کاربر
        const profileMap = {};
        profiles?.forEach(p => {
            profileMap[p.id] = p.username;
        });

        // ۳. ترکیب اطلاعات تسک با نام کاربر
        allAdminTasks = (tasks || []).map(task => ({
            ...task,
            profiles: {
                username: profileMap[task.user_id] || 'ناشناس'
            }
        }));

        // ۴. بروزرسانی رابط کاربری
        loadAdminData();

    } catch (error) {
        console.error("خطا در دریافت تسک‌های ادمین:", error.message || error);
    }
}

function loadAdminData() {
    const todayShamsi = convertToShamsiString(new Date());

    const listToday = document.getElementById('list-admin-today');
    const listFuture = document.getElementById('list-admin-future');
    const listExpired = document.getElementById('list-admin-expired');

    if (!listToday || !listFuture || !listExpired) return;

    listToday.innerHTML = ''; listFuture.innerHTML = ''; listExpired.innerHTML = '';

    allAdminTasks.forEach(task => {
        const isOverdue = isPastDeadline(task.due_date);
        const targetUsername = task.profiles?.username || 'ناشناس';
        const typeLabel = task.task_type || 'ویدیو';
        const farsiStatus = getStatusFarsi(task.status);

        let itemHtml = `<div class="card" style="padding:15px; border-color: #444;" id="admin-card-${task.id}">
                <div class="task-meta"><span class="admin-username-badge">عضو: ${targetUsername}</span> | <span class="task-badge" id="badge-val-${task.id}">${typeLabel}</span> <strong id="title-val-${task.id}">تسک: ${task.title}</strong></div>
                <div class="task-meta" style="margin-top:5px; margin-bottom:5px;">📅 مهلت تحویل: <strong style="color:var(--accent-blue);" id="date-val-${task.id}">${task.due_date}</strong> | وضعیت: <span style="color:#ff9e2c;">${farsiStatus}</span></div>`;

        if (task.status === 'pending' || task.status === 'approved_published' || task.status === 'approved_draft' || task.status === 'rejected') {
            if (task.user_title || task.task_content || task.file_url) {
                itemHtml += `
                        <div class="msg-box" style="background: #21262d; margin-bottom: 10px; color: var(--text-main); border-color: var(--border-color);">
                            <strong>عنوان کاربر:</strong> ${task.user_title || 'بدون عنوان'}<br>
                            <strong>فایل پیوست سرور:</strong> ${task.file_url ? `<a href="${task.file_url}" target="_blank" style="color:var(--accent-green); font-weight:bold;">📥 مشاهده فایل ضمیمه</a>` : 'فایلی آپلود نشده'}<br>
                            <strong>کپشن ارسالی کاربر (برای کپی روی متن کلیک کنید):</strong>
                            <div class="selectable-caption" title="کلیک کنید تا کل متن انتخاب شود" onclick="document.execCommand('selectAll',false,null)">${task.task_content || 'بدون کپشن'}</div>
                        </div>
                    `;
            }
        }

        itemHtml += `
                <div id="edit-box-${task.id}" class="edit-task-box hidden">
                    <label style="font-size:11px; color:var(--text-muted);">عنوان جدید تسک:</label>
                    <input type="text" id="edit-title-${task.id}" value="${task.title}">
                    
                    <label style="font-size:11px; color:var(--text-muted);">نوع جدید فعالیت:</label>
                    <select id="edit-type-${task.id}">
                        <option value="ویدیو" ${typeLabel === 'ویدیو' ? 'selected' : ''}>ویدیو</option>
                        <option value="پادکست" ${typeLabel === 'پادکست' ? 'selected' : ''}>پادکست</option>
                        <option value="پوستر" ${typeLabel === 'پوستر' ? 'selected' : ''}>پوستر / اینفوگرافیک</option>
                        <option value="متن" ${typeLabel === 'متن' ? 'selected' : ''}>متن</option>
                    </select>

                    <label style="font-size:11px; color:var(--text-muted);">تغییر مستقیم تاریخ مهلت شمسی (فرمت: yyyy/mm/dd):</label>
                    <input type="text" id="edit-date-${task.id}" value="${task.due_date}">
                    
                    <div style="display:flex; gap:5px;">
                        <button class="btn-small" style="background:var(--accent-green)" onclick="saveEditedTask('${task.id}')">💾 ثبت نهایی تغییرات</button>
                        <button class="btn-small" style="background:#555" onclick="toggleEditForm('${task.id}')">لغو</button>
                    </div>
                </div>
            `;

        itemHtml += `<div class="btn-group">`;
        if (task.status === 'pending') {
            itemHtml += `
                    <button class="btn-small" style="background:var(--accent-green)" onclick="reviewTask('${task.id}', 'approved_published')">تایید و انتشار</button>
                    <button class="btn-small" style="background:var(--accent-blue)" onclick="reviewTask('${task.id}', 'approved_draft')">تایید پیش‌نویس</button>
                    <button class="btn-small" style="background:var(--accent-red)" onclick="rejectPrompt('${task.id}')">❌ رد کردن با دلیل</button>
                `;
        } else {
            itemHtml += `<button class="btn-small" style="background:#444;" onclick="reviewTask('${task.id}', 'pending')">↩ برگشت به وضعیت بررسی</button>`;
        }

        itemHtml += `<button class="btn-small" style="background-color: #ff9e2c; color:#000;" onclick="toggleEditForm('${task.id}')">✏️ ویرایش تسک</button>`;
        itemHtml += `<button class="btn-small" style="background-color: var(--accent-red);" onclick="deleteTaskFromServer('${task.id}')">🗑️ حذف کامل تسک</button>`;
        itemHtml += `</div>`;

        if (isOverdue && task.status !== 'approved_published' && task.status !== 'approved_draft') {
            itemHtml += `
                    <div style="margin-top:10px; border-top:1px solid #333; padding-top:10px;">
                        <input type="text" id="extend-${task.id}" placeholder="مثال: 1405/04/20" style="width:70%; display:inline-block; margin-bottom:0; padding:6px; direction:ltr; text-align:right;">
                        <button class="btn-small" style="width:25%;" onclick="extendTask('${task.id}')">تمدید</button>
                    </div>
                `;
            listExpired.innerHTML += itemHtml;
        } else if (task.due_date === todayShamsi || task.status === 'pending' || task.status === 'approved_published' || task.status === 'approved_draft' || task.status === 'rejected') {
            listToday.innerHTML += itemHtml;
        } else {
            listFuture.innerHTML += itemHtml;
        }
    });
}

window.toggleEditForm = function (taskId) {
    const box = document.getElementById(`edit-box-${taskId}`);
    box.classList.toggle('hidden');
}

window.saveEditedTask = async function (taskId) {
    const newTitle = document.getElementById(`edit-title-${taskId}`).value.trim();
    const newType = document.getElementById(`edit-type-${taskId}`).value;
    const newDate = document.getElementById(`edit-date-${taskId}`).value.trim();

    if (!newTitle || !newDate) return alert('فیلدها نباید خالی باشند.');

    const { error } = await db.from('robo_tasks').update({
        title: newTitle,
        task_type: newType,
        due_date: newDate
    }).eq('id', taskId);

    if (!error) {
        alert('✓ تسک با موفقیت ویرایش و بروزرسانی شد.');
        fetchAdminDataFromServer();
    } else {
        alert('خطا در اعمال تغییرات: ' + error.message);
    }
}

window.reviewTask = async function (taskId, newStatus) {
    await db.from('robo_tasks').update({ status: newStatus }).eq('id', taskId);
    alert('وضعیت تسک به‌روزرسانی شد.');
    fetchAdminDataFromServer();
}

window.rejectPrompt = async function (taskId) {
    const comment = prompt('لطفاً دلیل و پیام رد کردن این فعالیت را بنویسید:');
    if (comment) {
        await db.from('robo_tasks').update({
            status: 'rejected',
            admin_comment: comment,
            has_red_dot: true
        }).eq('id', taskId);
        alert('فعالیت رد شد و علت آن ثبت گردید.');
        fetchAdminDataFromServer();
    }
}

window.extendTask = async function (taskId) {
    const extendValue = document.getElementById(`extend-${taskId}`).value.trim();
    if (!extendValue) return alert('لطفاً تاریخ تمدید جدید شمسی را وارد کنید.');
    await db.from('robo_tasks').update({ due_date: extendValue, is_extended: true, status: 'not_started' }).eq('id', taskId);
    alert('تسک تمدید شد.');
    fetchAdminDataFromServer();
}

window.deleteTaskFromServer = async function (taskId) {
    if (!confirm('آیا مطمئن هستید؟')) return;
    const { error } = await db.from('robo_tasks').delete().eq('id', taskId);
    if (!error) { alert('تسک با موفقیت حذف گردید.'); fetchAdminDataFromServer(); }
}

async function searchUserActivity() {
    const term = document.getElementById('search-input').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;
    if (!term) { resultsDiv.innerHTML = ''; return; }

    const { data: user } = await db.from('profiles').select('id').eq('username', term).single();
    if (!user) { resultsDiv.innerHTML = 'کاربری با این نام پیدا نشد.'; return; }

    const { data: tasks } = await db.from('robo_tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true });
    resultsDiv.innerHTML = `<h4>تعداد فعالیت‌ها: ${tasks?.length || 0}</h4>`;
    tasks?.forEach(t => {
        const farsiStatus = getStatusFarsi(t.status);
        resultsDiv.innerHTML += `<div style="padding:8px; border-bottom:1px solid #333;">• ${t.title} [نوع: ${t.task_type || 'ویدیو'}] [تاریخ: ${t.due_date}] [وضعیت: ${farsiStatus}]</div>`;
    });
}
