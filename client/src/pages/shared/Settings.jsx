/**
 * client/src/pages/shared/Settings.jsx
 * Unified profile + settings page (replaces separate CitizenProfile).
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import MuiAccordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme as useMuiTheme } from "@mui/material/styles";

import {
  selectUser,
  selectUserPersona,
  selectUserPlan,
  selectLawyerProfile,
  updateMe,
  setPassword,
  deactivateAccount,
  logout,
} from "../../store/slices/authSlice";
import { updateLawyerProfile } from "../../store/slices/lawyerSlice";
import {
  selectFreeUsage,
  getCurrentSubscription,
  cancelSubscription,
} from "../../store/slices/subscriptionSlice";
import {
  selectTheme,
  selectLanguage,
  setTheme,
  setLanguage,
} from "../../store/slices/uiSlice";
import AnimatedPage from "../../components/ui/AnimatedPage";
import LordIcon from "../../components/ui/LordIcon";
import { RADIUS, SHADOWS } from "../../theme/tokens";

const IC = {
  settings: "https://cdn.lordicon.com/asyunleq.json",
  account: "https://cdn.lordicon.com/kdduutaw.json",
  security: "https://cdn.lordicon.com/urswgamh.json",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman & Nicobar Islands",
  "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const THEMES = [
  {
    id: "default",
    label: "Blue Justice",
    primary: "#1565C0",
    bg: "#F8FAFF",
    desc: "Professional",
  },
  {
    id: "saffron",
    label: "Saffron India",
    primary: "#FF6F00",
    bg: "#FFFBF0",
    desc: "Patriotic",
  },
  {
    id: "dark",
    label: "Dark Mode",
    primary: "#5C9BF5",
    bg: "#0D1117",
    desc: "Developer",
  },
  {
    id: "highContrast",
    label: "High Contrast",
    primary: "#0000CC",
    bg: "#FFFFFF",
    desc: "Accessible",
  },
  {
    id: "emerald",
    label: "Emerald",
    primary: "#00695C",
    bg: "#F0FDF4",
    desc: "Calm",
  },
];

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

const SPECIALISATIONS = [
  { id: "criminal",             label: "Criminal Law" },
  { id: "civil",                label: "Civil Litigation" },
  { id: "family",               label: "Family Law" },
  { id: "property",             label: "Property Law" },
  { id: "consumer",             label: "Consumer Protection" },
  { id: "labour",               label: "Labour Law" },
  { id: "corporate",            label: "Corporate Law" },
  { id: "intellectual_property",label: "Intellectual Property" },
  { id: "tax",                  label: "Taxation" },
  { id: "constitutional",       label: "Constitutional Law" },
  { id: "environmental",        label: "Environmental Law" },
  { id: "cyber",                label: "Cyber Law" },
  { id: "immigration",          label: "Immigration" },
  { id: "rti",                  label: "RTI" },
  { id: "startup",              label: "Startup & Corporate" },
  { id: "other",                label: "Other" },
];

const PRACTICING_COURTS = [
  { id: "supreme_court",   label: "Supreme Court" },
  { id: "high_court",      label: "High Court" },
  { id: "district_court",  label: "District Court" },
  { id: "consumer_forum",  label: "Consumer Forum" },
  { id: "labour_court",    label: "Labour Court" },
  { id: "family_court",    label: "Family Court" },
  { id: "magistrate_court",label: "Magistrate Court" },
  { id: "tribunal",        label: "Tribunal" },
  { id: "other",           label: "Other" },
];

const CONSULTATION_MODES = [
  { id: "chat",      label: "💬 Chat",      desc: "Text-based consultation" },
  { id: "phone",     label: "📞 Phone",     desc: "Voice call" },
  { id: "video",     label: "📹 Video",     desc: "Video conference" },
  { id: "in_person", label: "🏛️ In-Person", desc: "Meet at office/court" },
];

const SAMPLE_TEXTS = {
  en: "Welcome to NyayaSetu — your bridge to justice.",
  hi: "न्यायसेतु में आपका स्वागत है — न्याय का सेतु।",
  bn: "NyayaSetu-এ স্বাগতম — ন্যায়বিচারের সেতু।",
  mr: "न्यायसेतु मध्ये आपले स्वागत आहे — न्यायाचा सेतू।",
  ta: "NyayaSetu-ல் வரவேற்கிறோம் — நீதிக்கான பாலம்.",
  te: "NyayaSetu కు స్వాగతం — న్యాయానికి వారధి.",
  gu: "NyayaSetu માં આપનું સ્વાગત છે — ન્યાયનો સેતુ.",
  kn: "NyayaSetu ಗೆ ಸ್ವಾಗತ — ನ್ಯಾಯಕ್ಕೆ ಸೇತುವೆ.",
  ml: "NyayaSetu-ൽ സ്വാഗതം — നീതിക്കുള്ള പാലം.",
  pa: "NyayaSetu ਵਿੱਚ ਜੀ ਆਇਆਂ — ਇਨਸਾਫ਼ ਦਾ ਪੁੱਲ.",
  ur: ".نیایاسیتو میں خوش آمدید — انصاف کا پل",
};

const SECTIONS = [
  { id: "account", icon: IC.account, label: "Account" },
  { id: "appearance", icon: "🎨", label: "Appearance" },
  { id: "language", icon: "🌐", label: "Language" },
  { id: "notificationSec", icon: "🔔", label: "Notifications" },
  { id: "subscription", icon: "💎", label: "Subscription" },
  { id: "security", icon: IC.security, label: "Security" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getAvatarColor(name) {
  const palette = [
    "#1565C0",
    "#00695C",
    "#4A148C",
    "#BF360C",
    "#1B5E20",
    "#880E4F",
  ];
  if (!name) return palette[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function formatMemberSince(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });
}

// ─── Profile hero ─────────────────────────────────────────────────────────────

function ProfileHero({ user, persona }) {
  const plan = user?.subscription?.plan || "free";
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const personaLabel = persona
    ? persona.charAt(0).toUpperCase() + persona.slice(1)
    : "User";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Box
        sx={{
          background:
            "linear-gradient(135deg, var(--color-primary-alpha) 0%, var(--color-surface) 100%)",
          border: "1px solid var(--color-border)",
          borderRadius: `${RADIUS.xl}px`,
          p: { xs: 2.5, sm: 3.5 },
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 3,
        }}
      >
        <Avatar
          sx={{
            width: 80,
            height: 80,
            background: getAvatarColor(user?.name),
            fontSize: "1.9rem",
            fontWeight: 700,
            border: "3px solid var(--color-surface)",
            boxShadow: SHADOWS.md,
            flexShrink: 0,
          }}
        >
          {getInitials(user?.name)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "var(--color-text)",
              mb: 0.5,
              lineHeight: 1.25,
            }}
          >
            {user?.name || "Your Profile"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "var(--color-text-secondary)", mb: 1.25 }}
          >
            {[user?.phone, user?.email].filter(Boolean).join(" · ")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            <Chip
              label={personaLabel}
              size="small"
              sx={{
                background: "var(--color-primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            />
            <Chip
              label={`${planLabel} Plan`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                fontSize: "0.72rem",
              }}
            />
            <Chip
              label={`Member since ${formatMemberSince(user?.createdAt)}`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
                fontSize: "0.72rem",
              }}
            />
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Section: Account ─────────────────────────────────────────────────────────

function AccountSection({ user, showSnack }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [personal, setPersonal] = useState({ name: "", email: "" });
  const [location, setLocation] = useState({
    state: "",
    district: "",
    pincode: "",
  });
  const [personalBusy, setPersonalBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setPersonal({ name: user.name || "", email: user.email || "" });
    setLocation({
      state: user.state || "",
      district: user.district || "",
      pincode: user.pincode || "",
    });
  }, [user]);

  const savePersonal = async () => {
    setPersonalBusy(true);
    const result = await dispatch(
      updateMe({
        name: personal.name.trim(),
        ...(personal.email && { email: personal.email }),
      }),
    );
    setPersonalBusy(false);
    updateMe.fulfilled.match(result)
      ? showSnack(t("settings.saved", "Settings saved!"))
      : showSnack(
          result.payload ||
            t("settings.save_failed", "Failed to save. Please try again."),
          "error",
        );
  };

  const saveLocation = async () => {
    setLocationBusy(true);
    const payload = {};
    if (location.state) payload.state = location.state;
    if (location.district) payload.district = location.district;
    if (location.pincode) payload.pincode = location.pincode;
    const result = await dispatch(updateMe(payload));
    setLocationBusy(false);
    updateMe.fulfilled.match(result)
      ? showSnack(t("settings.saved", "Settings saved!"))
      : showSnack(
          result.payload ||
            t("settings.save_failed", "Failed to save. Please try again."),
          "error",
        );
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` },
  };
  const boxSx = {
    p: 2.5,
    border: "1px solid var(--color-border)",
    borderRadius: `${RADIUS.lg}px`,
    background: "var(--color-surface)",
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {t("settings.account", "Account Information")}
      </Typography>

      {/* Personal info */}
      <Box sx={boxSx}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 2 }}
        >
          👤 Personal Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t("settings.name", "Full Name")}
              value={personal.name}
              onChange={(e) =>
                setPersonal((p) => ({ ...p, name: e.target.value }))
              }
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t("settings.email", "Email (optional)")}
              type="email"
              value={personal.email}
              onChange={(e) =>
                setPersonal((p) => ({ ...p, email: e.target.value }))
              }
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Phone Number"
              value={user?.phone || "—"}
              disabled
              helperText="Phone number cannot be changed"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">📱</InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={savePersonal}
          disabled={personalBusy || !personal.name.trim()}
          sx={{
            mt: 2.5,
            borderRadius: `${RADIUS.md}px`,
            fontWeight: 700,
            background: "var(--color-primary)",
          }}
        >
          {personalBusy ? (
            <CircularProgress size={20} sx={{ color: "#fff" }} />
          ) : (
            t("settings.save_changes", "Save Changes")
          )}
        </Button>
      </Box>

      {/* Location */}
      <Box sx={boxSx}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 2 }}
        >
          📍 Location
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("settings.state", "State")}</InputLabel>
              <Select
                value={location.state}
                label={t("settings.state", "State")}
                onChange={(e) =>
                  setLocation((p) => ({ ...p, state: e.target.value }))
                }
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">
                  <em>Select State</em>
                </MenuItem>
                {INDIAN_STATES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label={t("settings.district", "District")}
              value={location.district}
              onChange={(e) =>
                setLocation((p) => ({ ...p, district: e.target.value }))
              }
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Pincode"
              value={location.pincode}
              onChange={(e) =>
                setLocation((p) => ({
                  ...p,
                  pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              inputProps={{ maxLength: 6, inputMode: "numeric" }}
              sx={fieldSx}
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={saveLocation}
          disabled={locationBusy}
          sx={{
            mt: 2.5,
            borderRadius: `${RADIUS.md}px`,
            fontWeight: 700,
            background: "var(--color-primary)",
          }}
        >
          {locationBusy ? (
            <CircularProgress size={20} sx={{ color: "#fff" }} />
          ) : (
            "Save Location"
          )}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Section: Appearance ──────────────────────────────────────────────────────

function AppearanceSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activeTheme = useSelector(selectTheme);

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
          mb: 2,
        }}
      >
        {t("settings.appearance", "Appearance")}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "var(--color-text-secondary)", mb: 2.5 }}
      >
        {t(
          "settings.theme.desc",
          "Choose a theme that suits you. Changes take effect immediately.",
        )}
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {THEMES.map((th) => {
          const isActive = activeTheme === th.id;
          return (
            <motion.div
              key={th.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Box
                onClick={() => dispatch(setTheme(th.id))}
                sx={{
                  width: { xs: 130, sm: 150 },
                  cursor: "pointer",
                  borderRadius: `${RADIUS.lg}px`,
                  border: isActive
                    ? "2.5px solid var(--color-primary)"
                    : "1.5px solid var(--color-border)",
                  overflow: "hidden",
                  boxShadow: isActive ? SHADOWS.md : "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              >
                <Box
                  sx={{
                    height: 70,
                    background: th.bg,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    p: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      height: 8,
                      borderRadius: 4,
                      background: th.primary,
                    }}
                  />
                  <Box
                    sx={{
                      width: "70%",
                      height: 5,
                      borderRadius: 4,
                      background: th.primary,
                      opacity: 0.4,
                    }}
                  />
                  <Box
                    sx={{
                      width: "85%",
                      height: 5,
                      borderRadius: 4,
                      background: th.primary,
                      opacity: 0.25,
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    p: 1,
                    background: "var(--color-surface)",
                    borderTop: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? "var(--color-primary)"
                        : "var(--color-text)",
                    }}
                  >
                    {th.label}
                    {isActive && " ✓"}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: "var(--color-text-secondary)",
                      fontSize: "0.65rem",
                    }}
                  >
                    {th.desc}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Section: Language ────────────────────────────────────────────────────────

function LanguageSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activeLanguage = useSelector(selectLanguage);
  const [preview, setPreview] = useState(false);

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
          mb: 2,
        }}
      >
        {t("settings.language", "Language")}
      </Typography>

      {preview && (
        <Box
          sx={{
            mb: 2.5,
            p: 2,
            borderRadius: `${RADIUS.md}px`,
            background: "var(--color-primary-alpha)",
            border: "1px solid var(--color-primary)",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "var(--color-primary)", fontStyle: "italic" }}
          >
            {SAMPLE_TEXTS[activeLanguage] || SAMPLE_TEXTS.en}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
        {LANGUAGES.map((lang) => {
          const isActive = activeLanguage === lang.code;
          return (
            <Chip
              key={lang.code}
              label={
                <Box sx={{ textAlign: "center" }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                    }}
                  >
                    {lang.native}
                  </span>
                  <span style={{ fontSize: "0.65rem", opacity: 0.75 }}>
                    {lang.label}
                  </span>
                </Box>
              }
              onClick={() => dispatch(setLanguage(lang.code))}
              sx={{
                height: 48,
                px: 0.5,
                cursor: "pointer",
                background: isActive
                  ? "var(--color-primary)"
                  : "var(--color-surface)",
                color: isActive ? "#fff" : "var(--color-text)",
                border: isActive ? "none" : "1px solid var(--color-border)",
                "&:hover": {
                  background: isActive
                    ? "var(--color-primary)"
                    : "var(--color-overlay)",
                },
              }}
            />
          );
        })}
      </Box>

      <Button
        variant="outlined"
        size="small"
        onClick={() => setPreview((v) => !v)}
        sx={{
          borderRadius: `${RADIUS.md}px`,
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        {preview ? "Hide preview" : "👁 Preview text"}
      </Button>
    </Box>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection({ user, showSnack }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [prefs, setPrefs] = useState({
    whatsapp: user?.whatsappOptIn || false,
    whatsappNumber: user?.whatsappNumber?.replace("+91", "") || "",
    email: !!user?.email,
    hearingReminders: true,
    documentReady: true,
    weeklyDigest: false,
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const notifItems = [
    {
      key: "hearingReminders",
      icon: "⚖️",
      label: t("settings.notifications.hearings", "Hearing Reminders"),
      desc: t(
        "settings.notifications.hearings_desc",
        "Get alerted 2 days before each scheduled hearing",
      ),
    },
    {
      key: "documentReady",
      icon: "📄",
      label: t("settings.notifications.doc_ready", "Document Ready"),
      desc: t(
        "settings.notifications.doc_ready_desc",
        "When your generated document is ready",
      ),
    },
    {
      key: "weeklyDigest",
      icon: "📊",
      label: t("settings.notifications.digest", "Weekly Digest"),
      desc: t(
        "settings.notifications.digest_desc",
        "Summary of cases and upcoming hearings",
      ),
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    const payload = { whatsappOptIn: prefs.whatsapp };
    if (prefs.whatsapp && prefs.whatsappNumber) {
      payload.whatsappNumber = `+91${prefs.whatsappNumber}`;
    }
    const result = await dispatch(updateMe(payload));
    setSaving(false);
    updateMe.fulfilled.match(result)
      ? showSnack(t("settings.saved", "Settings saved!"))
      : showSnack(
          result.payload ||
            t("settings.save_failed", "Failed to save. Please try again."),
          "error",
        );
  };

  const switchSx = {
    "& .MuiSwitch-thumb": { background: "var(--color-primary)" },
  };
  const rowSx = {
    mb: 1.5,
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "flex-start",
    ml: 0,
    mr: 0,
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {t("settings.notificationSec", "Notifications")}
      </Typography>

      {/* Alert channels */}
      <Box
        sx={{
          p: 2,
          borderRadius: `${RADIUS.lg}px`,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}
        >
          {t("settings.notifications.channels", "Alert Channels")}
        </Typography>

        <FormControlLabel
          sx={{ ...rowSx, mb: prefs.whatsapp ? 1 : 1.5 }}
          labelPlacement="start"
          control={
            <Switch
              checked={prefs.whatsapp}
              onChange={() => toggle("whatsapp")}
              sx={switchSx}
            />
          }
          label={
            <Box>
              <Typography variant="body2">📱 WhatsApp</Typography>
              <Typography
                variant="caption"
                sx={{ color: "var(--color-text-secondary)" }}
              >
                {user?.phone || "Link your WhatsApp number"}
              </Typography>
            </Box>
          }
        />

        {prefs.whatsapp && (
          <TextField
            fullWidth
            size="small"
            label="WhatsApp Number"
            value={prefs.whatsappNumber}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
              }))
            }
            inputProps={{ maxLength: 10, inputMode: "numeric" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography
                    variant="caption"
                    sx={{ color: "var(--color-text-secondary)" }}
                  >
                    +91
                  </Typography>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.5,
              "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` },
            }}
          />
        )}

        <FormControlLabel
          sx={rowSx}
          labelPlacement="start"
          control={
            <Switch
              checked={prefs.email}
              onChange={() => toggle("email")}
              sx={switchSx}
            />
          }
          label={
            <Box>
              <Typography variant="body2">📧 Email</Typography>
              <Typography
                variant="caption"
                sx={{ color: "var(--color-text-secondary)" }}
              >
                {user?.email || "Add email in Account settings"}
              </Typography>
            </Box>
          }
        />
      </Box>

      {/* Notification types */}
      <Box
        sx={{
          p: 2,
          borderRadius: `${RADIUS.lg}px`,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}
        >
          {t("settings.notifTypes", "What to notify me about")}
        </Typography>
        {notifItems.map((item) => (
          <FormControlLabel
            key={item.key}
            labelPlacement="start"
            sx={rowSx}
            control={
              <Switch
                checked={prefs[item.key]}
                onChange={() => toggle(item.key)}
                sx={switchSx}
              />
            }
            label={
              <Box sx={{ mb: 0.25 }}>
                <Typography variant="body2">
                  {item.icon} {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "var(--color-text-secondary)" }}
                >
                  {item.desc}
                </Typography>
              </Box>
            }
          />
        ))}
      </Box>

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        sx={{
          borderRadius: `${RADIUS.md}px`,
          fontWeight: 700,
          background: "var(--color-primary)",
          width: "fit-content",
        }}
      >
        {saving ? (
          <CircularProgress size={20} sx={{ color: "#fff" }} />
        ) : (
          t("settings.notifications.save_preferences", "Save Preferences")
        )}
      </Button>
    </Box>
  );
}

// ─── Section: Subscription ────────────────────────────────────────────────────

function SubscriptionSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const plan = useSelector(selectUserPlan);
  const freeUsage = useSelector(selectFreeUsage);

  useEffect(() => {
    dispatch(getCurrentSubscription());
  }, [dispatch]);

  const meters = [
    {
      label: t("settings.docs", "Documents"),
      used: freeUsage?.docsGenerated || 0,
      limit: freeUsage?.docsLimit || 3,
      icon: "📄",
    },
    {
      label: t("settings.cases", "Cases"),
      used: freeUsage?.casesTracked || 0,
      limit: freeUsage?.casesLimit || 1,
      icon: "⚖️",
    },
    {
      label: t("settings.chats", "AI Chats"),
      used: freeUsage?.aiChatsUsed || 0,
      limit: freeUsage?.aiChatsLimit || 5,
      icon: "💬",
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {t("settings.subscription", "Subscription")}
      </Typography>

      <Box
        sx={{
          p: 2.5,
          borderRadius: `${RADIUS.xl}px`,
          border: "2px solid var(--color-primary)",
          background: "var(--color-primary-alpha)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {t("settings.current_plan", "Current Plan")}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: "var(--color-primary)",
                textTransform: "capitalize",
              }}
            >
              {plan}
            </Typography>
          </Box>
          {plan === "free" && (
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate("/pricing")}
              sx={{
                borderRadius: `${RADIUS.md}px`,
                fontWeight: 700,
                background: "var(--color-primary)",
              }}
            >
              {t("settings.upgrade", "Upgrade")} ↗
            </Button>
          )}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
          {meters.map((m) => {
            const unlimited = m.limit >= 999_999;
            const pct = unlimited ? 5 : Math.min(100, (m.used / m.limit) * 100);
            return (
              <Box key={m.label}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: "var(--color-text)" }}
                  >
                    {m.icon} {m.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "var(--color-text-secondary)" }}
                  >
                    {unlimited ? `${m.used} / ∞` : `${m.used} / ${m.limit}`}
                  </Typography>
                </Box>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ transformOrigin: "left" }}
                >
                  <LinearProgress
                    variant="determinate"
                    value={unlimited ? 10 : pct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--color-border)",
                      "& .MuiLinearProgress-bar": {
                        background:
                          pct >= 90 && !unlimited
                            ? "var(--color-error)"
                            : pct >= 70 && !unlimited
                              ? "var(--color-warning)"
                              : "var(--color-primary)",
                        borderRadius: 3,
                      },
                    }}
                  />
                </motion.div>
              </Box>
            );
          })}
        </Box>

        {freeUsage?.resetDate && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "var(--color-text-secondary)",
              mt: 1.5,
            }}
          >
            Resets on{" "}
            {new Date(freeUsage.resetDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </Typography>
        )}
      </Box>

      {plan !== "free" && (
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            if (
              window.confirm(
                "Cancel subscription? You keep access until end of billing period.",
              )
            ) {
              await dispatch(cancelSubscription());
            }
          }}
          sx={{
            borderRadius: `${RADIUS.md}px`,
            borderColor: "var(--color-error)",
            color: "var(--color-error)",
            fontWeight: 600,
            width: "fit-content",
          }}
        >
          {t("settings.cancel", "Cancel Subscription")}
        </Button>
      )}
    </Box>
  );
}

// ─── Section: Lawyer Profile ─────────────────────────────────────────────────

function LawyerProfileSection({ lawyerProfile, showSnack }) {
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    barCouncilNumber: "",
    barCouncilState: "",
    experience: 0,
    bio: "",
    specialisations: [],
    practicingStates: [],
    practicingCourts: [],
    languages: [],
    consultationFee: 500,
    consultationModes: [],
    isAcceptingClients: true,
    isPublic: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lawyerProfile) return;
    setForm({
      barCouncilNumber: lawyerProfile.barCouncilNumber || "",
      barCouncilState:  lawyerProfile.barCouncilState  || "",
      experience:       lawyerProfile.experience        ?? 0,
      bio:              lawyerProfile.bio               || "",
      specialisations:  lawyerProfile.specialisations   || [],
      practicingStates: lawyerProfile.practicingStates  || [],
      practicingCourts: lawyerProfile.practicingCourts  || [],
      languages:        lawyerProfile.languages         || [],
      consultationFee:  lawyerProfile.consultationFee   ? Math.round(lawyerProfile.consultationFee / 100) : 500,
      consultationModes:lawyerProfile.consultationModes || [],
      isAcceptingClients: lawyerProfile.isAcceptingClients ?? true,
      isPublic:          lawyerProfile.isPublic          ?? true,
    });
  }, [lawyerProfile]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleChip = (key, val) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  const handleSave = async () => {
    setSaving(true);
    const result = await dispatch(updateLawyerProfile({
      ...form,
      consultationFee: form.consultationFee * 100,
    }));
    setSaving(false);
    updateLawyerProfile.fulfilled.match(result)
      ? showSnack("Lawyer profile saved!")
      : showSnack(result.payload || "Failed to save profile.", "error");
  };

  const boxSx = {
    p: 2.5, border: "1px solid var(--color-border)",
    borderRadius: `${RADIUS.lg}px`, background: "var(--color-surface)",
  };
  const chipSx = (active) => ({
    cursor: "pointer", fontWeight: active ? 700 : 500, m: 0.4,
    background: active ? "var(--color-primary)" : "var(--color-surface)",
    color:      active ? "#fff" : "var(--color-text-secondary)",
    border:     active ? "none" : "1px solid var(--color-border)",
    "&:hover":  { background: active ? "var(--color-primary)" : "var(--color-overlay)" },
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h6" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: "var(--color-text)" }}>
        ⚖️ Lawyer Profile
      </Typography>

      {/* Practice details */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 2 }}>
          📋 Practice Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Bar Council Enrollment Number"
              value={form.barCouncilNumber}
              onChange={(e) => set("barCouncilNumber", e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Bar Council State</InputLabel>
              <Select value={form.barCouncilState} label="Bar Council State"
                onChange={(e) => set("barCouncilState", e.target.value)}
                sx={{ borderRadius: `${RADIUS.md}px` }}>
                {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Years of Experience" type="number"
              value={form.experience}
              onChange={(e) => set("experience", Math.max(0, parseInt(e.target.value) || 0))}
              inputProps={{ min: 0, max: 60 }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline rows={4} size="small" label="Professional Bio"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              inputProps={{ maxLength: 2000 }}
              helperText={`${form.bio.length}/2000`}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }} />
          </Grid>
        </Grid>
      </Box>

      {/* Specialisations */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}>
          🎓 Areas of Practice
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", mb: -0.5 }}>
          {SPECIALISATIONS.map((s) => {
            const active = form.specialisations.includes(s.id);
            return (
              <Chip key={s.id} label={s.label} size="small" clickable
                onClick={() => toggleChip("specialisations", s.id)} sx={chipSx(active)} />
            );
          })}
        </Box>
      </Box>

      {/* Practicing states */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}>
          📍 States of Practice
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", mb: -0.5 }}>
          {INDIAN_STATES.map((s) => {
            const active = form.practicingStates.includes(s);
            return (
              <Chip key={s} label={s} size="small" clickable
                onClick={() => toggleChip("practicingStates", s)} sx={chipSx(active)} />
            );
          })}
        </Box>
      </Box>

      {/* Practicing courts */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}>
          🏛️ Courts of Practice
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", mb: -0.5 }}>
          {PRACTICING_COURTS.map((c) => {
            const active = form.practicingCourts.includes(c.id);
            return (
              <Chip key={c.id} label={c.label} size="small" clickable
                onClick={() => toggleChip("practicingCourts", c.id)} sx={chipSx(active)} />
            );
          })}
        </Box>
      </Box>

      {/* Languages */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}>
          🌐 Languages
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", mb: -0.5 }}>
          {LANGUAGES.map((l) => {
            const active = form.languages.includes(l.code);
            return (
              <Chip key={l.code} label={l.native} size="small" clickable
                onClick={() => toggleChip("languages", l.code)} sx={chipSx(active)} />
            );
          })}
        </Box>
      </Box>

      {/* Consultation settings */}
      <Box sx={boxSx}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 2 }}>
          💼 Consultation Settings
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" label="Consultation Fee (₹)" type="number"
              value={form.consultationFee}
              onChange={(e) => set("consultationFee", Math.max(0, parseInt(e.target.value) || 0))}
              inputProps={{ min: 0 }}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              helperText="Per consultation (0 = Free)"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }} />
          </Grid>
        </Grid>

        <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1, display: "block" }}>
          Consultation Modes
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", mb: 2, mx: -0.5 }}>
          {CONSULTATION_MODES.map((m) => {
            const active = form.consultationModes.includes(m.id);
            return (
              <Chip key={m.id} label={m.label} clickable
                onClick={() => toggleChip("consultationModes", m.id)}
                sx={{ ...chipSx(active), height: 32, fontSize: "0.8rem" }} />
            );
          })}
        </Box>

        <FormControlLabel
          sx={{ mb: 1.5, display: "flex", width: "100%", justifyContent: "space-between", ml: 0 }}
          labelPlacement="start"
          control={
            <Switch checked={form.isAcceptingClients} onChange={(e) => set("isAcceptingClients", e.target.checked)}
              sx={{ "& .MuiSwitch-thumb": { background: "var(--color-primary)" } }} />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Accepting New Clients</Typography>
              <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                Toggle off to pause incoming consultation requests
              </Typography>
            </Box>
          }
        />
        <FormControlLabel
          sx={{ display: "flex", width: "100%", justifyContent: "space-between", ml: 0 }}
          labelPlacement="start"
          control={
            <Switch checked={form.isPublic} onChange={(e) => set("isPublic", e.target.checked)}
              sx={{ "& .MuiSwitch-thumb": { background: "var(--color-primary)" } }} />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Public Profile</Typography>
              <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                Visible in lawyer search results
              </Typography>
            </Box>
          }
        />
      </Box>

      <Button variant="contained" onClick={handleSave} disabled={saving}
        sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: "var(--color-primary)", width: "fit-content" }}>
        {saving ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Save Lawyer Profile"}
      </Button>
    </Box>
  );
}

// ─── Section: Security ────────────────────────────────────────────────────────

function SecuritySection({ showSnack }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  const handleChangePassword = async () => {
    setPwError("");
    if (pw.next.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    const payload = {
      password: pw.next,
      ...(pw.current && { currentPassword: pw.current }),
    };
    const result = await dispatch(setPassword(payload));
    setPwBusy(false);
    if (setPassword.fulfilled.match(result)) {
      setPw({ current: "", next: "", confirm: "" });
      showSnack("Password updated successfully.");
    } else {
      setPwError(result.payload || "Failed to change password.");
    }
  };

  const handleLogoutAll = async () => {
    if (
      window.confirm(
        t("settings.confirmLogoutAll", "Log out from all devices?"),
      )
    ) {
      await dispatch(logout());
      navigate("/login", { replace: true });
    }
  };

  const handleDeactivate = async () => {
    setDeactivateBusy(true);
    const result = await dispatch(deactivateAccount());
    setDeactivateBusy(false);
    setDeactivateOpen(false);
    if (deactivateAccount.fulfilled.match(result)) {
      navigate("/login");
    } else {
      showSnack(result.payload || "Failed to deactivate account.", "error");
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` },
  };
  const eyeBtn = (key) => (
    <InputAdornment position="end">
      <IconButton
        size="small"
        onClick={() => setShowPw((p) => ({ ...p, [key]: !p[key] }))}
      >
        <Typography sx={{ fontSize: 16 }}>
          {showPw[key] ? "🙈" : "👁️"}
        </Typography>
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
        }}
      >
        {t("settings.security", "Security")}
      </Typography>

      {/* Change password */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: `${RADIUS.lg}px`,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 2 }}
        >
          🔑 Change Password
        </Typography>
        {pwError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {pwError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Current Password (leave blank if not set)"
              type={showPw.current ? "text" : "password"}
              value={pw.current}
              onChange={(e) =>
                setPw((p) => ({ ...p, current: e.target.value }))
              }
              InputProps={{ endAdornment: eyeBtn("current") }}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="New Password"
              type={showPw.next ? "text" : "password"}
              value={pw.next}
              helperText="Min. 8 characters"
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              InputProps={{ endAdornment: eyeBtn("next") }}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Confirm New Password"
              type={showPw.confirm ? "text" : "password"}
              value={pw.confirm}
              onChange={(e) =>
                setPw((p) => ({ ...p, confirm: e.target.value }))
              }
              InputProps={{ endAdornment: eyeBtn("confirm") }}
              sx={fieldSx}
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={handleChangePassword}
          disabled={pwBusy || !pw.next}
          sx={{
            mt: 2.5,
            borderRadius: `${RADIUS.md}px`,
            fontWeight: 700,
            background: "var(--color-primary)",
          }}
        >
          {pwBusy ? (
            <CircularProgress size={20} sx={{ color: "#fff" }} />
          ) : (
            "Change Password"
          )}
        </Button>
      </Box>

      {/* Active sessions */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: `${RADIUS.lg}px`,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1 }}
        >
          {t("settings.activeSessions", "Active Sessions")}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-secondary)", display: "block", mb: 2 }}
        >
          {t(
            "settings.sessionsDesc",
            "NyayaSetu keeps you logged in on up to 5 devices.",
          )}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={handleLogoutAll}
          sx={{
            borderRadius: `${RADIUS.md}px`,
            borderColor: "var(--color-error)",
            color: "var(--color-error)",
            fontWeight: 600,
          }}
        >
          🔒 {t("settings.logoutAll", "Logout from All Devices")}
        </Button>
      </Box>

      {/* Deactivate account */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: `${RADIUS.lg}px`,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1 }}
        >
          ⚠️ Danger Zone
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "var(--color-text-secondary)",
            display: "block",
            mb: 2,
            lineHeight: 1.7,
          }}
        >
          Deactivating your account will sign you out and prevent future logins.
          Your data is retained for 30 days — contact support to reactivate
          before then.
        </Typography>
        <Divider sx={{ mb: 2, borderColor: "var(--color-border)" }} />
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => setDeactivateOpen(true)}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600 }}
        >
          Deactivate Account
        </Button>
      </Box>

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={deactivateOpen}
        onClose={() => !deactivateBusy && setDeactivateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, background: "var(--color-surface)" },
        }}
      >
        <DialogTitle
          sx={{ fontWeight: 700, color: "var(--color-text)", pb: 1 }}
        >
          ⚠️ Deactivate Account?
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}
          >
            This will immediately sign you out. Your documents and case data
            will be retained for 30 days. Contact{" "}
            <strong>support@nyayasetu.in</strong> to reverse this.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDeactivateOpen(false)}
            disabled={deactivateBusy}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeactivate}
            disabled={deactivateBusy}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            {deactivateBusy ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Yes, Deactivate"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Section icon — renders LordIcon URL or emoji string ─────────────────────

function SectionIcon({ icon, size = 22 }) {
  if (typeof icon === "string" && icon.startsWith("https://")) {
    return (
      <lord-icon src={icon} trigger="loop-on-hover" delay="500"
        style={{ width: size, height: size, flexShrink: 0,
          "--lord-icon-primary": "currentColor", "--lord-icon-secondary": "currentColor" }} />
    );
  }
  return <Typography sx={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{icon}</Typography>;
}

// ─── Main component ───────────────────────────────────────────────────────────

function Settings() {
  const { t } = useTranslation();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const user          = useSelector(selectUser);
  const persona       = useSelector(selectUserPersona);
  const lawyerProfile = useSelector(selectLawyerProfile);
  const isLawyer      = persona === "lawyer" || persona === "paralegal";

  const [activeTab, setActiveTab] = useState("account");
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  const showSnack = (msg, severity = "success") =>
    setSnack({ open: true, msg, severity });

  const sections = [
    { id: "account",         icon: IC.account,  label: "Account" },
    ...(isLawyer ? [{ id: "lawyerProfile", icon: "⚖️", label: "Lawyer Profile" }] : []),
    { id: "appearance",      icon: "🎨",         label: "Appearance" },
    { id: "language",        icon: "🌐",         label: "Language" },
    { id: "notificationSec", icon: "🔔",         label: "Notifications" },
    { id: "subscription",    icon: "💎",         label: "Subscription" },
    { id: "security",        icon: IC.security,  label: "Security" },
  ];

  const sectionContent = {
    account:       <AccountSection user={user} showSnack={showSnack} />,
    lawyerProfile: <LawyerProfileSection lawyerProfile={lawyerProfile} showSnack={showSnack} />,
    appearance:    <AppearanceSection />,
    language:      <LanguageSection />,
    notificationSec: <NotificationsSection user={user} showSnack={showSnack} />,
    subscription:  <SubscriptionSection />,
    security:      <SecuritySection showSnack={showSnack} />,
  };

  return (
    <AnimatedPage>
      <Box
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 960,
          mx: "auto",
          pb: { xs: 10, md: 6 },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <LordIcon
              src={IC.settings}
              trigger="loop"
              size={40}
              state="loop-cog"
              colors="primary:#1565C0,secondary:#5C9BF5"
            />
            <Typography
              variant="h4"
              sx={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              {t("settings.title", "Settings")}
            </Typography>
          </Box>
        </motion.div>

        <ProfileHero user={user} persona={persona} />

        {isMobile ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {sections.map((sec) => (
              <MuiAccordion
                key={sec.id}
                elevation={0}
                sx={{
                  borderRadius: `${RADIUS.lg}px !important`,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  "&:before": { display: "none" },
                  overflow: "hidden",
                }}
              >
                <AccordionSummary
                  expandIcon={<Typography sx={{ fontSize: 14 }}>▾</Typography>}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <SectionIcon icon={sec.icon} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)" }}>
                      {t(`settings.${sec.id}`, sec.label)}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails
                  sx={{ borderTop: "1px solid var(--color-border)", pt: 2.5 }}
                >
                  {sectionContent[sec.id]}
                </AccordionDetails>
              </MuiAccordion>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 3 }}>
            {/* Vertical tab list */}
            <Box sx={{ width: 200, flexShrink: 0 }}>
              <Box
                sx={{
                  borderRadius: `${RADIUS.xl}px`,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  overflow: "hidden",
                }}
              >
                {sections.map((sec) => {
                  const isActive = activeTab === sec.id;
                  return (
                    <Box
                      className="ns-nav-item"
                      key={sec.id}
                      onClick={() => setActiveTab(sec.id)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        cursor: "pointer",
                        borderLeft: isActive
                          ? "3px solid var(--color-primary)"
                          : "3px solid transparent",
                        background: isActive
                          ? "var(--color-primary-alpha)"
                          : "transparent",
                        color: isActive
                          ? "var(--color-primary)"
                          : "var(--color-text-secondary)",
                        transition: "all 0.18s",
                        "&:hover": {
                          background: isActive
                            ? 'var(--color-primary-alpha)'
                            : "var(--color-overlay)",
                          color: "var(--color-primary)",
                        },
                      }}
                    >
                      <SectionIcon icon={sec.icon} />
                      <Typography variant="body2" sx={{ fontWeight: isActive ? 700 : 500 }}>
                        {t(`settings.${sec.id}`, sec.label)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Content panel */}
            <Box sx={{ flex: 1 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <Box
                    sx={{
                      p: 3.5,
                      borderRadius: `${RADIUS.xl}px`,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      boxShadow: SHADOWS.sm,
                    }}
                  >
                    {sectionContent[activeTab]}
                  </Box>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}

export default Settings;
