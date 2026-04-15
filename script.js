/* ========================================
   駿匯聯 C&W Management - Main Script
   CMS 動態載入 + 客戶留痕 (Leads Capture)
   ======================================== */

// ⚠️ 部署後請確認 Worker URL
const API_BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8787'
    : 'https://cwmng-cms-worker.jimsbond007.workers.dev';

function getWhatsAppNumber() {
    return cmsCache?.site?.whatsappNumber || '85251164453';
}

function buildWhatsAppUrl(text) {
    const number = getWhatsAppNumber();
    const msg = (text || cmsCache?.site?.whatsappDefaultMessage || '你好，我想了解駿匯聯的收款方案').trim();
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
}

function bindWhatsAppLinks() {
    const selectors = '.wa-cta, .open-modal, .open-checklist';
    document.querySelectorAll(selectors).forEach(el => {
        const text = el.textContent.trim();
        el.setAttribute('href', buildWhatsAppUrl(text));
        el.setAttribute('target', '_blank');
        el.addEventListener('click', () => {
            trackEvent('whatsapp_click', { label: text || 'wa_cta' });
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initBaseInteractions();
    initHeroSlider();
    initPricingCalculator();
    fetchCMSData();
    trackPageView();
});

/* ========================================
   Theme Toggle
   ======================================== */
function initTheme() {
    const saved = localStorage.getItem('cwmng_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setTheme(isDark ? 'dark' : 'light');

    const toggle = document.getElementById('themeToggle');
    toggle?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('cwmng_theme', next);
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    }
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
        themeColor.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#1E3A8A');
    }
}

/* ========================================
   Hero Slider
   ======================================== */
function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('#heroDots button');
    const slider = document.querySelector('.hero-slider');
    if (slides.length < 2) return;
    let current = 0;
    let timer = null;

    function showSlide(index) {
        slides[current].classList.remove('active');
        dots[current]?.classList.remove('active');
        current = (index + slides.length) % slides.length;
        slides[current].classList.add('active');
        dots[current]?.classList.add('active');
    }

    function nextSlide() { showSlide(current + 1); }
    function startAuto() { timer = setInterval(nextSlide, 4000); }
    function stopAuto() { if (timer) clearInterval(timer); }

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => { stopAuto(); showSlide(i); startAuto(); });
    });

    if (slider) {
        slider.addEventListener('mouseenter', stopAuto);
        slider.addEventListener('mouseleave', startAuto);
    }

    startAuto();
}

/* ========================================
   Base UI Interactions ( preserved from original )
   ======================================== */
function initBaseInteractions() {
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
        if (window.scrollY > 10) navbar?.classList.add('scrolled');
        else navbar?.classList.remove('scrolled');
    }, { passive: true });

    // Mobile menu (event delegation for dynamically rendered nav)
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
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-links a');
        if (link && navLinks) navLinks.classList.remove('open');
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
                    el.textContent = Number.isInteger(target) ? Math.round(current) : current.toFixed(1);
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(c => counterObserver.observe(c));

    // WhatsApp Links
    bindWhatsAppLinks();

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

    // Sticky CTA
    const stickyCta = document.getElementById('stickyCta');
    let ctaShown = false;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500 && !ctaShown) {
            stickyCta?.classList.add('visible');
            ctaShown = true;
        }
    }, { passive: true });

    // Smooth scroll for anchor links (event delegation for dynamically rendered content)
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[href^="#"]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

/* ========================================
   CMS Data Loading & Rendering
   ======================================== */
let cmsCache = null;

async function fetchCMSData() {
    try {
        const res = await fetch(API_BASE_URL + '/api/cms/data', { cache: 'no-store' });
        if (!res.ok) throw new Error('CMS API error');
        cmsCache = await res.json();
        renderCMS(cmsCache);
    } catch (err) {
        console.warn('[CMS] Failed to load CMS data, using static fallback.', err);
    }
}

function renderCMS(data) {
    if (!data) return;
    renderSiteMeta(data.site);
    renderNav(data.nav);
    renderHero(data.hero);
    renderQuickLinks(data.quickLinks);
    renderProblems(data.problems);
    renderSolutions(data.solutions);
    renderProcess(data.process);
    renderPricing(data.pricing);
    renderDownloadPromo(data.downloadPromo);
    renderTrust(data.trust);
    renderTestimonials(data.testimonials);
    renderMarquee(data.marquee);
    renderFAQ(data.faq);
    renderCTA(data.cta);
    renderFooter(data.footer);
    renderStickyCta(data.stickyCta);
    bindWhatsAppLinks();
}

function renderSiteMeta(site) {
    if (!site) return;
    if (site.title) {
        document.title = site.title;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', site.title);
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute('content', site.title);
    }
    const desc = document.querySelector('meta[name="description"]');
    if (desc && site.description) desc.setAttribute('content', site.description);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && site.description) ogDesc.setAttribute('content', site.description);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc && site.description) twDesc.setAttribute('content', site.description);
}

function renderNav(nav) {
    if (!nav) return;
    const navLinks = document.getElementById('navLinks');
    if (navLinks && nav.items) {
        const items = Array.from(navLinks.querySelectorAll('li'));
        const ctaLi = items.find(li => li.querySelector('.btn-primary'));
        const themeLi = items.find(li => li.querySelector('#themeToggle'));
        navLinks.innerHTML = nav.items.map(item => `<li><a href="${item.href || '#'}">${item.text}</a></li>`).join('')
            + (ctaLi ? ctaLi.outerHTML : '')
            + (themeLi ? themeLi.outerHTML : '');
        if (nav.cta) {
            const newCtaA = navLinks.querySelector('.btn-primary');
            if (newCtaA) newCtaA.textContent = nav.cta;
        }
        // Re-bind theme toggle after innerHTML rebuild
        initTheme();
    }
}

function renderStickyCta(sticky) {
    if (!sticky) return;
    const container = document.querySelector('.sticky-cta-inner');
    if (container) {
        const span = container.querySelector('span');
        const btn = container.querySelector('a');
        if (span && sticky.text) span.textContent = sticky.text;
        if (btn && sticky.button) {
            btn.textContent = sticky.button;
            btn.setAttribute('href', buildWhatsAppUrl(sticky.button));
        }
    }
}

function renderHero(hero) {
    if (!hero) return;
    const h1 = document.querySelector('.hero-content h1');
    if (h1 && hero.title) h1.innerHTML = hero.title;
    const subtitle = document.querySelector('.hero-subtitle');
    if (subtitle && hero.subtitle) subtitle.textContent = hero.subtitle;

    const ctaPrimary = document.querySelector('.hero-cta .btn-primary');
    const ctaSecondary = document.querySelector('.hero-cta .btn-secondary');
    if (ctaPrimary && hero.ctaPrimary) ctaPrimary.textContent = hero.ctaPrimary;
    if (ctaSecondary && hero.ctaSecondary) ctaSecondary.textContent = hero.ctaSecondary;

    const trustBar = document.querySelector('.hero-trust-bar');
    if (trustBar && hero.trustBadges) {
        trustBar.innerHTML = hero.trustBadges.map((b, i) => {
            const sep = i > 0 ? '<span class="divider">|</span>' : '';
            const icon = b.icon ? `<i class="ph ${b.icon}"></i>` : '';
            return `${sep}<span>${icon} ${b.text}</span>`;
        }).join('');
    }

    const statsContainer = document.querySelector('.hero-stats');
    if (statsContainer && hero.stats) {
        statsContainer.innerHTML = hero.stats.map(s => `
            <div class="stat-item">
                <div><span class="stat-number" data-target="${s.number}">0</span><span class="stat-suffix">${s.suffix}</span></div>
                <span class="stat-label">${s.label}</span>
            </div>
        `).join('');
        // Re-observe new counters
        const counters = statsContainer.querySelectorAll('.stat-number[data-target]');
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
                        el.textContent = Number.isInteger(target) ? Math.round(current) : current.toFixed(1);
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                    counterObserver.unobserve(el);
                }
            });
        }, { threshold: 0.5 });
        counters.forEach(c => counterObserver.observe(c));
    }
}

function renderQuickLinks(links) {
    if (!links) return;
    const grid = document.querySelector('.quick-links-grid');
    if (!grid) return;
    grid.innerHTML = links.map(l => {
        const isExternal = l.href && l.href.startsWith('http');
        const href = isExternal ? l.href : buildWhatsAppUrl(l.text);
        const cls = isExternal ? '' : 'wa-cta';
        const target = 'target="_blank"';
        return `<a href="${href}" ${target} class="quick-link-card ${cls}">
            <i class="ph ${l.icon}"></i>
            <span>${l.text}</span>
            <i class="ph ph-arrow-right"></i>
        </a>`;
    }).join('');
    // Re-bind modal listeners for dynamically created links
    bindModalTriggers();
}

function renderProblems(problems) {
    if (!problems) return;
    const header = document.querySelector('#problems .section-header');
    if (header) {
        const h2 = header.querySelector('h2');
        const sub = header.querySelector('.section-subtitle');
        if (h2 && problems.sectionTitle) h2.innerHTML = problems.sectionTitle;
        if (sub && problems.sectionSubtitle) sub.textContent = problems.sectionSubtitle;
    }
    const grid = document.querySelector('.problem-grid');
    if (grid && problems.items) {
        grid.innerHTML = problems.items.map((item, i) => `
            <div class="problem-card reveal delay-${i + 1}">
                <div class="card-art${item.backdrop ? ' img-backdrop' : ''}">
                    <img src="${item.image}" alt="${item.alt}" class="card-illustration">
                </div>
                <div class="problem-icon">${item.icon}</div>
                <h3>${item.title}</h3>
                <p>${item.description}</p>
                <div class="problem-solution">
                    <i class="ph ph-check-circle text-success"></i>
                    <span>${item.solution}</span>
                </div>
            </div>
        `).join('');
        // Re-observe reveals
        grid.querySelectorAll('.reveal').forEach(el => {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
            obs.observe(el);
        });
    }
}

function renderSolutions(solutions) {
    if (!solutions) return;
    const header = document.querySelector('#solutions .section-header h2');
    if (header && solutions.sectionTitle) header.textContent = solutions.sectionTitle;

    const grid = document.querySelector('.solutions-grid');
    if (grid && solutions.items) {
        grid.innerHTML = solutions.items.map((item, i) => `
            <div class="solution-card reveal delay-${i + 1} ${item.featured ? 'featured' : ''}">
                ${item.featured ? '<div class="solution-badge">最熱門</div>' : ''}
                <div class="solution-art art-${['shop','sub','global'][i] || 'shop'}">
                    <div class="art-bg-shape"></div>
                    <i class="ph ${item.icon}"></i>
                    ${i === 0 ? '<div class="art-sparkle s1"></div><div class="art-sparkle s2"></div>' : ''}
                    ${i === 1 ? '<div class="art-ring r1"></div><div class="art-ring r2"></div>' : ''}
                    ${i === 2 ? '<div class="art-plane"><i class="ph ph-paper-plane-right"></i></div>' : ''}
                </div>
                <div class="solution-header">
                    <span class="solution-tag">${item.tag}</span>
                    <h3>${item.title}</h3>
                    <p class="solution-for">${item.for}</p>
                </div>
                <ul class="solution-features">
                    ${item.features.map(f => `<li><i class="ph ${f.icon || 'ph-check'}"></i> ${f.text || f}</li>`).join('')}
                </ul>
                <div class="solution-footer">
                    <div class="solution-price">
                        <span class="price-num">${item.priceNumber}</span>
                        <span class="price-unit">${item.priceUnit}</span>
                        ${item.priceNote ? `<small>${item.priceNote}</small>` : ''}
                    </div>
                    <a href="${buildWhatsAppUrl(item.cta)}" class="btn btn-primary btn-block wa-cta" target="_blank">${item.cta}</a>
                </div>
            </div>
        `).join('');
        grid.querySelectorAll('.reveal').forEach(el => {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
            obs.observe(el);
        });
        bindModalTriggers();
    }
}

function renderProcess(process) {
    if (!process) return;
    const h2 = document.querySelector('#process .section-header h2');
    if (h2 && process.sectionTitle) h2.textContent = process.sectionTitle;
    const img = document.querySelector('.process-hero img');
    if (img && process.image) img.src = process.image;

    const grid = document.querySelector('.process-grid');
    if (grid && process.steps) {
        grid.innerHTML = process.steps.map((step, i) => {
            const arrow = i < process.steps.length - 1 ? '<div class="process-arrow"><i class="ph ph-caret-right"></i></div>' : '';
            return `
                <div class="process-step reveal delay-${i + 1}">
                    <div class="step-pulse"></div>
                    <div class="step-num">${step.num}</div>
                    <h4>${step.title}</h4>
                    <p>${step.desc}</p>
                </div>
                ${arrow}
            `;
        }).join('');
        grid.querySelectorAll('.reveal').forEach(el => {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
            obs.observe(el);
        });
    }
}

function renderPricing(pricing) {
    if (!pricing) return;
    const header = document.querySelector('#pricing .section-header');
    if (header) {
        const h2 = header.querySelector('h2');
        const sub = header.querySelector('.section-subtitle');
        if (h2 && pricing.sectionTitle) h2.textContent = pricing.sectionTitle;
        if (sub && pricing.sectionSubtitle) sub.textContent = pricing.sectionSubtitle;
    }
    const tbody = document.querySelector('.comparison-table tbody');
    if (tbody && pricing.comparisonRows) {
        tbody.innerHTML = pricing.comparisonRows.map(row => `
            <tr>
                <td data-label="功能 / 服務">${row.feature}</td>
                <td class="col-us" data-label="駿匯聯">${row.us}</td>
                <td data-label="Xtripe">${row.xtripe}</td>
                <td data-label="XayPal">${row.xaypal}</td>
            </tr>
        `).join('');
    }
    const resultLabel = document.querySelector('#calculatorResult .result-label');
    if (resultLabel && pricing.resultLabel) resultLabel.textContent = pricing.resultLabel;
    const note = document.getElementById('calculatorNote');
    if (note && pricing.calculatorNote) note.textContent = pricing.calculatorNote;
    const ctaBtn = document.getElementById('calculatorCta');
    if (ctaBtn && pricing.cta) ctaBtn.textContent = pricing.cta;
    const input = document.getElementById('revenueInput');
    if (input && pricing.resultPlaceholder) input.placeholder = pricing.resultPlaceholder;
}

function renderDownloadPromo(promo) {
    if (!promo) return;
    const img = document.querySelector('.download-art img');
    if (img) {
        if (promo.image) img.src = promo.image;
        if (promo.alt) img.alt = promo.alt;
    }
    const h3 = document.querySelector('.download-content h3');
    const p = document.querySelector('.download-content p');
    const btn = document.querySelector('.download-content .btn');
    if (h3 && promo.title) h3.textContent = promo.title;
    if (p && promo.subtitle) p.textContent = promo.subtitle;
    if (btn && promo.cta) btn.innerHTML = `<i class="ph ph-whatsapp-logo"></i> ${promo.cta}`;
}

function renderTrust(trust) {
    if (!trust) return;
    const header = document.querySelector('#trust .section-header');
    if (header) {
        const h2 = header.querySelector('h2');
        const sub = header.querySelector('.section-subtitle');
        if (h2 && trust.sectionTitle) h2.textContent = trust.sectionTitle;
        if (sub && trust.sectionSubtitle) sub.textContent = trust.sectionSubtitle;
    }
    const grid = document.querySelector('.trust-badges');
    if (grid && trust.badges) {
        grid.innerHTML = trust.badges.map(b => `
            <div class="badge-item">
                <i class="ph ${b.icon}"></i>
                <span>${b.text}</span>
            </div>
        `).join('');
    }
    const statsGrid = document.querySelector('.trust-stats');
    if (statsGrid && trust.stats) {
        statsGrid.innerHTML = trust.stats.map(s => `
            <div class="trust-stat">
                <div class="trust-stat-number" data-target="${s.value}" data-prefix="${escHtml(s.prefix || '')}" data-suffix="${escHtml(s.suffix || '')}">${s.prefix || ''}${s.value}${s.suffix || ''}</div>
                <div class="trust-stat-label">${s.label}</div>
            </div>
        `).join('');
        initCountUp(statsGrid);
    }
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function initCountUp(container) {
    if (!container) return;
    const nodes = container.querySelectorAll('.trust-stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                nodes.forEach(node => {
                    const target = parseFloat(node.dataset.target) || 0;
                    const prefix = node.dataset.prefix || '';
                    const suffix = node.dataset.suffix || '';
                    const decimals = (String(target).split('.')[1] || '').length;
                    const duration = 1500;
                    const startTime = performance.now();
                    function step(now) {
                        const p = Math.min((now - startTime) / duration, 1);
                        const ease = 1 - Math.pow(1 - p, 3);
                        const val = target * ease;
                        node.textContent = prefix + val.toFixed(decimals) + suffix;
                        if (p < 1) requestAnimationFrame(step);
                    }
                    requestAnimationFrame(step);
                });
                observer.disconnect();
            }
        });
    }, { threshold: 0.3 });
    observer.observe(container);
}

function renderTestimonials(testimonials) {
    if (!testimonials) return;
    const h2 = document.querySelector('#testimonials .section-header h2');
    if (h2 && testimonials.sectionTitle) h2.innerHTML = testimonials.sectionTitle;

    const container = document.getElementById('testimonialsCarousel');
    if (container && testimonials.items) {
        const track = container.querySelector('.tc-track');
        if (track) {
            track.innerHTML = testimonials.items.map((t, i) => `
                <div class="testimonial-card" data-index="${i}">
                    <div class="testimonial-stars">${'★'.repeat(t.stars || 5)}</div>
                    <p>「${t.text}」</p>
                    <div class="testimonial-author">
                        <strong>${t.author}</strong>
                        <span>${t.role}</span>
                    </div>
                </div>
            `).join('');
        }
        const dots = container.querySelector('.tc-dots');
        if (dots) {
            dots.innerHTML = testimonials.items.map((_, i) => `
                <button data-index="${i}" ${i === 0 ? 'class="active"' : ''} aria-label="Slide ${i + 1}"></button>
            `).join('');
        }
        initTestimonialsCarousel(testimonials.items.length);
    }
}

function initTestimonialsCarousel(itemCount) {
    const container = document.getElementById('testimonialsCarousel');
    if (!container || itemCount <= 0) return;
    const track = container.querySelector('.tc-track');
    if (!track) return;
    const dots = container.querySelectorAll('.tc-dots button');
    const prev = container.querySelector('.tc-prev');
    const next = container.querySelector('.tc-next');
    let current = 0;

    function slidesPerView() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 1100) return 2;
        return 3;
    }

    function maxIndex() {
        return Math.max(0, itemCount - slidesPerView());
    }

    function goTo(index) {
        current = Math.max(0, Math.min(index, maxIndex()));
        const card = track.querySelector('.testimonial-card');
        const gap = 24; // 1.5rem default; will be overridden by JS computed style if needed
        const cardWidth = card ? card.offsetWidth + 24 : (track.offsetWidth / slidesPerView());
        track.style.transform = `translateX(-${current * cardWidth}px)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    prev?.addEventListener('click', () => goTo(current - 1));
    next?.addEventListener('click', () => goTo(current + 1));
    dots.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.index))));
    window.addEventListener('resize', () => goTo(current));
    goTo(0);
}

function renderMarquee(items) {
    if (!items) return;
    const content = document.querySelector('.marquee-content');
    if (content && items) {
        const html = items.map(i => `<span><i class="ph ${i.icon}"></i> ${i.text}</span>`).join('');
        content.innerHTML = html + html; // duplicate for seamless loop
    }
}

function renderFAQ(faq) {
    if (!faq) return;
    const h2 = document.querySelector('#faq .section-header h2');
    if (h2 && faq.sectionTitle) h2.textContent = faq.sectionTitle;

    // Update FAQPage schema
    const faqSchema = document.getElementById('faqSchema');
    if (faqSchema && faq.items) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faq.items.map(item => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer
                }
            }))
        };
        faqSchema.textContent = JSON.stringify(schema, null, 2);
    }

    const list = document.querySelector('.faq-list');
    if (list && faq.items) {
        list.innerHTML = faq.items.map((item, i) => {
            const cta1 = item.ctaText
                ? `<p style="margin-top:0.75rem;"><a href="${buildWhatsAppUrl(item.ctaText)}" class="text-accent wa-cta" style="font-weight:600;" target="_blank">${item.ctaText}</a></p>`
                : '';
            const cta2 = item.ctaText2
                ? `<p style="margin-top:0.5rem;"><a href="${item.ctaLink2 || '#contact'}" class="text-accent" style="font-weight:600;" target="_blank">${item.ctaText2}</a></p>`
                : '';
            return `
                <div class="faq-item">
                    <button class="faq-question">
                        <span>${item.question}</span>
                        <i class="ph ph-caret-down faq-icon"></i>
                    </button>
                    <div class="faq-answer">
                        <div class="faq-answer-inner">
                            <p>${item.answer}</p>
                            ${cta1}${cta2}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        // Re-bind FAQ click
        list.querySelectorAll('.faq-item').forEach(item => {
            const question = item.querySelector('.faq-question');
            question?.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
                if (!isOpen) item.classList.add('open');
            });
        });
        bindModalTriggers();
    }
}

function renderCTA(cta) {
    if (!cta) return;
    const art = document.querySelector('.cta-art');
    const img = art?.querySelector('img');
    if (img) {
        if (cta.image) img.src = cta.image;
        if (cta.alt) img.alt = cta.alt;
    }
    if (art) {
        art.classList.toggle('img-backdrop', !!cta.backdrop);
    }
    const h2 = document.querySelector('.cta h2');
    const sub = document.querySelector('.cta-subtitle');
    if (h2 && cta.title) h2.textContent = cta.title;
    if (sub && cta.subtitle) sub.textContent = cta.subtitle;

    const benefits = document.querySelector('.cta-benefits');
    if (benefits && cta.benefits) {
        benefits.innerHTML = cta.benefits.map(b => `<li><i class="ph ph-check-circle"></i> ${b}</li>`).join('');
    }

    const btnPrimary = document.querySelector('.cta-buttons .btn-accent');
    const btnSecondary = document.querySelector('.cta-buttons .btn-outline');
    if (btnPrimary && cta.ctaPrimary) btnPrimary.textContent = cta.ctaPrimary;
    if (btnSecondary && cta.ctaSecondary) btnSecondary.textContent = cta.ctaSecondary;

    const note = document.querySelector('.cta-note');
    if (note && cta.note) note.innerHTML = cta.note;
}

function renderFooter(footer) {
    if (!footer) return;
    const brandP = document.querySelector('.footer-brand p');
    if (brandP && footer.brandText) brandP.innerHTML = footer.brandText;

    const grid = document.querySelector('.footer-grid');
    if (grid && footer.columns) {
        const brand = grid.querySelector('.footer-brand');
        grid.innerHTML = '';
        if (brand) grid.appendChild(brand);
        footer.columns.forEach(col => {
            const div = document.createElement('div');
            div.className = 'footer-col';
            let linksHtml = '';
            if (col.links) {
                linksHtml = '<ul>' + col.links.map(l => {
                    const isExternal = l.href && l.href.startsWith('http');
                    const href = isExternal ? l.href : buildWhatsAppUrl(l.text);
                    const target = 'target="_blank"';
                    const cls = isExternal ? '' : 'wa-cta';
                    return `<li><a href="${href}" ${target} class="${cls}">${l.text}</a></li>`;
                }).join('') + '</ul>';
            }
            if (col.contactLines) {
                linksHtml = '<ul>' + col.contactLines.map(c => {
                    let inner = c.text;
                    if (c.icon === 'ph-phone') {
                        inner = `<a href="tel:${c.text.replace(/\s/g,'')}">${c.text}</a>`;
                    } else if (c.icon === 'ph-whatsapp-logo') {
                        const waNumber = c.text.replace(/\s/g, '').replace(/^\+/, '');
                        const fullWa = waNumber.startsWith('852') ? waNumber : '852' + waNumber;
                        inner = `<a href="https://wa.me/${fullWa}" target="_blank">${c.text}</a>`;
                    } else if (c.icon === 'ph-envelope') {
                        inner = `<a href="mailto:${c.text}">${c.text}</a>`;
                    } else if (c.icon === 'ph-map-pin') {
                        inner = `<a href="https://maps.google.com/?q=${encodeURIComponent(c.text)}" target="_blank">${c.text}</a>`;
                    }
                    return `<li><i class="ph ${c.icon}"></i> ${inner}</li>`;
                }).join('') + '</ul>';
            }
            div.innerHTML = `<h4>${col.title}</h4>` + linksHtml;
            grid.appendChild(div);
        });
        bindModalTriggers();
    }

    const copyright = document.querySelector('.footer-bottom');
    if (copyright && footer.copyright) {
        const left = copyright.querySelector('p:first-child');
        if (left) left.textContent = footer.copyright;
    }

    const powered = document.querySelector('.footer-bottom .powered-by');
    if (powered && footer.poweredBy) {
        powered.innerHTML = footer.poweredBy;
    }
}

/* ========================================
   Pricing Calculator
   ======================================== */
function initPricingCalculator() {
    const input = document.getElementById('revenueInput');
    const slider = document.getElementById('revenueSlider');
    const resultAmount = document.getElementById('resultAmount');
    const bar = document.querySelector('.calculator-bar');
    const barUs = document.getElementById('barUs');
    const barXtripe = document.getElementById('barXtripe');
    if (!input || !slider || !resultAmount) return;

    function formatMoney(n) {
        return '$' + Math.round(n).toLocaleString('zh-HK');
    }

    function update(val) {
        const v = Math.max(0, Number(val) || 0);
        input.value = v || '';
        slider.value = v;
        if (!v) {
            resultAmount.textContent = input.placeholder || '輸入交易額即可查看驚人差距';
            if (bar) bar.classList.remove('visible');
            return;
        }
        // Conservative calculation: pure rate difference only (Stripe 3.4% vs us 2.6%)
        const usFee = v * 0.026;
        const xtripeFee = v * 0.034;
        const yearlySavings = (xtripeFee - usFee) * 12;
        resultAmount.textContent = formatMoney(yearlySavings);
        resultAmount.classList.remove('pop');
        void resultAmount.offsetWidth; // force reflow
        resultAmount.classList.add('pop');
        setTimeout(() => resultAmount.classList.remove('pop'), 300);
        if (bar && barUs && barXtripe) {
            bar.classList.add('visible');
            const usPct = (0.026 / 0.034) * 100;
            barUs.style.width = usPct + '%';
            barXtripe.style.width = (100 - usPct) + '%';
        }
    }

    input.addEventListener('input', () => update(input.value));
    slider.addEventListener('input', () => update(slider.value));
}

/* ========================================
   WhatsApp CTA Helpers
   ======================================== */
function showToast(message, type = 'success') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon"></span><span class="toast-message"></span>`;
        document.body.appendChild(toast);
    }
    toast.className = 'toast ' + type;
    toast.querySelector('.toast-icon').textContent = type === 'success' ? '✓' : '✕';
    toast.querySelector('.toast-message').textContent = message;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 3200);
}

function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 8;
}

/* ========================================
   Calculator
   ======================================== */
/* ========================================
   Analytics Tracking
   ======================================== */
function trackPageView() {
    const payload = JSON.stringify({
        page: location.pathname + location.search,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        sessionId: getSessionId()
    });
    sendAnalytics('/api/analytics/pageview', payload);
}

function trackEvent(type, data) {
    try {
        if (typeof gtag === 'function') {
            if (type === 'whatsapp_click') gtag('event', 'whatsapp_click', { event_category: 'engagement', event_label: data.label });
        }
        if (typeof fbq === 'function') {
            if (type === 'whatsapp_click') fbq('track', 'Lead');
        }
    } catch (e) {}
    const payload = JSON.stringify({
        type: type === 'whatsapp_click' ? 'whatsapp_click' : 'click',
        element: data.label || type,
        page: location.pathname,
        value: data.label || '',
        sessionId: getSessionId()
    });
    sendAnalytics('/api/analytics/interaction', payload);
}

function sendAnalytics(endpoint, payload) {
    const url = API_BASE_URL + endpoint;
    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const ok = navigator.sendBeacon(url, blob);
            if (ok) return;
        }
    } catch (e) {}
    try {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch((err) => { console.error('[Analytics]', err); });
    } catch (e) {
        console.error('[Analytics]', e);
    }
}

function getSessionId() {
    let sid = sessionStorage.getItem('cwmng_session_id');
    if (!sid) {
        sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('cwmng_session_id', sid);
    }
    return sid;
}
