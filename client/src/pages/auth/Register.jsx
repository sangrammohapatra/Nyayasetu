/**
 * client/src/pages/auth/Register.jsx
 */

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { motion, AnimatePresence } from "framer-motion";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";

import {
  register as registerUser,
  selectAuthLoading,
  selectAuthError,
  clearError,
} from "../../store/slices/authSlice";
import { setTheme, setLanguage } from "../../store/slices/uiSlice";
import { RADIUS, SHADOWS } from "../../theme/tokens";

// ─── Indian states ────────────────────────────────────────────────────────────

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
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "اردو" },
];

const THEMES_PREVIEW = [
  { id: "default", label: "Blue Justice", color: "#1565C0" },
  { id: "saffron", label: "Saffron", color: "#FF6F00" },
  { id: "dark", label: "Dark", color: "#0D1117" },
  { id: "emerald", label: "Emerald", color: "#00695C" },
  { id: "highContrast", label: "High Contrast", color: "#000000" },
];

// ─── Yup schemas per step ─────────────────────────────────────────────────────

const step1Schema = yup.object({
  name: yup
    .string()
    .min(2, "Name must be at least 2 characters")
    .required("Name is required"),
  state: yup.string().required("State is required"),
  district: yup.string().required("District is required"),
});

const step2Schema = yup.object({
  persona: yup
    .string()
    .oneOf(["citizen", "lawyer"], "Please select a role")
    .required("Role is required"),
});

const step3Schema = yup.object({
  preferredLanguage: yup.string().required(),
  whatsappOptIn: yup.boolean(),
});

const schemas = [step1Schema, step2Schema, step3Schema];

// ─── Slide variants ───────────────────────────────────────────────────────────

const slideVariants = (direction) => ({
  enter: { x: direction > 0 ? 60 : -60, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
  exit: (dir) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" },
  }),
});

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ control, errors }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Typography
        variant="h5"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
          mb: 0.5,
        }}
      >
        {t("register.step1.title", "Personal Information")}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "var(--color-text-secondary)", mb: 1 }}
      >
        {t(
          "register.step1.subtitle",
          "This helps us tailor documents to your jurisdiction.",
        )}
      </Typography>

      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t("register.name", "Full Name")}
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            autoFocus
          />
        )}
      />

      <Controller
        name="state"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label={t("register.state", "State")}
            fullWidth
            error={!!errors.state}
            helperText={errors.state?.message}
          >
            {INDIAN_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        name="district"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t("register.district", "District")}
            fullWidth
            error={!!errors.district}
            helperText={errors.district?.message}
          />
        )}
      />
    </Box>
  );
}

function Step2({ control, errors, watch }) {
  const { t } = useTranslation();
  const selected = watch("persona");

  const PERSONAS = [
    {
      value: "citizen",
      icon: "🏠",
      title: t("register.persona.citizenTitle", "Citizen"),
      desc: t(
        "register.persona.citizenDesc",
        "I need legal documents, case tracking, and lawyer connections for my personal legal matters.",
      ),
      features: [
        t("register.f.docs", "Legal documents"),
        t("register.f.cases", "Case tracking"),
        t("register.f.lawyers", "Find lawyers"),
      ],
    },
    {
      value: "lawyer",
      icon: "⚖️",
      title: t("register.persona.lawyerTitle", "Advocate / Lawyer"),
      desc: t(
        "register.persona.lawyerDesc",
        "I am a practising advocate looking to offer consultations and grow my client base.",
      ),
      features: [
        t("register.f.clients", "Client portal"),
        t("register.f.consultations", "Consultations"),
        t("register.f.earnings", "Earnings dashboard"),
      ],
    },
  ];

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          fontFamily: "'Playfair Display',serif",
          fontWeight: 700,
          color: "var(--color-text)",
          mb: 0.5,
        }}
      >
        {t("register.step2.title", "Choose Your Role")}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "var(--color-text-secondary)", mb: 3 }}
      >
        {t("register.step2.subtitle", "You can change this later in settings.")}
      </Typography>

      <Controller
        name="persona"
        control={control}
        render={({ field }) => (
          <RadioGroup {...field} sx={{ gap: 2 }}>
            {PERSONAS.map((p) => {
              const isSelected = selected === p.value;
              return (
                <motion.div
                  key={p.value}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Box
                    onClick={() => field.onChange(p.value)}
                    sx={{
                      p: 2.5,
                      borderRadius: `${RADIUS.lg}px`,
                      border: isSelected
                        ? "2px solid var(--color-primary)"
                        : "1.5px solid var(--color-border)",
                      background: isSelected
                        ? "var(--color-primary-alpha)"
                        : "var(--color-surface)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? SHADOWS.md : "none",
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}
                    >
                      <Radio
                        value={p.value}
                        sx={{ mt: -0.5, color: "var(--color-primary)" }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Typography sx={{ fontSize: 22 }}>
                            {p.icon}
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, color: "var(--color-text)" }}
                          >
                            {p.title}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "var(--color-text-secondary)",
                            mb: 1.5,
                            lineHeight: 1.55,
                          }}
                        >
                          {p.desc}
                        </Typography>
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}
                        >
                          {p.features.map((f) => (
                            <Chip
                              key={f}
                              label={f}
                              size="small"
                              sx={{
                                background: isSelected
                                  ? "var(--color-primary)"
                                  : "var(--color-bg)",
                                color: isSelected
                                  ? "#fff"
                                  : "var(--color-text-secondary)",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                border: isSelected
                                  ? "none"
                                  : "1px solid var(--color-border)",
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </motion.div>
              );
            })}
          </RadioGroup>
        )}
      />
      {errors.persona && (
        <Typography
          variant="caption"
          sx={{ color: "var(--color-error)", mt: 1, display: "block" }}
        >
          {errors.persona.message}
        </Typography>
      )}
    </Box>
  );
}

function Step3({ control, watch }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const whatsappOptIn = watch("whatsappOptIn");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography
          variant="h5"
          sx={{
            fontFamily: "'Playfair Display',serif",
            fontWeight: 700,
            color: "var(--color-text)",
            mb: 0.5,
          }}
        >
          {t("register.step3.title", "Your Preferences")}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "var(--color-text-secondary)" }}
        >
          {t("register.step3.subtitle", "Customise your experience.")}
        </Typography>
      </Box>

      <Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}
        >
          {t("register.language", "Preferred Language")}
        </Typography>
        <Controller
          name="preferredLanguage"
          control={control}
          render={({ field }) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {LANGUAGES.map((l) => (
                <Chip
                  key={l.code}
                  label={l.label}
                  clickable
                  onClick={() => {
                    field.onChange(l.code);
                    dispatch(setLanguage(l.code));
                  }}
                  sx={{
                    background:
                      field.value === l.code
                        ? "var(--color-primary)"
                        : "var(--color-surface)",
                    color:
                      field.value === l.code ? "#fff" : "var(--color-text)",
                    border:
                      field.value === l.code
                        ? "none"
                        : "1px solid var(--color-border)",
                    fontWeight: 600,
                    transition: "all 0.18s",
                  }}
                />
              ))}
            </Box>
          )}
        />
      </Box>

      <Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "var(--color-text)", mb: 1.5 }}
        >
          {t("register.theme", "Theme")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {THEMES_PREVIEW.map((th) => (
            <Box
              key={th.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <motion.button
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => dispatch(setTheme(th.id))}
                title={th.label}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: th.color,
                  border: "2.5px solid var(--color-border)",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: "var(--color-text-secondary)",
                  fontSize: "0.65rem",
                }}
              >
                {th.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          borderRadius: `${RADIUS.lg}px`,
          background: "var(--color-surface)",
          border: "1.5px solid var(--color-border)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: "var(--color-text)" }}
            >
              📱 {t("register.whatsapp", "WhatsApp Notifications")}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {t(
                "register.whatsappDesc",
                "Get court hearing reminders and document updates on WhatsApp.",
              )}
            </Typography>
          </Box>
          <Controller
            name="whatsappOptIn"
            control={control}
            render={({ field }) => (
              <Switch
                {...field}
                checked={!!field.value}
                sx={{
                  "& .MuiSwitch-thumb": { background: "var(--color-primary)" },
                }}
              />
            )}
          />
        </Box>
        {whatsappOptIn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.25 }}
          >
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: `${RADIUS.md}px`,
                background: "var(--color-success-light, #E8F5E9)",
                border: "1px solid var(--color-success)",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "var(--color-success)", fontWeight: 600 }}
              >
                📅 Sample: "Your case DLHC01234562024 has a hearing tomorrow at
                10:30 AM at Delhi High Court."
              </Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepIndicator({ step, total }) {
  const { t } = useTranslation();
  const labels = [
    t("register.stepLabels.0", "Personal Info"),
    t("register.stepLabels.1", "Your Role"),
    t("register.stepLabels.2", "Preferences"),
  ];
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        {labels.map((label, i) => (
          <Typography
            key={i}
            variant="caption"
            sx={{
              fontWeight: i === step ? 700 : 400,
              color:
                i <= step
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
              display: { xs: i === step ? "block" : "none", sm: "block" },
            }}
          >
            {i < step ? "✓ " : `${i + 1}. `}
            {label}
          </Typography>
        ))}
      </Box>
      <LinearProgress
        variant="determinate"
        value={((step + 1) / total) * 100}
        sx={{
          height: 5,
          borderRadius: 3,
          background: "var(--color-border)",
          "& .MuiLinearProgress-bar": {
            background:
              "linear-gradient(90deg, var(--color-primary), var(--color-primary-light))",
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function Register() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  const phone = location.state?.phone || "";
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({});

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    trigger,
  } = useForm({
    resolver: yupResolver(schemas[step]),
    defaultValues: {
      name: "",
      state: "",
      district: "",
      persona: "citizen",
      preferredLanguage: "en",
      whatsappOptIn: true,
      preferredTheme: "default",
    },
    mode: "onTouched",
  });

  const TOTAL_STEPS = 3;

  const goNext = async () => {
    const valid = await trigger();
    if (!valid) return;
    const values = watch();
    setFormData((prev) => ({ ...prev, ...values }));
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const onSubmit = async (values) => {
    const merged = { ...formData, ...values, phone };
    dispatch(clearError());
    const result = await dispatch(registerUser(merged));
    if (result.meta.requestStatus === "fulfilled") {
      const persona = (result.payload?.user?.persona || "citizen").toLowerCase();
      navigate(`/${persona}/home`, { replace: true });
    }
  };

  const stepComponents = [
    <Step1 key={0} control={control} errors={errors} />,
    <Step2 key={1} control={control} errors={errors} watch={watch} />,
    <Step3 key={2} control={control} watch={watch} />,
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: `${RADIUS.md}px`,
                background: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⚖️
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                color: "var(--color-primary)",
              }}
            >
              NyayaSetu
            </Typography>
          </Box>
        </motion.div>

        <Box
          sx={{
            background: "var(--color-surface)",
            borderRadius: `${RADIUS.xl}px`,
            border: "1px solid var(--color-border)",
            boxShadow: SHADOWS.lg,
            p: { xs: 3, sm: 4 },
            overflow: "hidden",
          }}
        >
          <StepIndicator step={step} total={TOTAL_STEPS} />

          {/* Sliding step content */}
          <Box
            sx={{ position: "relative", overflow: "hidden", minHeight: 340 }}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants(direction)}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: "100%" }}
              >
                {stepComponents[step]}
              </motion.div>
            </AnimatePresence>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{ mt: 2, borderRadius: `${RADIUS.md}px` }}
              onClose={() => dispatch(clearError())}
            >
              {error}
            </Alert>
          )}

          {/* Navigation buttons */}
          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
            {step > 0 && (
              <Button
                variant="outlined"
                onClick={goBack}
                disabled={loading}
                sx={{
                  flex: 1,
                  py: 1.4,
                  borderRadius: `${RADIUS.md}px`,
                  fontWeight: 600,
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                  "&:hover": {
                    borderColor: "var(--color-primary)",
                    background: "var(--color-primary-alpha)",
                  },
                }}
              >
                {t("register.back", "Back")}
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button
                variant="contained"
                onClick={goNext}
                sx={{
                  flex: 2,
                  py: 1.4,
                  borderRadius: `${RADIUS.md}px`,
                  fontWeight: 700,
                  background: "var(--color-primary)",
                  "&:hover": {
                    background:
                      "var(--color-primary-dark, var(--color-primary))",
                  },
                }}
              >
                {t("register.continue", "Continue")} →
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                sx={{
                  flex: 2,
                  py: 1.4,
                  borderRadius: `${RADIUS.md}px`,
                  fontWeight: 700,
                  background: "var(--color-primary)",
                  "&:hover": {
                    background:
                      "var(--color-primary-dark, var(--color-primary))",
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  t("register.complete", "Complete Registration")
                )}
              </Button>
            )}
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            mt: 2,
            color: "var(--color-text-secondary)",
          }}
        >
          {t("register.alreadyHaveAccount", "Already have an account?")}{" "}
          <Typography
            component="span"
            variant="caption"
            sx={{
              color: "var(--color-primary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => navigate("/login")}
          >
            {t("register.signIn", "Sign In")}
          </Typography>
        </Typography>
      </Box>
    </Box>
  );
}

export default Register;
