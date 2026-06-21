import React, { useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  InputBase,
  CircularProgress,
  Chip,
  Divider,
  Pagination,
  Paper,
} from "@mui/material";
import { Gavel, OpenInNew, Search } from "@mui/icons-material";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "../../services/api";
import AnimatedPage from "../../components/ui/AnimatedPage";
import GradientHeading from "../../components/ui/GradientHeading";
import { RADIUS, TYPOGRAPHY } from "../../theme/tokens";

const PAGE_SIZE = 10;

function ResultCard({ doc, index }) {
  const prefersReducedMotion = useReducedMotion();
  const date = doc.publishdate
    ? new Date(doc.publishdate).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Paper
        component="a"
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        elevation={0}
        sx={{
          display: "block",
          p: 2.5,
          mb: 1.5,
          borderRadius: `${RADIUS.lg}px`,
          border: "1.5px solid var(--color-border)",
          background: "var(--color-surface)",
          textDecoration: "none",
          cursor: "pointer",
          transition: "border-color 0.18s, box-shadow 0.18s",
          "&:hover": {
            borderColor: "var(--color-primary)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Gavel
            sx={{
              color: "var(--color-primary)",
              fontSize: 20,
              mt: 0.25,
              flexShrink: 0,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                mb: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--color-primary)",
                  lineHeight: 1.35,
                }}
              >
                {doc.title || "Untitled"}
              </Typography>
              <OpenInNew
                sx={{
                  fontSize: 14,
                  color: "var(--color-text-secondary)",
                  flexShrink: 0,
                }}
              />
            </Box>

            {doc.headline ? (
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  color: "var(--color-text-secondary)",
                  mb: 1,
                  lineHeight: 1.55,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.headline) }}
              />
            ) : null}

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {doc.doctype && (
                <Chip
                  label={doc.doctype}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    bgcolor: "var(--color-primary-alpha)",
                    color: "var(--color-primary)",
                    border: "none",
                  }}
                />
              )}
              {doc.court && (
                <Chip
                  label={doc.court}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    bgcolor: "transparent",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                />
              )}
              {date && (
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: "20px",
                  }}
                >
                  {date}
                </Typography>
              )}
              {doc.citation && (
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: "20px",
                  }}
                >
                  · {doc.citation}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </motion.div>
  );
}

export default function LawSearch() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const urlQuery = searchParams.get("q") || "";
  const urlPage = Math.max(0, parseInt(searchParams.get("page") || "0", 10));

  const [inputValue, setInputValue] = useState(urlQuery);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q, page) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/jurisdiction/laws/search", {
        params: { q: q.trim(), page },
      });
      setResults(data.results || []);
      setTotal(data.total || 0);
      setSearched(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Search failed. Please try again.",
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search when URL params change
  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery);
      doSearch(urlQuery, urlPage);
    }
  }, [urlQuery, urlPage, doSearch]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    setSearchParams({ q: inputValue.trim(), page: "0" });
  };

  const handlePageChange = (_, newPage) => {
    // MUI Pagination is 1-based; API is 0-based
    setSearchParams({ q: urlQuery, page: String(newPage - 1) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AnimatedPage>
      <Box sx={{ maxWidth: 800, mx: "auto", px: { xs: 2, md: 4 }, py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <GradientHeading
            variant="h4"
            sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 700,
              fontSize: { xs: "1.5rem", md: "1.9rem" },
              mb: 0.5,
            }}
          >
            {t("lawSearch.title", "Legal Search")}
          </GradientHeading>
          <Typography
            sx={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}
          >
            {t(
              "lawSearch.subtitle",
              "Search Indian Kanoon — case law, judgments, and legislation",
            )}
          </Typography>
        </Box>

        {/* Search bar */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            alignItems: "center",
            background: "var(--color-surface)",
            border: "2px solid var(--color-border)",
            borderRadius: `${RADIUS.full}px`,
            px: 2.5,
            py: 1,
            mb: 3,
            transition: "border-color 0.2s, box-shadow 0.2s",
            "&:focus-within": {
              borderColor: "var(--color-primary)",
              boxShadow: "0 0 0 3px var(--color-primary-alpha)",
            },
          }}
        >
          <Search
            sx={{ color: "var(--color-text-secondary)", mr: 1.5, fontSize: 20 }}
          />
          <InputBase
            autoFocus
            fullWidth
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t(
              "lawSearch.placeholder",
              "Search acts, judgments, sections…",
            )}
            sx={{ fontSize: "0.95rem", color: "var(--color-text)" }}
            inputProps={{ "aria-label": "search laws" }}
          />
          {loading && (
            <CircularProgress
              size={18}
              sx={{ color: "var(--color-primary)", ml: 1 }}
            />
          )}
        </Box>

        {/* Error */}
        {error && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: "rgba(211,47,47,0.08)",
              border: "1px solid rgba(211,47,47,0.2)",
            }}
          >
            <Typography sx={{ color: "#d32f2f", fontSize: "0.875rem" }}>
              {error}
            </Typography>
          </Box>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {searched && !loading && (
            <motion.div
              key={`${urlQuery}-${urlPage}`}
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {results.length > 0 ? (
                <>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.82rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {t("lawSearch.results", "{{count}} results for", {
                        count: total,
                      })}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      "{urlQuery}"
                    </Typography>
                  </Box>

                  {results.map((doc, i) => (
                    <ResultCard key={doc.docId || i} doc={doc} index={i} />
                  ))}

                  {totalPages > 1 && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", mt: 3 }}
                    >
                      <Pagination
                        count={totalPages}
                        page={urlPage + 1}
                        onChange={handlePageChange}
                        color="primary"
                        shape="rounded"
                        sx={{
                          "& .MuiPaginationItem-root": {
                            color: "var(--color-text)",
                          },
                          "& .Mui-selected": {
                            bgcolor: "var(--color-primary) !important",
                            color: "#fff",
                          },
                        }}
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Gavel
                    sx={{
                      fontSize: 48,
                      color: "var(--color-text-secondary)",
                      opacity: 0.35,
                      mb: 2,
                    }}
                  />
                  <Typography
                    sx={{
                      fontWeight: 600,
                      color: "var(--color-text)",
                      mb: 0.5,
                    }}
                  >
                    {t("lawSearch.no_results", "No results found")}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {t(
                      "lawSearch.try_broader",
                      "Try different keywords or an act name",
                    )}
                  </Typography>
                </Box>
              )}
            </motion.div>
          )}

          {!searched && !loading && (
            <motion.div
              key="empty"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Box sx={{ textAlign: "center", py: 8 }}>
                <Gavel
                  sx={{
                    fontSize: 56,
                    color: "var(--color-primary)",
                    opacity: 0.25,
                    mb: 2,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.9rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {t(
                    "lawSearch.hint",
                    "Enter a query above to search Indian case law and legislation",
                  )}
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </AnimatedPage>
  );
}
