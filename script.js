/* ========================================
   駿匯聯 C&W Management - Main Script
   ======================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Scroll Progress
    const scrollProgress = document.getElementById('scrollProgress');
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const pct = maxScroll > 0 ? (scrolled / maxScroll) * 100 : 0;
        if (scrollProgress) scrollProgress.style.width = pct + '%';
    }, { passive: true });

    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    }, { passive: true });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    mobileMenuBtn?.addEventListener('click', () => {
        navLinks?.classList.toggle('open');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.classList.toggle('ph-list');
            icon.classList.toggle('ph-x');
        }
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => navLinks?.classList.remove('open'));
    });

    // Reveal on scroll
    const revealEls = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));

    // Counter animation
    const counters = document.querySelectorAll('.stat-number[data-target]');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseFloat(el.dataset.target);
                const duration = 1500;
                const startTime = performance.now();
                const animate = (now) => {
                    const progress = Math.min((now - startTime) / duration, 1);
                    const ease = 1 - Math.pow(1 - progress, 3);
                    const current = target * ease;
                    if (Number.isInteger(target)) {
                        el.textContent = Math.round(current);
                    } else {
                        el.textContent = current.toFixed(1);
                    }
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(c => counterObserver.observe(c));

    // Lead Modal
    const modal = document.getElementById('leadModal');
    const closeModal = document.getElementById('closeModal');
    const leadForm = document.getElementById('leadForm');
    const openModalBtns = document.querySelectorAll('.open-modal');

    function openModal() {
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (typeof gtag === 'function') {
                gtag('event', 'modal_open', { event_category: 'engagement', event_label: 'lead_modal' });
            }
            if (typeof fbq === 'function') {
                fbq('track', 'Lead');
            }
        }
    }
    function hideModal() {
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    openModalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    });
    closeModal?.addEventListener('click', hideModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideModal();
    });

    // Lead form submit -> WhatsApp
    leadForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(leadForm);
        const name = (formData.get('name') || '').trim();
        const phone = (formData.get('phone') || '').trim();
        if (!name || !phone) return;

        if (typeof gtag === 'function') {
            gtag('event', 'lead_submit', { event_category: 'conversion', event_label: 'whatsapp_redirect' });
        }
        if (typeof fbq === 'function') {
            fbq('track', 'Contact');
        }

        const msg = `你好，我是${name}，電話：${phone}。我有興趣了解駿匯聯的收款方案，請聯絡我，謝謝。`;
        const url = 'https://wa.me/85251164453?text=' + encodeURIComponent(msg);
        window.open(url, '_blank');
        hideModal();
        leadForm.reset();
    });

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question?.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            faqItems.forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');

            if (!isOpen && typeof gtag === 'function') {
                gtag('event', 'faq_expand', { event_category: 'engagement', event_label: question.textContent.trim().substring(0, 50) });
            }
        });
    });

    // Pricing Calculator
    const monthlyRevenue = document.getElementById('monthlyRevenue');
    const currentProvider = document.getElementById('currentProvider');
    const annualSavings = document.getElementById('annualSavings');
    const savingsMetaphor = document.getElementById('savingsMetaphor');
    const calcProgressFill = document.getElementById('calcProgressFill');

    function formatMoney(n) {
        return '$' + Math.round(n).toLocaleString('en-HK');
    }

    function updateCalculator() {
        const revenue = parseFloat(monthlyRevenue?.value) || 0;
        const provider = currentProvider?.value || 'xtripe';
        if (!revenue || revenue <= 0) {
            if (annualSavings) annualSavings.textContent = '$0';
            if (savingsMetaphor) savingsMetaphor.textContent = '輸入交易額即可查看驚人差距';
            if (calcProgressFill) calcProgressFill.style.width = '0%';
            return;
        }

        let theirRate = 0.034;
        let fixedFee = 2.35;
        if (provider === 'xaypal') { theirRate = 0.039; fixedFee = 2.35; }
        else if (provider === 'other') { theirRate = 0.035; fixedFee = 0; }

        const monthlyTxnCount = Math.max(1, Math.round(revenue / 400));
        const theirCost = revenue * theirRate + monthlyTxnCount * fixedFee;
        const ourCost = revenue * 0.026;
        const monthlySave = Math.max(0, theirCost - ourCost);
        const annualSave = monthlySave * 12;

        if (annualSavings) annualSavings.textContent = formatMoney(annualSave);

        let metaphor = '';
        if (annualSave < 5000) metaphor = '這筆錢夠你請一位兼職員工一個月。';
        else if (annualSave < 15000) metaphor = '這筆錢夠你帶全家去一趟短途旅行。';
        else if (annualSave < 30000) metaphor = '這筆錢足夠你升級整個網店的庫存系統。';
        else if (annualSave < 60000) metaphor = '這筆錢等於你一年免費多請一位全職員工。';
        else metaphor = '這筆錢足以讓你的網店擴張一個全新產品線。';
        if (savingsMetaphor) savingsMetaphor.textContent = metaphor;

        const maxSave = 100000;
        const pct = Math.min(100, Math.max(0, (annualSave / maxSave) * 100));
        if (calcProgressFill) calcProgressFill.style.width = pct + '%';
    }

    monthlyRevenue?.addEventListener('input', updateCalculator);
    currentProvider?.addEventListener('change', updateCalculator);

    // Sticky CTA
    const stickyCta = document.getElementById('stickyCta');
    let ctaShown = false;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500 && !ctaShown) {
            stickyCta?.classList.add('visible');
            ctaShown = true;
        }
    }, { passive: true });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
