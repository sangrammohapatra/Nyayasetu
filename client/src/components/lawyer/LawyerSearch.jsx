/**
 * client/src/components/lawyer/LawyerSearch.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import Skeleton from "@mui/material/Skeleton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import {
  searchLawyers,
  selectLawyerResults,
  selectSearchLoading,
} from "../../store/slices/lawyerSlice";
import ConsultationBooking from "./ConsultationBooking";
import { RADIUS } from "../../theme/tokens";
import AnimatedPage from "../ui/AnimatedPage";

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Bihar",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

const SPECIALISATIONS = [
  "Family Law",
  "Criminal Law",
  "Consumer Protection",
  "Property Law",
  "Labour Law",
  "Corporate Law",
  "Civil Litigation",
  "Intellectual Property",
  "Taxation",
  "Banking & Finance",
  "Environmental Law",
  "Constitutional Law",
];

const LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Gujarati",
];

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ rating = 0, count }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const rounded = Math.round(value);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const Icon = i < rounded ? StarRoundedIcon : StarBorderRoundedIcon;
          return (
            <Icon
              key={i}
              sx={{
                fontSize: 15,
                color: i < rounded ? "#C9A227" : "var(--color-border-strong)",
              }}
            />
          );
        })}
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "var(--color-text-secondary)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      >
        {value > 0 ? value.toFixed(1) : "New"}
        {count ? ` · ${count}` : ""}
      </Typography>
    </Box>
  );
}

// ─── Lawyer card ──────────────────────────────────────────────────────────────
function LawyerCard({ lawyer, onBook, delay = 0 }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const feeRupees = lawyer.consultationFee
    ? Math.round(lawyer.consultationFee / 100)
    : 0;
  const states = lawyer.practicingStates || [];
  const specs = lawyer.specialisations || [];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.22 }}
      style={{ height: "100%" }}
    >
      <Box
        sx={{
          p: 2.25,
          borderRadius: "12px",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          gap: 1.75,
          height: "100%",
          transition: "border-color 0.2s ease, background-color 0.2s ease",
          "&:hover": {
            borderColor: "var(--color-border-strong)",
            background: "var(--color-surface-raised)",
          },
        }}
      >
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              bgcolor: "var(--color-primary)",
              color: "var(--color-bg)",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            {(lawyer.name || "L").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--color-text)",
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {lawyer.name || "Advocate"}
              </Typography>
              {lawyer.isVerified && (
                <Tooltip title="Verified advocate">
                  <VerifiedRoundedIcon
                    sx={{ fontSize: 16, color: "var(--color-primary)", flexShrink: 0 }}
                  />
                </Tooltip>
              )}
              {lawyer.lawyerPlan === "firm" && (
                <Chip
                  label="Firm"
                  size="small"
                  sx={{
                    height: 18,
                    ml: 0.25,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    borderRadius: "4px",
                    background: "transparent",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-text-secondary)",
                  }}
                />
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                mt: 0.35,
                color: "var(--color-text-secondary)",
                minWidth: 0,
              }}
            >
              <Typography variant="caption" sx={{ color: "inherit", flexShrink: 0 }}>
                {lawyer.experience} {t("lawyer.experience", "years experience")}
              </Typography>
              {states.length > 0 && (
                <>
                  <Box
                    sx={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      bgcolor: "var(--color-border-strong)",
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, minWidth: 0 }}>
                    <LocationOnOutlinedIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "inherit",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {states.slice(0, 2).join(", ")}
                      {states.length > 2 ? ` +${states.length - 2}` : ""}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Box>

        <StarRating rating={lawyer.averageRating || 0} count={lawyer.totalRatings} />

        {specs.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {specs.slice(0, 3).map((s) => (
              <Chip
                key={s}
                label={s}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            ))}
            {specs.length > 3 && (
              <Chip
                label={`+${specs.length - 3}`}
                size="small"
                sx={{
                  height: 24,
                  fontSize: "0.72rem",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
              />
            )}
          </Box>
        )}

        {lawyer.bio && (
          <Typography
            variant="body2"
            sx={{
              color: "var(--color-text-secondary)",
              fontSize: "0.8125rem",
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {lawyer.bio}
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            mt: "auto",
            pt: 1.75,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "var(--color-text-secondary)",
                fontSize: "0.75rem",
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {t("lawyer.consult_fee", "Consultation")}
            </Typography>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "1.05rem",
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {feeRupees > 0 ? `₹${feeRupees.toLocaleString("en-IN")}` : "Free"}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            disableElevation
            onClick={() => onBook(lawyer)}
            disabled={!lawyer.isAvailable}
            sx={{
              borderRadius: "8px",
              px: 1.75,
              py: 0.85,
              minWidth: 104,
              fontWeight: 600,
              fontSize: "0.8125rem",
              boxShadow: "none",
              backgroundColor: "var(--color-primary)",
              color: "var(--color-bg)",
              "&:hover": {
                backgroundColor: "var(--color-primary-light)",
                boxShadow: "none",
              },
              "&.Mui-disabled": {
                backgroundColor: "var(--color-border)",
                color: "var(--color-text-disabled)",
              },
            }}
          >
              {lawyer.isAvailable
              ? t("lawyer.book_now", "Book Now")
              : t("lawyer.unavailable", "Unavailable")}
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function LawyerSearch() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const prefersReducedMotion = useReducedMotion();
  const results = useSelector(selectLawyerResults);
  const loading = useSelector(selectSearchLoading);

  const [filters, setFilters] = useState({
    state: "",
    specialisations: [],
    language: "",
    maxFee: 2000,
    availableOnly: false,
  });
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const handleSearch = useCallback(() => {
    const params = { availableOnly: filters.availableOnly };
    if (filters.state) params.state = filters.state;
    if (filters.specialisations.length)
      params.specialisation = filters.specialisations[0];
    if (filters.maxFee < 2000) params.maxFee = filters.maxFee * 100;
    dispatch(searchLawyers(params));
    setSearched(true);
  }, [filters, dispatch]);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleBook = (lawyer) => {
    setSelectedLawyer(lawyer);
    setBookingOpen(true);
  };

  const toggleSpec = (s) => {
    setFilters((f) => ({
      ...f,
      specialisations: f.specialisations.includes(s)
        ? f.specialisations.filter((x) => x !== s)
        : [...f.specialisations, s],
    }));
  };

  return (
    <AnimatedPage>
      <Box
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          maxWidth: 1200,
          mx: "auto",
          pb: { xs: 10, md: 4 },
        }}
      >
        {/* Search filters */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              borderRadius: "12px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--color-text)",
                mb: 0.5,
              }}
            >
              {t("lawyer.search_title", "Find a Lawyer")}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "var(--color-text-secondary)", mb: 2.5 }}
            >
              {t(
                "lawyer.search_subtitle",
                "Compare advocates by practice area, state, and fee.",
              )}
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t("lawyer.states", "State")}
                  value={filters.state}
                  onChange={(e) => setFilter("state", e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: `${RADIUS.md}px`,
                      background: "var(--color-bg)",
                    },
                  }}
                >
                  <MenuItem value="">
                    {t("lawyer.all_states", "All States")}
                  </MenuItem>
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t("settings.language_section.title", "Language")}
                  value={filters.language}
                  onChange={(e) => setFilter("language", e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: `${RADIUS.md}px`,
                      background: "var(--color-bg)",
                    },
                  }}
                >
                  <MenuItem value="">
                    {t("lawyer.any_language", "Any Language")}
                  </MenuItem>
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l} value={l}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--color-text-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    {t("lawyer.max_fee", "Max Fee")}: ₹
                    {filters.maxFee === 2000 ? "Any" : filters.maxFee}
                  </Typography>
                  <Slider
                    value={filters.maxFee}
                    onChange={(_, v) => setFilter("maxFee", v)}
                    min={100}
                    max={2000}
                    step={100}
                    sx={{ color: "var(--color-primary)", mt: 0.5 }}
                  />
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
              {SPECIALISATIONS.map((s) => {
                const active = filters.specialisations.includes(s);
                return (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    clickable
                    onClick={() => toggleSpec(s)}
                    sx={{
                      fontWeight: active ? 700 : 500,
                      background: active
                        ? "var(--color-primary)"
                        : "var(--color-surface)",
                      color: active ? "var(--color-bg)" : "var(--color-text-secondary)",
                      border: active ? "none" : "1px solid var(--color-border)",
                      "&:hover": {
                        background: active
                          ? "var(--color-primary)"
                          : "var(--color-overlay)",
                      },
                    }}
                  />
                );
              })}
            </Box>

            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "var(--color-text-secondary)" }}
              >
                {searched &&
                  `${results.length} ${t("lawyer.found", "lawyers found")}`}
              </Typography>
              <Box>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleSearch}
                  disabled={loading}
                  sx={{
                    borderRadius: "8px",
                    fontWeight: 600,
                    boxShadow: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-bg)",
                    "&:hover": {
                      backgroundColor: "var(--color-primary-light)",
                      boxShadow: "none",
                    },
                  }}
                >
                  {loading
                    ? t("lawyer.searching", "Searching…")
                    : t("lawyer.search", "Search Lawyers")}
                </Button>
                {(filters.state ||
                  filters.specialisations.length > 0 ||
                  filters.language) && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() =>
                      setFilters({
                        state: "",
                        specialisations: [],
                        language: "",
                        maxFee: 2000,
                        availableOnly: false,
                      })
                    }
                    sx={{ color: "var(--color-text-secondary)" }}
                  >
                    {t("lawyer.clear", "Clear filters")}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* Results */}
        {loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Skeleton
                  variant="rectangular"
                  height={280}
                  sx={{ borderRadius: `${RADIUS.xl}px` }}
                />
              </Grid>
            ))}
          </Grid>
        ) : results.length === 0 && searched ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                mx: "auto",
                mb: 1.75,
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-secondary)",
              }}
            >
              <SearchRoundedIcon fontSize="small" />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: "var(--color-text)",
                mb: 0.75,
              }}
            >
              {t("lawyer.no_results", "No lawyers found")}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {t(
                "lawyer.try_broader",
                "Try broader filters or a different state.",
              )}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {results.map((lawyer, i) => (
              <Grid item xs={12} sm={6} md={4} key={lawyer.id || lawyer._id}>
                <LawyerCard
                  lawyer={lawyer}
                  onBook={handleBook}
                  delay={(i % 6) * 0.07}
                />
              </Grid>
            ))}
          </Grid>
        )}

        <ConsultationBooking
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          lawyer={selectedLawyer}
        />
      </Box>
    </AnimatedPage>
  );
}

export default LawyerSearch;
