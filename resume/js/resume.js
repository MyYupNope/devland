/**
 * ResumeApp Class
 * Handles interactive experiences on Rodrigo Matias' Resume / Portfolio tab.
 */
export class ResumeApp {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrameId = null;
    this.isActive = false;
    this.isHeroCanvasVisible = true;
    this.heroCanvasObserver = null;
    
    // Typing animation state
    this.roles = [
      "IT Business Partner",
      "Digital Transformation Lead",
      "Service Delivery Manager",
      "Generative AI & Process Automation Lead",
      "Project Manager",
      "Innovation Catalyst"
    ];
    this.currentRoleIndex = 0;
    this.currentCharIndex = 0;
    this.isDeleting = false;
    this.typingTimeout = null;
    this.typingTarget = null;
    
    // Observers
    this.observers = [];
    
    // Bind resize
    this.handleResize = this._onResize.bind(this);
  }

  /**
   * Called by app.js when the Resume tab is clicked and displayed
   */
  onTabActivated() {
    if (this.isActive) return;
    this.isActive = true;
    
    this._initDomReferences();
    this._initScrollObservers();
    this._initHamburgerMenu();
    this._initHeroCanvas();
    this._initTypingAnimation();
    this._initPillarCards();
    this._initTimeline();
    this._initSkillsConstellation();
    this._initCursorGlow();
    this._initCertItems();
    
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Cleanup method to stop loops and event listeners when tab changes (optional)
   */
  deactivate() {
    this.isActive = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this.heroCanvasObserver) {
      this.heroCanvasObserver.disconnect();
      this.heroCanvasObserver = null;
    }
    
    if (this.handleNavScroll) {
      window.removeEventListener('scroll', this.handleNavScroll);
    }
    window.removeEventListener('resize', this.handleResize);
    
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
  }

  _initDomReferences() {
    this.typingTarget = document.getElementById('resumeTypingTarget');
    this.canvas = document.getElementById('resumeHeroCanvas');
  }

  /* --------------------------------------------------------------------------
     HERO BACKGROUND: CANVAS PARTICLE NETWORK
     -------------------------------------------------------------------------- */
  _initHeroCanvas() {
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this._onResize(true);
    this.particles = this._createParticles(this.canvas);

    // Pause animation when hero canvas is out of viewport to save CPU/battery
    if ('IntersectionObserver' in window) {
      this.heroCanvasObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isHeroCanvasVisible = entry.isIntersecting;
          if (this.isHeroCanvasVisible) {
            if (!this.animationFrameId) {
              this._animateCanvas();
            }
          } else {
            if (this.animationFrameId) {
              cancelAnimationFrame(this.animationFrameId);
              this.animationFrameId = null;
            }
          }
        });
      }, { threshold: 0.05 });

      this.heroCanvasObserver.observe(this.canvas);
      this.observers.push(this.heroCanvasObserver);
    }

    this._animateCanvas();
  }

  _createParticles(canvas) {
    const particles = [];
    const particleCount = window.innerWidth < 768 ? 40 : 80;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1
      });
    }
    return particles;
  }

  _onResize(immediate = false) {
    if (this._resizeTimeout) {
      clearTimeout(this._resizeTimeout);
    }
    const doResize = () => {
      const dpr = window.devicePixelRatio || 1;
      if (this.canvas) {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth * dpr;
        this.canvas.height = parent.clientHeight * dpr;
        if (this.ctx) {
          this.ctx.resetTransform();
          this.ctx.scale(dpr, dpr);
        }
      }
    };
    if (immediate) {
      doResize();
    } else {
      this._resizeTimeout = setTimeout(doResize, 150);
    }
  }

  _getColorRgb(cssVar) {
    if (typeof document === 'undefined') return { r: 176, g: 142, b: 114 };
    try {
      const el = document.querySelector('.resume-section');
      if (el) {
        const styles = getComputedStyle(el);
        let color = styles.getPropertyValue(cssVar).trim();
        if (color.startsWith('#')) {
          let hex = color.substring(1);
          if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          }
          return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
          };
        }
        if (color.startsWith('rgb')) {
          const matches = color.match(/\d+/g);
          if (matches && matches.length >= 3) {
            return { r: parseInt(matches[0]), g: parseInt(matches[1]), b: parseInt(matches[2]) };
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse dynamic color:", e);
    }
    return { r: 176, g: 142, b: 114 }; // Default fallback (warm bronze)
  }

  _animateCanvas() {
    if (!this.isActive || !this.isHeroCanvasVisible) return;
    
    if (this.canvas && this.ctx && this.particles.length > 0) {
      this._updateAndDrawCanvas(this.canvas, this.ctx, this.particles);
    }
    
    this.animationFrameId = requestAnimationFrame(() => this._animateCanvas());
  }

  _updateAndDrawCanvas(canvas, ctx, particles) {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);
    
    const themeClass = document.documentElement.className;
    if (this._lastThemeClass !== themeClass || !this._cachedColor) {
      this._lastThemeClass = themeClass;
      this._cachedColor = this._getColorRgb('--rm-canvas-accent');
    }
    const color = this._cachedColor;
    
    // Update and draw particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Boundaries bounce
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      
      // Draw particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`;
      ctx.fill();
    });
    
    // Draw lines between nearby particles
    const maxDistance = 140;
    const maxDistanceSq = maxDistance * maxDistance;
    
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < maxDistanceSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDistance) * 0.18;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  /* --------------------------------------------------------------------------
     HERO: TYPING ANIMATION
     -------------------------------------------------------------------------- */
  _initTypingAnimation() {
    if (!this.typingTarget) return;
    this.currentCharIndex = 0;
    this.currentRoleIndex = 0;
    this.isDeleting = false;
    this._typeCycle();
  }

  _typeCycle() {
    if (!this.isActive) return;
    const currentRole = this.roles[this.currentRoleIndex];
    
    if (this.isDeleting) {
      this.currentCharIndex--;
    } else {
      this.currentCharIndex++;
    }
    
    this.typingTarget.textContent = currentRole.substring(0, this.currentCharIndex);
    
    let typeSpeed = this.isDeleting ? 30 : 60;
    
    if (!this.isDeleting && this.currentCharIndex === currentRole.length) {
      // Pause at full word typed
      typeSpeed = 2000;
      this.isDeleting = true;
    } else if (this.isDeleting && this.currentCharIndex === 0) {
      this.isDeleting = false;
      this.currentRoleIndex = (this.currentRoleIndex + 1) % this.roles.length;
      // Brief pause before typing next word
      typeSpeed = 400;
    }
    
    this.typingTimeout = setTimeout(() => this._typeCycle(), typeSpeed);
  }

  /* --------------------------------------------------------------------------
     SCROLL OBSERVERS & METRIC COUNTERS
     -------------------------------------------------------------------------- */
  _initScrollObservers() {
    // 1. Entrance Animations Observer
    const animateElements = document.querySelectorAll('.resume-animate, .resume-stagger');
    const entranceObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('resume-visible');
          entranceObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    
    animateElements.forEach(el => {
      entranceObserver.observe(el);
      this.observers.push(entranceObserver);
    });
    
    // 2. Metric Cards Count-Up Observer
    const metricsGrid = document.querySelector('.resume-metrics-grid');
    if (metricsGrid) {
      this._metricsAnimated = false;
      const countersObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (!this._metricsAnimated) {
              this._startMetricCounters();
              this._metricsAnimated = true;
            }
          } else {
            // Reset state when it exits viewport so it can animate again when entering
            this._metricsAnimated = false;
          }
        });
      }, { threshold: 0.15 });
      
      countersObserver.observe(metricsGrid);
      this.observers.push(countersObserver);
    }
  }

  _startMetricCounters() {
    const yearsEl = document.getElementById('metricYears');
    const regionsEl = document.getElementById('metricRegions');
    const solutionsEl = document.getElementById('metricSolutions');
    const certsEl = document.getElementById('metricCerts');
    
    if (yearsEl) this._countUp(yearsEl, 0, 20, 1500);
    if (regionsEl) this._countUp(regionsEl, 1, 4, 1200);
    if (solutionsEl) this._countUp(solutionsEl, 0, 50, 1800);
    if (certsEl) this._countUp(certsEl, 0, 11, 1000);
  }

  _countUp(element, start, end, duration) {
    if (element._animId) {
      cancelAnimationFrame(element._animId);
    }
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = progress;
      const val = Math.floor(ease * (end - start) + start);
      element.textContent = val;
      if (progress < 1) {
        element._animId = requestAnimationFrame(step);
      } else {
        element.textContent = end;
        element._animId = null;
      }
    };
    element._animId = requestAnimationFrame(step);
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE: STRATEGIC PILLARS ACCORDION
     -------------------------------------------------------------------------- */
  _initPillarCards() {
    const cards = document.querySelectorAll('.resume-pillar-card');
    cards.forEach(card => {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', 'false');

      const toggleCard = (e) => {
        if (e.target.closest('a') || (e.target.closest('button') && !e.target.closest('.resume-pillar-card'))) return;
        
        const isExpanded = card.classList.contains('expanded');
        
        // Collapse all others
        cards.forEach(c => {
          c.classList.remove('expanded');
          c.setAttribute('aria-expanded', 'false');
        });
        
        // Toggle current card
        if (!isExpanded) {
          card.classList.add('expanded');
          card.setAttribute('aria-expanded', 'true');
        }
      };

      card.addEventListener('click', toggleCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard(e);
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE: CAREER TIMELINE NODES
     -------------------------------------------------------------------------- */
  _initTimeline() {
    const nodes = document.querySelectorAll('.resume-timeline-node-item');
    
    // Add Click & Keydown listener to node dot to change active detail
    nodes.forEach(node => {
      const dot = node.querySelector('.resume-timeline-node-dot');
      if (dot) {
        dot.setAttribute('tabindex', '0');
        dot.setAttribute('role', 'button');
        const roleTitle = node.querySelector('.resume-timeline-node-title')?.textContent || 'role';
        dot.setAttribute('aria-label', `View experience details for ${roleTitle}`);

        const selectNode = () => {
          const index = node.getAttribute('data-index');
          this._switchTimelineNode(index);
        };

        dot.addEventListener('click', selectNode);
        dot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectNode();
          }
        });
      }
    });

    // Horizontal Scroll Buttons (Desktop only)
    const btnLeft = document.getElementById('timelineScrollLeft');
    const btnRight = document.getElementById('timelineScrollRight');
    const container = document.querySelector('.resume-timeline-outer');
    
    if (btnLeft && container) {
      btnLeft.addEventListener('click', () => {
        container.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }
    if (btnRight && container) {
      btnRight.addEventListener('click', () => {
        container.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }
    
    // Initially activate first node
    this._switchTimelineNode("0");
  }

  _switchTimelineNode(index) {
    const nodes = document.querySelectorAll('.resume-timeline-node-item');
    const detailCards = document.querySelectorAll('.resume-timeline-detail-card');
    
    nodes.forEach(node => {
      if (node.getAttribute('data-index') === index) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });
    
    detailCards.forEach(card => {
      if (card.getAttribute('data-index') === index) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE: BENTO GRID OF SKILLS & WIDGETS
     -------------------------------------------------------------------------- */
  _initSkillsConstellation() {
    const bentoCards = document.querySelectorAll('.bento-card');
    bentoCards.forEach(card => {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');

      const selectBento = (e) => {
        if (e.target.closest('a') || e.target.closest('button')) return;
        const isSelected = card.classList.contains('selected');
        bentoCards.forEach(c => c.classList.remove('selected'));
        if (!isSelected) {
          card.classList.add('selected');
        }
      };

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });

      card.addEventListener('click', selectBento);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectBento(e);
        }
      });
    });

    const bentoTags = document.querySelectorAll('.bento-tag');
    bentoTags.forEach((tag, idx) => {
      tag.style.opacity = '0';
      tag.style.transform = 'translateY(10px)';
      tag.style.transition = `opacity 0.4s ease ${idx * 0.03}s, transform 0.4s ease ${idx * 0.03}s`;
    });

    const bentoGrid = document.querySelector('.bento-skills-grid');
    if (bentoGrid) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            bentoTags.forEach(tag => {
              tag.style.opacity = '1';
              tag.style.transform = 'translateY(0)';
            });
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(bentoGrid);
      this.observers.push(observer);
    }
  }

  _initCursorGlow() {
    const cards = document.querySelectorAll('.resume-card, .theme-toggle-btn');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    });

    this._initStickyNav();
  }

  _initStickyNav() {
    const siteNav = document.getElementById('siteNav');
    if (!siteNav) return;

    this.handleNavScroll = () => {
      if (window.scrollY > 80) {
        siteNav.classList.add('scrolled');
      } else {
        siteNav.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', this.handleNavScroll, { passive: true });
    this.handleNavScroll();

    const sections = document.querySelectorAll('section.resume-container, header.resume-hero');
    if ('IntersectionObserver' in window && sections.length > 0) {
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            let activeId = entry.target.getAttribute('id');
            if (activeId === 'pillars') activeId = 'metrics';
            this._setActiveNavLink(activeId);
          }
        });
      }, {
        rootMargin: '-15% 0px -65% 0px',
        threshold: 0.1
      });

      sections.forEach(sec => sectionObserver.observe(sec));
      this.observers.push(sectionObserver);
    }

    const links = siteNav.querySelectorAll('.nav-links a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            const navHeight = siteNav.offsetHeight || 60;
            const targetPosition = targetEl.offsetTop - navHeight + 2;
            if (targetId === '#metrics') {
              this._metricsAnimated = false;
              this._startMetricCounters();
              this._metricsAnimated = true;
            }
            
            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
          }
        }
      });
    });
  }

  _setActiveNavLink(activeId) {
    const siteNav = document.getElementById('siteNav');
    if (!siteNav) return;

    const links = siteNav.querySelectorAll('.nav-links a');
    if (!activeId) activeId = 'about';

    links.forEach(link => {
      const href = link.getAttribute('href').substring(1);
      if (href === activeId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const navBrand = document.getElementById('navBrand');
    if (navBrand) {
      if (activeId === 'about') {
        navBrand.classList.add('hidden');
      } else {
        navBrand.classList.remove('hidden');
      }
    }
  }

  _initCertItems() {
    const certItems = document.querySelectorAll('.resume-edu-cert-item');
    certItems.forEach(item => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.style.cursor = 'pointer';

      const toggleCert = () => {
        const isActive = item.classList.contains('active');
        certItems.forEach(c => c.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      };

      item.addEventListener('click', toggleCert);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCert();
        }
      });
    });
  }

  _initHamburgerMenu() {
    const navHamburger = document.getElementById('navHamburger');
    const navLinks = document.querySelector('.nav-links');
    if (!navHamburger || !navLinks) return;

    const closeMenu = () => {
      navHamburger.setAttribute('aria-expanded', 'false');
      navHamburger.classList.remove('active');
      navLinks.classList.remove('active');
      document.body.classList.remove('nav-open');
    };

    // Toggle menu state on click
    navHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = navHamburger.getAttribute('aria-expanded') === 'true';
      const nextState = !isExpanded;
      navHamburger.setAttribute('aria-expanded', nextState);
      navHamburger.classList.toggle('active', nextState);
      navLinks.classList.toggle('active', nextState);
      document.body.classList.toggle('nav-open', nextState);
    });

    // Close menu when clicking on any link
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close menu when clicking outside of the navigation bar
    document.addEventListener('click', (e) => {
      if (!navHamburger.contains(e.target) && !navLinks.contains(e.target)) {
        closeMenu();
      }
    });
  }
}

// Auto-instantiate and attach to window
export const resumeApp = new ResumeApp();
window._resumeApp = resumeApp;

// Auto-run when DOM is fully loaded in standalone mode
document.addEventListener('DOMContentLoaded', () => {
  resumeApp.onTabActivated();

  // Floating Theme Toggle Logic
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('theme-dark');
      if (isDark) {
        document.documentElement.classList.remove('theme-dark');
        document.documentElement.classList.add('theme-light');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('theme-dark');
        localStorage.setItem('theme', 'dark');
      }
      
      // Update canvas particle color dynamic cache
      resumeApp._cachedColor = null; // Forces re-evaluation of dynamic colors next frame
    });
  }
});
