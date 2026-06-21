/**
 * client/src/pages/citizen/Home.jsx
 */

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { selectUser, selectUserPlan } from "../../store/slices/authSlice";
import {
  selectDocuments,
  listDocuments,
} from "../../store/slices/documentSlice";
import { selectCases, listCases } from "../../store/slices/caseSlice";
import {
  selectFreeUsage,
  getCurrentSubscription,
} from "../../store/slices/subscriptionSlice";
import AnimatedPage from "../../components/ui/AnimatedPage";
import GlassCard from "../../components/ui/GlassCard";
import FeatureGate from "../../components/ui/FeatureGate";
import GradientHeading from "../../components/ui/GradientHeading";
import { RADIUS, SHADOWS, TYPOGRAPHY } from "../../theme/tokens";

// ─── Animated counter hook ────────────────────────────────────────────────────

function useAnimatedCounter(target, duration = 1.8) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) =>
    Math.round(v).toLocaleString("en-IN"),
  );
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const controls = animate(motionVal, target, { duration, ease: "easeOut" });
    const unsub = rounded.on("change", setDisplay);
    return () => {
      controls.stop();
      unsub();
    };
  }, [target]);

  return display;
}

// ─── Animated stat box ────────────────────────────────────────────────────────

function StatBadge({ icon, value, label, delay = 0 }) {
  const count = useAnimatedCounter(value);
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
    >
      <Box
        sx={{
          textAlign: "center",
          p: { xs: 2, sm: 2.5 },
          borderRadius: `${RADIUS.lg}px`,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: SHADOWS.sm,
        }}
      >
        <Typography sx={{ fontSize: 28, mb: 0.5 }}>{icon}</Typography>
        <GradientHeading
          variant="h5"
          sx={{
            fontWeight: 800,
            fontFamily: TYPOGRAPHY.fontFamily.display,
            lineHeight: 1.1,
          }}
        >
          {count}
        </GradientHeading>
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────

function QuickActionCard({ icon, title, description, path, color, delay = 0 }) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={prefersReducedMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      style={{ height: "100%" }}
    >
      <Box
        onClick={() => navigate(path)}
        sx={{
          p: { xs: 2, sm: 2.5 },
          height: "100%",
          borderRadius: `${RADIUS.lg}px`,
          background: "var(--color-surface)",
          border: "1.5px solid var(--color-border)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:hover": {
            borderColor: "var(--color-primary)",
            boxShadow: SHADOWS.md,
          },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: `${RADIUS.md}px`,
            background: color || "var(--color-primary-alpha)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            mb: 0.5,
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="body1"
          sx={{ fontWeight: 700, color: "var(--color-text)" }}
        >
          {title}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}
        >
          {description}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── Recent document row ──────────────────────────────────────────────────────

function DocumentRow({ doc, delay }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const statusColors = {
    completed: "var(--color-success)",
    generating: "var(--color-warning)",
    active: "var(--color-primary)",
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Box
        onClick={() => navigate(`/citizen/documents/${doc._id}`)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 1.5,
          borderRadius: `${RADIUS.md}px`,
          cursor: "pointer",
          transition: "background 0.15s",
          "&:hover": { background: "var(--color-overlay)" },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: `${RADIUS.md}px`,
            background: "var(--color-primary-alpha)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 20,
          }}
        >
          📄
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "var(--color-text)",
              noWrap: true,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "var(--color-text-secondary)" }}
          >
            {new Date(doc.createdAt).toLocaleDateString("en-IN", {
              dateStyle: "medium",
            })}
          </Typography>
        </Box>
        <Chip
          label={doc.status || "completed"}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.67rem",
            fontWeight: 600,
            background: `${statusColors[doc.status] || "var(--color-border)"}22`,
            color: statusColors[doc.status] || "var(--color-text-secondary)",
            border: `1px solid ${statusColors[doc.status] || "var(--color-border)"}`,
          }}
        />
      </Box>
    </motion.div>
  );
}

// ─── Upcoming hearing card ────────────────────────────────────────────────────

function HearingCard({ hearingCase }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  if (!hearingCase) return null;

  const hearing = hearingCase.hearings?.find(
    (h) => h.date && new Date(h.date) >= new Date(),
  );
  if (!hearing) return null;

  const daysUntil = Math.ceil(
    (new Date(hearing.date) - new Date()) / (1000 * 60 * 60 * 24),
  );
  const isUrgent = daysUntil <= 2;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
    >
      <GlassCard
        elevation={1}
        sx={{
          p: 2.5,
          mb: 3,
          border: `1.5px solid ${isUrgent ? "var(--color-warning)" : "var(--color-border)"}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: `${RADIUS.md}px`,
              background: isUrgent
                ? "rgba(230,81,0,0.12)"
                : "var(--color-primary-alpha)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {isUrgent ? "🚨" : "📅"}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: isUrgent ? "var(--color-warning)" : "var(--color-text)",
              }}
            >
              {isUrgent
                ? t("home.urgent_hearing", "Hearing in {{days}} day(s)!", {
                    days: daysUntil,
                  })
                : t("home.upcoming_hearing", "Upcoming Hearing")}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-secondary)", display: "block" }}
            >
              {hearingCase.caseTitle || hearingCase.cnrNumber}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {new Date(hearing.date).toLocaleDateString("en-IN", {
                dateStyle: "full",
              })}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/citizen/cases/${hearingCase._id}`)}
            sx={{
              borderRadius: `${RADIUS.md}px`,
              fontSize: "0.72rem",
              fontWeight: 600,
              borderColor: isUrgent
                ? "var(--color-warning)"
                : "var(--color-primary)",
              color: isUrgent ? "var(--color-warning)" : "var(--color-primary)",
              flexShrink: 0,
            }}
          >
            {t("home.view_case", "View")}
          </Button>
        </Box>
      </GlassCard>
    </motion.div>
  );
}

// ─── Usage meter ──────────────────────────────────────────────────────────────

function UsageMeter({ freeUsage, plan }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  if (plan !== "free") return null;

  const used = freeUsage?.docsGenerated || 0;
  const limit = freeUsage?.docsLimit || 3;
  const pct = Math.min(100, (used / limit) * 100);
  const isFull = used >= limit;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: `${RADIUS.lg}px`,
          background: isFull
            ? "rgba(198,40,40,0.06)"
            : "var(--color-primary-alpha)",
          border: `1.5px solid ${isFull ? "var(--color-error)" : "var(--color-primary)"}`,
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: isFull ? "var(--color-error)" : "var(--color-primary)",
            }}
          >
            {isFull ? "🔴 " : "📊 "}
            {t("home.monthly_usage", "Monthly Documents")}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "var(--color-text-secondary)", fontWeight: 600 }}
          >
            {used}/{limit}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: 3,
            mb: 1.25,
            background: "var(--color-border)",
            "& .MuiLinearProgress-bar": {
              background: isFull
                ? "var(--color-error)"
                : "linear-gradient(90deg, var(--color-primary), var(--color-primary-light))",
              borderRadius: 3,
              transition: "transform 1s ease",
            },
          }}
        />
        {isFull && (
          <Button
            fullWidth
            size="small"
            variant="contained"
            onClick={() => navigate("/pricing")}
            sx={{
              fontWeight: 700,
              fontSize: "0.8rem",
              py: 0.75,
              background: "var(--color-primary)",
              borderRadius: `${RADIUS.md}px`,
            }}
          >
            {t("home.upgrade", "Upgrade for unlimited documents")}
          </Button>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function CitizenHome() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const user = useSelector(selectUser);
  const plan = useSelector(selectUserPlan);
  const documents = useSelector(selectDocuments);
  const cases = useSelector(selectCases);
  const freeUsage = useSelector(selectFreeUsage);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dispatch(listDocuments({ limit: 3 })),
      dispatch(listCases({ limit: 5 })),
      dispatch(getCurrentSubscription()),
    ]).finally(() => setLoading(false));
  }, [dispatch]);

  const nextHearingCase = cases?.find((c) =>
    c.hearings?.some((h) => h.date && new Date(h.date) >= new Date()),
  );

  const recentDocs = documents?.slice(0, 3);

  const QUICK_ACTIONS = [
    {
      icon: "📝",
      title: t("home.create_doc", "Create Document"),
      description: t(
        "home.create_doc_desc",
        "Generate a legal document with AI in minutes",
      ),
      path: "/citizen/documents/new",
      color: "var(--color-primary-alpha)",
      delay: 0.15,
    },
    {
      icon: "⚖️",
      title: t("home.track_case", "Track Case"),
      description: t("home.track_case_desc", "Monitor hearings via CNR number"),
      path: "/citizen/cases",
      color: "rgba(46,125,50,0.1)",
      delay: 0.22,
    },
    {
      icon: "👨‍⚖️",
      title: t("home.find_lawyer", "Find Lawyer"),
      description: t(
        "home.find_lawyer_desc",
        "Connect with a verified advocate near you",
      ),
      path: "/citizen/lawyers",
      color: "rgba(230,81,0,0.1)",
      delay: 0.29,
    },
    {
      icon: "📋",
      title: t("home.rti_tracker", "RTI Tracker"),
      description: t("home.rti_tracker_desc", "File & track RTI applications with auto-deadline alerts"),
      path: "/citizen/rti",
      color: "rgba(13,71,161,0.1)",
      delay: 0.36,
    },
    {
      icon: "📖",
      title: t("home.legal_faq", "Legal FAQ"),
      description: t("home.legal_faq_desc", "Know your rights under Indian law"),
      path: "/laws/search",
      color: "rgba(1,121,111,0.1)",
      delay: 0.43,
    },
  ];

  const firstName = user?.name?.split(" ")[0] || t("home.there", "there");
  const greeting =
    new Date().getHours() < 12
      ? t("home.good_morning", "Good Morning")
      : new Date().getHours() < 17
        ? t("home.good_afternoon", "Good Afternoon")
        : t("home.good_evening", "Good Evening");

  return (
    <AnimatedPage>
      <Box
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1100,
          mx: "auto",
          pb: { xs: 10, md: 4 }, // padding for bottom nav on mobile
        }}
      >
        {/* Hero section */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Box
            sx={{
              borderRadius: `${RADIUS.xl}px`,
              background:
                "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)",
              p: { xs: 3, sm: 4 },
              mb: 3,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative circle */}
            <Box
              sx={{
                position: "absolute",
                right: -40,
                top: -40,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                right: 40,
                bottom: -60,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                pointerEvents: "none",
              }}
            />

            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.78)", mb: 0.5 }}
            >
              {greeting}, {firstName} &nbsp; 
              <lord-icon
                src={"/icons/zubhquzc.json"}
                trigger="loop"
                delay="500"
                target=".ns-nav-item"
                style={{
                  paddingTop: 3,
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  "--lord-icon-primary": "currentColor",
                  "--lord-icon-secondary": "currentColor",
                }}
              />
            </Typography>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              sx={{
                fontFamily: TYPOGRAPHY.fontFamily.display,
                fontWeight: 700,
                color: "#FFFFFF",
                mb: 1,
                lineHeight: 1.25,
              }}
            >
              {t("home.hero", "आपका कानूनी अधिकार, हमारी ज़िम्मेदारी")}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.82)",
                mb: 2.5,
                lineHeight: 1.6,
              }}
            >
              {t(
                "home.hero_sub")}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate("/citizen/documents/new")}
              sx={{
                background: "#FFFFFF",
                color: "var(--color-primary)",
                fontWeight: 700,
                borderRadius: `${RADIUS.md}px`,
                px: 3,
                py: 1,
                "&:hover": { background: "rgba(255,255,255,0.9)" },
                boxShadow: SHADOWS.md,
              }}
            >
              {t("home.create_doc", "Create a Document →")}
            </Button>
          </Box>
        </motion.div>

        {/* Emergency Legal Helpline CTA */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          whileHover={prefersReducedMotion ? undefined : { y: -2 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        >
          <Box
            onClick={() => navigate("/citizen/helpline")}
            sx={{
              mb: 3,
              p: { xs: 2, sm: 2.5 },
              borderRadius: `${RADIUS.lg}px`,
              background: "linear-gradient(135deg, rgba(255,23,68,0.12) 0%, rgba(183,28,28,0.08) 100%)",
              border: "2px solid rgba(255,23,68,0.3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
              transition: "border-color 0.2s, box-shadow 0.2s",
              "&:hover": {
                borderColor: "#FF1744",
                boxShadow: "0 4px 20px rgba(255,23,68,0.2)",
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255,23,68,0.12)",
                border: "1.5px solid rgba(255,23,68,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
                position: "relative",
              }}
            >
              🆘
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#FF1744",
                  border: "2px solid var(--color-surface)",
                  animation: "pulse-dot 1.4s ease-in-out infinite",
                  "@keyframes pulse-dot": {
                    "0%,100%": { transform: "scale(1)", opacity: 1 },
                    "50%": { transform: "scale(1.5)", opacity: 0.5 },
                  },
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#FF1744" }}>
                  Legal Emergency Helpline
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: "4px",
                    background: "#FF1744",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "0.06em",
                  }}
                >
                  FREE
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                Describe what happened — get instant law, steps & nearest legal aid in seconds. Works in Hindi, Tamil, Bengali & more.
              </Typography>
            </Box>
            <Typography sx={{ color: "#FF1744", fontWeight: 700, fontSize: "1.1rem", flexShrink: 0 }}>→</Typography>
          </Box>
        </motion.div>

        {/* Usage meter — free tier only */}
        <UsageMeter freeUsage={freeUsage} plan={plan} />

        {/* Upcoming hearing alert */}
        {loading ? (
          <Box sx={{ borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Skeleton variant="rounded" width={48} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={20} />
              <Skeleton variant="text" width="65%" height={16} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
        ) : (
          <HearingCard hearingCase={nextHearingCase} />
        )}

        {/* Quick actions */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <GradientHeading
            variant="h6"
            sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 700,
              mb: 2,
            }}
          >
            {t("home.quick_actions", "Quick Actions")}
          </GradientHeading>
        </motion.div>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          {QUICK_ACTIONS.map((action) => (
            <Grid item xs={6} sm={4} md={2.4} key={action.path}>
              <QuickActionCard {...action} />
            </Grid>
          ))}
        </Grid>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            {
              icon: "📄",
              value: 125000,
              label: t("home.stat_docs", "Documents Created"),
              delay: 0.1,
            },
            {
              icon: "👥",
              value: 48000,
              label: t("home.stat_users", "Indians Helped"),
              delay: 0.2,
            },
            {
              icon: "⚖️",
              value: 15,
              label: t("home.stat_templates", "Legal Templates"),
              delay: 0.3,
            },
          ].map((stat) => (
            <Grid item xs={4} key={stat.label}>
              <StatBadge {...stat} />
            </Grid>
          ))}
        </Grid>

        {/* Recent documents */}
        <Box
          sx={{
            borderRadius: `${RADIUS.xl}px`,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
            boxShadow: SHADOWS.sm,
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <GradientHeading
              variant="h6"
              sx={{
                fontFamily: TYPOGRAPHY.fontFamily.display,
                fontWeight: 700,
              }}
            >
              {t("home.recent_docs", "Recent Documents")}
            </GradientHeading>
            <Typography
              variant="caption"
              sx={{
                color: "var(--color-primary)",
                cursor: "pointer",
                fontWeight: 600,
              }}
              onClick={() => navigate("/citizen/documents")}
            >
              {t("home.view_all", "View all →")}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: "var(--color-border)" }} />

          <Box sx={{ px: 1.5, py: 1 }}>
            <AnimatePresence>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderBottom: '1px solid var(--color-border)' }}>
                    <Skeleton variant="rounded" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="50%" height={18} />
                      <Skeleton variant="text" width="30%" height={14} sx={{ mt: 0.5 }} />
                    </Box>
                    <Skeleton variant="rounded" width={56} height={20} />
                  </Box>
                ))
              ) : recentDocs?.length > 0 ? (
                recentDocs?.map((doc, i) => (
                  <DocumentRow key={doc._id} doc={doc} delay={0.1 + i * 0.08} />
                ))
              ) : (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography sx={{ fontSize: 40, mb: 1 }}>📄</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "var(--color-text-secondary)", mb: 2 }}
                    >
                      {t(
                        "home.no_docs_yet",
                        "You haven't created any documents yet.",
                      )}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate("/citizen/documents/new")}
                      sx={{
                        borderRadius: `${RADIUS.md}px`,
                        fontWeight: 600,
                        borderColor: "var(--color-primary)",
                        color: "var(--color-primary)",
                      }}
                    >
                      {t("home.create_first", "Create your first document")}
                    </Button>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>
    </AnimatedPage>
  );
}

export default CitizenHome;
