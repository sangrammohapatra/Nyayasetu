/**
 * client/src/components/lawyer/LawyerSearch.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

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

import {
  searchLawyers,
  selectLawyerResults,
  selectLawyerLoading,
} from "../../store/slices/lawyerSlice";
import ConsultationBooking from "./ConsultationBooking";
import { RADIUS, SHADOWS } from "../../theme/tokens";
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
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Typography
          key={i}
          sx={{
            fontSize: 14,
            lineHeight: 1,
            color:
              i < full
                ? "#F59E0B"
                : i === full && half
                  ? "#F59E0B"
                  : "var(--color-border)",
          }}
        >
          {i < full ? "★" : i === full && half ? "⭐" : "☆"}
        </Typography>
      ))}
      {count !== undefined && (
        <Typography
          variant="caption"
          sx={{ color: "var(--color-text-secondary)", ml: 0.25 }}
        >
          ({count})
        </Typography>
      )}
    </Box>
  );
}

// ─── Lawyer card ──────────────────────────────────────────────────────────────
function LawyerCard({ lawyer, onBook, delay = 0 }) {
  const { t } = useTranslation();
  const feeRupees = lawyer.consultationFee
    ? Math.round(lawyer.consultationFee / 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38 }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
    >
      <Box
        sx={{
          p: 2.5,
          borderRadius: `${RADIUS.xl}px`,
          border: "1.5px solid var(--color-border)",
          background: "var(--color-surface)",
          boxShadow: SHADOWS.sm,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          height: "100%",
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:hover": {
            borderColor: "var(--color-primary)",
            boxShadow: SHADOWS.md,
          },
        }}
      >
        {/* Header row */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Avatar
            sx={{
              width: 52,
              height: 52,
              flexShrink: 0,
              background: "var(--color-primary)",
              fontWeight: 700,
              fontSize: "1.1rem",
              border: "2px solid var(--color-border)",
            }}
          >
            {(lawyer.name || "L").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                  color: "var(--color-text)",
                  lineHeight: 1.2,
                }}
              >
                {lawyer.name || "Advocate"}
              </Typography>
              {lawyer.isVerified && (
                <Tooltip title="Verified Advocate" arrow>
                  <Typography sx={{ fontSize: 16, mt: 0.5 }}>
                    <lord-icon
                      src="https://cdn.lordicon.com/lvrxlmju.json"
                      trigger="loop"
                      delay="500"
                      style={{
                        width: 23,
                        height: 23,
                        marginTop: 2,
                        color: "var(--color-primary)",
                      }}
                    ></lord-icon>
                  </Typography>
                </Tooltip>
              )}
              {lawyer.lawyerPlan === "firm" && (
                <Chip
                  label="🥇 FIRM"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    background: "rgba(245,158,11,0.15)",
                    color: "#B45309",
                  }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-secondary)", display: "block" }}
            >
              {lawyer.experience} {t("lawyer.experience", "years experience")}
            </Typography>
            <StarRating
              rating={lawyer.averageRating || 0}
              count={lawyer.totalRatings}
            />
          </Box>
        </Box>

        {/* Specialisations */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {(lawyer.specialisations || []).slice(0, 3).map((s) => (
            <Chip
              key={s}
              label={s}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.67rem",
                background: "var(--color-primary-alpha)",
                color: "var(--color-primary)",
                fontWeight: 600,
              }}
            />
          ))}
          {(lawyer.specialisations || []).length > 3 && (
            <Chip
              label={`+${lawyer.specialisations.length - 3}`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.67rem",
                background: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            />
          )}
        </Box>

        {/* States */}
        {lawyer.practicingStates?.length > 0 && (
          <Typography
            variant="caption"
            sx={{ color: "var(--color-text-secondary)" }}
          >
            📍 {lawyer.practicingStates.slice(0, 2).join(", ")}
            {lawyer.practicingStates.length > 2
              ? ` +${lawyer.practicingStates.length - 2}`
              : ""}
          </Typography>
        )}

        {/* Bio */}
        {lawyer.bio && (
          <Typography
            variant="caption"
            sx={{
              color: "var(--color-text-secondary)",
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

        {/* Fee + Book */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: "auto",
            pt: 1,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "var(--color-text-secondary)" }}
            >
              {t("lawyer.consult_fee", "Consultation Fee")}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 800,
                color: "var(--color-primary)",
                lineHeight: 1.1,
              }}
            >
              {feeRupees > 0 ? `₹${feeRupees}` : "Free"}
            </Typography>
          </Box>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => onBook(lawyer)}
              disabled={!lawyer.isAvailable}
              sx={{
                borderRadius: `${RADIUS.md}px`,
                fontWeight: 700,
                fontSize: "0.8rem",
                background: lawyer.isAvailable
                  ? "var(--color-primary)"
                  : "var(--color-border)",
                color: lawyer.isAvailable
                  ? "#fff"
                  : "var(--color-text-secondary)",
                "&:hover": {
                  background: lawyer.isAvailable
                    ? "var(--color-primary-dark, var(--color-primary))"
                    : undefined,
                },
                "&:disabled": {
                  background: "var(--color-border)",
                  color: "var(--color-text-secondary)",
                },
              }}
            >
              {lawyer.isAvailable
                ? t("lawyer.book_now", "Book Now")
                : t("lawyer.unavailable", "Unavailable")}
            </Button>
          </motion.div>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function LawyerSearch() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const results = useSelector(selectLawyerResults);
  const loading = useSelector(selectLawyerLoading);

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
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Box
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: `${RADIUS.xl}px`,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              boxShadow: SHADOWS.sm,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                color: "var(--color-text)",
                mb: 2,
              }}
            >
              🔍 {t("lawyer.search_title", "Find a Lawyer")}
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
                      color: active ? "#fff" : "var(--color-text-secondary)",
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
                  onClick={handleSearch}
                  disabled={loading}
                  sx={{
                    borderRadius: `${RADIUS.md}px`,
                    fontWeight: 700,
                    background: "var(--color-primary)",
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
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography sx={{ fontSize: 48, mb: 1.5 }}>🔍</Typography>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Playfair Display',serif",
                fontWeight: 700,
                color: "var(--color-text)",
                mb: 1,
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
