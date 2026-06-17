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
    this._initHeroCanvas();
    this._initTypingAnimation();
    this._initPillarCards();
    this._initTimeline();
    this._initSkillsConstellation();
    
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Cleanup method to stop loops and event listeners when tab changes (optional)
   */
  deactivate() {
    this.isActive = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
  }

  _initDomReferences() {
    this.typingTarget = document.getElementById('resumeTypingTarget');
    this.canvas = document.getElementById('resumeHeroCanvas');
    this.bottomCanvas = document.getElementById('resumeBottomCanvas');
  }

  /* --------------------------------------------------------------------------
     HERO BACKGROUND: CANVAS PARTICLE NETWORK
     -------------------------------------------------------------------------- */
  _initHeroCanvas() {
    this._onResize();
    
    // Hero Canvas
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.particles = this._createParticles(this.canvas);
    }
    
    // Bottom Canvas
    if (this.bottomCanvas) {
      this.bottomCtx = this.bottomCanvas.getContext('2d');
      this.bottomParticles = this._createParticles(this.bottomCanvas);
    }
    
    this._animateCanvas();
  }

  _createParticles(canvas) {
    const particles = [];
    const particleCount = window.innerWidth < 768 ? 50 : 110;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1
      });
    }
    return particles;
  }

  _onResize() {
    if (this.canvas) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    }
    if (this.bottomCanvas) {
      this.bottomCanvas.width = this.bottomCanvas.parentElement.clientWidth;
      this.bottomCanvas.height = this.bottomCanvas.parentElement.clientHeight;
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
    if (!this.isActive) return;
    
    // Animate Hero Canvas
    if (this.canvas && this.ctx && this.particles.length > 0) {
      this._updateAndDrawCanvas(this.canvas, this.ctx, this.particles);
    }
    
    // Animate Bottom Canvas
    if (this.bottomCanvas && this.bottomCtx && this.bottomParticles.length > 0) {
      this._updateAndDrawCanvas(this.bottomCanvas, this.bottomCtx, this.bottomParticles);
    }
    
    this.animationFrameId = requestAnimationFrame(() => this._animateCanvas());
  }

  _updateAndDrawCanvas(canvas, ctx, particles) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const maxDistance = 140;
    const color = this._getColorRgb('--rm-accent-teal');
    
    // Update and draw particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Boundaries bounce
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      
      // Draw particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`;
      ctx.fill();
    });
    
    // Draw lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < maxDistance) {
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
      const countersObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this._startMetricCounters();
            countersObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      
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
    if (regionsEl) this._countUp(regionsEl, 0, 4, 1200);
    if (solutionsEl) this._countUp(solutionsEl, 0, 50, 1800);
    if (certsEl) this._countUp(certsEl, 0, 11, 1000);
  }

  _countUp(element, start, end, duration) {
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Easing function easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.floor(ease * (end - start) + start);
      element.textContent = val;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = end;
      }
    };
    requestAnimationFrame(step);
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE: STRATEGIC PILLARS ACCORDION
     -------------------------------------------------------------------------- */
  _initPillarCards() {
    const cards = document.querySelectorAll('.resume-pillar-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent action if clicking inside already active buttons/links inside extra section (if any)
        if (e.target.closest('a') || e.target.closest('button') && !e.target.closest('.resume-pillar-card')) return;
        
        const isExpanded = card.classList.contains('expanded');
        
        // Collapse all others
        cards.forEach(c => c.classList.remove('expanded'));
        
        // Toggle current card
        if (!isExpanded) {
          card.classList.add('expanded');
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE: CAREER TIMELINE NODES
     -------------------------------------------------------------------------- */
  _initTimeline() {
    const nodes = document.querySelectorAll('.resume-timeline-node-item');
    const detailCards = document.querySelectorAll('.resume-timeline-detail-card');
    
    // Add Click listener to node dot to change active detail
    nodes.forEach(node => {
      const dot = node.querySelector('.resume-timeline-node-dot');
      if (dot) {
        dot.addEventListener('click', () => {
          const index = node.getAttribute('data-index');
          this._switchTimelineNode(index);
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
     INTERACTIVE: SKILLS ORBITAL GRAPH
     -------------------------------------------------------------------------- */
  _initSkillsConstellation() {
    const nodes = document.querySelectorAll('.resume-skill-node');
    const rings = document.querySelectorAll('.resume-skills-ring');
    
    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => {
        const related = node.getAttribute('data-related');
        if (!related) return;
        
        const relatedArray = related.split(',');
        
        nodes.forEach(otherNode => {
          const otherId = otherNode.getAttribute('data-id');
          if (otherId === node.getAttribute('data-id') || relatedArray.includes(otherId)) {
            otherNode.classList.add('highlighted');
          }
        });
      });
      
      node.addEventListener('mouseleave', () => {
        nodes.forEach(otherNode => otherNode.classList.remove('highlighted'));
      });
    });
    
    // Rings highlight nodes inside them
    rings.forEach((ring, index) => {
      const ringNum = index + 1;
      let selector = '';
      if (ringNum === 1) selector = '.skill-t1, .skill-t2, .skill-t3, .skill-t4';
      if (ringNum === 2) selector = '.skill-p1, .skill-p2, .skill-p3, .skill-p4, .skill-p5';
      if (ringNum === 3) selector = '.skill-d1, .skill-d2, .skill-d3, .skill-d4, .skill-d5';
      if (ringNum === 4) selector = '.skill-a1, .skill-a2, .skill-a3, .skill-a4, .skill-a5';
      
      ring.addEventListener('mouseenter', () => {
        document.querySelectorAll(selector).forEach(node => {
          node.classList.add('highlighted');
        });
      });
      
      ring.addEventListener('mouseleave', () => {
        document.querySelectorAll(selector).forEach(node => {
          node.classList.remove('highlighted');
        });
      });
    });
  }
}

// Auto-instantiate and attach to window
const resumeApp = new ResumeApp();
window._resumeApp = resumeApp;
