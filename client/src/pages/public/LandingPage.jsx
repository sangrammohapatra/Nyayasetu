/**
 * NyayaSetu Public Landing Page
 * Full-page marketing site — no auth required.
 */

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  motion, AnimatePresence, useReducedMotion,
  useScroll, useTransform, useSpring, useInView,
} from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import Collapse from '@mui/material/Collapse';

import {
  selectIsAuthenticated, selectUserPersona,
} from '../../store/slices/authSlice';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';

// ─── Design tokens for dark landing sections ───────────────────────────────────
const DARK = {
  bg:           '#080E1D',
  bg2:          '#0D1530',
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.18)',
  text:         '#F0F4FF',
  textSub:      'rgba(240,244,255,0.62)',
  primary:      '#4A9BFF',
  primaryGlow:  'rgba(74,155,255,0.25)',
  accent:       '#FF7043',
  glass:        'rgba(255,255,255,0.05)',
  glassBorder:  'rgba(255,255,255,0.1)',
};

// ─── Particle Canvas Hook ─────────────────────────────────────────────────────

function useParticles(canvasRef, count = 60) {
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const particles = Array.from({ length: count }, () => ({
      x:     Math.random(),
      y:     Math.random(),
      vx:    (Math.random() - 0.5) * 0.0003,
      vy:    (Math.random() - 0.5) * 0.0003,
      r:     Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.35 + 0.08,
    }));

    let raf;
    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // draw connecting lines
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach((q) => {
          const dx = (p.x - q.x) * width;
          const dy = (p.y - q.y) * height;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x * width, p.y * height);
            ctx.lineTo(q.x * width, q.y * height);
            ctx.strokeStyle = `rgba(74,155,255,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(74,155,255,${p.alpha})`;
        ctx.fill();

        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [canvasRef, count, prefersReducedMotion]);
}

// ─── Scroll reveal wrapper ────────────────────────────────────────────────────

function Reveal({ children, delay = 0, y = 32 }) {
  const ref  = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px 0px' });
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? {} : { opacity: 0, y }}
      animate={inView || prefersReducedMotion ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function Counter({ target, suffix = '' }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = null;
    const dur  = 1600;
    const step = (ts) => {
      if (!start) start = ts;
      const pct = Math.min((ts - start) / dur, 1);
      setVal(Math.round(pct * pct * target));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target]);
  return (
    <span ref={ref}>{val.toLocaleString('en-IN')}{suffix}</span>
  );
}

// ─── 1. Landing Navbar ────────────────────────────────────────────────────────

function LandingNavbar({ onScrollTo }) {
  const navigate       = useNavigate();
  const isAuth         = useSelector(selectIsAuthenticated);
  const persona        = useSelector(selectUserPersona);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const dashboardPath = persona === 'admin'
    ? '/admin/dashboard'
    : `/${persona || 'citizen'}/home`;

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        px: { xs: 2, md: 6 }, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(8,14,29,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? `1px solid ${DARK.border}` : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Logo */}
      <Box
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
      >
        <Box
          sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #1565C0, #4A9BFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 12px rgba(74,155,255,0.4)',
          }}
        >
          ⚖️
        </Box>
        <Typography sx={{
          fontFamily: TYPOGRAPHY.fontFamily.display,
          fontWeight: 700, fontSize: '1.2rem', color: '#fff',
          letterSpacing: '-0.01em',
        }}>
          NyayaSetu
        </Typography>
      </Box>

      {/* Nav links — desktop only */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, alignItems: 'center' }}>
        {[
          ['Features', 'features'],
          ['How it Works', 'how'],
          ['Legal Helpline', 'helpline'],
          ['Pricing', 'pricing'],
        ].map(([label, id]) => (
          <Box
            key={id}
            onClick={() => onScrollTo(id)}
            sx={{
              fontSize: '0.875rem', color: DARK.textSub, cursor: 'pointer',
              fontWeight: 500, transition: 'color 0.2s',
              '&:hover': { color: '#fff' },
            }}
          >
            {label}
          </Box>
        ))}
      </Box>

      {/* CTAs */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        {isAuth ? (
          <Button
            onClick={() => navigate(dashboardPath)}
            sx={{
              px: 2.5, py: 0.75, borderRadius: '100px',
              background: 'linear-gradient(135deg, #1565C0, #4A9BFF)',
              color: '#fff', fontWeight: 700, fontSize: '0.85rem',
              textTransform: 'none', boxShadow: '0 4px 12px rgba(74,155,255,0.35)',
            }}
          >
            Go to Dashboard →
          </Button>
        ) : (
          <>
            <Button
              onClick={() => navigate('/login')}
              sx={{
                px: 2, py: 0.75, borderRadius: '100px',
                color: DARK.textSub, fontWeight: 500, fontSize: '0.85rem',
                textTransform: 'none', border: `1px solid ${DARK.border}`,
                '&:hover': { color: '#fff', borderColor: DARK.borderStrong },
              }}
            >
              Login
            </Button>
            <Button
              onClick={() => navigate('/register')}
              sx={{
                px: 2.5, py: 0.75, borderRadius: '100px',
                background: 'linear-gradient(135deg, #1565C0, #4A9BFF)',
                color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                textTransform: 'none', boxShadow: '0 4px 12px rgba(74,155,255,0.35)',
              }}
            >
              Get Started Free
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

// ─── 2. Hero Section ──────────────────────────────────────────────────────────

const FLOATING_ICONS = [
  { icon: '⚖️', x: '8%',  y: '20%', size: 40, dur: 6 },
  { icon: '📜', x: '88%', y: '15%', size: 34, dur: 8 },
  { icon: '🏛️', x: '5%',  y: '70%', size: 38, dur: 7 },
  { icon: '📋', x: '90%', y: '65%', size: 30, dur: 9 },
  { icon: '🔏', x: '78%', y: '40%', size: 28, dur: 5 },
  { icon: '💼', x: '18%', y: '85%', size: 32, dur: 10 },
  { icon: '🏠', x: '82%', y: '82%', size: 26, dur: 7 },
  { icon: '👨‍⚖️', x: '12%', y: '45%', size: 36, dur: 8 },
];

function HeroSection({ onScrollTo }) {
  const navigate  = useNavigate();
  const canvasRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  useParticles(canvasRef, 55);

  return (
    <Box
      id="hero"
      sx={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(ellipse at 60% 30%, rgba(21,101,192,0.35) 0%, transparent 60%),
                     radial-gradient(ellipse at 20% 80%, rgba(74,155,255,0.15) 0%, transparent 50%),
                     linear-gradient(160deg, #080E1D 0%, #0D1530 60%, #080E1D 100%)`,
        overflow: 'hidden', px: { xs: 2, md: 4 }, pt: 10, pb: 6,
        textAlign: 'center',
      }}
    >
      {/* Particle canvas */}
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Floating icons */}
      {!prefersReducedMotion && FLOATING_ICONS.map((f, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
          style={{
            position: 'absolute', left: f.x, top: f.y,
            fontSize: f.size, opacity: 0.15, pointerEvents: 'none',
            filter: 'blur(0.5px)',
          }}
        >
          {f.icon}
        </motion.div>
      ))}

      {/* Trust pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Box
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1,
            mb: 3, px: 2, py: 0.6, borderRadius: '100px',
            background: 'rgba(74,155,255,0.1)',
            border: '1px solid rgba(74,155,255,0.3)',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9BFF',
            animation: 'blink 1.5s ease-in-out infinite',
            '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
          }} />
          <Typography sx={{ fontSize: '0.78rem', color: DARK.primary, fontWeight: 600 }}>
            India's First AI-Powered Legal Assistant — Available in 11 Languages
          </Typography>
        </Box>
      </motion.div>

      {/* Main headline */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Typography
          component="h1"
          sx={{
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: { xs: '2.4rem', sm: '3.5rem', md: '4.5rem' },
            fontWeight: 800, lineHeight: 1.1,
            letterSpacing: '-0.02em', mb: 0.5,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #B0C8FF 50%, #4A9BFF 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          कानूनी मदद अब
          <br />
          सबकी पहुँच में
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: TYPOGRAPHY.fontFamily.body,
            fontSize: { xs: '1.1rem', sm: '1.35rem' },
            fontWeight: 400, color: DARK.textSub,
            mt: 1, mb: 3, maxWidth: 600, mx: 'auto',
            lineHeight: 1.6,
          }}
        >
          Legal rights explained in your language. AI-powered documents, case tracking,
          lawyer matching — all in one place, starting{' '}
          <Box component="span" sx={{ color: DARK.primary, fontWeight: 600 }}>free</Box>.
        </Typography>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.45 }}
      >
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 5 }}>
          <Button
            onClick={() => navigate('/register')}
            sx={{
              px: { xs: 3, sm: 4 }, py: 1.5,
              borderRadius: '100px',
              background: 'linear-gradient(135deg, #1565C0 0%, #4A9BFF 100%)',
              color: '#fff', fontWeight: 700, fontSize: '1rem',
              textTransform: 'none',
              boxShadow: '0 8px 24px rgba(74,155,255,0.45)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 32px rgba(74,155,255,0.55)',
              },
            }}
          >
            Start for Free →
          </Button>
          <Button
            onClick={() => onScrollTo('helpline')}
            sx={{
              px: { xs: 3, sm: 4 }, py: 1.5,
              borderRadius: '100px',
              background: 'rgba(255,23,68,0.1)',
              border: '1.5px solid rgba(255,23,68,0.4)',
              color: '#FF4465', fontWeight: 700, fontSize: '1rem',
              textTransform: 'none',
              transition: 'all 0.2s',
              '&:hover': {
                background: 'rgba(255,23,68,0.18)',
                boxShadow: '0 8px 24px rgba(255,23,68,0.25)',
              },
            }}
          >
            🆘 Try Legal Helpline
          </Button>
        </Box>
      </motion.div>

      {/* Language pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
      >
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
          {['हिन्दी', 'বাংলা', 'मराठी', 'தமிழ்', 'తెలుగు', 'ગુજરાતી', 'ಕನ್ನಡ', 'English', '+3 more'].map((lang) => (
            <Box key={lang} sx={{
              px: 1.5, py: 0.4, borderRadius: '100px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${DARK.border}`,
              fontSize: '0.75rem', color: DARK.textSub, fontWeight: 500,
            }}>
              {lang}
            </Box>
          ))}
        </Box>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: 32 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '0.7rem', color: DARK.textSub, letterSpacing: '0.08em' }}>SCROLL</Typography>
          <Box sx={{ width: 1.5, height: 32, background: `linear-gradient(to bottom, ${DARK.primary}, transparent)`, borderRadius: 1 }} />
        </Box>
      </motion.div>
    </Box>
  );
}

// ─── 3. Stats strip ───────────────────────────────────────────────────────────

// "Indian Languages" is a fixed product fact (see SUPPORTED_LANGUAGES), not a
// growing metric, so it stays hardcoded. The other three are fetched from
// /v1/platform/stats and only fall back to these numbers until that resolves.
const STATS_FALLBACK = [
  { key: 'documentsCreated', value: 125000, suffix: '+', label: 'Documents Generated' },
  { key: 'usersHelped',      value: 48000,  suffix: '+', label: 'Indians Helped' },
  { key: null,               value: 11,     suffix: '',  label: 'Indian Languages' },
  { key: 'legalTemplates',   value: 15,     suffix: '+', label: 'Legal Templates' },
];

function StatsSection() {
  const [stats, setStats] = useState(STATS_FALLBACK);

  useEffect(() => {
    api.get('/platform/stats')
      .then(({ data }) => {
        setStats((prev) => prev.map((s) => (
          s.key && data[s.key] !== undefined ? { ...s, value: data[s.key] } : s
        )));
      })
      .catch(() => {}); // keep fallback values on error
  }, []);

  return (
    <Box sx={{
      py: { xs: 4, md: 6 }, px: { xs: 2, md: 6 },
      background: DARK.bg2,
      borderTop: `1px solid ${DARK.border}`,
      borderBottom: `1px solid ${DARK.border}`,
    }}>
      <Grid container spacing={2} justifyContent="center">
        {stats.map((s, i) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Reveal delay={i * 0.08}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{
                  fontFamily: TYPOGRAPHY.fontFamily.display,
                  fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800,
                  background: 'linear-gradient(135deg, #fff, #4A9BFF)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: DARK.textSub, mt: 0.25 }}>
                  {s.label}
                </Typography>
              </Box>
            </Reveal>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ─── 4. Problem → Solution Section ───────────────────────────────────────────

const PROBLEMS = [
  {
    icon: '💸',
    problem: 'Legal help costs ₹5,000–₹20,000 just for a consultation',
    solution: 'NyayaSetu gives you AI legal guidance starting at ₹0',
    color: '#FF7043',
  },
  {
    icon: '📑',
    problem: 'Legal documents are in English — incomprehensible for most',
    solution: 'Generate documents and get answers in your own language',
    color: '#4A9BFF',
  },
  {
    icon: '😟',
    problem: 'People don\'t know their rights until it\'s too late',
    solution: 'Instant emergency triage tells you exactly what law applies',
    color: '#66BB6A',
  },
];

function ProblemSection() {
  return (
    <Box
      id="why"
      sx={{
        py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
        background: DARK.bg,
        maxWidth: '100%',
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Reveal>
          <Typography sx={{
            textAlign: 'center',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
            color: DARK.primary, textTransform: 'uppercase', mb: 1.5,
          }}>
            THE PROBLEM
          </Typography>
          <Typography
            component="h2"
            sx={{
              textAlign: 'center',
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontSize: { xs: '1.8rem', md: '2.6rem' }, fontWeight: 800,
              color: '#fff', mb: 1,
            }}
          >
            Justice Delayed is Justice Denied
          </Typography>
          <Typography sx={{
            textAlign: 'center', color: DARK.textSub,
            fontSize: '1rem', mb: 6, maxWidth: 560, mx: 'auto',
          }}>
            130 crore Indians, but legal help remains out of reach for most. Until now.
          </Typography>
        </Reveal>

        <Grid container spacing={3}>
          {PROBLEMS.map((p, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Reveal delay={i * 0.12}>
                <Box sx={{
                  p: 3, borderRadius: `${RADIUS.xl}px`,
                  background: DARK.glass, border: `1px solid ${DARK.border}`,
                  height: '100%',
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: p.color },
                }}>
                  <Box sx={{ fontSize: 40, mb: 2 }}>{p.icon}</Box>
                  {/* Problem */}
                  <Box sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2,
                    p: 1.5, borderRadius: `${RADIUS.md}px`,
                    background: 'rgba(255,23,68,0.06)',
                    border: '1px solid rgba(255,23,68,0.12)',
                  }}>
                    <Typography sx={{ fontSize: '1rem', mt: '-2px' }}>❌</Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: '#FF8A80', lineHeight: 1.5 }}>
                      {p.problem}
                    </Typography>
                  </Box>
                  {/* Solution */}
                  <Box sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1,
                    p: 1.5, borderRadius: `${RADIUS.md}px`,
                    background: 'rgba(74,155,255,0.06)',
                    border: '1px solid rgba(74,155,255,0.15)',
                  }}>
                    <Typography sx={{ fontSize: '1rem', mt: '-2px' }}>✅</Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: '#90CAF9', lineHeight: 1.5 }}>
                      {p.solution}
                    </Typography>
                  </Box>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

// ─── 5. How it works ─────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '01',
    icon: '🗣️',
    title: 'Describe Your Situation',
    desc: 'Type what happened in any language — Hindi, Tamil, Bengali or English. No legal jargon needed.',
    color: '#4A9BFF',
  },
  {
    step: '02',
    icon: '🤖',
    title: 'AI Analyses Instantly',
    desc: 'Our AI — trained on Indian law — identifies applicable acts, your rights, and immediate steps.',
    color: '#FF7043',
  },
  {
    step: '03',
    icon: '📄',
    title: 'Act with Confidence',
    desc: 'Get your legal document drafted, find a verified lawyer, or track your case in court — all in one app.',
    color: '#66BB6A',
  },
];

function HowItWorksSection() {
  return (
    <Box
      id="how"
      sx={{
        py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
        background: `linear-gradient(180deg, ${DARK.bg} 0%, ${DARK.bg2} 100%)`,
      }}
    >
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Reveal>
          <Typography sx={{
            textAlign: 'center',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
            color: '#FF7043', textTransform: 'uppercase', mb: 1.5,
          }}>
            HOW IT WORKS
          </Typography>
          <Typography sx={{
            textAlign: 'center',
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800,
            color: '#fff', mb: 6,
          }}>
            3 Steps to Legal Clarity
          </Typography>
        </Reveal>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 0 }, alignItems: 'stretch' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <Reveal delay={i * 0.15} y={20}>
                <Box sx={{
                  flex: 1, p: 3, borderRadius: `${RADIUS.xl}px`,
                  background: DARK.glass, border: `1px solid ${DARK.border}`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* Step number watermark */}
                  <Typography sx={{
                    position: 'absolute', top: -10, right: 16,
                    fontFamily: TYPOGRAPHY.fontFamily.display,
                    fontSize: '5rem', fontWeight: 900, lineHeight: 1,
                    color: 'rgba(255,255,255,0.03)', userSelect: 'none',
                  }}>
                    {s.step}
                  </Typography>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: '14px', fontSize: 26,
                    background: `${s.color}18`, border: `1.5px solid ${s.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
                  }}>
                    {s.icon}
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: s.color, fontWeight: 700, letterSpacing: '0.08em', mb: 0.75 }}>
                    STEP {s.step}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', mb: 1 }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: DARK.textSub, lineHeight: 1.6 }}>
                    {s.desc}
                  </Typography>
                </Box>
              </Reveal>
              {i < STEPS.length - 1 && (
                <Box sx={{
                  display: { xs: 'none', md: 'flex' }, alignItems: 'center', px: 1,
                  color: DARK.textSub, fontSize: '1.5rem',
                }}>
                  →
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ─── 6. Features Grid ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🆘',
    title: 'Legal Emergency Helpline',
    desc: 'Describe your crisis in any language — get instant law, steps & nearest free legal aid.',
    badge: 'NEW',
    badgeColor: '#FF1744',
    color: '#FF4465',
  },
  {
    icon: '📝',
    title: 'AI Document Generator',
    desc: 'Fill a short questionnaire. AI drafts police complaints, tenant notices, consumer complaints & more.',
    color: '#4A9BFF',
  },
  {
    icon: '⚖️',
    title: 'Court Case Tracker',
    desc: 'Enter your CNR number. Auto-fetch hearing dates from eCourts and get WhatsApp / email alerts.',
    color: '#66BB6A',
  },
  {
    icon: '👨‍⚖️',
    title: 'Verified Lawyer Network',
    desc: 'Find NALSA-empanelled advocates by specialization and location. Book video consultations instantly.',
    color: '#FF7043',
  },
  {
    icon: '🔍',
    title: 'Clause Explainer',
    desc: 'Paste any legal clause — AI explains it in plain Hindi or English, flags red flags.',
    color: '#AB47BC',
  },
  {
    icon: '🔔',
    title: 'Hearing Alerts',
    desc: 'Never miss a court date. SMS, WhatsApp, and email reminders 2 days before each hearing.',
    color: '#26C6DA',
  },
  {
    icon: '📚',
    title: 'Indian Law Search',
    desc: 'Search BNS, BNSS, PWDVA, Consumer Protection Act and 50+ Indian statutes in plain language.',
    color: '#FFA726',
  },
  {
    icon: '🌐',
    title: '11 Indian Languages',
    desc: 'Full support for Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Urdu.',
    color: '#EF5350',
  },
];

function FeaturesSection() {
  return (
    <Box
      id="features"
      sx={{
        py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
        background: DARK.bg,
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Reveal>
          <Typography sx={{
            textAlign: 'center',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
            color: '#66BB6A', textTransform: 'uppercase', mb: 1.5,
          }}>
            FEATURES
          </Typography>
          <Typography sx={{
            textAlign: 'center',
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800,
            color: '#fff', mb: 1,
          }}>
            Everything You Need, All in One App
          </Typography>
          <Typography sx={{
            textAlign: 'center', color: DARK.textSub,
            fontSize: '0.95rem', mb: 6, maxWidth: 500, mx: 'auto',
          }}>
            No switching between apps. No expensive retainers. No confusing legalese.
          </Typography>
        </Reveal>

        <Grid container spacing={2}>
          {FEATURES.map((f, i) => (
            <Grid item xs={12} sm={6} md={3} key={f.title}>
              <Reveal delay={i * 0.07} y={20}>
                <Box sx={{
                  p: 2.5, borderRadius: `${RADIUS.xl}px`,
                  background: DARK.glass, border: `1px solid ${DARK.border}`,
                  height: '100%', position: 'relative',
                  transition: 'border-color 0.25s, transform 0.25s, box-shadow 0.25s',
                  '&:hover': {
                    borderColor: f.color,
                    transform: 'translateY(-4px)',
                    boxShadow: `0 12px 30px ${f.color}18`,
                  },
                }}>
                  {f.badge && (
                    <Box sx={{
                      position: 'absolute', top: 12, right: 12,
                      px: 1, py: 0.2, borderRadius: '4px',
                      background: f.badgeColor, fontSize: '0.6rem',
                      fontWeight: 800, color: '#fff', letterSpacing: '0.08em',
                    }}>
                      {f.badge}
                    </Box>
                  )}
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '12px',
                    background: `${f.color}15`, border: `1.5px solid ${f.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, mb: 1.75,
                  }}>
                    {f.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', mb: 0.75 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: DARK.textSub, lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

// ─── 7. AI Section ───────────────────────────────────────────────────────────

function AISection() {
  return (
    <Box sx={{
      py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
      background: `radial-gradient(ellipse at 50% 0%, rgba(21,101,192,0.25) 0%, transparent 65%),
                   linear-gradient(180deg, ${DARK.bg2} 0%, ${DARK.bg} 100%)`,
    }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Grid container spacing={5} alignItems="center">
          <Grid item xs={12} md={6}>
            <Reveal>
              <Typography sx={{
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
                color: DARK.primary, textTransform: 'uppercase', mb: 1.5,
              }}>
                POWERED BY CONSTITUTIONAL AI
              </Typography>
              <Typography sx={{
                fontFamily: TYPOGRAPHY.fontFamily.display,
                fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800,
                color: '#fff', mb: 2, lineHeight: 1.2,
              }}>
                AI That Understands
                <br />Indian Law & Context
              </Typography>
              <Typography sx={{
                color: DARK.textSub, fontSize: '0.95rem', lineHeight: 1.75, mb: 3,
              }}>
                NyayaSetu is built on top of state-of-the-art Constitutional AI, fine-tuned to understand the nuances of Indian jurisprudence — from the Bharatiya Nyaya Sanhita 2023 to PWDVA, from state Rent Control Acts to the Consumer Protection Act.
              </Typography>
              {[
                'Jurisdiction-aware: answers change based on your state',
                'Language-native: responds in Hindi, Tamil, Bengali & more',
                'Citation-accurate: references real Indian statutes and sections',
                'Safe by design: always recommends consulting a real lawyer',
              ].map((item) => (
                <Box key={item} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(74,155,255,0.15)',
                    border: '1.5px solid rgba(74,155,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', color: DARK.primary, fontWeight: 700, mt: '2px',
                  }}>
                    ✓
                  </Box>
                  <Typography sx={{ fontSize: '0.88rem', color: DARK.textSub }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Reveal>
          </Grid>

          <Grid item xs={12} md={6}>
            <Reveal delay={0.15} y={20}>
              {/* Fake chat UI */}
              <Box sx={{
                p: 2.5, borderRadius: `${RADIUS.xl}px`,
                background: DARK.glass, border: `1px solid ${DARK.border}`,
                fontFamily: TYPOGRAPHY.fontFamily.body,
              }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, pb: 2, borderBottom: `1px solid ${DARK.border}` }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg,#1565C0,#4A9BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚖️</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>NyayaBot</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#4A9BFF' }}>● Online</Typography>
                  </Box>
                </Box>

                {/* User message */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                  <Box sx={{
                    maxWidth: '80%', px: 2, py: 1.25, borderRadius: '16px 16px 4px 16px',
                    background: '#1565C0', fontSize: '0.83rem', color: '#fff', lineHeight: 1.5,
                  }}>
                    मेरे मकान मालिक ने बिना नोटिस के मुझे घर से निकाल दिया। मैं क्या करूँ?
                  </Box>
                </Box>

                {/* AI response */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(74,155,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, mt: 0.25 }}>⚖️</Box>
                  <Box sx={{ maxWidth: '88%', px: 2, py: 1.5, borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${DARK.border}`, fontSize: '0.83rem', color: DARK.textSub, lineHeight: 1.65 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      <Chip label="🚨 URGENT" size="small" sx={{ fontSize: '0.65rem', background: 'rgba(255,23,68,0.15)', color: '#FF4465', fontWeight: 700, height: 20 }} />
                      <Chip label="Tenant Law" size="small" sx={{ fontSize: '0.65rem', background: 'rgba(74,155,255,0.1)', color: '#4A9BFF', height: 20 }} />
                    </Box>
                    <strong style={{ color: '#fff' }}>यह Transfer of Property Act, 1882 का उल्लंघन है।</strong>
                    <br />तुरंत करें: (1) नजदीकी पुलिस थाने में FIR दर्ज करें, (2) किरायेदारी का कोई भी प्रमाण इकट्ठा करें, (3) NALSA हेल्पलाइन <strong style={{ color: '#4A9BFF' }}>1516</strong> पर कॉल करें।
                  </Box>
                </Box>
              </Box>
            </Reveal>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

// ─── 8. Live Helpline Demo ────────────────────────────────────────────────────

const URGENCY_CFG = {
  CRITICAL: { label: 'CRITICAL', color: '#FF1744', bg: 'rgba(255,23,68,0.12)', border: 'rgba(255,23,68,0.35)' },
  URGENT:   { label: 'URGENT',   color: '#FF6D00', bg: 'rgba(255,109,0,0.12)', border: 'rgba(255,109,0,0.35)' },
  MODERATE: { label: 'MODERATE', color: '#FFD600', bg: 'rgba(255,214,0,0.10)', border: 'rgba(255,214,0,0.35)' },
};

function LiveHelplineSection() {
  const navigate = useNavigate();

  const [phase, setPhase]             = useState('email');  // email | input | loading | result | exceeded
  const [email, setEmail]             = useState('');
  const [emailError, setEmailError]   = useState('');
  const [description, setDescription] = useState('');
  const [result, setResult]           = useState(null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmail() {
    if (!emailRe.test(email)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  }

  function handleEmailNext(e) {
    e.preventDefault();
    if (validateEmail()) setPhase('input');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (description.trim().length < 10) return;

    setPhase('loading');
    try {
      const { data } = await api.post('/triage/public', {
        email: email.trim(),
        description: description.trim(),
      });
      setResult(data);
      setPhase('result');
    } catch (err) {
      if (err?.response?.status === 403) {
        setPhase('exceeded');
      } else {
        setPhase('input');
      }
    }
  }

  const triage   = result?.triage;
  const urgCfg   = triage ? (URGENCY_CFG[triage.urgency] || URGENCY_CFG.MODERATE) : null;

  return (
    <Box
      id="helpline"
      sx={{
        py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
        background: `radial-gradient(ellipse at 50% 50%, rgba(255,23,68,0.08) 0%, transparent 65%),
                     ${DARK.bg2}`,
      }}
    >
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        {/* Header */}
        <Reveal>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Box sx={{
              display: 'inline-flex', width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,23,68,0.12)', border: '2px solid rgba(255,23,68,0.3)',
              alignItems: 'center', justifyContent: 'center', fontSize: 30, mb: 2,
            }}>
              🆘
            </Box>
            <Typography sx={{
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
              color: '#FF4465', textTransform: 'uppercase', mb: 1.5,
            }}>
              TRY IT NOW — LIVE DEMO
            </Typography>
            <Typography sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800,
              color: '#fff', mb: 1,
            }}>
              Legal Helpline — Free
            </Typography>
            <Typography sx={{ color: DARK.textSub, fontSize: '0.95rem', mb: 1 }}>
              No sign-up needed. Tell us what happened and get instant legal guidance.
            </Typography>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              mt: 1, px: 2, py: 0.6, borderRadius: '100px',
              background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)',
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#FF1744',
                animation: 'blink2 1.5s ease-in-out infinite',
                '@keyframes blink2': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.15 } },
              }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#FF4465', fontWeight: 600 }}>
                NALSA Free Helpline: <strong>1516</strong>
              </Typography>
            </Box>
          </Box>
        </Reveal>

        {/* Multi-phase form */}
        <Reveal delay={0.1}>
          <Box sx={{
            p: { xs: 2.5, sm: 4 }, borderRadius: `${RADIUS.xl}px`,
            background: DARK.glass, border: `1.5px solid ${DARK.border}`,
          }}>
            <AnimatePresence mode="wait">

              {/* Phase: email */}
              {phase === 'email' && (
                <motion.div key="email"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Typography sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                    First, what's your email?
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: DARK.textSub, mb: 2.5 }}>
                    We use this to track your free daily use. No spam, ever.
                  </Typography>
                  <form onSubmit={handleEmailNext}>
                    <TextField
                      fullWidth type="email" placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={!!emailError}
                      helperText={emailError}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: `${RADIUS.md}px`,
                          background: 'rgba(255,255,255,0.04)',
                          '& fieldset': { borderColor: DARK.border },
                          '&:hover fieldset': { borderColor: DARK.primary },
                          '&.Mui-focused fieldset': { borderColor: DARK.primary },
                        },
                        '& input': { color: '#fff' },
                        '& .MuiFormHelperText-root': { color: '#FF4465' },
                      }}
                    />
                    <Button type="submit" fullWidth
                      disabled={!email}
                      sx={{
                        py: 1.5, borderRadius: `${RADIUS.md}px`,
                        background: email
                          ? 'linear-gradient(135deg,#FF1744,#D50000)'
                          : 'rgba(255,255,255,0.07)',
                        color: email ? '#fff' : DARK.textSub,
                        fontWeight: 700, fontSize: '0.95rem', textTransform: 'none',
                        boxShadow: email ? '0 4px 16px rgba(255,23,68,0.35)' : 'none',
                      }}
                    >
                      Continue →
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* Phase: input */}
              {phase === 'input' && (
                <motion.div key="input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9BFF' }} />
                    <Typography sx={{ fontSize: '0.78rem', color: DARK.primary }}>
                      {email}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                    What happened?
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: DARK.textSub, mb: 2 }}>
                    Write in any language — Hindi, Tamil, Bengali, or English.
                  </Typography>
                  <form onSubmit={handleSubmit}>
                    <TextField
                      fullWidth multiline minRows={5}
                      placeholder="Example: मेरे मकान मालिक ने बिना नोटिस के मुझे घर से निकाल दिया..."
                      value={description}
                      onChange={(e) => { if (e.target.value.length <= 2000) setDescription(e.target.value); }}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: `${RADIUS.md}px`,
                          background: 'rgba(255,255,255,0.04)',
                          '& fieldset': { borderColor: DARK.border },
                          '&:hover fieldset': { borderColor: '#FF4465' },
                          '&.Mui-focused fieldset': { borderColor: '#FF4465' },
                        },
                        '& textarea': { color: '#fff', '&::placeholder': { color: DARK.textSub, opacity: 1 } },
                      }}
                    />
                    <Button type="submit" fullWidth
                      disabled={description.trim().length < 10}
                      sx={{
                        py: 1.5, borderRadius: `${RADIUS.md}px`,
                        background: description.trim().length >= 10
                          ? 'linear-gradient(135deg,#FF1744,#D50000)'
                          : 'rgba(255,255,255,0.07)',
                        color: description.trim().length >= 10 ? '#fff' : DARK.textSub,
                        fontWeight: 700, fontSize: '0.95rem', textTransform: 'none',
                      }}
                    >
                      🆘 Get Immediate Legal Guidance
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* Phase: loading */}
              {phase === 'loading' && (
                <motion.div key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={40} sx={{ color: '#FF4465' }} />
                    <Typography sx={{ color: DARK.textSub, fontSize: '0.9rem' }}>
                      Analysing your legal situation…
                    </Typography>
                  </Box>
                </motion.div>
              )}

              {/* Phase: result */}
              {phase === 'result' && triage && (
                <motion.div key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Urgency + category */}
                  <Box sx={{
                    p: 2, borderRadius: `${RADIUS.lg}px`,
                    background: urgCfg.bg, border: `1.5px solid ${urgCfg.border}`, mb: 2,
                  }}>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Box sx={{
                        px: 1.5, py: 0.4, borderRadius: '100px',
                        background: urgCfg.bg, border: `1px solid ${urgCfg.border}`,
                        fontSize: '0.72rem', fontWeight: 800, color: urgCfg.color,
                        letterSpacing: '0.06em',
                      }}>
                        {triage.urgency}
                      </Box>
                      <Chip label={triage.legalCategory} size="small"
                        sx={{ fontSize: '0.72rem', background: DARK.glass, color: DARK.textSub, border: `1px solid ${DARK.border}`, height: 22 }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.88rem', color: DARK.text, lineHeight: 1.6 }}>
                      {triage.summary}
                    </Typography>
                  </Box>

                  {/* Top 3 steps */}
                  {triage.immediateSteps?.slice(0, 3).map((step, i) => (
                    <Box key={i} sx={{
                      display: 'flex', gap: 1.5, mb: 1.25, p: 1.5,
                      borderRadius: `${RADIUS.md}px`,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${DARK.border}`,
                    }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(74,155,255,0.15)', border: '1px solid rgba(74,155,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, color: DARK.primary,
                      }}>
                        {step.order}
                      </Box>
                      <Typography sx={{ fontSize: '0.83rem', color: DARK.text, flex: 1 }}>
                        {step.action}
                        {step.channel && <Box component="span" sx={{ color: DARK.primary }}> → {step.channel}</Box>}
                      </Typography>
                    </Box>
                  ))}

                  {/* Legal aid */}
                  {triage.legalAidCenter && (
                    <Box sx={{
                      mt: 2, p: 2, borderRadius: `${RADIUS.md}px`,
                      background: 'rgba(74,155,255,0.06)', border: '1px solid rgba(74,155,255,0.15)',
                    }}>
                      <Typography sx={{ fontSize: '0.72rem', color: DARK.primary, fontWeight: 700, mb: 0.5 }}>
                        NEAREST FREE LEGAL AID
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                        {triage.legalAidCenter.authority}
                      </Typography>
                      {triage.legalAidCenter.phone && (
                        <Typography sx={{ fontSize: '0.8rem', color: DARK.textSub, mt: 0.25 }}>
                          📞 {triage.legalAidCenter.phone}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* CTA */}
                  <Box sx={{ mt: 2.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {triage.recommendedTemplate && (
                      <Button
                        onClick={() => navigate('/register')}
                        sx={{
                          flex: 1, py: 1.25, borderRadius: `${RADIUS.md}px`,
                          background: 'linear-gradient(135deg,#1565C0,#4A9BFF)',
                          color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                          textTransform: 'none',
                        }}
                      >
                        Generate Document →
                      </Button>
                    )}
                    <Button
                      onClick={() => navigate('/register')}
                      sx={{
                        flex: 1, py: 1.25, borderRadius: `${RADIUS.md}px`,
                        border: '1px solid rgba(74,155,255,0.3)',
                        color: DARK.primary, fontWeight: 700, fontSize: '0.85rem',
                        textTransform: 'none',
                      }}
                    >
                      Create Free Account
                    </Button>
                  </Box>

                  <Typography sx={{ fontSize: '0.72rem', color: DARK.textSub, mt: 2, textAlign: 'center' }}>
                    1 free triage/day without an account.{' '}
                    <Box component="span" sx={{ color: DARK.primary, cursor: 'pointer' }}
                      onClick={() => navigate('/register')}>
                      Sign up for more →
                    </Box>
                  </Typography>
                </motion.div>
              )}

              {/* Phase: exceeded */}
              {phase === 'exceeded' && (
                <motion.div key="exceeded"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography sx={{ fontSize: 48, mb: 2 }}>🔓</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', mb: 1 }}>
                      You've Used Today's Free Triage
                    </Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: DARK.textSub, mb: 3, maxWidth: 380, mx: 'auto' }}>
                      Create a free account to get 3 triages/day, AI document generation, case tracking and much more.
                    </Typography>
                    <Button
                      fullWidth onClick={() => navigate('/register')}
                      sx={{
                        py: 1.5, borderRadius: `${RADIUS.md}px`,
                        background: 'linear-gradient(135deg,#1565C0,#4A9BFF)',
                        color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                        textTransform: 'none',
                        boxShadow: '0 8px 24px rgba(74,155,255,0.35)',
                        mb: 1.5,
                      }}
                    >
                      Create Free Account →
                    </Button>
                    <Button
                      fullWidth onClick={() => navigate('/pricing')}
                      sx={{
                        py: 1.25, borderRadius: `${RADIUS.md}px`,
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: DARK.textSub, fontWeight: 600, fontSize: '0.85rem',
                        textTransform: 'none',
                      }}
                    >
                      View Pricing Plans
                    </Button>
                  </Box>
                </motion.div>
              )}

            </AnimatePresence>
          </Box>
        </Reveal>
      </Box>
    </Box>
  );
}

// ─── 9. Pricing Preview ───────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    color: DARK.textSub,
    items: ['1 triage/day', '3 documents/month', '5 AI chats', '1 case tracked'],
    cta: 'Get Started',
    ctaAction: '/register',
  },
  {
    name: 'Basic',
    price: '₹99',
    period: '/month',
    color: '#4A9BFF',
    popular: true,
    items: ['3 triages/day', '15 documents', '30 AI chats', '5 cases tracked', 'WhatsApp alerts', 'PDF downloads'],
    cta: 'Start Basic',
    ctaAction: '/register',
  },
  {
    name: 'Pro',
    price: '₹199',
    period: '/month',
    color: '#FF7043',
    items: ['Unlimited triages', 'Unlimited documents', 'Unlimited AI chats', 'Book consultations', 'All alerts', 'Priority support'],
    cta: 'Go Pro',
    ctaAction: '/register',
  },
];

function PricingSection() {
  const navigate = useNavigate();
  return (
    <Box
      id="pricing"
      sx={{
        py: { xs: 6, md: 10 }, px: { xs: 2, md: 6 },
        background: DARK.bg,
      }}
    >
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Reveal>
          <Typography sx={{
            textAlign: 'center',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em',
            color: '#FF7043', textTransform: 'uppercase', mb: 1.5,
          }}>
            PRICING
          </Typography>
          <Typography sx={{
            textAlign: 'center',
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800,
            color: '#fff', mb: 1,
          }}>
            Start Free. Scale As You Need.
          </Typography>
          <Typography sx={{
            textAlign: 'center', color: DARK.textSub,
            fontSize: '0.95rem', mb: 6,
          }}>
            No credit card required. Cancel anytime.
          </Typography>
        </Reveal>

        <Grid container spacing={2} alignItems="stretch">
          {PLANS.map((plan, i) => (
            <Grid item xs={12} md={4} key={plan.name}>
              <Reveal delay={i * 0.1} y={20}>
                <Box sx={{
                  p: 3, borderRadius: `${RADIUS.xl}px`, height: '100%',
                  background: plan.popular ? `rgba(74,155,255,0.06)` : DARK.glass,
                  border: plan.popular ? '2px solid rgba(74,155,255,0.4)' : `1px solid ${DARK.border}`,
                  position: 'relative', display: 'flex', flexDirection: 'column',
                }}>
                  {plan.popular && (
                    <Box sx={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      px: 2, py: 0.4, borderRadius: '100px',
                      background: 'linear-gradient(135deg,#1565C0,#4A9BFF)',
                      fontSize: '0.72rem', fontWeight: 700, color: '#fff',
                      whiteSpace: 'nowrap',
                    }}>
                      ✦ MOST POPULAR
                    </Box>
                  )}
                  <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: plan.color, mb: 1 }}>
                    {plan.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2.5 }}>
                    <Typography sx={{
                      fontFamily: TYPOGRAPHY.fontFamily.display,
                      fontSize: '2.2rem', fontWeight: 800, color: '#fff',
                    }}>
                      {plan.price}
                    </Typography>
                    <Typography sx={{ color: DARK.textSub, fontSize: '0.85rem' }}>
                      {plan.period}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, mb: 3 }}>
                    {plan.items.map((item) => (
                      <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: `${plan.color}20`, border: `1px solid ${plan.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: plan.color, fontWeight: 700, flexShrink: 0 }}>
                          ✓
                        </Box>
                        <Typography sx={{ fontSize: '0.83rem', color: DARK.textSub }}>
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    fullWidth
                    onClick={() => navigate(plan.ctaAction)}
                    sx={{
                      py: 1.25, borderRadius: `${RADIUS.md}px`,
                      background: plan.popular
                        ? 'linear-gradient(135deg,#1565C0,#4A9BFF)'
                        : `rgba(255,255,255,0.05)`,
                      border: plan.popular ? 'none' : `1px solid ${DARK.border}`,
                      color: plan.popular ? '#fff' : DARK.textSub,
                      fontWeight: 700, fontSize: '0.88rem', textTransform: 'none',
                      boxShadow: plan.popular ? '0 6px 18px rgba(74,155,255,0.3)' : 'none',
                      '&:hover': {
                        background: plan.popular
                          ? 'linear-gradient(135deg,#1E88E5,#64B5F6)'
                          : `rgba(255,255,255,0.08)`,
                      },
                    }}
                  >
                    {plan.cta}
                  </Button>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
        <Reveal delay={0.3}>
          <Typography sx={{ textAlign: 'center', mt: 3, fontSize: '0.82rem', color: DARK.textSub }}>
            Lawyer plans available from ₹499/month.{' '}
            <Box component="span" sx={{ color: DARK.primary, cursor: 'pointer' }} onClick={() => navigate('/pricing')}>
              See all plans →
            </Box>
          </Typography>
        </Reveal>
      </Box>
    </Box>
  );
}

// ─── 10. Final CTA Section ────────────────────────────────────────────────────

function CTASection() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  useParticles(canvasRef, 35);
  return (
    <Box sx={{
      py: { xs: 8, md: 12 }, px: { xs: 2, md: 6 }, textAlign: 'center',
      background: `radial-gradient(ellipse at 50% 0%, rgba(21,101,192,0.4) 0%, transparent 70%),
                   ${DARK.bg2}`,
      position: 'relative', overflow: 'hidden',
      borderTop: `1px solid ${DARK.border}`,
    }}>
      <Box component="canvas" ref={canvasRef}
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Reveal>
          <Typography sx={{
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800,
            color: '#fff', mb: 1.5, lineHeight: 1.2,
          }}>
            Your Legal Rights,
            <br />
            <Box component="span" sx={{
              background: 'linear-gradient(135deg,#4A9BFF,#82CAFF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Just One Tap Away
            </Box>
          </Typography>
          <Typography sx={{ color: DARK.textSub, fontSize: '1rem', mb: 4, maxWidth: 480, mx: 'auto' }}>
            Join thousands of Indians who already know their rights. Free forever. No lawyer required.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              onClick={() => navigate('/register')}
              sx={{
                px: 4, py: 1.75, borderRadius: '100px',
                background: 'linear-gradient(135deg,#1565C0,#4A9BFF)',
                color: '#fff', fontWeight: 700, fontSize: '1rem',
                textTransform: 'none',
                boxShadow: '0 8px 28px rgba(74,155,255,0.5)',
                '&:hover': { transform: 'translateY(-2px)' },
                transition: 'transform 0.2s',
              }}
            >
              Get Started Free →
            </Button>
            <Button
              onClick={() => navigate('/login')}
              sx={{
                px: 4, py: 1.75, borderRadius: '100px',
                border: `1.5px solid ${DARK.borderStrong}`,
                color: DARK.text, fontWeight: 600, fontSize: '1rem',
                textTransform: 'none',
                '&:hover': { borderColor: '#fff', color: '#fff' },
              }}
            >
              Sign In
            </Button>
          </Box>
        </Reveal>
      </Box>
    </Box>
  );
}

// ─── 11. Footer ───────────────────────────────────────────────────────────────

function LandingFooter() {
  const navigate = useNavigate();
  return (
    <Box sx={{
      py: 5, px: { xs: 2, md: 6 },
      background: '#050A14',
      borderTop: `1px solid ${DARK.border}`,
    }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Grid container spacing={4} sx={{ mb: 5 }}>
          {/* Brand */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '9px', background: 'linear-gradient(135deg,#1565C0,#4A9BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚖️</Box>
              <Typography sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>NyayaSetu</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: DARK.textSub, lineHeight: 1.7, mb: 2 }}>
              India's first AI-powered legal assistant. Making justice accessible to every Indian in their own language.
            </Typography>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              px: 1.5, py: 0.5, borderRadius: '8px',
              background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.15)',
            }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#FF4465', fontWeight: 600 }}>
                🆘 Free Legal Aid: <strong>1516</strong>
              </Typography>
            </Box>
          </Grid>

          {/* Product links */}
          <Grid item xs={6} md={2}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>Product</Typography>
            {[
              ['Features', '/register'],
              ['Legal Helpline', '/register'],
              ['Pricing', '/pricing'],
              ['For Lawyers', '/register'],
            ].map(([label, path]) => (
              <Typography key={label} onClick={() => navigate(path)}
                sx={{ fontSize: '0.82rem', color: DARK.textSub, mb: 1, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                {label}
              </Typography>
            ))}
          </Grid>

          {/* Legal */}
          <Grid item xs={6} md={2}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>Legal</Typography>
            {[
              ['Privacy Policy', '#'],
              ['Terms of Use', '#'],
              ['Disclaimer', '#'],
            ].map(([label, href]) => (
              <Typography key={label}
                sx={{ fontSize: '0.82rem', color: DARK.textSub, mb: 1, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                {label}
              </Typography>
            ))}
          </Grid>

          {/* Contact */}
          <Grid item xs={12} md={4}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>Emergency & Support</Typography>
            <Box sx={{ p: 2, borderRadius: `${RADIUS.md}px`, background: DARK.glass, border: `1px solid ${DARK.border}` }}>
              <Typography sx={{ fontSize: '0.8rem', color: DARK.textSub, mb: 0.5 }}>NALSA Free Legal Aid Helpline</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#FF4465', fontFamily: TYPOGRAPHY.fontFamily.mono }}>1516</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: DARK.textSub, mt: 0.5 }}>Toll-free · Available across India · Multilingual</Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: DARK.border, mb: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', color: DARK.textSub }}>
            © 2025 NyayaSetu. Built in India with ❤️ for 130 crore Indians.
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: DARK.textSub }}>
            This platform provides legal information, not legal advice. Always consult a qualified lawyer.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Root LandingPage ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const sectionRefs = {
    features: useRef(null),
    how:      useRef(null),
    helpline: useRef(null),
    pricing:  useRef(null),
  };

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Override body background for dark landing
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#080E1D';
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <Box sx={{ background: '#080E1D', minHeight: '100vh', overflowX: 'hidden' }}>
      <LandingNavbar onScrollTo={scrollTo} />
      <HeroSection onScrollTo={scrollTo} />
      <StatsSection />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AISection />
      <LiveHelplineSection />
      <PricingSection />
      <CTASection />
      <LandingFooter />
    </Box>
  );
}
